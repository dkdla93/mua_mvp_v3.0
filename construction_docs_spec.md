# 착공도서 자동생성 시스템 - 개발 명세서

## 1. 프로젝트 개요

### 목적
인테리어 착공도서를 자동으로 생성하는 경량 웹앱. 사용자가 업로드한 파일들을 분석하여 PowerPoint 형태의 착공도서를 자동 생성.

### 핵심 워크플로우
```
입력 → 처리 → 출력
├─ 엑셀(자재표)      ├─ 엑셀 파싱           ├─ PPTX 파일
├─ 미니맵 이미지     ├─ 장면별 자재 매칭    │  ├─ 장면 이미지
└─ 장면 이미지들     ├─ 미니맵 위치 지정    │  ├─ 미니맵 + 위치박스
                     └─ PPT 생성            │  └─ 자재 스펙표
```

## 2. 기술 스택 & 아키텍처

### 프론트엔드 전용 (백엔드 없음)
- **HTML/CSS/JavaScript (ES5 호환)**
- **외부 라이브러리:**
  - SheetJS (xlsx.full.min.js) - 엑셀 파싱
  - PptxGenJS - PPT 생성
- **배포:** Vercel 정적 호스팅

### 파일 구조
```
public/
├── index.html          # 메인 UI
├── app.js             # 핵심 로직
├── styles.css         # 스타일링
├── vercel.json        # 배포 설정
├── package.json       # 프로젝트 정보
└── README.md          # 문서
```

## 3. 사용자 인터페이스 (3단계 워크플로우)

### 1단계: 파일 업로드
- **엑셀 파일** (.xlsx, .xls) - 자재표 정보
- **미니맵 이미지** - 전체 평면도
- **장면 이미지들** - 공간별 렌더/사진 (다중 선택)

### 2단계: 매칭 & 위치 지정
- **장면 선택:** 썸네일 리스트에서 장면 선택
- **자재 선택:** 체크박스로 장면별 자재 매칭
- **미니맵 위치:** 드래그로 장면 위치 박스 그리기
- **필터링:** 탭명(시트명)으로 자재 필터링

### 3단계: 생성 & 다운로드
- **미리보기:** HTML로 슬라이드 미리보기
- **PPT 생성:** 장면별 슬라이드가 포함된 PPTX 다운로드

## 4. 데이터 구조

### 전역 상태 (appState)
```javascript
appState = {
  // 엑셀 관련
  excelData: null,              // 현재 선택된 시트의 2차원 배열
  allSheets: {},                // { sheetName: 2D-array }
  currentSheet: null,           // 선택된 시트명
  
  // 이미지 관련
  minimapImage: null,           // 미니맵 dataURL
  sceneImages: [],              // [{name, data, index}]
  
  // 자재 & 매핑
  materials: [],                // 파싱된 자재 리스트
  sceneMaterialMapping: {},     // { sceneIdx: [materialId, ...] }
  
  // UI 상태
  currentSelectedScene: 0,      // 현재 선택된 장면
  minimapBoxes: {}              // { sceneIdx: {x,y,w,h} } 정규화 좌표
}
```

### 자재 객체 구조
```javascript
material = {
  id: number,                   // 고유 ID
  tabName: string,              // 시트명 (필터링 용도)
  displayId: string,            // 표시용 ID (#시트명)
  category: string,             // 카테고리 (MATERIAL/SWITCH/LIGHT 등)
  material: string,             // 자재명 (주요 필드)
  area: string,                 // 공간/영역
  item: string,                 // 항목명
  remarks: string,              // 비고
  brand: string,                // 브랜드
  imageUrl: string,             // 이미지 URL
  image: string                 // 이미지 데이터 (imageUrl과 동일)
}
```

## 5. 엑셀 파싱 로직

### 핵심 전략
1. **다중 시트 지원**: 시트명에 숫자 접두(1., 2. 등)가 있거나 "1."이 포함된 시트 우선 선택
2. **유연한 헤더 탐지**: 상단 40행 내에서 키워드 탐색
3. **라벨-값 추출**: 키워드 오른쪽 6칸 내 첫 번째 non-empty 값

### 파싱 키워드
- **AREA**: 새로운 자재 항목 시작점
- **MATERIAL**: 자재명 (없으면 그룹라벨/카테고리/시트명으로 폴백)
- **ITEM**: 항목명
- **REMARKS/REMARK**: 비고 (라벨 자체는 필터링)
- **IMAGE**: 이미지 URL (data:, http(s):, HYPERLINK 형태 지원)

### 이미지 URL 추출 규칙
```javascript
// 지원 형태들
1. data:image/jpeg;base64,... 
2. https://example.com/image.jpg
3. HYPERLINK("https://...","설명")
4. 확장자 없는 이미지 응답 URL
```

### 그룹화 로직
- **currentCategory**: MATERIAL/SWITCH/LIGHT 등 A열의 큰 카테고리
- **currentGroupLabel**: A열의 구역 라벨 (예: "WALL COVERING")
- AREA 이후 MATERIAL이 비어있으면 위 값들로 폴백

