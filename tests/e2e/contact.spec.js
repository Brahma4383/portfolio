import { test, expect } from '../fixtures.js'
import { contacts } from '../../src/data/portfolio.js'

const phone = contacts.find((contact) => contact.id === 'phone')

test.describe('Contact', () => {
  // Data-driven: one row per contact in portfolio.js. The resume row has its own
  // View and Download links, checked in resume.spec.js.
  test('the Contact panel lists every way to reach me, phone number included', async ({ portfolio }) => {
    await portfolio.startEngine()
    await portfolio.goTo('contact')
    await portfolio.expectPanelFor('contact')
    for (const contact of contacts.filter((c) => c.id !== 'resume')) {
      const row = portfolio.panel.locator(`.links a[href="${contact.href}"]`)
      await expect(row).toHaveCount(1)
      await expect(row).toContainText(contact.label)
      await expect(row).toContainText(contact.value)
    }
  })

  test.describe('with clipboard access', () => {
    test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

    test('Copy puts my phone number on the clipboard', async ({ portfolio, page }) => {
      await portfolio.startEngine()
      await portfolio.goTo('contact')
      await portfolio.expectPanelFor('contact')
      const copy = portfolio.copyButton(portfolio.panel)
      await expect(copy).toHaveText('Copy')
      await copy.click()
      await expect(copy).toHaveText('Copied ✓')
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(phone.value)
      // and back again a moment later
      await expect(copy).toHaveText('Copy', { timeout: 4_000 })
    })
  })
})
