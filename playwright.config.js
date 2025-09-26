// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * 착공도서 자동생성 시스템 E2E 테스트 설정
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests',
  /* 병렬 실행 설정 */
  fullyParallel: true,
  /* CI에서 재시도 비활성화 */
  forbidOnly: !!process.env.CI,
  /* 실패 시 재시도 횟수 */
  retries: process.env.CI ? 2 : 0,
  /* 병렬 워커 수 (CI에서는 1개, 로컬에서는 undefined로 자동) */
  workers: process.env.CI ? 1 : undefined,
  /* 레포트 설정 */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['line']
  ],
  /* 전체 테스트에 공통으로 적용할 설정 */
  use: {
    /* 액션 전후 스크린샷 촬영 */
    actionTimeout: 10000,
    navigationTimeout: 30000,
    /* 실패 시 스크린샷 및 비디오 수집 */
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    /* 브라우저 컨텍스트 설정 */
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    /* 테스트 대상 URL */
    baseURL: 'https://mua-mvp-v3-0.vercel.app',
  },

  /* 프로젝트별 브라우저 설정 */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // 파일 다운로드 허용
        acceptDownloads: true,
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        acceptDownloads: true,
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        acceptDownloads: true,
      },
    },
    /* 모바일 테스트 */
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        acceptDownloads: true,
      },
    },
    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 12'],
        acceptDownloads: true,
      },
    },
  ],

  /* 로컬 개발 서버 설정 - 배포된 사이트 테스트하므로 비활성화 */
  // webServer: {
  //   command: 'npm run start',
  //   port: 3000,
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120000,
  // },

  /* 테스트 출력 디렉토리 */
  outputDir: 'test-results/',

  /* 전역 설정 */
  globalSetup: require.resolve('./tests/global-setup.js'),
  globalTeardown: require.resolve('./tests/global-teardown.js'),
});