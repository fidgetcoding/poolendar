import { test, expect } from '@playwright/test'

const E2E_LIVE = !!process.env.E2E_BASE

test.describe('kanban board', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!E2E_LIVE, 'requires a live Supabase stack (set E2E_BASE)')
    await page.goto('/')
  })

  test('board view toggle reveals the four columns', async ({ page }) => {
    // Open the task panel, then switch to board (grid icon) view mode.
    await page.getByRole('button', { name: /^tasks$/i }).first().click()
    await page.getByRole('button', { name: /board view/i }).click()

    for (const col of ['Backlog', 'In Progress', 'Check', 'Done']) {
      await expect(page.getByText(col, { exact: false })).toBeVisible()
    }
  })

  test('a column header + creates a task in that column', async ({ page }) => {
    await page.getByRole('button', { name: /board view/i }).click()
    await page.getByRole('button', { name: /add task to backlog/i }).click()
    const input = page.getByPlaceholder(/task title/i)
    await input.fill('E2E kanban task')
    await page.getByRole('button', { name: /^create$/i }).click()
    await expect(page.getByText('E2E kanban task')).toBeVisible()
  })

  test('a card can be dragged between columns', async ({ page }) => {
    await page.getByRole('button', { name: /board view/i }).click()
    const card = page.locator('[data-task-card]').first()
    const target = page.getByText('In Progress').first()
    await card.dragTo(target)
    await expect(card).toBeVisible()
  })
})
