import { test, expect } from '../fixtures.js'
import { contacts, profile } from '../../src/data/portfolio.js'

// Runs in the "mobile" project: a Pixel 7 with touch, held sideways, as phones drive the
// island in landscape with a steering wheel and pedals. Held upright, they're asked to turn.

test.describe('Phone held sideways', () => {
  test('shows the steering wheel and pedals instead of keyboard hints', { tag: '@smoke' }, async ({ portfolio }) => {
    await portfolio.startEngine()
    await expect(portfolio.wheel).toBeVisible()
    await expect(portfolio.gasPedal).toBeVisible()
    await expect(portfolio.brakePedal).toBeVisible()
    await expect(portfolio.driftPedal).toBeVisible()
    await expect(portfolio.keyboardHint).toBeHidden()
    await expect(portfolio.rotatePrompt).toBeHidden()
  })

  test('turning the wheel and holding Gas drives the car, and the wheel turns back when let go', { tag: '@smoke' }, async ({ portfolio }) => {
    await portfolio.startEngine()
    await portfolio.turnWheel(60)
    await expect(portfolio.wheel).toHaveAttribute('data-angle', '60')
    await expect(portfolio.speed).toHaveText('0') // a wheel alone doesn't move the car

    await portfolio.pressPedal(portfolio.gasPedal)
    await expect(portfolio.gasPedal).toHaveClass(/is-down/)
    // the speedometer is hidden on phones (the wheel's hub shows it), but it still tracks the car
    await expect.poll(async () => Number(await portfolio.speed.textContent())).toBeGreaterThan(5)

    await portfolio.liftFingers()
    await expect(portfolio.gasPedal).not.toHaveClass(/is-down/)
    await expect(portfolio.wheel).toHaveAttribute('data-angle', '0')
  })

  // The wheel steers the car: from the Contact drop-off, heading west, a gentle right turn
  // runs across the pad in front of my phone number (straight on, or left, misses it).
  test('the pad in front of my phone number shows the number on its card', async ({ portfolio }) => {
    const index = contacts.findIndex((contact) => contact.id === 'phone')
    await portfolio.startEngine()
    await portfolio.goTo('contact')
    await portfolio.expectPeekFor('contact')
    await portfolio.turnWheel(35)
    await portfolio.pressPedal(portfolio.gasPedal)
    const title = await portfolio.catchPeekTitle(`contact:${index}`)
    await portfolio.liftFingers()
    expect(title).toBe(contacts[index].value)
  })

  // A whole panel would cover half the screen, and the car with it.
  test('arriving in an area shows a small card at the top, clear of the wheel and pedals', { tag: '@smoke' }, async ({ portfolio, page }) => {
    await portfolio.startEngine()
    await portfolio.goTo('about')
    await portfolio.expectPeekFor('about')
    await expect(portfolio.peekTitle).toHaveText(`Hi, I’m ${profile.firstName}`)
    await page.waitForTimeout(400) // let the card slide in
    const card = await portfolio.peek.boundingBox()
    const wheel = await portfolio.wheel.boundingBox()
    const gas = await portfolio.gasPedal.boundingBox()
    expect(card.y + card.height).toBeLessThan(Math.min(wheel.y, gas.y))
    await expect(portfolio.gasPedal).toBeInViewport()
  })

  test('the card opens the panel down the right side, and the menu reaches every area', async ({ portfolio, page }) => {
    await portfolio.startEngine()
    // Contact is near the end of the menu, below the bottom of such a short screen
    await portfolio.goTo('contact')
    await portfolio.openPeek('contact')
    await expect(portfolio.peek).toBeHidden()
    await page.waitForTimeout(400) // let the slide-in animation finish
    const box = await portfolio.panel.boundingBox()
    const viewport = page.viewportSize()
    expect(box.x).toBeGreaterThan(viewport.width * 0.45)
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
    // the wheel stays in view on the left, so the car can drive off from there
    const wheel = await portfolio.wheel.boundingBox()
    expect(wheel.x + wheel.width).toBeLessThan(box.x)

    // the pedals sit below the minimap, not on top of it
    await portfolio.minimisePanelButton.click()
    await portfolio.expectPeekFor('contact')
    const minimap = await page.locator('#minimap').boundingBox()
    for (const pedal of [portfolio.gasPedal, portfolio.brakePedal, portfolio.driftPedal]) {
      const pedalBox = await pedal.boundingBox()
      expect(pedalBox.y).toBeGreaterThan(minimap.y + minimap.height)
    }
  })

  test('taking the wheel folds the open panel back into its card', async ({ portfolio }) => {
    await portfolio.startEngine()
    await portfolio.goTo('contact')
    await portfolio.openPeek('contact')
    // no Enter key on a phone, so no "press Enter" tip either
    await expect(portfolio.panel.locator('.for-keys')).toBeHidden()
    await expect(portfolio.panel.getByText('Park on a pad, or tap a link below.')).toBeVisible()

    await portfolio.turnWheel(0)
    await portfolio.expectPeekFor('contact')
    await portfolio.liftFingers()
  })

  test('a board picked from an open panel arrives with its panel open', async ({ portfolio }) => {
    await portfolio.startEngine()
    await portfolio.goTo('projects')
    await portfolio.openPeek('projects')
    await portfolio.panel.locator('[data-jump="project:0"]').click()
    await portfolio.expectPanelFor('project:0')
    await expect(portfolio.peek).toBeHidden()
  })
})

