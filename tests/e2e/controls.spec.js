import { test, expect } from '../fixtures.js'

test.describe('Controls', () => {
  test('N switches between day and night', async ({ portfolio, page }) => {
    await portfolio.startEngine()
    await expect(portfolio.nightButton).toHaveAttribute('aria-pressed', 'false')
    await page.keyboard.press('KeyN')
    await expect(portfolio.nightButton).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('KeyN')
    await expect(portfolio.nightButton).toHaveAttribute('aria-pressed', 'false')
  })

  test('the sound setting is remembered after a reload', async ({ portfolio, page }) => {
    await portfolio.startEngine()
    await expect(portfolio.soundButton).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('KeyM')
    await expect(portfolio.soundButton).toHaveAttribute('aria-pressed', 'false')
    await page.reload()
    await portfolio.waitUntilLoaded()
    await expect(portfolio.soundButton).toHaveAttribute('aria-pressed', 'false')
  })

  test('Escape closes the info panel', async ({ portfolio, page }) => {
    await portfolio.startEngine()
    await portfolio.goTo('about')
    await portfolio.expectPanelFor('about')
    await page.keyboard.press('Escape')
    await expect(portfolio.panel).toBeHidden()
  })

  test('R takes the car back to the start', async ({ portfolio, page }) => {
    await portfolio.startEngine()
    await portfolio.goTo('experience')
    await portfolio.expectPanelFor('experience')
    await page.keyboard.press('KeyR')
    await expect(portfolio.panel).toBeHidden()
  })

  test('holding W makes the car move', { tag: '@smoke' }, async ({ portfolio, page }) => {
    await portfolio.startEngine()
    await expect(portfolio.speed).toHaveText('0')
    await page.keyboard.down('KeyW')
    await expect.poll(async () => Number(await portfolio.speed.textContent())).toBeGreaterThan(5)
    await page.keyboard.up('KeyW')
  })
})
