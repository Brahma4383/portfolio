import { test, expect } from '../fixtures.js'
import { contacts, profile } from '../../src/data/portfolio.js'

// Width and height of a JPEG, read from its start-of-frame marker.
function jpegSize(bytes) {
  let i = 2 // skip the start-of-image marker
  while (i < bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1]
    if (marker >= 0xc0 && marker <= 0xc2) return { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) }
    i += 2 + bytes.readUInt16BE(i + 2)
  }
  return null
}

test.describe('Link previews and search', () => {
  test('the link-preview image is served at the size its tags promise', { tag: '@smoke' }, async ({ page, request }) => {
    await page.goto('./')
    const meta = (property) => page.locator(`meta[property="${property}"]`).getAttribute('content')
    const image = await meta('og:image')
    // share scrapers (LinkedIn, WhatsApp) only follow absolute URLs
    expect(image).toMatch(/^https:\/\//)

    // the tag points at the live site; check the same file in this build
    const response = await request.get(new URL(image).pathname.split('/').pop())
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('image/jpeg')
    expect(jpegSize(await response.body())).toEqual({ width: Number(await meta('og:image:width')), height: Number(await meta('og:image:height')) })
  })

  test('the structured data describes me, with my real links', async ({ page }) => {
    await page.goto('./')
    const person = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent())
    expect(person['@type']).toBe('Person')
    expect(person.name).toBe(profile.name)
    expect(person.jobTitle).toBe(profile.role)
    const profiles = contacts.filter((contact) => ['github', 'linkedin'].includes(contact.id)).map((contact) => contact.href)
    expect(person.sameAs).toEqual(profiles)
  })
})
