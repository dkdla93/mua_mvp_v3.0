// 글로벌 설정 스크립트
const { chromium } = require('@playwright/test');
const path = require('path');

async function globalSetup(config) {
  console.log('🚀 E2E 테스트 환경 설정 중...');

  // 테스트용 파일들 준비
  const testFilesDir = path.join(__dirname, 'fixtures');

  // 브라우저 실행 확인
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 테스트 대상 사이트 접근 가능 여부 확인
    const baseURL = config?.use?.baseURL || 'https://mua-mvp-v3-0.vercel.app';
    await page.goto(baseURL);
    await page.waitForSelector('h1', { timeout: 30000 });
    console.log('✅ 테스트 대상 사이트 접근 확인');
  } catch (error) {
    console.error('❌ 테스트 대상 사이트 접근 실패:', error.message);
    throw error;
  } finally {
    await browser.close();
  }

  console.log('✅ 글로벌 설정 완료');
}

module.exports = globalSetup;