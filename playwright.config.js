import { defineConfig, devices } from '@playwright/test'

const PORT = 4317

// How headless Chrome draws the 3D island. On Windows it uses the real GPU (much
// faster WebGL). CI machines have no GPU, so there it uses SwiftShader, Chrome's
// software renderer, which Chrome only allows for WebGL when asked explicitly.
const gpuArgs = process.env.CI
  ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  : process.platform === 'win32'
    ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']
    : []

export default defineConfig({
  testDir: './tests/e2e',
  // Without a GPU (CI) every frame is drawn by the CPU, so the same steps take longer.
  timeout: process.env.CI ? 180_000 : 60_000,
  expect: { timeout: process.env.CI ? 30_000 : 15_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Every test renders the whole 3D island; running them one at a time is faster
  // than several browsers fighting over the same GPU.
  workers: 1,
  // on CI, failures are also shown on the GitHub Actions run's summary page
  reporter: [...(process.env.CI ? [['github']] : []), ['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: `http://localhost:${PORT}`,
    // Runs on the installed Google Chrome, so no separate browser download is needed.
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1440, height: 900 }, launchOptions: { args: gpuArgs } },
      testIgnore: ['**/mobile.spec.js', '**/no-webgl.spec.js'],
    },
    {
      // held sideways, as phones drive the island in landscape (mobile.spec.js also turns it upright)
      name: 'mobile',
      use: { ...devices['Pixel 7 landscape'], channel: 'chrome', launchOptions: { args: gpuArgs } },
      testMatch: '**/mobile.spec.js',
    },
    {
      name: 'no-webgl',
      use: { ...devices['Desktop Chrome'], channel: 'chrome', launchOptions: { args: ['--disable-webgl', '--disable-3d-apis'] } },
      testMatch: '**/no-webgl.spec.js',
    },
  ],

  // Tests run against the production build, served locally.
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
