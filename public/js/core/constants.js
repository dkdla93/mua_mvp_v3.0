/**
 * 착공도서 자동생성 시스템 - 상수 및 설정 관리
 * Construction Document Auto Generator - Constants & Configuration
 */

'use strict';

// 전역 상수 객체
window.APP_CONSTANTS = {
    // 애플리케이션 기본 설정
    APP: {
        NAME: '착공도서 자동생성 시스템',
        VERSION: '3.0.0',
        AUTHOR: 'Construction Document Generator',
        MAX_RETRY_ATTEMPTS: 3,
        DEFAULT_TIMEOUT: 30000 // 30초
    },

    // 워크플로우 단계
    STEPS: {
        FILE_UPLOAD: 1,
        PROCESS_MANAGEMENT: 2,
        MATERIAL_MATCHING: 3,
        GENERATION: 4,
        STEP_NAMES: {
            1: '파일 업로드',
            2: '공정 관리',
            3: '자재 매칭 & 배치',
            4: '문서 생성'
        }
    },

    // 파일 관련 설정
    FILES: {
        MAX_SIZES: {
            excel: 10 * 1024 * 1024,  // 10MB
            image: 50 * 1024 * 1024,  // 50MB
            total: 100 * 1024 * 1024  // 100MB
        },
        ALLOWED_EXTENSIONS: {
            excel: ['.xlsx', '.xls'],
            image: ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
            ppt: ['.pptx', '.ppt']
        },
        MIME_TYPES: {
            excel: [
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-excel'
            ],
            image: [
                'image/jpeg', 'image/jpg', 'image/png',
                'image/gif', 'image/bmp', 'image/webp'
            ]
        }
    },

    // UI 관련 설정
    UI: {
        MODAL_ANIMATION_DURATION: 300,
        LOADING_MIN_DURATION: 1000,
        NOTIFICATION_TIMEOUT: 5000,
        DRAG_DROP_ANIMATION_DURATION: 200,
        SCROLL_ANIMATION_DURATION: 500
    },

    // 이미지 처리 설정
    IMAGE: {
        MAX_DIMENSIONS: {
            width: 1920,
            height: 1080
        },
        QUALITY: 0.8,
        CANVAS_MAX_SIZE: 4096,
        THUMBNAIL_SIZE: 150
    },

    // 상태 관리 설정
    STATE: {
        STORAGE_KEY: 'construction_app_state',
        AUTO_SAVE_INTERVAL: 10000, // 10초
        MAX_HISTORY_SIZE: 50,
        CACHE_EXPIRY: 24 * 60 * 60 * 1000 // 24시간
    },

    // 드래그앤드롭 설정
    DRAG_DROP: {
        SNAP_THRESHOLD: 10,
        MIN_DRAG_DISTANCE: 5,
        SCROLL_EDGE_SIZE: 50,
        SCROLL_SPEED: 20
    },

    // Excel 처리 설정
    EXCEL: {
        SHEET_NAMES: {
            MAIN: '자재목록',
            MATERIALS: '자재',
            SUMMARY: '요약'
        },
        COLUMNS: {
            MATERIAL: '자재명',
            AREA: '구역',
            ITEM: '품목',
            SPEC: '규격',
            UNIT: '단위',
            QUANTITY: '수량',
            NOTE: '비고'
        },
        MAX_ROWS: 10000,
        MAX_SHEETS: 10
    },

    // PPT 생성 설정
    PPT: {
        SLIDE_SIZE: {
            width: 10,
            height: 5.63
        },
        MARGINS: {
            top: 0.5,
            bottom: 0.5,
            left: 0.5,
            right: 0.5
        },
        FONT: {
            family: '맑은 고딕',
            size: 12,
            color: '000000'
        },
        TITLE_FONT: {
            family: '맑은 고딕',
            size: 18,
            color: '000000',
            bold: true
        }
    },

    // 성능 관련 설정
    PERFORMANCE: {
        CHUNK_SIZE: 1000,
        BATCH_SIZE: 50,
        DEBOUNCE_DELAY: 300,
        THROTTLE_DELAY: 100,
        MAX_CONCURRENT_UPLOADS: 3
    },

    // 오류 메시지
    ERRORS: {
        FILE_TOO_LARGE: '파일 크기가 너무 큽니다.',
        INVALID_FILE_TYPE: '지원하지 않는 파일 형식입니다.',
        NETWORK_ERROR: '네트워크 연결을 확인해주세요.',
        PROCESSING_ERROR: '파일 처리 중 오류가 발생했습니다.',
        VALIDATION_ERROR: '입력값이 올바르지 않습니다.',
        BROWSER_NOT_SUPPORTED: '현재 브라우저에서 지원하지 않는 기능입니다.'
    },

    // 성공 메시지
    SUCCESS: {
        FILE_UPLOADED: '파일이 성공적으로 업로드되었습니다.',
        PROCESS_CREATED: '공정이 생성되었습니다.',
        MATERIALS_MATCHED: '자재 매칭이 완료되었습니다.',
        PPT_GENERATED: 'PowerPoint 문서가 생성되었습니다.',
        STATE_SAVED: '작업 상태가 저장되었습니다.'
    },

    // 브라우저 호환성
    BROWSER: {
        MIN_VERSIONS: {
            chrome: 60,
            firefox: 55,
            safari: 12,
            edge: 79,
            ie: 11
        },
        REQUIRED_FEATURES: [
            'FileReader',
            'localStorage',
            'querySelector',
            'addEventListener',
            'JSON'
        ]
    },

    // API 관련 설정 (향후 확장용)
    API: {
        BASE_URL: '',
        TIMEOUT: 30000,
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000
    },

    // 개발/디버그 설정
    DEBUG: {
        ENABLED: false, // 프로덕션에서는 false
        CONSOLE_LOGS: false,
        PERFORMANCE_MONITORING: false,
        ERROR_REPORTING: true
    }
};

