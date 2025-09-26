# 🎭 E2E 테스트 가이드

## 📋 테스트 개요

Playwright를 사용한 착공도서 자동생성 시스템의 종단간 테스트입니다.

## 🚀 설치 및 실행

### 1. Playwright 설치

```bash
# Playwright 설치
npm install --save-dev @playwright/test

# 브라우저 설치
npm run test:install
```

### 2. 테스트 실행

```bash
# 모든 테스트 실행 (헤드리스)
npm run test:e2e

# UI 모드로 테스트 실행
npm run test:e2e:ui

# 브라우저를 보면서 테스트 실행
npm run test:e2e:headed

# 디버그 모드로 테스트 실행
npm run test:e2e:debug
```

## 📂 테스트 구조

```
tests/
├── README.md                    # 이 파일
├── e2e-full-flow.spec.js       # 전체 플로우 테스트
├── performance.spec.js         # 성능 및 접근성 테스트
├── utils/
│   └── test-helpers.js         # 테스트 유틸리티
├── fixtures/                   # 테스트용 파일들
│   └── sample-material-list.xlsx
├── global-setup.js            # 전역 설정
└── global-teardown.js         # 전역 정리
```

## 🎯 테스트 시나리오

### 전체 플로우 테스트
- **시나리오 1**: 성공적인 전체 플로우 (1→2→3→4단계)
- **시나리오 2**: 오류 처리 및 복구

### 성능 테스트
- Core Web Vitals (LCP, FID, CLS)
- 모바일 반응형
- 키보드 접근성
- 브라우저 호환성

## 🔧 설정 파일

### `playwright.config.js`
- 브라우저 설정 (Chrome, Firefox, Safari, Mobile)
- 테스트 옵션 및 리포팅
- 기본 URL 및 타임아웃 설정

## 📊 테스트 결과

테스트 실행 후 다음 위치에서 결과를 확인할 수 있습니다:

- **HTML 리포트**: `playwright-report/index.html`
- **XML 결과**: `test-results/results.xml`
- **스크린샷**: `test-results/` 디렉토리
- **비디오**: `test-results/` 디렉토리 (실패 시)

## 🎯 테스트 대상

### 기능 테스트
- ✅ 파일 업로드 (엑셀, 이미지)
- ✅ 공정 관리 (추가, 삭제, 선택)
- ✅ 자재 배치 (드래그앤드롭)
- ✅ PPT 생성 및 다운로드

### 비기능 테스트
- ✅ 성능 메트릭 (로딩 시간, 응답 시간)
- ✅ 접근성 (키보드 네비게이션, 스크린 리더)
- ✅ 반응형 디자인 (모바일, 태블릿)
- ✅ 브라우저 호환성

## 🔍 디버깅

### 테스트 실패 시 확인사항

1. **스크린샷 확인**: `test-results/` 디렉토리
2. **비디오 확인**: 실패한 테스트의 녹화 파일
3. **콘솔 로그**: 브라우저 개발자 도구 메시지
4. **네트워크 요청**: 실패한 API 호출

### 디버그 모드 실행

```bash
npm run test:e2e:debug
```

디버그 모드에서는 브레이크포인트를 설정하고 단계별로 실행할 수 있습니다.

## 📝 테스트 추가하기

새로운 테스트를 추가하려면:

1. `tests/` 디렉토리에 `*.spec.js` 파일 생성
2. `test.describe()` 및 `test()` 함수 사용
3. `utils/test-helpers.js`의 헬퍼 함수 활용

### 예제

```javascript
const { test, expect } = require('@playwright/test');
const { uploadFile, goToStep } = require('./utils/test-helpers');

test.describe('새로운 기능 테스트', () => {
  test('새로운 기능 동작 확인', async ({ page }) => {
    await page.goto('/');
    // 테스트 코드 작성
  });
});
```

## 🎯 CI/CD 통합

GitHub Actions에서 실행하려면 `.github/workflows/e2e.yml`:

```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
```

## 📞 문제 해결

### 자주 발생하는 문제

1. **브라우저 설치 실패**: `npm run test:install` 실행
2. **타임아웃 오류**: `playwright.config.js`에서 타임아웃 증가
3. **파일 업로드 실패**: `fixtures/` 디렉토리의 테스트 파일 확인

### 추가 도움

- [Playwright 공식 문서](https://playwright.dev/)
- [Playwright Discord](https://discord.com/invite/playwright-807756831384403968)