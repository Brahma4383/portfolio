import { test, expect } from '../fixtures.js'
import { development, profile, projects, skillGroups, testing } from '../../src/data/portfolio.js'

const SECTIONS = ['How I build & test', 'Experience', 'Projects', 'Skills', 'Education & certifications', 'Contact']

test.describe('Classic page', () => {
  test('opens from the start screen and contains every section', { tag: '@smoke' }, async ({ portfolio }) => {
    await portfolio.open()
    await portfolio.introClassicButton.click()
    await expect(portfolio.classic).toBeVisible()
    for (const heading of SECTIONS) {
      await expect(portfolio.classic.getByRole('heading', { level: 2, name: heading, exact: true })).toBeVisible()
    }
    // development on one side, testing on the other, each with all its steps and tools
    // (the tools loop round, so only the copy screen readers get is counted)
    for (const [title, label, side] of [['How I build', 'Development', development], ['How I test', 'Testing', testing]]) {
      const card = portfolio.classic.getByRole('article', { name: title, exact: true })
      await expect(card).toBeVisible()
      await expect(card.locator('.steps li')).toHaveCount(side.steps.length)
      for (const step of side.steps) await expect(card.locator('.steps')).toContainText(step.name)
      const tools = card.getByRole('region', { name: `${label} toolkit` }).locator('ul:not([aria-hidden]) li')
      await expect(tools).toHaveText(side.toolkit)
    }
    for (const project of projects) {
      await expect(portfolio.classic.getByRole('heading', { level: 3, name: project.name, exact: true })).toBeVisible()
    }
    for (const group of skillGroups) {
      await expect(portfolio.classic.getByRole('heading', { level: 3, name: group.name, exact: true })).toBeVisible()
    }
  })

  test('each toolkit scrolls past as a loop that stops while you hover it', async ({ portfolio, page }) => {
    await portfolio.open()
    await portfolio.introClassicButton.click()
    const loop = portfolio.classic.getByRole('region', { name: 'Testing toolkit' })
    await loop.scrollIntoViewIfNeeded()
    const offset = () => loop.locator('.logoloop__track').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41)
    // how far it moves in a fifth of a second
    const drift = async () => {
      const before = await offset()
      await page.waitForTimeout(200)
      return Math.abs((await offset()) - before)
    }

    await expect.poll(drift).toBeGreaterThan(2)
    await loop.hover()
    await expect.poll(drift).toBeLessThan(0.5)
    await page.mouse.move(0, 0)
    await expect.poll(drift).toBeGreaterThan(2)
  })

  test('the intro shows both roles with their tools', { tag: '@smoke' }, async ({ portfolio }) => {
    await portfolio.open()
    await portfolio.introClassicButton.click()
    await expect(portfolio.classic.locator('.classic__hero .eyebrow')).toHaveText(profile.role)
    const tracks = portfolio.classic.locator('.classic__hero .track')
    await expect(tracks).toHaveCount(profile.tracks.length)
    for (const [index, track] of profile.tracks.entries()) {
      await expect(tracks.nth(index).locator('strong')).toHaveText(track.title)
      for (const tool of track.stack) await expect(tracks.nth(index)).toContainText(tool)
    }
  })

  test('the 3D character loads and switches between idle, walk and run', async ({ portfolio }) => {
    await portfolio.open()
    await portfolio.introClassicButton.click()
    const robot = portfolio.classic.locator('.robot')
    await expect(robot).toHaveAttribute('data-state', 'ready', { timeout: 30_000 })
    await expect(robot).toHaveAttribute('data-move', 'idle')

    for (const move of ['walk', 'run', 'idle']) {
      const button = robot.getByRole('button', { name: move, exact: false })
      await button.click()
      await expect(button).toHaveAttribute('aria-pressed', 'true')
      // walk and run finish their current step before switching, so allow a moment
      await expect(robot).toHaveAttribute('data-move', move, { timeout: 10_000 })
    }
  })

  test('the 3D character acts out each request sent from his API console', async ({ portfolio }) => {
    await portfolio.open()
    await portfolio.introClassicButton.click()
    const robot = portfolio.classic.locator('.robot')
    const bubble = robot.locator('.robot__bubble')
    const response = robot.locator('.robot__response')
    await expect(robot).toHaveAttribute('data-state', 'ready', { timeout: 30_000 })

    const requests = [
      ['GET /salute', 'salute', '200 OK'],
      ['POST /pushups', 'pushups', '201 Created'],
      ['PUT /march', 'march', '202 Accepted'],
      ['DELETE /bug', 'bug', '204 No Content'],
      ['GET /coffee', 'teapot', '418 I’m a teapot'],
      ['POST /deploy', 'deploy', '500 Internal Server Error'],
    ]
    for (const [request, action, status] of requests) {
      const button = robot.getByRole('button', { name: request })
      await button.click()
      await expect(robot).toHaveAttribute('data-action', action)
      await expect(button).toHaveAttribute('aria-pressed', 'true')
      await expect(response).toContainText(status)
      await expect(bubble).toContainText(status)
      // each one plays through to the end
      await expect(robot).toHaveAttribute('data-action', '', { timeout: 10_000 })
      await expect(button).toHaveAttribute('aria-pressed', 'false')
    }
  })

  test('poking the 3D character makes him talk, and poking too fast gets a 429', async ({ portfolio }) => {
    await portfolio.open()
    await portfolio.introClassicButton.click()
    const robot = portfolio.classic.locator('.robot')
    const canvas = robot.locator('canvas')
    const bubble = robot.locator('.robot__bubble')
    await expect(robot).toHaveAttribute('data-state', 'ready', { timeout: 30_000 })

    await canvas.click()
    await expect(robot).toHaveAttribute('data-pokes', '1')
    await expect(bubble).toHaveText('Hey! 👋')

    // five pokes in under three seconds is too many
    for (let i = 0; i < 4; i++) await canvas.click()
    await expect(robot).toHaveAttribute('data-pokes', '5')
    await expect(bubble).toContainText('429 Too Many Requests')
    await expect(robot.locator('.robot__response')).toContainText('429 Too Many Requests')
    await expect(robot).toHaveAttribute('data-action', 'dizzy')
    await expect(robot).toHaveAttribute('data-action', '', { timeout: 10_000 })
  })

  test('left alone, the 3D character fidgets by himself, and a request cuts it short', async ({ portfolio }) => {
    await portfolio.open()
    await portfolio.introClassicButton.click()
    const robot = portfolio.classic.locator('.robot')
    await expect(robot).toHaveAttribute('data-state', 'ready', { timeout: 30_000 })
    await expect(robot).toHaveAttribute('data-fidget', '')

    // the first fidget comes a few seconds after he's ready
    await expect(robot).toHaveAttribute('data-fidget', /^(lookAround|stretch|watch|akimbo)$/, { timeout: 10_000 })
    await robot.getByRole('button', { name: 'GET /salute' }).click()
    await expect(robot).toHaveAttribute('data-action', 'salute')
    await expect(robot).toHaveAttribute('data-fidget', '')
  })

  test('opens from the HUD and goes back to the island', async ({ portfolio }) => {
    await portfolio.startEngine()
    await portfolio.classicButton.click()
    await expect(portfolio.classic).toBeVisible()
    await portfolio.backToIslandButton.click()
    await expect(portfolio.classic).toBeHidden()
    await expect(portfolio.hud).toBeVisible()
  })

  test('every link on the page works', async ({ portfolio, request }) => {
    await portfolio.open()
    await portfolio.introClassicButton.click()
    const links = await portfolio.classic.locator('a[href]').evaluateAll((anchors) =>
      anchors.map((a) => ({ href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel') })),
    )
    expect(links.length).toBeGreaterThan(0)

    for (const link of links) {
      if (link.target === '_blank') expect(link.rel, `${link.href} should open safely`).toContain('noopener')
      if (/^(mailto|tel):/.test(link.href)) continue
      if (/^https?:/.test(link.href)) {
        expect(link.href, 'external links should use https').toMatch(/^https:\/\//)
        continue
      }
      const response = await request.get(link.href)
      expect(response.status(), `${link.href} should load`).toBe(200)
    }
  })
})