// 환경 감지 및 설정 조정
(function initializeEnvironment() {
    // 개발 환경 감지
    const isDevelopment = window.location.hostname === 'localhost' ||
                         window.location.hostname.includes('127.0.0.1') ||
                         window.location.search.includes('debug=true');

    if (isDevelopment) {
        APP_CONSTANTS.DEBUG.ENABLED = true;
        APP_CONSTANTS.DEBUG.CONSOLE_LOGS = true;
        APP_CONSTANTS.DEBUG.PERFORMANCE_MONITORING = true;
    }

    // 모바일 기기 감지 및 설정 조정
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        APP_CONSTANTS.FILES.MAX_SIZES.image = 20 * 1024 * 1024; // 모바일에서는 20MB 제한
        APP_CONSTANTS.PERFORMANCE.CHUNK_SIZE = 500; // 모바일에서는 더 작은 청크
    }

    console.log(`🏗️ 환경 초기화 완료: ${isDevelopment ? '개발' : '운영'} 모드`);
    if (isMobile) console.log('📱 모바일 환경 감지됨');
})();

// 설정 유틸리티 함수들
window.AppConfig = {
    /**
     * 설정값 가져오기
     */
    get: function(path, defaultValue) {
        const keys = path.split('.');
        let value = APP_CONSTANTS;

        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return defaultValue;
            }
        }

        return value;
    },

    /**
     * 파일 크기 검증
     */
    isValidFileSize: function(file, type) {
        const maxSize = this.get(`FILES.MAX_SIZES.${type}`, 0);
        return file.size <= maxSize;
    },

    /**
     * 파일 확장자 검증
     */
    isValidFileExtension: function(filename, type) {
        const allowedExtensions = this.get(`FILES.ALLOWED_EXTENSIONS.${type}`, []);
        const ext = '.' + filename.split('.').pop().toLowerCase();
        return allowedExtensions.includes(ext);
    },

    /**
     * MIME 타입 검증
     */
    isValidMimeType: function(mimeType, type) {
        const allowedTypes = this.get(`FILES.MIME_TYPES.${type}`, []);
        return allowedTypes.includes(mimeType);
    },

    /**
     * 브라우저 호환성 검사
     */
    checkBrowserCompatibility: function() {
        const requiredFeatures = this.get('BROWSER.REQUIRED_FEATURES', []);
        const unsupportedFeatures = [];

        for (const feature of requiredFeatures) {
            if (!(feature in window)) {
                unsupportedFeatures.push(feature);
            }
        }

        return {
            compatible: unsupportedFeatures.length === 0,
            missingFeatures: unsupportedFeatures
        };
    },

    /**
     * 디버그 로그 출력
     */
    log: function(message, type = 'log') {
        if (this.get('DEBUG.CONSOLE_LOGS', false)) {
            console[type](`[APP] ${message}`);
        }
    },

    /**
     * 성능 측정 시작
     */
    startPerformance: function(label) {
        if (this.get('DEBUG.PERFORMANCE_MONITORING', false) && window.performance) {
            window.performance.mark(`${label}-start`);
        }
    },

    /**
     * 성능 측정 종료
     */
    endPerformance: function(label) {
        if (this.get('DEBUG.PERFORMANCE_MONITORING', false) && window.performance) {
            window.performance.mark(`${label}-end`);
            window.performance.measure(label, `${label}-start`, `${label}-end`);

            const measure = window.performance.getEntriesByName(label)[0];
            this.log(`Performance ${label}: ${measure.duration.toFixed(2)}ms`, 'info');
        }
    }
};

console.log('✅ Constants 및 AppConfig 초기화 완료');