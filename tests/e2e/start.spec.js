import { test, expect } from '../fixtures.js'
import { ZONES } from '../../src/world/layout.js'
import { profile } from '../../src/data/portfolio.js'

test.describe('Start screen', () => {
  test('shows my name, role and an enabled start button', { tag: '@smoke' }, async ({ page, portfolio }) => {
    await portfolio.open()
    await expect(page).toHaveTitle(`${profile.name} — ${profile.role}`)
    await expect(portfolio.introName).toHaveText(profile.name)
    await expect(page.locator('.intro__role')).toContainText(profile.role)
    await portfolio.waitUntilLoaded()
    await expect(portfolio.startButton).toHaveText('Start the engine')
  })

  test('starting the engine opens the HUD with nothing explored yet', { tag: '@smoke' }, async ({ portfolio }) => {
    await portfolio.startEngine()
    await expect(portfolio.intro).toBeHidden()
    await expect(portfolio.explored).toHaveText(`0 / ${ZONES.length} explored`)
    await expect(portfolio.toast).toHaveText('Drive into an area to read about it')
  })

  test('every visible button has an accessible name', async ({ page, portfolio }) => {
    await portfolio.startEngine()
    const unnamed = await page.locator('button:visible').evaluateAll((buttons) =>
      buttons.filter((b) => !(b.getAttribute('aria-label') || b.textContent.trim() || b.title)).map((b) => b.outerHTML),
    )
    expect(unnamed).toEqual([])
  })
})