## 6. UI 컴포넌트 상세

### 장면 선택기 (Scene Selector)
- 썸네일 표시 (80x60px)
- 활성 상태 표시
- 선택된 자재 개수 표시

### 자재 테이블
- 필터링 탭 버튼 (시트별)
- 체크박스 선택/해제
- 이미지 썸네일 (40x30px)
- 행별 호버 효과

### 미니맵 캔버스
- 드래그로 빨간 박스 그리기
- 정규화 좌표 (0~1) 저장
- 장면별 박스 정보 유지
- Reset 버튼으로 박스 삭제

## 7. PPT 생성 명세

### 슬라이드 레이아웃 (16:9)
```
전체 크기: 10in × 5.625in

┌─────────────────────────────────────────┐
│ 제목 (x:0.5, y:0.3)                     │
│ ┌──────────────┐  ┌───────────┐        │
│ │              │  │ 미니맵     │        │
│ │  장면 이미지   │  │ + 위치박스 │        │
│ │  (6.0×3.0~3.3)│  │ (2.9×2.1) │        │
│ │              │  │           │        │
│ └──────────────┘  └───────────┘        │
│ ┌─────────────────────────────────────┐ │
│ │        자재 테이블                   │ │
│ │ (행 수에 따라 높이 자동 조절)         │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 테이블 구조
- **컬럼**: No., 탭명, MATERIAL, AREA, ITEM, REMARKS, IMAGE
- **행 높이**: 0.16~0.28인치 (자재 개수에 따라 자동 계산)
- **이미지 처리**: 텍스트 대신 오버레이로 썸네일 삽입

## 8. 핵심 알고리즘

### 좌표 정규화
```javascript
// 캔버스 좌표 → 정규화 좌표 (0~1)
normalized = {
  x: canvasX / canvas.width,
  y: canvasY / canvas.height,
  w: canvasW / canvas.width,
  h: canvasH / canvas.height
}
```

### 안정적 이미지 추출 (robustPickImage)
```javascript
// 우선순위별 탐색
1. imageCol 위치의 값
2. imageCol+1 위치의 값  
3. 같은 행에서 "IMAGE" 라벨 오른쪽 값
4. 아래 1~2행에서 동일한 순서로 재시도
```

### 테이블 오버플로우 방지
```javascript
availableHeight = 5.2 - tableY;
rowHeight = Math.max(0.16, Math.min(0.28, availableHeight / rowCount));
```

## 9. 오류 처리 & 예외 상황

### 파일 업로드 실패
- 엑셀: 워크북 파싱 실패 시 명확한 오류 메시지
- 이미지: 로드 실패 시 대체 처리

### 파싱 실패 케이스
- 빈 시트 또는 키워드 없음 → 사용자 안내
- 이미지 URL 인식 실패 → "없음" 표시
- HYPERLINK 파싱 오류 → 원본 텍스트 유지

### UI 안정성
- 빈 자재 리스트 → 안내 메시지 표시
- 미니맵 없이 PPT 생성 시 → 경고 후 중단
- 장면-자재 매핑 없음 → 선택 요청 메시지

## 10. 성능 최적화 포인트

### 메모리 관리
- 이미지는 dataURL로 메모리에 저장 (localStorage 사용 불가)
- 캔버스 임시 객체는 사용 후 정리
- 대용량 엑셀 파일 처리 시 청크 단위 파싱 고려

### UI 반응성
- 파일 업로드 진행률 표시
- PPT 생성 진행률 바
- 비동기 처리로 UI 블로킹 방지

## 11. 확장 가능성 (v2.5 대비)

### 장면 위 번호 뱃지 기능 (향후)
```javascript
// 추가될 상태
sceneMarkers: {
  [sceneIdx]: [
    { label: "1", x: 0.3, y: 0.5, materialId: 123 },
    { label: "2", x: 0.7, y: 0.3, materialId: 124 }
  ]
}
```

### 다국어 지원 준비
- 키워드 사전 확장 가능한 구조
- 폰트 감지 로직 (한글/영문)

## 12. 개발 시 주의사항

### 브라우저 호환성
- ES5 문법 사용 (IE11 호환성 고려)
- 모던 브라우저 API는 polyfill 필요 시 추가

### 디버깅 포인트
1. 엑셀 파싱 결과 console.log로 확인
2. 이미지 URL 추출 실패 시 원본 셀 값 검사
3. PPT 생성 시 좌표 계산 오류 점검

### 테스트 케이스
- 다양한 엑셀 레이아웃 (헤더 위치, 시트 구성)
- 이미지 URL 형태별 파싱 테스트
- 극단적 자재 개수 (1개, 50개 이상)
- 미니맵 박스 경계값 처리

---

**개발 우선순위**
1. 기본 파일 업로드 & 파싱 안정화
2. UI 컴포넌트 구현 (장면 선택, 자재 테이블)
3. 미니맵 캔버스 드로잉 기능
4. PPT 생성 & 테이블 레이아웃 최적화
5. 예외 처리 & 사용자 경험 개선