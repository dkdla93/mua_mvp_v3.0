/**
 * 착공도서 자동생성 시스템 - 애플리케이션 코어
 * Construction Document Auto Generator - Application Core
 */

'use strict';

// 전역 애플리케이션 코어 클래스
window.AppCore = (function() {

    let initialized = false;
    let startTime = null;
    const bootLog = [];
    const errorHandlers = [];
    const shutdownHandlers = [];

    // 애플리케이션 상태
    const appState = {
        phase: 'initializing', // initializing, loading, ready, error, shutdown
        currentStep: 1,
        modules: {},
        errors: [],
        performance: {}
    };

    /**
     * 부트스트랩 로그 기록
     */
    function log(message, type = 'info') {
        const timestamp = Date.now() - (startTime || Date.now());
        const logEntry = {
            timestamp,
            type,
            message,
            time: new Date().toISOString()
        };

        bootLog.push(logEntry);
        AppConfig.log(`[${timestamp}ms] ${message}`, type);
    }

    /**
     * 전역 에러 핸들러 설정
     */
    function setupGlobalErrorHandling() {
        // JavaScript 런타임 에러
        window.onerror = function(message, source, lineno, colno, error) {
            const errorInfo = {
                type: 'javascript',
                message,
                source,
                line: lineno,
                column: colno,
                error: error ? error.stack : null,
                timestamp: new Date().toISOString()
            };

            handleError(errorInfo);
            return false; // 기본 에러 처리도 수행
        };

        // Promise rejection 에러
        window.addEventListener('unhandledrejection', function(event) {
            const errorInfo = {
                type: 'promise',
                message: event.reason ? event.reason.toString() : 'Unhandled Promise Rejection',
                error: event.reason ? event.reason.stack : null,
                timestamp: new Date().toISOString()
            };

            handleError(errorInfo);
        });

        log('전역 에러 핸들링 설정 완료');
    }

    /**
     * 에러 처리
     */
    function handleError(errorInfo) {
        appState.errors.push(errorInfo);
        console.error('💥 Application Error:', errorInfo);

        // 등록된 에러 핸들러들 실행
        errorHandlers.forEach(handler => {
            try {
                handler(errorInfo);
            } catch (e) {
                console.error('에러 핸들러 실행 중 오류:', e);
            }
        });

        // 심각한 에러인 경우 애플리케이션 상태 변경
        if (errorInfo.type === 'critical') {
            appState.phase = 'error';
        }
    }

    /**
     * 브라우저 환경 검사
     */
    function checkEnvironment() {
        log('브라우저 환경 검사 시작');

        const compatibility = AppConfig.checkBrowserCompatibility();
        if (!compatibility.compatible) {
            const error = {
                type: 'critical',
                message: `브라우저 호환성 문제: ${compatibility.missingFeatures.join(', ')}`,
                timestamp: new Date().toISOString()
            };

            handleError(error);
            return false;
        }

        // 필요한 라이브러리 확인
        const requiredLibraries = ['XLSX', 'PptxGenJS'];
        const missingLibraries = requiredLibraries.filter(lib => !window[lib]);

        if (missingLibraries.length > 0) {
            log(`일부 라이브러리가 로드되지 않음: ${missingLibraries.join(', ')}`, 'warn');
        }

        log('브라우저 환경 검사 완료');
        return true;
    }

    /**
     * DOM 준비 상태 확인
     */
    function waitForDOM() {
        return new Promise((resolve) => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve);
            } else {
                resolve();
            }
        });
    }

    /**
     * 필수 모듈들 정의
     */
    function defineEssentialModules() {
        log('필수 모듈 정의 시작');

        // 이미 로드된 모듈들을 ModuleLoader에 등록
        const essentialModules = [
            {
                name: 'StateManager',
                instance: window.stateManager,
                dependencies: []
            },
            {
                name: 'EventManager',
                instance: window.eventManager,
                dependencies: []
            },
            {
                name: 'FileProcessor',
                instance: window.fileProcessor,
                dependencies: ['StateManager']
            },
            {
                name: 'WorkerManager',
                instance: window.workerManager,
                dependencies: []
            }
        ];

        essentialModules.forEach(({ name, instance, dependencies }) => {
            if (instance) {
                ModuleLoader.define(name, () => Promise.resolve(instance), dependencies);
                log(`필수 모듈 등록: ${name}`);
            } else {
                log(`필수 모듈 누락: ${name}`, 'warn');
            }
        });

        log('필수 모듈 정의 완료');
    }

    /**
     * 애플리케이션 모듈들 로드
     */
    async function loadApplicationModules() {
        log('애플리케이션 모듈 로드 시작');
        appState.phase = 'loading';

        try {
            // 이미 정의된 필수 모듈들 로드
            await ModuleLoader.loadAll();

            // 추가로 로드할 모듈들이 있다면 여기서 처리
            // 예: Manager들을 별도 파일로 분리한 경우

            appState.modules = ModuleLoader.getInfo();
            log('애플리케이션 모듈 로드 완료');

        } catch (error) {
            const errorInfo = {
                type: 'critical',
                message: `모듈 로드 실패: ${error.message}`,
                error: error.stack,
                timestamp: new Date().toISOString()
            };

            handleError(errorInfo);
            throw error;
        }
    }

    /**
     * 레거시 시스템 통합
     */
    function integrateLegacySystem() {
        log('레거시 시스템 통합 시작');

        // 기존 app.js의 전역 변수들과 새 모듈 시스템 연결
        if (window.fileUploadManager) {
            appState.modules.fileUploadManager = window.fileUploadManager;
        }
        if (window.processManager) {
            appState.modules.processManager = window.processManager;
        }
        if (window.workspaceManager) {
            appState.modules.workspaceManager = window.workspaceManager;
        }
        if (window.dragDropManager) {
            appState.modules.dragDropManager = window.dragDropManager;
        }

        // 기존 appState Proxy와 연결
        if (window.appState) {
            // 기존 상태를 새 시스템으로 마이그레이션
            const legacyState = {};
            try {
                // appState의 모든 키 순회
                const keys = Object.keys(window.appState);
                keys.forEach(key => {
                    legacyState[key] = window.appState[key];
                });
            } catch (e) {
                log('레거시 상태 마이그레이션 중 오류: ' + e.message, 'warn');
            }
        }

        log('레거시 시스템 통합 완료');
    }

    /**
     * 애플리케이션 초기화
     */
    async function initialize() {
        if (initialized) {
            log('애플리케이션이 이미 초기화되었습니다', 'warn');
            return false;
        }

        startTime = Date.now();
        log('애플리케이션 초기화 시작');

        try {
            // 1. 전역 에러 핸들링 설정
            setupGlobalErrorHandling();

            // 2. 브라우저 환경 검사
            if (!checkEnvironment()) {
                throw new Error('브라우저 환경이 요구사항을 만족하지 않습니다');
            }

            // 3. DOM 준비 대기
            await waitForDOM();
            log('DOM 준비 완료');

            // 4. 필수 모듈 정의
            defineEssentialModules();

            // 5. 애플리케이션 모듈 로드
            await loadApplicationModules();

            // 6. 레거시 시스템 통합
            integrateLegacySystem();

            // 7. 초기화 완료
            appState.phase = 'ready';
            initialized = true;

            const totalTime = Date.now() - startTime;
            log(`애플리케이션 초기화 완료 (${totalTime}ms)`);

            // 초기화 완료 이벤트 발생
            if (window.eventManager) {
                window.eventManager.emit('app:initialized', {
                    totalTime,
                    modules: appState.modules,
                    bootLog
                });
            }

            return true;

        } catch (error) {
            const errorInfo = {
                type: 'critical',
                message: `애플리케이션 초기화 실패: ${error.message}`,
                error: error.stack,
                timestamp: new Date().toISOString()
            };

            handleError(errorInfo);
            appState.phase = 'error';
            throw error;
        }
    }

    /**
     * 애플리케이션 상태 조회
     */
    function getState() {
        return {
            ...appState,
            initialized,
            uptime: startTime ? Date.now() - startTime : 0,
            bootLog: [...bootLog]
        };
    }

    /**
     * 성능 정보 수집
     */
    function getPerformanceInfo() {
        const performance = {
            memory: null,
            timing: null,
            navigation: null
        };

        if (window.performance) {
            // 메모리 정보 (Chrome만 지원)
            if (window.performance.memory) {
                performance.memory = {
                    used: Math.round(window.performance.memory.usedJSHeapSize / 1024 / 1024),
                    total: Math.round(window.performance.memory.totalJSHeapSize / 1024 / 1024),
                    limit: Math.round(window.performance.memory.jsHeapSizeLimit / 1024 / 1024)
                };
            }

            // 타이밍 정보
            if (window.performance.timing) {
                const timing = window.performance.timing;
                performance.timing = {
                    domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
                    loadComplete: timing.loadEventEnd - timing.navigationStart,
                    domReady: timing.domInteractive - timing.navigationStart
                };
            }

            // 네비게이션 정보
            if (window.performance.navigation) {
                performance.navigation = {
                    type: window.performance.navigation.type,
                    redirectCount: window.performance.navigation.redirectCount
                };
            }
        }

        return performance;
    }

    /**
     * 에러 핸들러 등록
     */
    function onError(handler) {
        if (typeof handler === 'function') {
            errorHandlers.push(handler);
        }
    }

    /**
     * 종료 핸들러 등록
     */
    function onShutdown(handler) {
        if (typeof handler === 'function') {
            shutdownHandlers.push(handler);
        }
    }

    /**
     * 애플리케이션 종료
     */
    function shutdown() {
        log('애플리케이션 종료 시작');
        appState.phase = 'shutdown';

        // 등록된 종료 핸들러들 실행
        shutdownHandlers.forEach(handler => {
            try {
                handler();
            } catch (e) {
                log(`종료 핸들러 실행 중 오류: ${e.message}`, 'error');
            }
        });

        // 모듈들 정리
        Object.values(appState.modules).forEach(module => {
            if (module && typeof module.cleanup === 'function') {
                try {
                    module.cleanup();
                } catch (e) {
                    log(`모듈 정리 중 오류: ${e.message}`, 'error');
                }
            }
        });

        log('애플리케이션 종료 완료');
    }

    // 페이지 언로드 시 자동 종료
    window.addEventListener('beforeunload', shutdown);

    // Public API
    return {
        initialize,
        getState,
        getPerformanceInfo,
        onError,
        onShutdown,
        shutdown,

        // 디버그용 메서드들
        debug: {
            getBootLog: () => [...bootLog],
            getErrors: () => [...appState.errors],
            getModuleInfo: () => ModuleLoader.getInfo(),
            triggerError: (errorInfo) => handleError(errorInfo)
        }
    };
})();

console.log('✅ AppCore 초기화 완료');