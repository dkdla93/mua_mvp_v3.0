# MUA MVP v3.0 오류 분석 및 수정 계획서

## 📁 프로젝트 정보
- **저장소**: https://github.com/dkdla93/mua_mvp_v3.0
- **프로젝트명**: 인테리어 착공도서 자동 생성 웹 애플리케이션
- **배포 환경**: Vercel (정적 사이트)
- **기술 스택**: Vanilla JavaScript (ES5), CSS3, SheetJS, PptxGenJS

## 🔍 전반적인 프로젝트 분석

### 프로젝트 구조
1. **1단계 - 파일 업로드**: 엑셀 자재표(.xlsx, .xls), 미니맵 이미지, 장면 이미지 업로드
2. **2단계 - 공정 관리**: 공정 추가/삭제/관리 (최대 10개), 장면별 공정 선택
3. **3단계 - 드래그앤드롭**: 자재 배치, 번호 배지 시스템, 좌표 시스템
4. **4단계 - PPT 생성**: PowerPoint 자동 생성 (미구현)

### 현재 상태
- 1-3단계 구현 완료 (평균 8.7/10 평점)
- 4단계 PPT 생성 기능 미구현
- Vercel 배포 시 다수의 오류 발생

## ⚠️ 검출된 주요 오류 리스트

### 1. 메모리 누수 문제 (Critical)
- **증상**: 장시간 사용 시 브라우저 성능 저하, 메모리 사용량 지속 증가
- **원인**: 
  - 이벤트 리스너가 제거되지 않고 계속 누적
  - DOM 요소 참조가 메모리에 남아있음
  - 대용량 이미지 데이터가 메모리에서 해제되지 않음

### 2. 파일 업로드 오류 (Critical)
- **증상**: 특정 엑셀 파일이나 대용량 이미지 업로드 실패
- **원인**:
  - SheetJS 라이브러리 버전 호환성 문제
  - ArrayBuffer 처리 시 메모리 오버플로우
  - MIME 타입 검증 누락
  - 파일 크기 제한 없음
  - 에러 처리 미비

### 3. 드래그앤드롭 좌표 시스템 오류 (High)
- **증상**: 반응형 환경에서 자재 위치가 틀어짐, 브라우저 크기 변경 시 오작동
- **원인**:
  - `getBoundingClientRect()` 값 캐싱으로 인한 오차
  - Transform 속성과 실제 좌표 간 불일치
  - Viewport 변경 이벤트 미처리
  - 정규화된 좌표와 픽셀 좌표 간 변환 오류

### 4. 상태 관리 불일치 (High)
- **증상**: 공정 전환 시 데이터 손실, 새로고침 시 모든 데이터 초기화
- **원인**:
  - 전역 상태와 로컬 상태 간 동기화 문제
  - 공정 데이터가 메모리에만 저장되어 영속성 없음
  - 탭 전환 시 이전 상태 복원 실패
  - 데이터 격리 로직 오류

### 5. 브라우저 호환성 문제 (Medium)
- **증상**: 구형 브라우저(IE11, 구버전 Safari)에서 작동 불가
- **원인**:
  - ES6+ 문법 사용 (`Object.assign()`, `Array.from()`, Arrow functions 등)
  - Promise 지원 없는 브라우저 대응 부재
  - CSS Grid/Flexbox 폴백 없음
  - Polyfill 미적용

### 6. Vercel 배포 환경 특화 오류 (High)
- **증상**: 로컬에서는 작동하나 배포 후 리소스 로딩 실패
- **원인**:
  - `vercel.json` 설정 누락 또는 오류
  - 정적 자산 경로가 절대경로로 하드코딩됨
  - 환경변수 미설정
  - CORS 정책 위반
  - 빌드 프로세스 미구성

## 📋 오류별 상세 원인 분석

### 1. 메모리 누수 상세 분석
```javascript
// 현재 문제가 되는 코드 패턴
element.addEventListener('click', handler);
// 컴포넌트 제거 시 리스너 제거 코드 없음

// 문제점:
// - 동적으로 생성된 DOM 요소의 이벤트 리스너가 제거되지 않음
// - 클로저로 인한 메모리 참조 유지
// - 이미지 객체가 null 처리되지 않음
```

