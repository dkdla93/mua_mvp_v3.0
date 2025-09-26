// 글로벌 정리 스크립트
async function globalTeardown(config) {
  console.log('🧹 E2E 테스트 환경 정리 중...');

  // 테스트 결과 정리
  const fs = require('fs');
  const path = require('path');

  // 테스트 리포트 경로 확인
  const reportPath = path.join(__dirname, '../playwright-report');
  const resultsPath = path.join(__dirname, '../test-results');

  if (fs.existsSync(reportPath)) {
    console.log('📊 HTML 리포트 생성 완료:', reportPath);
  }

  if (fs.existsSync(resultsPath)) {
    console.log('📁 테스트 결과 저장 완료:', resultsPath);
  }

  console.log('✅ 글로벌 정리 완료');
}

module.exports = globalTeardown;