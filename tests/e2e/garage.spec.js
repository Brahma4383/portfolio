import { test, expect } from '../fixtures.js'
import { cars, DEFAULT_CAR } from '../../src/data/cars.js'

test.describe('Garage and car switching', () => {
  test('the picker lists every car and switches instantly from anywhere', { tag: '@smoke' }, async ({ portfolio, page }) => {
    await portfolio.startEngine()
    await portfolio.carButton.click()
    await expect(portfolio.cars).toBeVisible()
    await expect(portfolio.cars.locator('[data-car]')).toHaveCount(cars.length)
    await expect(portfolio.cars.locator(`[data-car="${DEFAULT_CAR}"]`)).toHaveAttribute('aria-pressed', 'true')

    await portfolio.cars.locator('[data-car="jeep"]').click()
    await expect(portfolio.cars).toBeHidden()
    await expect(portfolio.toast).toHaveText('Now driving the Jeep')
    await portfolio.carButton.click()
    await expect(portfolio.cars.locator('[data-car="jeep"]')).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Escape')
    await expect(portfolio.cars).toBeHidden()
  })

  test('C opens the picker and the choice survives a reload', async ({ portfolio, page }) => {
    await portfolio.startEngine()
    await page.keyboard.press('KeyC')
    await expect(portfolio.cars).toBeVisible()
    await portfolio.cars.locator('[data-car="limo"]').click()
    await expect(portfolio.toast).toHaveText('Now driving the Limo')

    await page.reload()
    await portfolio.waitUntilLoaded()
    await portfolio.startButton.click()
    await portfolio.carButton.click()
    await expect(portfolio.cars.locator('[data-car="limo"]')).toHaveAttribute('aria-pressed', 'true')
  })

  test('the Garage has a board and pad for every car; parking on a pad switches to it', async ({ portfolio, page }) => {
    await portfolio.startEngine()
    await portfolio.goTo('garage')
    await portfolio.expectPanelFor('garage')
    await expect(portfolio.panelHeading).toHaveText('Pick a car')
    await expect(portfolio.panel.locator('.list li')).toHaveCount(cars.length)

    // from the entrance the car faces straight up the middle column; the front row's
    // middle pad belongs to the Bug (car 8), so driving ahead parks on it
    await page.keyboard.press('Escape')
    await page.keyboard.down('KeyW')
    await expect(portfolio.panel).toHaveAttribute('data-trigger', 'car:bug', { timeout: 8_000 })
    await page.keyboard.up('KeyW')
    await expect(portfolio.toast).toHaveText('Now driving the Bug')
    await expect(portfolio.panel).toContainText('You’re driving it now.')

    await portfolio.carButton.click()
    await expect(portfolio.cars.locator('[data-car="bug"]')).toHaveAttribute('aria-pressed', 'true')
  })

  test('the Garage is not one of the portfolio areas, so it does not count as explored', async ({ portfolio }) => {
    await portfolio.startEngine()
    await portfolio.goTo('garage')
    await portfolio.expectPanelFor('garage')
    await expect(portfolio.explored).toContainText('0 /')
  })
})