### 2. 파일 업로드 오류 상세 분석
```javascript
// 현재 문제가 되는 코드
reader.readAsArrayBuffer(file); // 대용량 파일 시 메모리 부족
// 에러 처리 없음

// 문제점:
// - 파일 크기 체크 없이 전체를 메모리에 로드
// - 파일 형식 검증 없음
// - 업로드 실패 시 재시도 메커니즘 없음
// - 진행률 표시가 실제 처리와 동기화되지 않음
```

### 3. 좌표 시스템 문제 분석
```javascript
// 현재 문제가 되는 코드
const rect = element.getBoundingClientRect();
// 이 값을 캐싱하여 사용 -> 리사이즈 시 오차 발생

// 문제점:
// - 윈도우 리사이즈 이벤트 미처리
// - 스크롤 위치 고려하지 않음
// - 부모 요소의 transform 영향 미고려
```

### 4. 상태 관리 문제 분석
```javascript
// 현재 문제가 되는 패턴
let globalState = {}; // 전역 변수로 상태 관리
// 새로고침 시 모든 데이터 손실

// 문제점:
// - localStorage 미활용
// - 상태 변경 추적 시스템 없음
// - Undo/Redo 기능 불가능한 구조
```

## 🛠️ 오류 해결 계획

### Phase 1: 긴급 수정 (Critical Fixes) - P0 우선순위

#### 1.1 메모리 누수 해결
```javascript
// 해결 방안: 이벤트 리스너 관리 클래스 구현
class EventManager {
  constructor() {
    this.listeners = new Map();
  }
  
  addListener(element, event, handler) {
    if (!this.listeners.has(element)) {
      this.listeners.set(element, []);
    }
    element.addEventListener(event, handler);
    this.listeners.get(element).push({ event, handler });
  }
  
  removeAllListeners() {
    this.listeners.forEach((handlers, element) => {
      handlers.forEach(({ event, handler }) => {
        element.removeEventListener(event, handler);
      });
    });
    this.listeners.clear();
  }
  
  removeListenersForElement(element) {
    if (this.listeners.has(element)) {
      const handlers = this.listeners.get(element);
      handlers.forEach(({ event, handler }) => {
        element.removeEventListener(event, handler);
      });
      this.listeners.delete(element);
    }
  }
}

// 이미지 메모리 해제
function cleanupImages() {
  images.forEach(img => {
    img.src = ''; // 이미지 소스 제거
    img = null;   // 참조 제거
  });
  images = [];
}
```

#### 1.2 파일 업로드 안정화
```javascript
// 해결 방안: 강화된 파일 처리 시스템
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

async function validateAndProcessFile(file) {
  // 1. MIME 타입 검증
  const validTypes = {
    excel: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  };
  
  // 2. 파일 크기 검증
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`파일 크기가 ${MAX_FILE_SIZE / 1024 / 1024}MB를 초과합니다.`);
  }
  
  // 3. 청크 단위 처리
  return await processInChunks(file);
}

async function processInChunks(file) {
  const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
  const chunks = Math.ceil(file.size / CHUNK_SIZE);
  const result = [];
  
  for (let i = 0; i < chunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    
    // 청크 처리
    const processed = await processChunk(chunk);
    result.push(processed);
    
    // 진행률 업데이트
    updateProgress((i + 1) / chunks * 100);
  }
  
  return result;
}

// 에러 복구 메커니즘
async function uploadWithRetry(file, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await validateAndProcessFile(file);
    } catch (error) {
      console.error(`Upload attempt ${i + 1} failed:`, error);
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // 지수 백오프
    }
  }
}
```

### Phase 2: 핵심 기능 수정 (Core Fixes) - P1 우선순위

