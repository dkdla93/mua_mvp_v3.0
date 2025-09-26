/**
 * StateManager - 중앙집중식 상태 관리 유틸리티
 * localStorage 기반 상태 지속성, 구독/알림, 히스토리 관리를 제공합니다.
 */

'use strict';

(function(global) {
    // StateManager 클래스 정의
    function StateManager(options) {
        this.options = Object.assign({
            storageKey: 'mua_state',
            autoSaveDelay: 2000,           // 자동 저장 지연 시간 (2초)
            maxHistorySize: 50,            // 최대 히스토리 크기
            enableHistory: true,           // 히스토리 기능 활성화
            compressionThreshold: 100000   // 압축 임계값 (100KB)
        }, options || {});

        // 상태 초기화
        this.state = this.loadFromStorage() || this.getInitialState();
        this.subscribers = new Set();
        this.history = [];
        this.historyIndex = -1;

        // 자동 저장 디바운싱 함수 생성
        this.autoSave = this.debounce(this.saveToStorage.bind(this), this.options.autoSaveDelay);

        // 브라우저 언로드 시 강제 저장
        this.setupUnloadHandler();

        console.log('StateManager 초기화 완료:', this.options);
    }

    StateManager.prototype = {
        constructor: StateManager,

        /**
         * 초기 상태 정의
         */
        getInitialState: function() {
            return {
                // 파일 관련 데이터
                files: {
                    excel: null,
                    minimap: null,
                    scenes: []
                },

                // Excel 데이터
                excelData: null,
                allSheets: {},
                currentSheet: null,
                materials: [],

                // 공정 관리
                processes: [
                    {
                        id: 'process_1',
                        name: '공정1',
                        selectedScenes: [],
                        isActive: true
                    }
                ],
                currentProcess: 'process_1',

                // 자재 매핑 (공정별)
                sceneMaterialMapping: {
                    'process_1': {}
                },

                // 자재 위치 배치 (공정별)
                sceneMaterialPositions: {
                    'process_1': {}
                },

                // 미니맵 박스 (공정별)
                minimapBoxes: {
                    'process_1': {}
                },

                // UI 상태
                currentStep: 1,
                currentSelectedScene: 0,
                nextPositionNumber: 1,

                // 메타데이터
                metadata: {
                    version: '3.0.0',
                    createdAt: new Date().toISOString(),
                    lastModifiedAt: new Date().toISOString()
                }
            };
        },

        /**
         * 상태 업데이트 메인 메서드
         * @param {string} path - 상태 경로 (예: 'files.excel')
         * @param {*} value - 새로운 값
         * @param {boolean} saveToHistory - 히스토리 저장 여부
         */
        updateState: function(path, value, saveToHistory) {
            if (saveToHistory === undefined) {
                saveToHistory = this.options.enableHistory;
            }

            // 히스토리 저장
            if (saveToHistory) {
                this.saveHistory();
            }

            // 상태 업데이트
            this.setNestedValue(this.state, path, value);

            // 메타데이터 업데이트
            this.state.metadata.lastModifiedAt = new Date().toISOString();

            // 구독자들에게 알림
            this.notifySubscribers({
                type: 'update',
                path: path,
                value: value,
                state: this.state
            });

            // 자동 저장
            this.autoSave();

            return this;
        },

        /**
         * 상태 가져오기
         * @param {string} path - 상태 경로 (선택사항)
         */
        getState: function(path) {
            if (path) {
                return this.getNestedValue(this.state, path);
            }
            return this.state;
        },

        /**
         * 여러 상태 일괄 업데이트
         * @param {Object} updates - 업데이트할 상태들 { path: value }
         * @param {boolean} saveToHistory - 히스토리 저장 여부
         */
        updateMultiple: function(updates, saveToHistory) {
            if (saveToHistory === undefined) {
                saveToHistory = this.options.enableHistory;
            }

            if (saveToHistory) {
                this.saveHistory();
            }

            var changedPaths = [];

            // 모든 업데이트 적용
            for (var path in updates) {
                if (updates.hasOwnProperty(path)) {
                    this.setNestedValue(this.state, path, updates[path]);
                    changedPaths.push(path);
                }
            }

            // 메타데이터 업데이트
            this.state.metadata.lastModifiedAt = new Date().toISOString();

            // 구독자들에게 알림
            this.notifySubscribers({
                type: 'batch_update',
                paths: changedPaths,
                updates: updates,
                state: this.state
            });

            // 자동 저장
            this.autoSave();

            return this;
        },

        /**
         * 상태 초기화
         * @param {boolean} preserveFiles - 파일 데이터 보존 여부
         */
        resetState: function(preserveFiles) {
            var filesToPreserve = null;

            if (preserveFiles) {
                filesToPreserve = this.state.files;
            }

            this.saveHistory();
            this.state = this.getInitialState();

            if (preserveFiles && filesToPreserve) {
                this.state.files = filesToPreserve;
            }

            this.notifySubscribers({
                type: 'reset',
                preserveFiles: !!preserveFiles,
                state: this.state
            });

            this.autoSave();
            return this;
        },

        /**
         * 상태 변경 구독
         * @param {Function} callback - 콜백 함수
         * @returns {Function} 구독 해제 함수
         */
        subscribe: function(callback) {
            this.subscribers.add(callback);

            // 구독 해제 함수 반환
            return function() {
                this.subscribers.delete(callback);
            }.bind(this);
        },

        /**
         * 특정 경로의 상태 변경 구독
         * @param {string} path - 감시할 경로
         * @param {Function} callback - 콜백 함수
         * @returns {Function} 구독 해제 함수
         */
        subscribeTo: function(path, callback) {
            var self = this;
            var wrappedCallback = function(eventData) {
                // 해당 경로의 변경만 알림
                if (eventData.path === path || (eventData.paths && eventData.paths.includes(path))) {
                    callback(eventData);
                }
            };

            this.subscribers.add(wrappedCallback);

            return function() {
                self.subscribers.delete(wrappedCallback);
            };
        },

        /**
         * 구독자들에게 알림
         * @param {Object} eventData - 이벤트 데이터
         */
        notifySubscribers: function(eventData) {
            this.subscribers.forEach(function(callback) {
                try {
                    callback(eventData);
                } catch (error) {
                    console.error('StateManager 구독자 콜백 오류:', error);
                }
            });
        },

        /**
         * localStorage에 상태 저장
         */
        saveToStorage: function() {
            try {
                // 저장할 상태 준비 (대용량 데이터 제외)
                var stateToSave = this.createLightState();
                var stateJson = JSON.stringify(stateToSave);

                // 압축 임계값 확인
                if (stateJson.length > this.options.compressionThreshold) {
                    console.log('StateManager: 대용량 데이터 감지, 경량화 수행');
                    stateToSave = this.createMinimalState();
                    stateJson = JSON.stringify(stateToSave);
                }

                localStorage.setItem(this.options.storageKey, stateJson);

                // 백업도 저장 (용량 오류 복구용)
                this.saveBackup(stateToSave);

                console.log('StateManager: 상태 저장 완료 (' +
                    Math.round(stateJson.length / 1024) + 'KB)');

            } catch (error) {
                console.error('StateManager: 상태 저장 실패:', error);

                // localStorage 용량 초과 시 정리 시도
                if (error.name === 'QuotaExceededError') {
                    this.cleanupOldData();

                    // 재시도
                    try {
                        var minimalState = this.createMinimalState();
                        localStorage.setItem(this.options.storageKey, JSON.stringify(minimalState));
                        console.log('StateManager: 경량화 후 저장 성공');
                    } catch (retryError) {
                        console.error('StateManager: 경량화 저장도 실패:', retryError);
                    }
                }
            }
        },

        /**
         * localStorage에서 상태 로드
         */
        loadFromStorage: function() {
            try {
                var saved = localStorage.getItem(this.options.storageKey);

                if (saved) {
                    var parsedState = JSON.parse(saved);

                    // 버전 호환성 확인
                    if (this.isCompatibleVersion(parsedState)) {
                        // 현재 상태 스키마와 병합
                        var mergedState = this.mergeWithInitialState(parsedState);
                        console.log('StateManager: 상태 로드 성공');
                        return mergedState;
                    } else {
                        console.warn('StateManager: 비호환 버전 감지, 백업에서 복구 시도');
                        return this.loadFromBackup() || this.getInitialState();
                    }
                } else {
                    console.log('StateManager: 저장된 상태 없음, 초기 상태 사용');
                    return null;
                }

            } catch (error) {
                console.error('StateManager: 상태 로드 실패:', error);

                // 백업에서 복구 시도
                var backupState = this.loadFromBackup();
                if (backupState) {
                    console.log('StateManager: 백업에서 복구 성공');
                    return backupState;
                }

                console.log('StateManager: 백업 복구 실패, 초기 상태 사용');
                return null;
            }
        },

        /**
         * 경량화된 상태 생성 (이미지 데이터 제외)
         */
        createLightState: function() {
            var lightState = JSON.parse(JSON.stringify(this.state)); // 깊은 복사

            // 대용량 데이터 제거 또는 참조로 변경
            if (lightState.files) {
                // 이미지 데이터는 'stored' 문자열로 대체
                if (lightState.files.minimap) {
                    lightState.files.minimap = 'stored';
                }

                if (lightState.files.scenes && lightState.files.scenes.length > 0) {
                    lightState.files.scenes = lightState.files.scenes.map(function() {
                        return 'stored';
                    });
                }
            }

            return lightState;
        },

        /**
         * 최소화된 상태 생성 (핵심 데이터만)
         */
        createMinimalState: function() {
            return {
                processes: this.state.processes,
                currentProcess: this.state.currentProcess,
                sceneMaterialMapping: this.state.sceneMaterialMapping,
                sceneMaterialPositions: this.state.sceneMaterialPositions,
                minimapBoxes: this.state.minimapBoxes,
                currentStep: this.state.currentStep,
                nextPositionNumber: this.state.nextPositionNumber,
                metadata: {
                    version: this.state.metadata.version,
                    lastModifiedAt: new Date().toISOString(),
                    isMinimal: true
                }
            };
        },

        /**
         * 초기 상태와 저장된 상태 병합
         * @param {Object} savedState - 저장된 상태
         */
        mergeWithInitialState: function(savedState) {
            var initialState = this.getInitialState();
            return this.deepMerge(initialState, savedState);
        },

        /**
         * 버전 호환성 확인
         * @param {Object} savedState - 저장된 상태
         */
        isCompatibleVersion: function(savedState) {
            if (!savedState.metadata || !savedState.metadata.version) {
                return false;
            }

            var savedVersion = savedState.metadata.version;
            var currentVersion = this.getInitialState().metadata.version;

            // 간단한 버전 호환성 체크 (메이저 버전만)
            var savedMajor = parseInt(savedVersion.split('.')[0]);
            var currentMajor = parseInt(currentVersion.split('.')[0]);

            return savedMajor === currentMajor;
        },

        /**
         * 히스토리에 현재 상태 저장
         */
        saveHistory: function() {
            if (!this.options.enableHistory) return;

            // 현재 인덱스 이후의 히스토리 제거 (새로운 분기)
            this.history = this.history.slice(0, this.historyIndex + 1);

            // 현재 상태를 히스토리에 추가
            var stateSnapshot = JSON.stringify(this.state);
            this.history.push(stateSnapshot);
            this.historyIndex++;

            // 히스토리 크기 제한
            if (this.history.length > this.options.maxHistorySize) {
                var excess = this.history.length - this.options.maxHistorySize;
                this.history = this.history.slice(excess);
                this.historyIndex -= excess;
            }
        },

        /**
         * 실행 취소 (Undo)
         */
        undo: function() {
            if (!this.options.enableHistory || this.historyIndex <= 0) {
                return false;
            }

            this.historyIndex--;
            this.state = JSON.parse(this.history[this.historyIndex]);

            this.notifySubscribers({
                type: 'undo',
                state: this.state,
                historyIndex: this.historyIndex
            });

            this.autoSave();
            return true;
        },

        /**
         * 다시 실행 (Redo)
         */
        redo: function() {
            if (!this.options.enableHistory || this.historyIndex >= this.history.length - 1) {
                return false;
            }

            this.historyIndex++;
            this.state = JSON.parse(this.history[this.historyIndex]);

            this.notifySubscribers({
                type: 'redo',
                state: this.state,
                historyIndex: this.historyIndex
            });

            this.autoSave();
            return true;
        },

        /**
         * 중첩된 객체에서 값 가져오기
         * @param {Object} obj - 대상 객체
         * @param {string} path - 경로 ('a.b.c')
         */
        getNestedValue: function(obj, path) {
            var keys = path.split('.');
            var current = obj;

            for (var i = 0; i < keys.length; i++) {
                if (current === null || current === undefined) {
                    return undefined;
                }
                current = current[keys[i]];
            }

            return current;
        },

        /**
         * 중첩된 객체에 값 설정
         * @param {Object} obj - 대상 객체
         * @param {string} path - 경로 ('a.b.c')
         * @param {*} value - 설정할 값
         */
        setNestedValue: function(obj, path, value) {
            var keys = path.split('.');
            var current = obj;

            // 마지막 키를 제외한 모든 경로 생성
            for (var i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
                    current[keys[i]] = {};
                }
                current = current[keys[i]];
            }

            // 마지막 키에 값 설정
            current[keys[keys.length - 1]] = value;
        },

        /**
         * 깊은 객체 병합
         * @param {Object} target - 대상 객체
         * @param {Object} source - 소스 객체
         */
        deepMerge: function(target, source) {
            var result = JSON.parse(JSON.stringify(target)); // 깊은 복사

            for (var key in source) {
                if (source.hasOwnProperty(key)) {
                    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                        result[key] = this.deepMerge(result[key] || {}, source[key]);
                    } else {
                        result[key] = source[key];
                    }
                }
            }

            return result;
        },

        /**
         * 디바운싱 유틸리티
         * @param {Function} func - 실행할 함수
         * @param {number} wait - 대기 시간
         */
        debounce: function(func, wait) {
            var timeout;
            return function executedFunction() {
                var context = this;
                var args = arguments;

                var later = function() {
                    timeout = null;
                    func.apply(context, args);
                };

                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        /**
         * 백업 저장
         * @param {Object} state - 저장할 상태
         */
        saveBackup: function(state) {
            try {
                var backupKey = this.options.storageKey + '_backup';
                localStorage.setItem(backupKey, JSON.stringify(state));
            } catch (error) {
                console.warn('StateManager: 백업 저장 실패:', error);
            }
        },

        /**
         * 백업에서 로드
         */
        loadFromBackup: function() {
            try {
                var backupKey = this.options.storageKey + '_backup';
                var backup = localStorage.getItem(backupKey);

                if (backup) {
                    return JSON.parse(backup);
                }
            } catch (error) {
                console.error('StateManager: 백업 로드 실패:', error);
            }

            return null;
        },

        /**
         * 오래된 데이터 정리
         */
        cleanupOldData: function() {
            try {
                var keysToRemove = [];

                // localStorage의 모든 키 확인
                for (var i = 0; i < localStorage.length; i++) {
                    var key = localStorage.key(i);

                    // 오래된 mua 관련 키들 찾기
                    if (key && (
                        key.startsWith('mua_old_') ||
                        key.startsWith('mua_temp_') ||
                        (key.startsWith('mua_') && key !== this.options.storageKey)
                    )) {
                        keysToRemove.push(key);
                    }
                }

                // 오래된 키들 삭제
                keysToRemove.forEach(function(key) {
                    localStorage.removeItem(key);
                });

                console.log('StateManager: ' + keysToRemove.length + '개의 오래된 데이터 정리 완료');

            } catch (error) {
                console.error('StateManager: 데이터 정리 실패:', error);
            }
        },

        /**
         * 브라우저 언로드 핸들러 설정
         */
        setupUnloadHandler: function() {
            var self = this;

            // 페이지 언로드 시 강제 저장
            var unloadEvents = ['beforeunload', 'pagehide', 'unload'];

            unloadEvents.forEach(function(eventType) {
                window.addEventListener(eventType, function() {
                    // 디바운싱 무시하고 즉시 저장
                    self.saveToStorage();
                });
            });
        },

        /**
         * StateManager 상태 정보 반환
         */
        getInfo: function() {
            return {
                stateSize: JSON.stringify(this.state).length,
                subscriberCount: this.subscribers.size,
                historySize: this.history.length,
                historyIndex: this.historyIndex,
                canUndo: this.historyIndex > 0,
                canRedo: this.historyIndex < this.history.length - 1,
                lastModified: this.state.metadata.lastModifiedAt
            };
        },

        /**
         * 메모리 정리
         */
        cleanup: function() {
            this.subscribers.clear();
            this.history = [];
            this.historyIndex = -1;
        }
    };

    // 전역 싱글톤 인스턴스 생성
    global.stateManager = global.stateManager || new StateManager();

    // 클래스도 전역에 노출
    global.StateManager = StateManager;

    // AMD/CommonJS 지원
    if (typeof define === 'function' && define.amd) {
        define(function() { return global.stateManager; });
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = global.stateManager;
    }

})(typeof window !== 'undefined' ? window : this);