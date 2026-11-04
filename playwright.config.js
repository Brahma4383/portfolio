import { defineConfig, devices } from '@playwright/test'

const PORT = 4317

// On Windows, ask headless Chrome to use the real GPU (much faster WebGL);
// elsewhere Chrome falls back to software rendering, which is slower but works.
const gpuArgs = process.platform === 'win32' ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : []

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Every test renders the whole 3D island; running them one at a time is faster
  // than several browsers fighting over the same GPU.
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],

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
      name: 'mobile',
      use: { ...devices['Pixel 7'], channel: 'chrome', launchOptions: { args: gpuArgs } },
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