#### 2.1 반응형 좌표 시스템 구현
```javascript
// 해결 방안: 정규화된 좌표 시스템
class ResponsiveCoordinateSystem {
  constructor(container) {
    this.container = container;
    this.setupResizeObserver();
    this.updateDimensions();
  }
  
  setupResizeObserver() {
    this.resizeObserver = new ResizeObserver(() => {
      this.updateDimensions();
      this.recalculateAllPositions();
    });
    this.resizeObserver.observe(this.container);
  }
  
  updateDimensions() {
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
  }
  
  // 픽셀 좌표를 0-1 범위로 정규화
  normalizeCoordinates(x, y) {
    return {
      normalX: x / this.width,
      normalY: y / this.height
    };
  }
  
  // 정규화된 좌표를 픽셀로 변환
  denormalizeCoordinates(normalX, normalY) {
    return {
      x: normalX * this.width,
      y: normalY * this.height
    };
  }
  
  recalculateAllPositions() {
    // 모든 배치된 요소의 위치 재계산
    document.querySelectorAll('.placed-item').forEach(item => {
      const normalX = parseFloat(item.dataset.normalX);
      const normalY = parseFloat(item.dataset.normalY);
      const { x, y } = this.denormalizeCoordinates(normalX, normalY);
      item.style.left = `${x}px`;
      item.style.top = `${y}px`;
    });
  }
  
  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }
}
```

#### 2.2 중앙집중식 상태 관리 시스템
```javascript
// 해결 방안: 상태 관리자 구현
class StateManager {
  constructor() {
    this.state = this.loadFromLocalStorage() || this.getInitialState();
    this.subscribers = new Set();
    this.history = [];
    this.historyIndex = -1;
    
    // 자동 저장 설정 (디바운싱)
    this.autoSave = this.debounce(() => {
      this.saveToLocalStorage();
    }, 1000);
  }
  
  getInitialState() {
    return {
      files: {
        excel: null,
        minimap: null,
        scenes: []
      },
      processes: [],
      placements: {},
      currentProcess: null,
      currentScene: null
    };
  }
  
  updateState(path, value, saveToHistory = true) {
    // 이전 상태 저장 (Undo 기능용)
    if (saveToHistory) {
      this.saveHistory();
    }
    
    // 중첩 객체 경로 처리 (예: 'files.excel')
    const keys = path.split('.');
    let current = this.state;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    
    // 구독자들에게 알림
    this.notifySubscribers(path, value);
    
    // 자동 저장
    this.autoSave();
  }
  
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
  
  notifySubscribers(path, value) {
    this.subscribers.forEach(callback => {
      callback({ path, value, state: this.state });
    });
  }
  
  saveToLocalStorage() {
    try {
      // 이미지 데이터는 별도 처리 (용량 문제)
      const stateToSave = {
        ...this.state,
        files: {
          ...this.state.files,
          minimap: this.state.files.minimap ? 'stored' : null,
          scenes: this.state.files.scenes.map(() => 'stored')
        }
      };
      localStorage.setItem('mua_mvp_state', JSON.stringify(stateToSave));
    } catch (e) {
      console.error('Failed to save state:', e);
      // 용량 초과 시 오래된 데이터 정리
      this.cleanupOldData();
    }
  }
  
  loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem('mua_mvp_state');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error('Failed to load state:', e);
      return null;
    }
  }
  
  saveHistory() {
    // 현재 인덱스 이후의 히스토리 제거
    this.history = this.history.slice(0, this.historyIndex + 1);
    
    // 새 상태 추가
    this.history.push(JSON.stringify(this.state));
    this.historyIndex++;
    
    // 히스토리 크기 제한 (메모리 관리)
    const MAX_HISTORY = 50;
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(-MAX_HISTORY);
      this.historyIndex = this.history.length - 1;
    }
  }
  
  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.state = JSON.parse(this.history[this.historyIndex]);
      this.notifySubscribers('undo', this.state);
    }
  }
  
  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.state = JSON.parse(this.history[this.historyIndex]);
      this.notifySubscribers('redo', this.state);
    }
  }
  
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  cleanupOldData() {
    // localStorage 용량 초과 시 오래된 데이터 정리
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('mua_mvp_old_')) {
        localStorage.removeItem(key);
      }
    });
  }
}
```

### Phase 3: 호환성 및 최적화 (Compatibility & Optimization) - P2 우선순위

