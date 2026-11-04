import { test as base, expect } from '@playwright/test'
import { PortfolioPage } from './pages/PortfolioPage.js'

export const test = base.extend({
  // Every test fails if the page logs an error or throws an uncaught exception.
  consoleErrors: [
    async ({ page }, use) => {
      const errors = []
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
      })
      page.on('pageerror', (error) => errors.push(error.message))
      await use(errors)
      expect(errors, 'the page should not log errors').toEqual([])
    },
    { auto: true },
  ],

  // External sites are stubbed so the suite never depends on GitHub or LinkedIn being reachable.
  stubExternalSites: [
    async ({ context }, use) => {
      await context.route(/^https:\/\/(github\.com|www\.linkedin\.com)\//, (route) =>
        route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>stub</h1>' }),
      )
      await use()
    },
    { auto: true },
  ],

  portfolio: async ({ page }, use) => {
    await use(new PortfolioPage(page))
  },
})

export { expect }
