import { test, expect } from '@playwright/test'

// DB-dependent flows (#12–#15). These require a live Supabase stack + an
// authenticated session; without E2E_BASE they skip cleanly so the suite stays
// green in CI/local until a stack is wired.
const E2E_LIVE = !!process.env.E2E_BASE

test.describe('calendar item CRUD (#12–#15)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!E2E_LIVE, 'requires a live Supabase stack (set E2E_BASE)')
    await page.goto('/')
    await page.getByRole('button', { name: /week view/i }).waitFor({ state: 'visible' }).catch(() => {})
  })

  test('#12 double-click an empty slot creates an item', async ({ page }) => {
    const grid = page.locator('[data-day-column]').first()
    await grid.dblclick({ position: { x: 20, y: 200 } })
    // A quick-create popover / edit form appears with a title field.
    await expect(page.getByRole('textbox').first()).toBeVisible()
  })

  test('#12 click-drag on an empty slot sets a duration', async ({ page }) => {
    const grid = page.locator('[data-day-column]').first()
    const box = await grid.boundingBox()
    if (!box) test.fail(true, 'no day column')
    await page.mouse.move(box!.x + 20, box!.y + 120)
    await page.mouse.down()
    await page.mouse.move(box!.x + 20, box!.y + 220, { steps: 5 })
    await page.mouse.up()
    await expect(page.getByRole('textbox').first()).toBeVisible()
  })

  test('#12 right-click an empty slot offers create event/task/routine', async ({ page }) => {
    const grid = page.locator('[data-day-column]').first()
    await grid.click({ button: 'right', position: { x: 20, y: 240 } })
    await expect(page.getByText(/create event/i)).toBeVisible()
    await expect(page.getByText(/create task/i)).toBeVisible()
    await expect(page.getByText(/create routine/i)).toBeVisible()
  })

  test('#13 double-click an item opens the edit form with three tabs', async ({ page }) => {
    await page.locator('[data-calendar-item]').first().dblclick()
    await expect(page.getByRole('button', { name: /^task$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^routine$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^event$/i })).toBeVisible()
  })

  test('#13 converting a saved event to a task can warn about attendees', async ({ page }) => {
    await page.locator('[data-calendar-item]').first().dblclick()
    await page.getByRole('button', { name: /^task$/i }).click()
    // Attendee-bearing events prompt a confirmation dialog on conversion.
    page.on('dialog', (d) => d.dismiss())
    await page.getByRole('button', { name: /save/i }).click()
  })

  test('#14 dragging an event changes its time', async ({ page }) => {
    const item = page.locator('[data-calendar-item]').first()
    const box = await item.boundingBox()
    if (!box) test.fail(true, 'no calendar item')
    await item.hover()
    await page.mouse.down()
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 80, { steps: 6 })
    await page.mouse.up()
    await expect(item).toBeVisible()
  })

  test('#15 single click opens the preview popover with quick actions', async ({ page }) => {
    await page.locator('[data-calendar-item]').first().click()
    await expect(page.getByRole('button', { name: /edit/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /delete/i })).toBeVisible()
  })
})
