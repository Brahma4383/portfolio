import { test, expect } from '../fixtures.js'
import { ZONES } from '../../src/world/layout.js'
import { testing } from '../../src/data/portfolio.js'
import { BUG_COUNT } from '../../src/world/BugHunt.js'
import { EMOTES } from '../../src/world/Stormtrooper.js'

test.describe('Island areas', () => {
  // Data-driven: one test per area defined in layout.js.
  for (const zone of ZONES) {
    test(`jumping to ${zone.label} opens its info panel`, { tag: '@smoke' }, async ({ portfolio }) => {
      await portfolio.startEngine()
      await portfolio.goTo(zone.id)
      await portfolio.expectPanelFor(zone.id)
      await expect(portfolio.panelHeading).not.toBeEmpty()
      await expect(portfolio.explored).toHaveText(`1 / ${ZONES.length} explored`)
    })
  }

  test('visiting every area completes the explored counter', async ({ portfolio, page }) => {
    await portfolio.startEngine()
    for (const zone of ZONES) {
      await portfolio.goTo(zone.id)
      await portfolio.expectPanelFor(zone.id)
    }
    await expect(portfolio.explored).toHaveText(`${ZONES.length} / ${ZONES.length} explored`)
    for (const zone of ZONES) {
      await expect(page.locator(`[data-check="${zone.id}"]`)).toHaveClass(/is-done/)
    }
    await expect(portfolio.toast).toContainText('seen everything')
  })

  test('a closed panel stays closed while the car is still in that area', async ({ portfolio, page }) => {
    await portfolio.startEngine()
    await portfolio.goTo('skills')
    await portfolio.expectPanelFor('skills')
    await portfolio.closePanelButton.click()
    await expect(portfolio.panel).toBeHidden()
    // give the game loop a few frames to re-check where the car is
    await page.waitForTimeout(500)
    await expect(portfolio.panel).toBeHidden()
  })

  test('the dancing stormtrooper loads in the About area', async ({ portfolio, page }) => {
    const model = page.waitForResponse((response) => response.url().endsWith('/stormtrooper.dae'))
    const texture = page.waitForResponse((response) => response.url().endsWith('/Stormtrooper_D.jpg'))
    await portfolio.startEngine()
    expect((await model).status()).toBe(200)
    expect((await texture).status()).toBe(200)
    await portfolio.goTo('about')
    await portfolio.expectPanelFor('about')
  })

  test('the Stormtrooper in the About area plays emotes from the panel', async ({ portfolio }) => {
    await portfolio.startEngine()
    await portfolio.goTo('about')
    await portfolio.expectPanelFor('about')

    // a one-off emote plays, then he goes back to standing
    const yes = portfolio.panel.locator('[data-emote="Yes"]')
    await expect(yes).toBeEnabled({ timeout: 20_000 })
    await yes.click()
    await expect(yes).toHaveAttribute('aria-pressed', 'true')
    await expect(yes).toHaveAttribute('aria-pressed', 'false', { timeout: 10_000 })

    // Dance switches dancing on and off
    const dance = portfolio.panel.locator('[data-emote="Dance"]')
    await dance.click()
    await expect(dance).toHaveAttribute('aria-pressed', 'true')
    await dance.click()
    await expect(dance).toHaveAttribute('aria-pressed', 'false')
  })

  test('the Stormtrooper does every trick, and a move asked for mid-flip waits its turn', async ({ portfolio }) => {
    await portfolio.startEngine()
    await portfolio.goTo('about')
    await portfolio.expectPanelFor('about')
    const button = (id) => portfolio.panel.locator(`[data-emote="${id}"]`)
    const tricks = EMOTES.filter((emote) => emote.trick)
    await expect(portfolio.panel.locator('.emotes__grid--tricks button')).toHaveCount(tricks.length)

    // asked for during a backflip, the wave waits until he has landed
    await expect(button('Backflip')).toBeEnabled({ timeout: 20_000 })
    await button('Backflip').click()
    await expect(button('Backflip')).toHaveAttribute('aria-pressed', 'true')
    await button('Wave').click()
    await expect(button('Backflip')).toHaveAttribute('aria-pressed', 'true')
    await expect(button('Wave')).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 })
    await expect(button('Wave')).toHaveAttribute('aria-pressed', 'false', { timeout: 5_000 })

    // every trick plays through to the end
    for (const trick of tricks) {
      await expect(button(trick.id)).toContainText(trick.label)
      await button(trick.id).click()
      await expect(button(trick.id)).toHaveAttribute('aria-pressed', 'true')
      await expect(button(trick.id)).toHaveAttribute('aria-pressed', 'false', { timeout: 6_000 })
    }
  })

  test('a knocked-over crate stack rebuilds itself into its pyramid 20 seconds later', async ({ portfolio, page }) => {
    test.setTimeout(60_000)
    const canvas = page.locator('canvas.webgl')
    await portfolio.startEngine()
    await portfolio.goTo('skills')
    await portfolio.expectPanelFor('skills')
    await expect(canvas).toHaveAttribute('data-knocked-stacks', '0')

    // from the drop-off point the car faces the middle stack: drive into it, then back away
    await page.keyboard.press('Escape')
    await page.keyboard.down('KeyW')
    await expect(canvas).toHaveAttribute('data-knocked-stacks', '1', { timeout: 6_000 })
    const knockedAt = Date.now()
    await page.keyboard.up('KeyW')
    await page.keyboard.down('KeyS')
    await page.waitForTimeout(2_600)
    await page.keyboard.up('KeyS')

    await expect(canvas).toHaveAttribute('data-knocked-stacks', '0', { timeout: 30_000 })
    const seconds = (Date.now() - knockedAt) / 1000
    expect(seconds).toBeGreaterThan(19.5)
    expect(seconds).toBeLessThan(25)
  })

  test('knocked-over pixel letters fly back into their word 20 seconds later', async ({ portfolio, page }) => {
    test.setTimeout(60_000)
    const canvas = page.locator('canvas.webgl')
    await portfolio.startEngine()
    await expect(canvas).toHaveAttribute('data-knocked-words', '0')

    // the car starts facing my name: drive into it, then back away
    await page.keyboard.down('KeyW')
    await expect(canvas).toHaveAttribute('data-knocked-words', '1', { timeout: 6_000 })
    const knockedAt = Date.now()
    await page.keyboard.up('KeyW')
    await page.keyboard.down('KeyS')
    await page.waitForTimeout(2_600)
    await page.keyboard.up('KeyS')

    await expect(canvas).toHaveAttribute('data-knocked-words', '0', { timeout: 30_000 })
    const seconds = (Date.now() - knockedAt) / 1000
    expect(seconds).toBeGreaterThan(19.5)
    expect(seconds).toBeLessThan(25)
  })

  test('the Test Lab explains the testing process step by step', async ({ portfolio }) => {
    await portfolio.startEngine()
    await portfolio.goTo('testing')
    await portfolio.expectPanelFor('testing')
    await expect(portfolio.panelHeading).toHaveText('How I test')
    await expect(portfolio.panel.locator('.steps li')).toHaveCount(testing.steps.length)
  })

  test('the Test Lab has a bug radar: how many bugs are left and where the nearest one is', async ({ portfolio }) => {
    await portfolio.startEngine()
    // twice, with a visit somewhere else in between: the panel is rebuilt each time
    // and the same radar has to move into the new one
    for (const visit of ['first', 'again']) {
      if (visit === 'again') {
        await portfolio.goTo('about')
        await portfolio.expectPanelFor('about')
      }
      await portfolio.goTo('testing')
      await portfolio.expectPanelFor('testing')
      const radar = portfolio.panel.locator('[data-bug-radar]')
      await expect(radar).toHaveAttribute('data-state', 'ready', { timeout: 15_000 })
      await expect(radar.locator('canvas')).toBeVisible()
      await expect(radar).toHaveAttribute('data-left', String(BUG_COUNT))
      await expect(radar.locator('.bug-radar__count')).toHaveText(`${BUG_COUNT} of ${BUG_COUNT} bugs left`)
      await expect(radar.locator('.bug-radar__nearest')).toHaveText(
        /^Nearest: (\d+ m (north|south|east|west|north-east|north-west|south-east|south-west)|right under your wheels!)$/,
      )
    }
  })
})
