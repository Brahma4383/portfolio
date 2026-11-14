// The same tests, run against the live site on GitHub Pages instead of a local build:
//   npm run test:live                                     the @smoke tests
//   npx playwright test --config playwright.live.config.js   every test
// The URL is also in index.html's tags and public/404.html; change them together.
import config from './playwright.config.js'

export default {
  ...config,
  use: { ...config.use, baseURL: 'https://brahma4383.github.io/portfolio/' },
  webServer: undefined,
}
