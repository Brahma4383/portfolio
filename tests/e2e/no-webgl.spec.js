import { test, expect } from '../fixtures.js'
import { profile, projects, resume } from '../../src/data/portfolio.js'

// Runs in the "no-webgl" project: Chrome is started with WebGL switched off.
test.describe('Without WebGL', () => {
  test('falls back to the classic page with all the content', { tag: '@smoke' }, async ({ portfolio }) => {
    await portfolio.open()
    await expect(portfolio.classic).toBeVisible()
    await expect(portfolio.intro).toBeHidden()
    await expect(portfolio.hud).toBeHidden()
    await expect(portfolio.backToIslandButton).toBeHidden()
    await expect(portfolio.classic.locator('.robot')).toHaveCount(0)
    await expect(portfolio.classic.getByRole('heading', { level: 1 })).toHaveText(profile.name)
    for (const project of projects) {
      await expect(portfolio.classic.getByRole('heading', { level: 3, name: project.name, exact: true })).toBeVisible()
    }
    await expect(portfolio.resumeLink(portfolio.classic, 'view')).toHaveAttribute('href', resume.file)
    await expect(portfolio.resumeLink(portfolio.classic, 'download')).toHaveAttribute('download', resume.fileName)
  })
})
