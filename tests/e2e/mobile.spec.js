import { test, expect } from '../fixtures.js'

// Runs in the "mobile" project (Pixel 7 emulation with touch).
test.describe('Phone layout', () => {
  test('shows touch controls instead of keyboard hints', { tag: '@smoke' }, async ({ portfolio, page }) => {
    await portfolio.startEngine()
    await expect(page.getByRole('button', { name: 'Drift' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Brake' })).toBeVisible()
    await expect(portfolio.keyboardHint).toBeHidden()
  })

  test('info panels open as a bottom sheet', async ({ portfolio, page }) => {
    await portfolio.startEngine()
    await portfolio.goTo('about')
    await portfolio.expectPanelFor('about')
    await expect(portfolio.panel).toHaveClass(/is-open/)
    await page.waitForTimeout(400) // let the slide-in animation finish
    const box = await portfolio.panel.boundingBox()
    const viewport = page.viewportSize()
    expect(box.y + box.height).toBeGreaterThan(viewport.height - 40)
    expect(box.width).toBeGreaterThan(viewport.width - 40)
  })

  test('the menu opens the classic view, as the top bar has no room for its button', async ({ portfolio }) => {
    await portfolio.startEngine()
    await expect(portfolio.classicButton).toBeHidden()
    await portfolio.menuButton.click()
    await portfolio.menuClassicButton.click()
    await expect(portfolio.classic).toBeVisible()
    await expect(portfolio.menu).toBeHidden()
    await portfolio.backToIslandButton.click()
    await expect(portfolio.hud).toBeVisible()
  })

  test('the classic page shows my name first, before the 3D character', async ({ portfolio }) => {
    await portfolio.open()
    await portfolio.introClassicButton.click()
    await expect(portfolio.classicName).toBeInViewport()
    const name = await portfolio.classicName.boundingBox()
    const robot = await portfolio.classicRobot.boundingBox()
    expect(name.y).toBeLessThan(robot.y)
  })

  test('dragging the joystick drives the car', async ({ portfolio, page }) => {
    await portfolio.startEngine()
    const zone = await portfolio.joystickZone.boundingBox()
    const x = zone.x + zone.width / 2
    const y = zone.y + zone.height * 0.6
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x, y - 50, { steps: 5 })
    await expect(page.locator('#joystick')).toHaveClass(/is-active/)
    // the speedometer is hidden on phones, but it still tracks the car's speed
    await expect.poll(async () => Number(await portfolio.speed.textContent())).toBeGreaterThan(5)
    await page.mouse.up()
    await expect(page.locator('#joystick')).not.toHaveClass(/is-active/)
  })
})
