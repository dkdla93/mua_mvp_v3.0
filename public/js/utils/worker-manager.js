/**
 * WorkerManager - Web Worker 관리 유틸리티
 * 파일 처리 작업을 백그라운드에서 실행하고 결과를 관리
 */

'use strict';

(function(global) {
    // WorkerManager 클래스 정의
    function WorkerManager(options) {
        this.options = Object.assign({
            workerPath: 'js/workers/file-worker.js',
            maxWorkers: 2,                      // 최대 워커 개수
            workerTimeout: 60000,               // 워커 타임아웃 (60초)
            enableFallback: true                // Web Worker 지원 안할 때 폴백
        }, options || {});

        // 상태 관리
        this.workers = [];
        this.availableWorkers = [];
        this.busyWorkers = [];
        this.messageQueue = [];
        this.callbacks = new Map();
        this.messageId = 0;

        // Web Worker 지원 여부 확인
        this.isSupported = typeof Worker !== 'undefined';

        this.init();
    }

    WorkerManager.prototype = {
        constructor: WorkerManager,

        /**
         * WorkerManager 초기화
         */
        init: function() {
            if (!this.isSupported) {
                console.warn('WorkerManager: Web Worker가 지원되지 않음, 폴백 모드로 실행');
                return;
            }

            // 워커 풀 생성
            this.createWorkerPool();

            console.log('WorkerManager 초기화 완료:', {
                지원여부: this.isSupported,
                워커개수: this.workers.length,
                워커경로: this.options.workerPath
            });
        },

        /**
         * 워커 풀 생성
         */
        createWorkerPool: function() {
            for (var i = 0; i < this.options.maxWorkers; i++) {
                try {
                    var worker = this.createWorker();
                    if (worker) {
                        this.workers.push(worker);
                        this.availableWorkers.push(worker);
                    }
                } catch (error) {
                    console.error('WorkerManager: 워커 생성 실패:', error);
                }
            }
        },

        /**
         * 개별 워커 생성
         */
        createWorker: function() {
            try {
                var worker = new Worker(this.options.workerPath);
                var self = this;

                // 워커에 고유 ID 부여
                worker._id = 'worker_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

                // 메시지 수신 핸들러
                worker.addEventListener('message', function(event) {
                    self.handleWorkerMessage(worker, event);
                });

                // 에러 핸들러
                worker.addEventListener('error', function(error) {
                    console.error('WorkerManager: 워커 오류:', worker._id, error);
                    self.handleWorkerError(worker, error);
                });

                // 워커 연결 테스트
                this.testWorker(worker);

                console.log('WorkerManager: 워커 생성됨:', worker._id);
                return worker;

            } catch (error) {
                console.error('WorkerManager: 워커 생성 실패:', error);
                return null;
            }
        },

        /**
         * 워커 연결 테스트
         */
        testWorker: function(worker) {
            var self = this;
            var testId = this.generateMessageId();

            // 테스트 메시지 전송
            worker.postMessage({
                id: testId,
                type: 'PING',
                payload: { test: true }
            });

            // 타임아웃 설정
            setTimeout(function() {
                if (self.callbacks.has(testId)) {
                    console.warn('WorkerManager: 워커 응답 타임아웃:', worker._id);
                    self.callbacks.delete(testId);
                }
            }, 5000);

            // 응답 콜백
            this.callbacks.set(testId, {
                resolve: function(response) {
                    console.log('WorkerManager: 워커 연결 확인됨:', worker._id);
                },
                reject: function(error) {
                    console.error('WorkerManager: 워커 연결 실패:', worker._id, error);
                },
                type: 'PING'
            });
        },

        /**
         * 워커 메시지 처리
         */
        handleWorkerMessage: function(worker, event) {
            var data = event.data;
            var messageId = data.id;
            var callback = this.callbacks.get(messageId);

            if (!callback) {
                console.warn('WorkerManager: 알 수 없는 메시지 ID:', messageId);
                return;
            }

            try {
                if (data.success) {
                    // 진행률 업데이트인 경우
                    if (data.type === 'PROGRESS') {
                        if (callback.onProgress) {
                            callback.onProgress(data.data);
                        }
                        return; // 진행률 업데이트는 콜백을 제거하지 않음
                    }

                    // 성공적인 응답
                    callback.resolve(data.data);
                } else {
                    // 오류 응답
                    callback.reject(new Error(data.error.message));
                }

                // 콜백 제거 및 워커를 사용 가능 풀로 이동
                this.callbacks.delete(messageId);
                this.releaseWorker(worker);

            } catch (error) {
                console.error('WorkerManager: 메시지 처리 오류:', error);
                callback.reject(error);
                this.callbacks.delete(messageId);
                this.releaseWorker(worker);
            }
        },

        /**
         * 워커 오류 처리
         */
        handleWorkerError: function(worker, error) {
            // 해당 워커를 사용하는 모든 콜백에 오류 전달
            var self = this;
            this.callbacks.forEach(function(callback, messageId) {
                if (callback.workerId === worker._id) {
                    callback.reject(error);
                    self.callbacks.delete(messageId);
                }
            });

            // 오류가 발생한 워커를 풀에서 제거
            this.removeWorkerFromPools(worker);

            // 워커를 종료하고 새로운 워커 생성
            try {
                worker.terminate();
            } catch (e) {
                // 이미 종료된 워커일 수 있음
            }

            // 새 워커로 교체
            var newWorker = this.createWorker();
            if (newWorker) {
                this.workers.push(newWorker);
                this.availableWorkers.push(newWorker);
            }
        },

        /**
         * 사용 가능한 워커 가져오기
         */
        getAvailableWorker: function() {
            if (this.availableWorkers.length > 0) {
                var worker = this.availableWorkers.shift();
                this.busyWorkers.push(worker);
                return worker;
            }
            return null;
        },

        /**
         * 워커 해제
         */
        releaseWorker: function(worker) {
            var busyIndex = this.busyWorkers.indexOf(worker);
            if (busyIndex !== -1) {
                this.busyWorkers.splice(busyIndex, 1);
                this.availableWorkers.push(worker);
            }

            // 대기 중인 작업이 있으면 처리
            this.processMessageQueue();
        },

        /**
         * 워커를 모든 풀에서 제거
         */
        removeWorkerFromPools: function(worker) {
            var availableIndex = this.availableWorkers.indexOf(worker);
            if (availableIndex !== -1) {
                this.availableWorkers.splice(availableIndex, 1);
            }

            var busyIndex = this.busyWorkers.indexOf(worker);
            if (busyIndex !== -1) {
                this.busyWorkers.splice(busyIndex, 1);
            }

            var workersIndex = this.workers.indexOf(worker);
            if (workersIndex !== -1) {
                this.workers.splice(workersIndex, 1);
            }
        },

        /**
         * 메시지 큐 처리
         */
        processMessageQueue: function() {
            while (this.messageQueue.length > 0 && this.availableWorkers.length > 0) {
                var queueItem = this.messageQueue.shift();
                var worker = this.getAvailableWorker();

                if (worker) {
                    queueItem.callback.workerId = worker._id;
                    worker.postMessage(queueItem.message);
                } else {
                    // 다시 큐에 넣기
                    this.messageQueue.unshift(queueItem);
                    break;
                }
            }
        },

        /**
         * Excel 파일 처리
         * @param {ArrayBuffer} fileData - Excel 파일 데이터
         * @param {Object} options - 처리 옵션
         * @param {Function} onProgress - 진행률 콜백
         * @returns {Promise} 처리 결과
         */
        processExcelFile: function(fileData, options, onProgress) {
            if (!this.isSupported && this.options.enableFallback) {
                return this.processExcelFileFallback(fileData, options, onProgress);
            }

            return this.sendWorkerMessage('PROCESS_EXCEL', {
                fileData: fileData,
                options: options
            }, onProgress);
        },

        /**
         * 이미지 파일 처리
         * @param {ArrayBuffer} fileData - 이미지 파일 데이터
         * @param {string} mimeType - MIME 타입
         * @param {string} fileName - 파일명
         * @param {Object} options - 처리 옵션
         * @param {Function} onProgress - 진행률 콜백
         * @returns {Promise} 처리 결과
         */
        processImageFile: function(fileData, mimeType, fileName, options, onProgress) {
            if (!this.isSupported && this.options.enableFallback) {
                return this.processImageFileFallback(fileData, mimeType, fileName, options, onProgress);
            }

            return this.sendWorkerMessage('PROCESS_IMAGE', {
                fileData: fileData,
                mimeType: mimeType,
                fileName: fileName,
                options: options
            }, onProgress);
        },

        /**
         * 파일 유효성 검증
         * @param {Array} files - 검증할 파일들
         * @param {Object} rules - 검증 규칙
         * @returns {Promise} 검증 결과
         */
        validateFiles: function(files, rules) {
            return this.sendWorkerMessage('VALIDATE_FILES', {
                files: files,
                rules: rules
            });
        },

        /**
         * 워커로 메시지 전송
         * @param {string} type - 메시지 타입
         * @param {Object} payload - 페이로드
         * @param {Function} onProgress - 진행률 콜백
         * @returns {Promise} 처리 결과
         */
        sendWorkerMessage: function(type, payload, onProgress) {
            var self = this;

            return new Promise(function(resolve, reject) {
                var messageId = self.generateMessageId();
                var callback = {
                    resolve: resolve,
                    reject: reject,
                    onProgress: onProgress,
                    type: type,
                    timestamp: Date.now()
                };

                self.callbacks.set(messageId, callback);

                // 타임아웃 설정
                setTimeout(function() {
                    if (self.callbacks.has(messageId)) {
                        self.callbacks.delete(messageId);
                        reject(new Error('워커 작업 타임아웃'));
                    }
                }, self.options.workerTimeout);

                var message = {
                    id: messageId,
                    type: type,
                    payload: payload
                };

                // 사용 가능한 워커가 있으면 즉시 처리
                var worker = self.getAvailableWorker();
                if (worker) {
                    callback.workerId = worker._id;
                    worker.postMessage(message);
                } else {
                    // 워커가 없으면 큐에 추가
                    self.messageQueue.push({
                        message: message,
                        callback: callback
                    });
                }
            });
        },

        /**
         * Excel 파일 폴백 처리 (Web Worker 미지원 시)
         */
        processExcelFileFallback: function(fileData, options, onProgress) {
            var self = this;

            return new Promise(function(resolve, reject) {
                try {
                    // 메인 스레드에서 직접 처리
                    if (typeof XLSX === 'undefined') {
                        reject(new Error('XLSX 라이브러리가 로드되지 않았습니다.'));
                        return;
                    }

                    if (onProgress) {
                        onProgress({ stage: 'parsing', progress: 0 });
                    }

                    setTimeout(function() { // 논블로킹으로 만들기
                        try {
                            var workbook = XLSX.read(fileData, {
                                type: 'array',
                                cellDates: true,
                                raw: false
                            });

                            var result = {
                                workbook: {
                                    SheetNames: workbook.SheetNames,
                                    Props: workbook.Props || {}
                                },
                                sheets: {},
                                metadata: {
                                    sheetNames: workbook.SheetNames,
                                    sheetCount: workbook.SheetNames.length,
                                    processedAt: new Date().toISOString(),
                                    fileSize: fileData.byteLength
                                }
                            };

                            // 각 시트 처리
                            workbook.SheetNames.forEach(function(sheetName, index) {
                                try {
                                    result.sheets[sheetName] = XLSX.utils.sheet_to_json(
                                        workbook.Sheets[sheetName],
                                        { header: 1, raw: false }
                                    );

                                    if (onProgress) {
                                        var progress = 50 + Math.round(((index + 1) / workbook.SheetNames.length) * 50);
                                        onProgress({
                                            stage: 'processing',
                                            progress: progress,
                                            currentSheet: sheetName
                                        });
                                    }
                                } catch (sheetError) {
                                    console.warn('시트 처리 경고:', sheetName, sheetError);
                                    result.sheets[sheetName] = [];
                                }
                            });

                            resolve(result);
                        } catch (error) {
                            reject(error);
                        }
                    }, 10);

                } catch (error) {
                    reject(error);
                }
            });
        },

        /**
         * 이미지 파일 폴백 처리
         */
        processImageFileFallback: function(fileData, mimeType, fileName, options, onProgress) {
            return new Promise(function(resolve, reject) {
                try {
                    var blob = new Blob([fileData], { type: mimeType });
                    var imageUrl = URL.createObjectURL(blob);
                    var img = new Image();

                    img.onload = function() {
                        var result = {
                            width: img.width,
                            height: img.height,
                            size: fileData.byteLength,
                            type: mimeType,
                            name: fileName,
                            dataUrl: imageUrl,
                            processedAt: new Date().toISOString()
                        };

                        resolve(result);
                        URL.revokeObjectURL(imageUrl);
                    };

                    img.onerror = function() {
                        URL.revokeObjectURL(imageUrl);
                        reject(new Error('이미지 로드 실패'));
                    };

                    img.src = imageUrl;

                } catch (error) {
                    reject(error);
                }
            });
        },

        /**
         * 메시지 ID 생성
         */
        generateMessageId: function() {
            return 'msg_' + (++this.messageId) + '_' + Date.now();
        },

        /**
         * 상태 정보 반환
         */
        getStatus: function() {
            return {
                supported: this.isSupported,
                totalWorkers: this.workers.length,
                availableWorkers: this.availableWorkers.length,
                busyWorkers: this.busyWorkers.length,
                queueLength: this.messageQueue.length,
                activeCallbacks: this.callbacks.size
            };
        },

        /**
         * 모든 워커 종료
         */
        terminate: function() {
            // 모든 콜백 취소
            this.callbacks.forEach(function(callback, messageId) {
                callback.reject(new Error('WorkerManager가 종료되었습니다.'));
            });
            this.callbacks.clear();

            // 모든 워커 종료
            this.workers.forEach(function(worker) {
                try {
                    worker.terminate();
                } catch (error) {
                    console.warn('워커 종료 중 오류:', error);
                }
            });

            // 상태 초기화
            this.workers = [];
            this.availableWorkers = [];
            this.busyWorkers = [];
            this.messageQueue = [];

            console.log('WorkerManager 종료 완료');
        }
    };

    // 전역 싱글톤 인스턴스 생성
    global.workerManager = global.workerManager || new WorkerManager();

    // 클래스도 전역에 노출
    global.WorkerManager = WorkerManager;

    // AMD/CommonJS 지원
    if (typeof define === 'function' && define.amd) {
        define(function() { return global.workerManager; });
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = global.workerManager;
    }

})(typeof window !== 'undefined' ? window : this);