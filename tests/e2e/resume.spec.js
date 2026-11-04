import { test, expect } from '../fixtures.js'
import { resume } from '../../src/data/portfolio.js'

test.describe('Resume: view and download', () => {
  test('the PDF is served', { tag: '@smoke' }, async ({ request }) => {
    const response = await request.get(resume.file)
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/pdf')
    expect((await response.body()).subarray(0, 4).toString()).toBe('%PDF')
  })

  test('View opens the resume in a new tab', { tag: '@smoke' }, async ({ portfolio, page }) => {
    await portfolio.startEngine()
    await portfolio.goTo('about')
    await portfolio.expectPanelFor('about')
    const view = portfolio.resumeLink(portfolio.panel, 'view')
    await expect(view).toHaveText('View resume')
    await expect(view).toHaveAttribute('target', '_blank')
    const [popup] = await Promise.all([page.waitForEvent('popup'), view.click()])
    expect(popup.url()).toContain(resume.file)
  })

  test('Download saves the PDF with a proper file name', { tag: '@smoke' }, async ({ portfolio, page }) => {
    await portfolio.startEngine()
    await portfolio.goTo('about')
    await portfolio.expectPanelFor('about')
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      portfolio.resumeLink(portfolio.panel, 'download').click(),
    ])
    expect(download.suggestedFilename()).toBe(resume.fileName)
  })

  test('the Contact panel offers both options too', async ({ portfolio }) => {
    await portfolio.startEngine()
    await portfolio.goTo('contact')
    await portfolio.expectPanelFor('contact')
    await expect(portfolio.resumeLink(portfolio.panel, 'view')).toHaveAttribute('href', resume.file)
    await expect(portfolio.resumeLink(portfolio.panel, 'download')).toHaveAttribute('download', resume.fileName)
  })

  test('the classic page offers both options', async ({ portfolio, page }) => {
    await portfolio.open()
    await portfolio.introClassicButton.click()
    await expect(portfolio.classic).toBeVisible()
    await expect(portfolio.resumeLink(portfolio.classic, 'view')).toHaveText('View resume')
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      portfolio.resumeLink(portfolio.classic, 'download').click(),
    ])
    expect(download.suggestedFilename()).toBe(resume.fileName)
  })
})
