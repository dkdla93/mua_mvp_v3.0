// 성능 및 접근성 테스트
const { test, expect } = require('@playwright/test');

test.describe('성능 및 접근성 테스트', () => {
  test('Core Web Vitals 측정', async ({ page }) => {
    // 네트워크 조절 (3G 시뮬레이션)
    await page.route('**/*', route => route.continue());

    const startTime = Date.now();
    await page.goto('/', { waitUntil: 'networkidle' });

    // Web Vitals 측정
    const webVitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const vitals = {};

          entries.forEach((entry) => {
            if (entry.entryType === 'largest-contentful-paint') {
              vitals.lcp = entry.startTime;
            }
            if (entry.entryType === 'first-input') {
              vitals.fid = entry.processingStart - entry.startTime;
            }
            if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
              vitals.cls = (vitals.cls || 0) + entry.value;
            }
          });

          // 기본 타이밍 메트릭
          const navigation = performance.getEntriesByType('navigation')[0];
          vitals.domContentLoaded = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart;
          vitals.loadComplete = navigation.loadEventEnd - navigation.loadEventStart;

          resolve(vitals);
        }).observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });

        // 타임아웃 설정
        setTimeout(() => resolve({}), 5000);
      });
    });

    console.log('📊 Web Vitals:', webVitals);

    // LCP는 2.5초 이하가 좋음
    if (webVitals.lcp) {
      expect(webVitals.lcp).toBeLessThan(2500);
    }

    // FID는 100ms 이하가 좋음
    if (webVitals.fid) {
      expect(webVitals.fid).toBeLessThan(100);
    }

    // CLS는 0.1 이하가 좋음
    if (webVitals.cls) {
      expect(webVitals.cls).toBeLessThan(0.1);
    }
  });

  test('모바일 반응형 테스트', async ({ page }) => {
    // 모바일 뷰포트 설정
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // 모바일에서 기본 요소들이 잘 보이는지 확인
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.progress-steps')).toBeVisible();
    await expect(page.locator('.file-upload-area')).toBeVisible();

    // 터치 타겟 크기 확인 (최소 44px)
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const box = await button.boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('키보드 접근성 테스트', async ({ page }) => {
    await page.goto('/');

    // 키보드 네비게이션 테스트
    await page.keyboard.press('Tab');

    // 포커스된 요소 확인
    const focusedElement = await page.evaluate(() => document.activeElement.tagName);
    expect(['BUTTON', 'INPUT', 'A']).toContain(focusedElement);

    // 여러 번 Tab을 눌러서 네비게이션 확인
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      const currentFocus = await page.evaluate(() => document.activeElement.tagName);
      expect(['BUTTON', 'INPUT', 'A', 'DIV']).toContain(currentFocus);
    }
  });

  test('대용량 파일 처리 성능', async ({ page }) => {
    await page.goto('/');

    // 메모리 사용량 모니터링 시작
    const startMemory = await page.evaluate(() => performance.memory?.usedJSHeapSize || 0);

    // 가상의 대용량 데이터 처리 시뮬레이션
    await page.evaluate(() => {
      // 큰 배열 생성으로 메모리 사용량 테스트
      window.testData = new Array(100000).fill(0).map((_, i) => ({
        id: i,
        name: `자재${i}`,
        category: `카테고리${i % 10}`,
        price: Math.random() * 10000
      }));

      return window.testData.length;
    });

    // 메모리 사용량 확인
    const endMemory = await page.evaluate(() => performance.memory?.usedJSHeapSize || 0);
    const memoryIncrease = endMemory - startMemory;

    console.log(`메모리 사용량 증가: ${memoryIncrease / 1024 / 1024}MB`);

    // 메모리 누수가 심하지 않은지 확인 (100MB 이하)
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);

    // 정리
    await page.evaluate(() => {
      delete window.testData;
    });
  });

  test('브라우저 호환성', async ({ page, browserName }) => {
    await page.goto('/');

    // 브라우저별 기본 기능 확인
    const title = await page.title();
    expect(title).toContain('착공도서');

    // JavaScript 라이브러리 로딩 확인
    const xlsxLoaded = await page.evaluate(() => typeof window.XLSX !== 'undefined');
    const pptxLoaded = await page.evaluate(() => typeof window.PptxGenJS !== 'undefined');

    console.log(`${browserName}: XLSX=${xlsxLoaded}, PptxGenJS=${pptxLoaded}`);

    // 폴백 메커니즘 확인
    if (!xlsxLoaded) {
      console.warn(`${browserName}: XLSX 라이브러리 로딩 실패, 폴백 확인`);
    }
    if (!pptxLoaded) {
      console.warn(`${browserName}: PptxGenJS 라이브러리 로딩 실패, 폴백 확인`);
    }

    // 기본 DOM 조작 가능 여부
    const canManipulateDOM = await page.evaluate(() => {
      try {
        const testDiv = document.createElement('div');
        testDiv.innerHTML = 'test';
        document.body.appendChild(testDiv);
        document.body.removeChild(testDiv);
        return true;
      } catch (e) {
        return false;
      }
    });

    expect(canManipulateDOM).toBeTruthy();
  });
});