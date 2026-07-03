import { test, expect } from '@playwright/test'
import { SEED } from './seed'

// External booking happy path (#57b). Visits the path-based public booking page
// /book/{slug} for the seeded public link, picks a date + time slot, submits the
// form, and lands on the confirmation. Requires a live Supabase stack + the
// seeded baseline (seed.setup.ts); skips cleanly without E2E_BASE.
const E2E_LIVE = !!process.env.E2E_BASE

test.describe('external booking page (#57b)', () => {
  test.beforeEach(() => {
    test.skip(!E2E_LIVE, 'requires a live Supabase stack (set E2E_BASE)')
  })

  test('book a slot end-to-end on /book/{slug}', async ({ page }) => {
    await page.goto(`/book/${SEED.bookingSlug}`)

    // The link resolved (not the "Page Not Found" error state): the link name
    // and duration render in the header.
    await expect(page.getByText(SEED.bookingLinkName)).toBeVisible()
    await expect(page.getByText(/30 min/i)).toBeVisible()

    // Pick the first selectable (available, future) day in the month grid.
    const dayButton = page.locator('button[aria-label*=", 20"]:not([disabled])').first()
    await dayButton.waitFor({ state: 'visible' })
    await dayButton.click()

    // Slots load asynchronously; pick the first time-slot button (e.g. "9:00 AM").
    const slotButton = page.getByRole('button', { name: /^\d{1,2}:\d{2}(\s?[AP]M)?$/i }).first()
    await slotButton.waitFor({ state: 'visible' })
    await slotButton.click()

    // The details form appears.
    await expect(page.getByText('Your details')).toBeVisible()
    await page.getByLabel('Your name').fill('E2E Booker')
    await page.getByLabel('Email address').fill('e2e-booker@example.com')
    await page.getByRole('button', { name: /confirm booking/i }).click()

    // Confirmation screen (auto-approve link → immediately confirmed).
    await expect(page.getByRole('heading', { name: /booking confirmed/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /add to google calendar/i })).toBeVisible()
  })
})
