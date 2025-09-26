# 착공도서 자동생성 시스템 리팩토링 계획

## 현재 문제점
- app.js 파일이 4,833줄로 너무 큼 (단일 책임 원칙 위반)
- 모듈 간 의존성이 복잡하게 얽혀있음
- 코드 재사용성과 테스트 가능성 부족
- 새로운 기능 추가 시 수정 범위가 과도하게 큼

## 새로운 아키텍처 구조

```
public/
├── index.html
├── styles.css
├── app.js (통합 진입점, 최소화)
├── js/
│   ├── core/              # 핵심 시스템
│   │   ├── app-core.js    # 애플리케이션 초기화 및 라이프사이클
│   │   ├── module-loader.js # 모듈 로딩 및 의존성 관리
│   │   └── constants.js   # 상수 및 설정값
│   ├── managers/          # 각 기능별 관리자
│   │   ├── file-upload-manager.js
│   │   ├── process-manager.js
│   │   ├── workspace-manager.js
│   │   ├── drag-drop-manager.js
│   │   ├── coordinate-system-manager.js
│   │   └── ppt-generator-manager.js
│   ├── services/          # 비즈니스 로직 서비스
│   │   ├── excel-service.js
│   │   ├── image-service.js
│   │   ├── material-service.js
│   │   ├── scene-service.js
│   │   └── minimap-service.js
│   ├── components/        # UI 컴포넌트
│   │   ├── step-navigator.js
│   │   ├── material-table.js
│   │   ├── scene-viewer.js
│   │   ├── minimap-viewer.js
│   │   └── progress-tracker.js
│   ├── utils/             # 기존 유틸리티 (개선)
│   │   ├── state-manager.js
│   │   ├── event-manager.js
│   │   ├── file-processor.js
│   │   ├── worker-manager.js
│   │   ├── coordinate-system.js
│   │   ├── ui-utils.js    # 모달, 로딩 등
│   │   └── validation-utils.js
│   ├── polyfills/
│   │   └── polyfills.js
│   └── workers/
│       └── file-worker.js
└── vercel.json
```

## 모듈 분리 원칙

### 1. 단일 책임 원칙 (SRP)
- 각 모듈은 하나의 명확한 책임만 가짐
- Manager는 특정 기능 영역의 조정자 역할
- Service는 순수한 비즈니스 로직 처리
- Component는 UI 표현 및 사용자 상호작용

### 2. 의존성 역전 원칙 (DIP)
- 상위 모듈이 하위 모듈에 의존하지 않도록 인터페이스 정의
- 각 Manager는 Service를 통해서만 비즈니스 로직에 접근

### 3. 개방-폐쇄 원칙 (OCP)
- 새로운 기능 추가 시 기존 코드 수정 최소화
- 플러그인 방식으로 기능 확장 가능

## 주요 개선사항

### 1. 모듈 로딩 시스템
```javascript
// module-loader.js
class ModuleLoader {
    static async loadModule(moduleName, dependencies = []) {
        // 의존성 해결 및 모듈 로딩
    }

    static registerModule(name, module, dependencies) {
        // 모듈 등록 및 의존성 관리
    }
}
```

### 2. 통일된 이벤트 시스템
```javascript
// 모든 Manager는 EventManager를 통해 통신
eventManager.emit('material:matched', { materialIndex, sceneIndex });
eventManager.on('scene:selected', this.handleSceneSelection.bind(this));
```

### 3. 서비스 레이어 분리
```javascript
// material-service.js - 순수한 비즈니스 로직
class MaterialService {
    static matchMaterialToScene(materialIndex, sceneIndex) {
        // 매칭 로직만 처리
    }

    static validateMaterial(material) {
        // 유효성 검사만 처리
    }
}
```

### 4. 컴포넌트 기반 UI
```javascript
// material-table.js - UI 컴포넌트만 담당
class MaterialTable {
    render(materials, matchedMaterials) {
        // 테이블 렌더링만 처리
    }

    bindEvents() {
        // 이벤트 바인딩만 처리
    }
}
```

## 리팩토링 단계

### Phase 1: 기반 시스템 구축
1. 모듈 로더 및 의존성 관리 시스템 구축
2. 이벤트 시스템 통합 및 개선
3. 서비스 레이어 기본 구조 생성

### Phase 2: Manager 분리
1. 각 Manager를 독립 모듈로 분리
2. Manager 간 의존성을 이벤트 기반으로 전환
3. 상태 관리 중앙화

### Phase 3: 서비스 레이어 구현
1. 비즈니스 로직을 Service로 분리
2. 데이터 처리 로직 최적화
3. 유효성 검사 로직 분리

### Phase 4: UI 컴포넌트화
1. UI 로직을 Component로 분리
2. 재사용 가능한 컴포넌트 라이브러리 구축
3. 반응형 UI 개선

### Phase 5: 최적화 및 테스트
1. 성능 최적화 (메모리, 속도)
2. 단위 테스트 추가
3. E2E 테스트 강화

## 호환성 보장

### 1. 점진적 마이그레이션
- 기존 기능을 유지하면서 단계적으로 리팩토링
- 각 단계마다 기능 테스트 실시

### 2. 레거시 지원
- 기존 API 호환성 유지
- 전환 과정에서 두 시스템 병행 운영

### 3. 사용자 영향 최소화
- 사용자가 느낄 수 있는 변경사항 없음
- 성능 향상만 체감 가능

## 성공 지표

1. **코드 품질**
   - 각 파일 500줄 이하 유지
   - 순환 의존성 제거
   - 코드 중복률 20% 이하

2. **성능**
   - 초기 로딩 시간 30% 단축
   - 메모리 사용량 25% 감소
   - 파일 처리 속도 20% 향상

3. **유지보수성**
   - 새 기능 추가 시 수정 파일 수 50% 감소
   - 버그 수정 시간 40% 단축
   - 코드 리뷰 시간 30% 단축

4. **확장성**
   - 새로운 파일 형식 지원 용이성
   - 새로운 워크플로우 단계 추가 용이성
   - 다국어 지원 확장성