test.describe('Small phone held sideways', () => {
  // narrower than the 760px the top bar needs for its "Classic view" button
  test.use({ viewport: { width: 667, height: 320 }, screen: { width: 667, height: 375 } })

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
})

test.describe('Phone held upright', () => {
  // the same Pixel 7, the right way up
  test.use({ viewport: { width: 412, height: 839 }, screen: { width: 412, height: 915 } })

  test('the island waits for the phone to be turned sideways', { tag: '@smoke' }, async ({ portfolio, page }) => {
    await portfolio.startEngine()
    await expect(portfolio.rotatePrompt).toBeVisible()
    await expect(portfolio.rotatePrompt.getByRole('heading')).toHaveText('Turn your phone sideways')
    // the world is paused behind the prompt
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(500)
    await expect(portfolio.speed).toHaveText('0')
    await page.keyboard.up('KeyW')

    await page.setViewportSize({ width: 839, height: 412 })
    await expect(portfolio.rotatePrompt).toBeHidden()
    await portfolio.pressPedal(portfolio.gasPedal)
    await expect.poll(async () => Number(await portfolio.speed.textContent())).toBeGreaterThan(5)
    await portfolio.liftFingers()
  })

  test('the prompt to turn sideways offers the classic view instead', async ({ portfolio }) => {
    await portfolio.startEngine()
    await portfolio.rotateClassicButton.click()
    await expect(portfolio.classic).toBeVisible()
    await portfolio.backToIslandButton.click()
    await expect(portfolio.rotatePrompt).toBeVisible()
  })

  test('the classic page shows my name first, before the 3D character', async ({ portfolio }) => {
    await portfolio.open()
    await portfolio.introClassicButton.click()
    await expect(portfolio.classicName).toBeInViewport()
    const name = await portfolio.classicName.boundingBox()
    const robot = await portfolio.classicRobot.boundingBox()
    expect(name.y).toBeLessThan(robot.y)
  })
})

// A narrow browser window with a mouse: no wheel, and no prompt to turn (it's not a phone).
test.describe('Narrow browser window', () => {
  test.use({ viewport: { width: 412, height: 839 }, isMobile: false, hasTouch: false })

  test('the card opens the panel as a bottom sheet, and Minimise folds it back', async ({ portfolio, page }) => {
    await portfolio.startEngine()
    await expect(portfolio.rotatePrompt).toBeHidden()
    await expect(portfolio.wheel).toBeHidden()
    await portfolio.goTo('about')
    await portfolio.openPeek('about')
    await expect(portfolio.peek).toBeHidden()
    await page.waitForTimeout(400) // let the slide-in animation finish
    const box = await portfolio.panel.boundingBox()
    const viewport = page.viewportSize()
    expect(box.y + box.height).toBeGreaterThan(viewport.height - 40)
    expect(box.width).toBeGreaterThan(viewport.width - 40)

    await portfolio.minimisePanelButton.click()
    await portfolio.expectPeekFor('about')
  })
})
