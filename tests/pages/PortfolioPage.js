import { expect } from '@playwright/test'

// Page object for the portfolio: every selector lives here, so the specs read
// like test cases and a markup change only needs fixing in one place.
export class PortfolioPage {
  constructor(page) {
    this.page = page

    // start screen
    this.intro = page.locator('#intro')
    this.introName = page.locator('#intro-title')
    this.startButton = page.locator('#start-button')
    this.introClassicButton = page.locator('#intro-classic')

    // HUD
    this.hud = page.locator('#hud')
    this.explored = page.locator('#explored')
    this.menuButton = page.getByRole('button', { name: 'Jump to a section' })
    this.menu = page.locator('#menu')
    // phones only; exact, as the start screen's "Prefer a simple page? Open the classic view"
    // is still fading out (and so still matches) for a moment after Start
    this.menuClassicButton = page.getByRole('button', { name: 'Open the classic view', exact: true })
    this.carButton = page.getByRole('button', { name: 'Switch car' })
    this.cars = page.locator('#cars')
    this.nightButton = page.locator('#night-button')
    this.soundButton = page.locator('#sound-button')
    this.classicButton = page.getByRole('button', { name: 'Classic view', exact: true })
    this.speed = page.locator('#speed')
    this.toast = page.locator('#toast')
    this.touchControls = page.locator('.touch')
    this.keyboardHint = page.locator('.hint__keys')
    // touch screens: the steering wheel (its data-angle is how far it's turned) and the pedals
    this.wheel = page.locator('#wheel')
    this.gasPedal = page.getByRole('button', { name: 'Gas', exact: true })
    this.brakePedal = page.getByRole('button', { name: 'Brake', exact: true })
    this.driftPedal = page.getByRole('button', { name: 'Drift', exact: true })
    // phones held upright: the prompt to turn sideways
    this.rotatePrompt = page.locator('#rotate')
    this.rotateClassicButton = page.getByRole('button', { name: 'Or read the classic view' })

    // info panel
    this.panel = page.locator('#panel')
    this.panelHeading = this.panel.locator('h2')
    this.closePanelButton = page.getByRole('button', { name: 'Close panel' })
    // phones: the small card an area shows while driving, and the button that folds the panel back into it
    this.peek = page.locator('#peek')
    this.peekTitle = this.peek.locator('.peek__title')
    this.minimisePanelButton = page.getByRole('button', { name: 'Minimise panel' })

    // classic page
    this.classic = page.locator('#classic')
    this.backToIslandButton = this.classic.getByRole('button', { name: 'Back to the island' })
    this.classicName = this.classic.locator('h1')
    this.classicRobot = this.classic.locator('.robot')
  }

  async open() {
    // './' rather than '/', so it also works when the site lives in a folder
    // (the live site is at /portfolio/)
    await this.page.goto('./')
  }

  async waitUntilLoaded() {
    // Building the island takes a few seconds on slow (software-rendered) machines,
    // and longer on CI, which has no GPU at all.
    await expect(this.startButton).toBeEnabled({ timeout: process.env.CI ? 90_000 : 45_000 })
  }

  async startEngine() {
    await this.open()
    await this.waitUntilLoaded()
    await this.startButton.click()
    await expect(this.hud).toBeVisible()
  }

  // Uses the "Jump to" menu. `id` is a zone id from layout.js, 'spawn' or 'bowling'.
  async goTo(id) {
    await this.menuButton.click()
    await this.menu.locator(`[data-teleport="${id}"]`).click()
  }

  async expectPanelFor(triggerId) {
    await expect(this.panel).toBeVisible()
    await expect(this.panel).toHaveAttribute('data-trigger', triggerId)
  }

  // Phones: the area shows only its card; the panel itself stays closed.
  async expectPeekFor(triggerId) {
    await expect(this.peek).toBeVisible()
    await expect(this.panel).toHaveAttribute('data-trigger', triggerId)
    await expect(this.panel).toBeHidden()
  }

  // Phones: tap the area's card to open its panel.
  async openPeek(triggerId) {
    await this.expectPeekFor(triggerId)
    await this.peek.click()
    await this.expectPanelFor(triggerId)
    await expect(this.panel).toHaveClass(/is-open/)
  }

  // ---------- touch: several fingers at once ----------
  // Playwright's own touchscreen can only tap, and driving takes two thumbs (one on the
  // wheel, one on a pedal), so fingers are put down through the Chrome DevTools Protocol.
  // Each event lists every finger still down, as a real touch screen reports them.

  async sendTouch(type) {
    this.cdp ??= await this.page.context().newCDPSession(this.page)
    const touchPoints = [...this.fingers.values()]
    await this.cdp.send('Input.dispatchTouchEvent', { type, touchPoints })
  }

  async fingerDown(name, x, y) {
    this.fingers ??= new Map()
    this.fingers.set(name, { x, y, id: this.fingers.size + 1 })
    await this.sendTouch('touchStart')
  }

  async fingerMove(name, x, y) {
    Object.assign(this.fingers.get(name), { x, y })
    await this.sendTouch('touchMove')
  }

  async liftFingers() {
    this.fingers?.clear()
    await this.sendTouch('touchEnd')
  }

  // Phones: put a thumb on the top of the wheel's rim and turn it `degrees` clockwise
  // (negative: anticlockwise). It stays there, holding the wheel, until liftFingers().
  async turnWheel(degrees) {
    // wait for the wheel to finish gliding in, or its centre is still moving
    await expect(this.wheel).toHaveCSS('opacity', '1')
    const box = await this.wheel.boundingBox()
    const radius = box.width * 0.4
    const onRim = (angle) => {
      const radians = ((angle - 90) * Math.PI) / 180
      return [box.x + box.width / 2 + radius * Math.cos(radians), box.y + box.height / 2 + radius * Math.sin(radians)]
    }
    await this.fingerDown('wheel', ...onRim(0))
    const steps = Math.ceil(Math.abs(degrees) / 5)
    for (let step = 1; step <= steps; step++) await this.fingerMove('wheel', ...onRim((degrees * step) / steps))
  }

  // Phones: hold a pedal (this.gasPedal, this.brakePedal or this.driftPedal) down until liftFingers().
  async pressPedal(pedal) {
    const box = await pedal.boundingBox()
    await this.fingerDown(await pedal.textContent(), box.x + box.width / 2, box.y + box.height / 2)
  }

  // Projects panel → "jump to board" button for one project.
  async goToProject(index) {
    await this.goTo('projects')
    await this.expectPanelFor('projects')
    await this.panel.locator(`[data-jump="project:${index}"]`).click()
    await this.expectPanelFor(`project:${index}`)
  }

  resumeLink(scope, kind) {
    return scope.locator(`[data-resume="${kind}"]`).first()
  }

  // A "Copy" button (the phone number). Found by its data, as its text changes when clicked.
  copyButton(scope) {
    return scope.locator('[data-copy]').first()
  }

  // Phones: waits for the car to be on `triggerId` and returns the card's title at that
  // moment. Checked every frame, so it catches spots the car only drives across.
  async catchPeekTitle(triggerId) {
    const title = await this.page.waitForFunction(
      (id) => document.querySelector('#panel').dataset.trigger === id && document.querySelector('#peek-title').textContent,
      triggerId,
      { polling: 'raf', timeout: 15_000 },
    )
    return title.jsonValue()
  }
}
