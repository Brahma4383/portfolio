import { test, expect } from '../fixtures.js'

// GitHub Pages serves public/404.html for any address on the site that doesn't exist.
test.describe('Missing pages', () => {
  test('the 404 page says so and links back to the portfolio', { tag: '@smoke' }, async ({ page, request }) => {
    // it should send people to the address the home page calls its own
    const home = (await (await request.get('./')).text()).match(/<link\s+rel="canonical"\s+href="([^"]+)"/)[1]

    await page.goto('404.html')
    await expect(page).toHaveTitle(/Page not found/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Wrong turn')
    await expect(page.getByRole('link', { name: 'Back to the portfolio' })).toHaveAttribute('href', home)
  })

  test('a missing address answers 404 with that page', { tag: '@smoke' }, async ({ request, baseURL }) => {
    // the local preview server answers every address with the site itself, so this
    // only means something against the live site
    test.skip(new URL(baseURL).hostname === 'localhost', 'only GitHub Pages serves 404.html')
    const response = await request.get('no-such-page')
    expect(response.status()).toBe(404)
    expect(await response.text()).toContain('Wrong turn')
  })
})
