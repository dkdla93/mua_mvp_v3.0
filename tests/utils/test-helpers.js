// E2E 테스트 유틸리티 함수들
const path = require('path');

/**
 * 테스트용 파일 경로 생성
 */
function getTestFilePath(filename) {
  return path.join(__dirname, '../fixtures', filename);
}

/**
 * 파일 업로드 헬퍼
 */
async function uploadFile(page, selector, filePath) {
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.click(selector);
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(filePath);
}

/**
 * 스텝 네비게이션 헬퍼
 */
async function goToStep(page, stepNumber) {
  await page.click(`[data-step="${stepNumber}"]`);
  await page.waitForSelector(`#step-${stepNumber}.active`, { timeout: 5000 });
}

/**
 * 로딩 완료 대기
 */
async function waitForLoading(page) {
  // 로딩 오버레이가 사라질 때까지 대기
  await page.waitForSelector('#loading-overlay', { state: 'hidden', timeout: 10000 });
}

/**
 * 에러 모달 확인
 */
async function checkForErrorModal(page) {
  const errorModal = await page.$('#error-modal:visible');
  if (errorModal) {
    const errorMessage = await page.textContent('#error-message');
    throw new Error(`에러 모달 발생: ${errorMessage}`);
  }
}

/**
 * 드래그 앤 드롭 시뮬레이션
 */
async function dragAndDrop(page, sourceSelector, targetSelector, targetPosition = { x: 0, y: 0 }) {
  const source = await page.locator(sourceSelector);
  const target = await page.locator(targetSelector);

  // 소스 요소 위치 가져오기
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();

  if (!sourceBox || !targetBox) {
    throw new Error('드래그 또는 드롭 요소를 찾을 수 없습니다');
  }

  // 드래그 시작
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();

  // 타겟으로 이동
  const dropX = targetBox.x + targetPosition.x;
  const dropY = targetBox.y + targetPosition.y;
  await page.mouse.move(dropX, dropY);

  // 드롭
  await page.mouse.up();

  // 드롭 완료 대기
  await page.waitForTimeout(1000);
}

/**
 * 테스트용 더미 데이터 생성
 */
function createDummyMaterialData() {
  return [
    { category: '도배', material: '벽지 A타입', quantity: 10, unit: 'm²' },
    { category: '바닥', material: '마루판', quantity: 5, unit: '장' },
    { category: '조명', material: 'LED 조명', quantity: 8, unit: '개' }
  ];
}

/**
 * 성능 메트릭 수집
 */
async function collectPerformanceMetrics(page) {
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');

    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
      firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
    };
  });

  return metrics;
}

module.exports = {
  getTestFilePath,
  uploadFile,
  goToStep,
  waitForLoading,
  checkForErrorModal,
  dragAndDrop,
  createDummyMaterialData,
  collectPerformanceMetrics
};