#### 3.1 Polyfill 및 트랜스파일링 설정
```javascript
// polyfills.js - 프로젝트 최상단에 추가
// Object.assign polyfill
if (typeof Object.assign !== 'function') {
  Object.defineProperty(Object, "assign", {
    value: function assign(target) {
      'use strict';
      if (target == null) {
        throw new TypeError('Cannot convert undefined or null to object');
      }
      var to = Object(target);
      for (var index = 1; index < arguments.length; index++) {
        var nextSource = arguments[index];
        if (nextSource != null) {
          for (var key in nextSource) {
            if (Object.prototype.hasOwnProperty.call(nextSource, key)) {
              to[key] = nextSource[key];
            }
          }
        }
      }
      return to;
    },
    writable: true,
    configurable: true
  });
}

// Array.from polyfill
if (!Array.from) {
  Array.from = function(object) {
    'use strict';
    return [].slice.call(object);
  };
}

// Promise polyfill (core-js 사용 권장)
if (!window.Promise) {
  document.write('<script src="https://cdn.jsdelivr.net/npm/promise-polyfill@8/dist/polyfill.min.js"><\/script>');
}

// ResizeObserver polyfill
if (!window.ResizeObserver) {
  document.write('<script src="https://cdn.jsdelivr.net/npm/resize-observer-polyfill@1.5.1/dist/ResizeObserver.min.js"><\/script>');
}
```

```json
// babel.config.json
{
  "presets": [
    ["@babel/preset-env", {
      "targets": {
        "browsers": ["> 0.25%", "not dead", "IE 11"]
      },
      "useBuiltIns": "usage",
      "corejs": 3
    }]
  ],
  "plugins": [
    "@babel/plugin-transform-arrow-functions",
    "@babel/plugin-transform-classes"
  ]
}
```

#### 3.2 Vercel 설정 최적화
```json
// vercel.json - 프로젝트 루트에 생성
{
  "version": 2,
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "outputDirectory": "public",
  "framework": null,
  "public": true,
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/public/$1"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=3600, s-maxage=86400, stale-while-revalidate"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    },
    {
      "source": "/(.*).js",
      "headers": [
        {
          "key": "Content-Type",
          "value": "application/javascript; charset=utf-8"
        }
      ]
    },
    {
      "source": "/(.*).css",
      "headers": [
        {
          "key": "Content-Type",
          "value": "text/css; charset=utf-8"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

```json
// package.json 수정 사항
{
  "name": "mua-mvp-v3",
  "version": "3.0.0",
  "scripts": {
    "dev": "http-server ./public -p 3000",
    "build": "npm run build:js && npm run build:css && npm run copy:assets",
    "build:js": "babel public/js --out-dir public/dist/js",
    "build:css": "postcss public/css --dir public/dist/css",
    "copy:assets": "cp -r public/images public/dist/",
    "test": "jest",
    "lint": "eslint public/js"
  },
  "dependencies": {
    "xlsx": "^0.18.5",
    "pptxgenjs": "^3.12.0",
    "core-js": "^3.30.0"
  },
  "devDependencies": {
    "@babel/core": "^7.22.0",
    "@babel/preset-env": "^7.22.0",
    "@babel/cli": "^7.22.0",
    "postcss": "^8.4.24",
    "postcss-cli": "^10.1.0",
    "autoprefixer": "^10.4.14",
    "http-server": "^14.1.1",
    "eslint": "^8.42.0",
    "jest": "^29.5.0"
  }
}
```

### Phase 4: 성능 최적화 (Performance) - P3 우선순위

#### 4.1 Web Worker를 활용한 대용량 파일 처리
```javascript
// worker.js - Web Worker 파일
self.addEventListener('message', async function(e) {
  const { type, data } = e.data;
  
  switch(type) {
    case 'PROCESS_EXCEL':
      try {
        // XLSX 라이브러리 동적 로드
        importScripts('https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js');
        
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        self.postMessage({
          type: 'EXCEL_PROCESSED',
          data: jsonData
        });
      } catch (error) {
        self.postMessage({
          type: 'ERROR',
          error: error.message
        });
      }
      break;
      
    case 'PROCESS_IMAGE':
      // 이미지 리사이징 등 무거운 처리
      const processedImage = await processImage(data);
      self.postMessage({
        type: 'IMAGE_PROCESSED',
        data: processedImage
      });
      break;
  }
});

async function processImage(imageData) {
  // 이미지 처리 로직
  return imageData; // 처리된 이미지 반환
}

