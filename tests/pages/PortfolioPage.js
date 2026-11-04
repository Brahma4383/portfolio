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
    this.carButton = page.getByRole('button', { name: 'Switch car' })
    this.cars = page.locator('#cars')
    this.nightButton = page.locator('#night-button')
    this.soundButton = page.locator('#sound-button')
    this.classicButton = page.getByRole('button', { name: 'Classic view', exact: true })
    this.speed = page.locator('#speed')
    this.toast = page.locator('#toast')
    this.touchControls = page.locator('.touch')
    this.keyboardHint = page.locator('.hint__keys')
    this.joystickZone = page.locator('#joystick-zone')

    // info panel
    this.panel = page.locator('#panel')
    this.panelHeading = this.panel.locator('h2')
    this.closePanelButton = page.getByRole('button', { name: 'Close panel' })

    // classic page
    this.classic = page.locator('#classic')
    this.backToIslandButton = this.classic.getByRole('button', { name: 'Back to the island' })
  }

  async open() {
    await this.page.goto('/')
  }

  async waitUntilLoaded() {
    // Building the island takes a few seconds on slow (software-rendered) machines.
    await expect(this.startButton).toBeEnabled({ timeout: 45_000 })
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
}
