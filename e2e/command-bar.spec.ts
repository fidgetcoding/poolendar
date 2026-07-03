import { test, expect } from '@playwright/test'

const E2E_LIVE = !!process.env.E2E_BASE

test.describe('command bar (#72a–c)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!E2E_LIVE, 'requires a live Supabase stack (set E2E_BASE)')
    await page.goto('/')
  })

  test('⌘K opens the palette with the master prompt', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    await expect(page.getByPlaceholder(/what do you need/i)).toBeVisible()
  })

  test('actions are grouped and dispatch — Open Kanban switches to board', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    await expect(page.getByText('Actions', { exact: true })).toBeVisible()
    await expect(page.getByText('Navigation', { exact: true })).toBeVisible()
    await page.getByText('Open Kanban Board').click()
    await expect(page.getByText('Backlog', { exact: false })).toBeVisible()
  })

  test('Go to Today action closes the palette', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    await page.getByText('Go to Today').click()
    await expect(page.getByPlaceholder(/what do you need/i)).toBeHidden()
  })

  test('typing a query shows grouped search results', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    await page.getByPlaceholder(/what do you need/i).fill('meeting')
    await expect(page.getByText(/search results/i)).toBeVisible({ timeout: 5000 })
  })
})