// main.js - 메인 스레드
class WorkerManager {
  constructor() {
    this.worker = new Worker('worker.js');
    this.callbacks = new Map();
    this.messageId = 0;
    
    this.worker.addEventListener('message', (e) => {
      const { type, data, error, id } = e.data;
      if (this.callbacks.has(id)) {
        const callback = this.callbacks.get(id);
        if (error) {
          callback.reject(error);
        } else {
          callback.resolve(data);
        }
        this.callbacks.delete(id);
      }
    });
  }
  
  async processExcel(fileData) {
    return this.sendMessage('PROCESS_EXCEL', fileData);
  }
  
  async processImage(imageData) {
    return this.sendMessage('PROCESS_IMAGE', imageData);
  }
  
  sendMessage(type, data) {
    return new Promise((resolve, reject) => {
      const id = this.messageId++;
      this.callbacks.set(id, { resolve, reject });
      this.worker.postMessage({ type, data, id });
    });
  }
  
  terminate() {
    this.worker.terminate();
  }
}
```

#### 4.2 이미지 Lazy Loading 및 최적화
```javascript
// 이미지 지연 로딩 구현
class ImageLazyLoader {
  constructor() {
    this.imageObserver = null;
    this.init();
  }
  
  init() {
    // Intersection Observer 설정
    const options = {
      root: null,
      rootMargin: '50px',
      threshold: 0.01
    };
    
    this.imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.loadImage(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, options);
    
    // 모든 lazy-load 이미지 관찰 시작
    document.querySelectorAll('img[data-lazy]').forEach(img => {
      this.imageObserver.observe(img);
    });
  }
  
  loadImage(img) {
    const src = img.dataset.lazy;
    
    // 새 이미지 객체로 미리 로드
    const tempImg = new Image();
    tempImg.onload = () => {
      img.src = src;
      img.classList.add('loaded');
      delete img.dataset.lazy;
    };
    tempImg.onerror = () => {
      img.classList.add('error');
      console.error('Failed to load image:', src);
    };
    tempImg.src = src;
  }
  
  // 수동으로 이미지 로드 (스크롤 없이)
  loadAllImages() {
    document.querySelectorAll('img[data-lazy]').forEach(img => {
      this.loadImage(img);
    });
  }
  
  destroy() {
    if (this.imageObserver) {
      this.imageObserver.disconnect();
    }
  }
}

// 이미지 압축 및 최적화
class ImageOptimizer {
  constructor(options = {}) {
    this.maxWidth = options.maxWidth || 1920;
    this.maxHeight = options.maxHeight || 1080;
    this.quality = options.quality || 0.8;
  }
  
  async optimizeImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // 리사이징 계산
          let { width, height } = this.calculateDimensions(
            img.width,
            img.height
          );
          
          canvas.width = width;
          canvas.height = height;
          
          // 이미지 그리기
          ctx.drawImage(img, 0, 0, width, height);
          
          // Blob으로 변환
          canvas.toBlob(
            (blob) => {
              resolve({
                blob,
                width,
                height,
                originalSize: file.size,
                optimizedSize: blob.size,
                compressionRatio: (blob.size / file.size * 100).toFixed(2) + '%'
              });
            },
            'image/jpeg',
            this.quality
          );
        };
        
        img.onerror = reject;
        img.src = e.target.result;
      };
      
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  
  calculateDimensions(originalWidth, originalHeight) {
    let width = originalWidth;
    let height = originalHeight;
    
    // 최대 크기 초과 시 비율 유지하며 축소
    if (width > this.maxWidth) {
      height = (this.maxWidth / width) * height;
      width = this.maxWidth;
    }
    
    if (height > this.maxHeight) {
      width = (this.maxHeight / height) * width;
      height = this.maxHeight;
    }
    
    return { width: Math.round(width), height: Math.round(height) };
  }
}
```

#### 4.3 requestAnimationFrame 최적화
```javascript
// setTimeout 대신 requestAnimationFrame 사용
class AnimationManager {
  constructor() {
    this.animations = new Map();
    this.running = false;
  }
  
  register(id, callback) {
    this.animations.set(id, callback);
    if (!this.running) {
      this.start();
    }
  }
  
  unregister(id) {
    this.animations.delete(id);
    if (this.animations.size === 0) {
      this.stop();
    }
  }
  
  start() {
    this.running = true;
    this.animate();
  }
  
