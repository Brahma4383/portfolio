import { test, expect } from '../fixtures.js'
import { projects } from '../../src/data/portfolio.js'

test.describe('Projects', () => {
  test('the Projects panel lists every project', async ({ portfolio }) => {
    await portfolio.startEngine()
    await portfolio.goTo('projects')
    await portfolio.expectPanelFor('projects')
    await expect(portfolio.panel.locator('[data-jump]')).toHaveCount(projects.length)
  })

  // Data-driven: one test per project in portfolio.js.
  projects.forEach((project, index) => {
    test(`project ${index + 1} (${project.name}) shows how it was built, then how it was tested`, async ({ portfolio }) => {
      await portfolio.startEngine()
      await portfolio.goToProject(index)
      await expect(portfolio.panelHeading).toHaveText(project.name)

      const phases = portfolio.panel.locator('.phase')
      await expect(phases).toHaveCount(2)
      await expect(phases.nth(0).locator('.phase__label')).toHaveText(/Built with/)
      await expect(phases.nth(1).locator('.phase__label')).toHaveText(/Tested with/)
      await expect(phases.nth(0)).toContainText(project.built.text)
      await expect(phases.nth(1)).toContainText(project.tested.text)
      await expect(phases.nth(0).locator('.chips li')).toHaveText(project.built.stack)
      await expect(phases.nth(1).locator('.chips li')).toHaveText(project.tested.stack)

      await expect(portfolio.panel.getByRole('link', { name: /See my GitHub/ })).toHaveAttribute('href', project.link)
    })
  })

  test('the classic page shows every project in the same two steps', async ({ portfolio }) => {
    await portfolio.open()
    await portfolio.introClassicButton.click()
    const cards = portfolio.classic.locator('.project-list .project-card')
    await expect(cards).toHaveCount(projects.length)
    for (const [index, project] of projects.entries()) {
      const card = cards.nth(index)
      await expect(card.getByRole('heading', { level: 3 })).toHaveText(project.name)
      await expect(card.locator('.phase').nth(0).locator('.chips li')).toHaveText(project.built.stack)
      await expect(card.locator('.phase').nth(1).locator('.chips li')).toHaveText(project.tested.stack)
    }
  })

  test('crashing into a board breaks it, and it is back in its place 15 to 20 seconds later', async ({ portfolio, page }) => {
    test.setTimeout(60_000)
    const canvas = page.locator('canvas.webgl')
    await portfolio.startEngine()
    await expect(canvas).toHaveAttribute('data-broken-boards', '0')

    // the pad leaves the car facing its board, about 5 m away
    await portfolio.goToProject(0)
    await page.keyboard.press('Escape')
    await page.keyboard.down('KeyW')
    await expect(canvas).toHaveAttribute('data-broken-boards', '1', { timeout: 5_000 })
    const crashedAt = Date.now()
    // the car smashes through and keeps going
    await page.waitForTimeout(400)
    const speed = Number(await portfolio.speed.textContent())
    await page.keyboard.up('KeyW')
    expect(speed).toBeGreaterThan(20)

    // drive away, then wait for the board to rebuild itself
    await portfolio.goTo('spawn')
    await expect(canvas).toHaveAttribute('data-broken-boards', '0', { timeout: 25_000 })
    const seconds = (Date.now() - crashedAt) / 1000
    expect(seconds).toBeGreaterThan(14.5)
    expect(seconds).toBeLessThan(22.5)
  })

  test('pressing Enter on a project pad opens the link in a new tab', { tag: '@smoke' }, async ({ portfolio, page }) => {
    await portfolio.startEngine()
    await portfolio.goToProject(0)
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.keyboard.press('Enter')])
    expect(popup.url()).toBe(projects[0].link)
  })
})