  stop() {
    this.running = false;
  }
  
  animate() {
    if (!this.running) return;
    
    this.animations.forEach(callback => {
      callback();
    });
    
    requestAnimationFrame(() => this.animate());
  }
}

// 사용 예시
const animationManager = new AnimationManager();

// 드래그 중 요소 이동
function handleDrag(e) {
  animationManager.register('drag', () => {
    element.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  });
}

function handleDragEnd() {
  animationManager.unregister('drag');
}
```

## 🚀 구현 우선순위 및 일정

### 즉시 수정 (1-2일)
1. **P0-1**: 이벤트 리스너 메모리 누수 수정
2. **P0-2**: 파일 업로드 에러 처리 추가
3. **P0-3**: localStorage 자동 저장 구현

### 1주차 수정
4. **P1-1**: 반응형 좌표 시스템 구현
5. **P1-2**: 중앙집중식 상태 관리 도입
6. **P1-3**: Vercel 설정 파일 추가

### 2주차 수정
7. **P2-1**: Polyfill 및 브라우저 호환성
8. **P2-2**: Web Worker 도입
9. **P2-3**: 이미지 최적화 및 Lazy Loading

### 3주차 이후
10. **P3-1**: 성능 프로파일링 및 최적화
11. **P3-2**: 단위 테스트 추가
12. **P3-3**: PPT 생성 기능 구현

## 📝 Claude Code 실행 지침

### 단계별 수정 명령어

```bash
# 1. 프로젝트 클론 및 의존성 설치
git clone https://github.com/dkdla93/mua_mvp_v3.0.git
cd mua_mvp_v3.0
npm install

# 2. 긴급 수정사항 적용
# EventManager 클래스를 public/js/utils/event-manager.js에 생성
# StateManager 클래스를 public/js/utils/state-manager.js에 생성
# 메인 파일들에 import 및 적용

# 3. Vercel 설정 파일 생성
# vercel.json 파일을 프로젝트 루트에 생성

# 4. Babel 설정 및 빌드 스크립트 추가
# babel.config.json 생성
# package.json scripts 섹션 업데이트

# 5. 테스트 실행
npm run dev
# 브라우저에서 localhost:3000 확인

# 6. Vercel 배포
vercel --prod
```

### 파일 구조 제안
```
mua_mvp_v3.0/
├── public/
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── main.js
│   │   ├── utils/
│   │   │   ├── event-manager.js
│   │   │   ├── state-manager.js
│   │   │   ├── coordinate-system.js
│   │   │   └── file-processor.js
│   │   ├── workers/
│   │   │   └── file-worker.js
│   │   └── polyfills/
│   │       └── polyfills.js
│   └── images/
├── src/  (개발 소스, Babel 트랜스파일 전)
├── dist/ (빌드된 파일)
├── tests/
├── .gitignore
├── package.json
├── babel.config.json
├── vercel.json
└── README.md
```

## ⚠️ 주의사항

1. **백업 필수**: 모든 수정 전 현재 코드 백업
2. **단계별 테스트**: 각 수정 후 철저한 테스트 수행
3. **브라우저 테스트**: Chrome, Firefox, Safari, Edge에서 테스트
4. **모바일 테스트**: 반응형 디자인 확인
5. **성능 모니터링**: Chrome DevTools Performance 탭 활용

## 📊 예상 결과

수정 완료 시 다음과 같은 개선이 예상됩니다:

- **성능**: 50% 이상 메모리 사용량 감소
- **안정성**: 오류 발생률 90% 감소
- **호환성**: 95% 이상 브라우저 지원
- **사용성**: 상태 유지로 인한 사용자 경험 개선
- **확장성**: 향후 기능 추가 용이

## 🔄 추가 개선 제안

### 향후 고려사항
1. **TypeScript 도입**: 타입 안정성 확보
2. **React/Vue 마이그레이션**: 컴포넌트 기반 아키텍처
3. **PWA 지원**: 오프라인 기능 추가
4. **CI/CD 파이프라인**: GitHub Actions 활용
5. **모니터링**: Sentry 등 에러 트래킹 도구 도입

이 문서를 Claude Code에 전달하여 체계적으로 오류를 수정하시기 바랍니다.