/**
 * FileProcessor - 안정화된 파일 처리 유틸리티
 * 파일 크기 제한, 타입 검증, 청크 처리, 에러 복구 기능을 제공합니다.
 */

'use strict';

(function(global) {
    // FileProcessor 클래스 정의
    function FileProcessor(options) {
        this.options = Object.assign({
            maxFileSize: 50 * 1024 * 1024, // 50MB 기본값
            chunkSize: 2 * 1024 * 1024,    // 2MB 청크
            maxRetries: 3,                  // 최대 재시도
            timeout: 30000                  // 30초 타임아웃
        }, options || {});

        // 지원 파일 타입 정의
        this.supportedTypes = {
            excel: {
                extensions: ['.xlsx', '.xls', '.csv'],
                mimeTypes: [
                    'application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'text/csv'
                ]
            },
            image: {
                extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'],
                mimeTypes: [
                    'image/jpeg',
                    'image/png',
                    'image/gif',
                    'image/webp',
                    'image/bmp'
                ]
            }
        };

        this.init();
    }

    FileProcessor.prototype = {
        constructor: FileProcessor,

        /**
         * FileProcessor 초기화
         */
        init: function() {
            this.processingQueue = [];
            this.currentProcessing = 0;
            this.maxConcurrent = 3; // 동시 처리 파일 수 제한

            // WorkerManager 연동 설정
            this.useWebWorker = this.options.useWebWorker !== false;
            this.workerManager = null;

            // WorkerManager 초기화 시도
            if (this.useWebWorker && typeof WorkerManager !== 'undefined') {
                try {
                    this.workerManager = new WorkerManager({
                        workerPath: 'js/workers/file-worker.js',
                        maxWorkers: 2,
                        workerTimeout: 60000,
                        enableFallback: true
                    });
                    console.log('FileProcessor: WorkerManager 연동 완료');
                } catch (error) {
                    console.warn('FileProcessor: WorkerManager 초기화 실패:', error);
                    this.workerManager = null;
                }
            }

            console.log('FileProcessor 초기화 완료:', {
                options: this.options,
                workerSupported: !!this.workerManager
            });
        },

        /**
         * 단일 파일 처리 메인 메서드
         * @param {File} file - 처리할 파일
         * @param {Object} options - 처리 옵션
         * @returns {Promise} 처리 결과
         */
        processFile: function(file, options) {
            var self = this;
            options = options || {};

            return new Promise(function(resolve, reject) {
                // 1단계: 파일 기본 검증
                try {
                    self.validateFile(file, options.type);
                } catch (error) {
                    reject(error);
                    return;
                }

                // 2단계: 처리 큐에 추가
                var processTask = {
                    file: file,
                    options: options,
                    resolve: resolve,
                    reject: reject,
                    id: self.generateProcessId()
                };

                self.processingQueue.push(processTask);
                self.processQueue();
            });
        },

        /**
         * 여러 파일 배치 처리
         * @param {FileList|Array} files - 처리할 파일들
         * @param {Object} options - 처리 옵션
         * @returns {Promise} 모든 파일의 처리 결과
         */
        processFiles: function(files, options) {
            var self = this;
            var fileArray = Array.prototype.slice.call(files);

            var promises = fileArray.map(function(file, index) {
                return self.processFile(file, Object.assign({}, options, {
                    index: index,
                    total: fileArray.length
                }));
            });

            return Promise.all(promises);
        },

        /**
         * 처리 큐 관리
         */
        processQueue: function() {
            // 동시 처리 한계 확인
            if (this.currentProcessing >= this.maxConcurrent || this.processingQueue.length === 0) {
                return;
            }

            var task = this.processingQueue.shift();
            this.currentProcessing++;

            this.executeProcessTask(task).finally(function() {
                this.currentProcessing--;
                this.processQueue(); // 다음 작업 처리
            }.bind(this));
        },

        /**
         * 개별 처리 작업 실행
         * @param {Object} task - 처리 작업 객체
         */
        executeProcessTask: function(task) {
            var self = this;

            return this.processWithRetry(task.file, task.options)
                .then(function(result) {
                    task.resolve(result);
                })
                .catch(function(error) {
                    console.error('파일 처리 실패:', task.file.name, error);
                    task.reject(error);
                });
        },

        /**
         * 재시도 메커니즘이 포함된 파일 처리
         * @param {File} file - 처리할 파일
         * @param {Object} options - 처리 옵션
         */
        processWithRetry: function(file, options) {
            var self = this;
            var attempt = 0;

            function tryProcess() {
                attempt++;

                return self.processFileInternal(file, options)
                    .catch(function(error) {
                        if (attempt < self.options.maxRetries && self.isRetryableError(error)) {
                            console.log('파일 처리 재시도:', attempt, '/', self.options.maxRetries);

                            // 지수 백오프 적용
                            var delay = Math.pow(2, attempt - 1) * 1000;
                            return self.delay(delay).then(tryProcess);
                        }
                        throw error;
                    });
            }

            return tryProcess();
        },

        /**
         * 실제 파일 처리 로직
         * @param {File} file - 처리할 파일
         * @param {Object} options - 처리 옵션
         */
        processFileInternal: function(file, options) {
            var self = this;

            return new Promise(function(resolve, reject) {
                // 타임아웃 설정
                var timeout = setTimeout(function() {
                    reject(new Error('파일 처리 타임아웃: ' + file.name));
                }, self.options.timeout);

                // 파일 타입에 따른 처리 분기
                if (self.isExcelFile(file)) {
                    self.processExcelFile(file, options)
                        .then(function(result) {
                            clearTimeout(timeout);
                            resolve(result);
                        })
                        .catch(function(error) {
                            clearTimeout(timeout);
                            reject(error);
                        });
                } else if (self.isImageFile(file)) {
                    self.processImageFile(file, options)
                        .then(function(result) {
                            clearTimeout(timeout);
                            resolve(result);
                        })
                        .catch(function(error) {
                            clearTimeout(timeout);
                            reject(error);
                        });
                } else {
                    clearTimeout(timeout);
                    reject(new Error('지원하지 않는 파일 타입입니다: ' + file.name));
                }
            });
        },

        /**
         * Excel 파일 처리
         * @param {File} file - Excel 파일
         * @param {Object} options - 처리 옵션
         */
        processExcelFile: function(file, options) {
            var self = this;

            return new Promise(function(resolve, reject) {
                // WorkerManager가 사용 가능하면 Web Worker로 처리
                if (self.workerManager) {
                    self.processExcelWithWorker(file, options)
                        .then(resolve)
                        .catch(function(workerError) {
                            console.warn('Worker 처리 실패, 폴백 처리 시도:', workerError);
                            // Worker 실패시 기존 방식으로 폴백
                            self.processExcelFallback(file, options)
                                .then(resolve)
                                .catch(reject);
                        });
                } else {
                    // Worker 미지원시 기존 방식 사용
                    self.processExcelFallback(file, options)
                        .then(resolve)
                        .catch(reject);
                }
            });
        },

        /**
         * Web Worker를 이용한 Excel 처리
         * @param {File} file - Excel 파일
         * @param {Object} options - 처리 옵션
         */
        processExcelWithWorker: function(file, options) {
            var self = this;

            return new Promise(function(resolve, reject) {
                var reader = new FileReader();

                reader.onload = function(e) {
                    try {
                        var fileData = new Uint8Array(e.target.result);

                        // 진행률 콜백 설정
                        var onProgress = options.onProgress ? function(progressData) {
                            options.onProgress({
                                loaded: progressData.progress || 0,
                                total: 100,
                                percentage: progressData.progress || 0,
                                stage: progressData.stage || 'processing'
                            });
                        } : null;

                        // WorkerManager를 통해 Excel 처리
                        self.workerManager.processExcelFile(fileData, {
                            fileName: file.name,
                            fileSize: file.size,
                            options: options
                        }, onProgress)
                            .then(function(workerResult) {
                                console.log('Excel Worker 처리 완료:', file.name);
                                resolve(workerResult);
                            })
                            .catch(function(error) {
                                console.error('Excel Worker 처리 실패:', error);
                                reject(error);
                            });

                    } catch (error) {
                        reject(new Error('Excel 파일 읽기 실패: ' + error.message));
                    }
                };

                reader.onerror = function() {
                    reject(new Error('파일 읽기 실패: ' + file.name));
                };

                reader.readAsArrayBuffer(file);
            });
        },

        /**
         * 기존 방식 Excel 처리 (폴백)
         * @param {File} file - Excel 파일
         * @param {Object} options - 처리 옵션
         */
        processExcelFallback: function(file, options) {
            var self = this;

            return new Promise(function(resolve, reject) {
                // 큰 파일은 청크 단위로 처리
                if (file.size > self.options.chunkSize) {
                    self.processExcelInChunks(file, options)
                        .then(resolve)
                        .catch(reject);
                } else {
                    self.processExcelDirect(file, options)
                        .then(resolve)
                        .catch(reject);
                }
            });
        },

        /**
         * 청크 단위 Excel 처리
         * @param {File} file - Excel 파일
         * @param {Object} options - 처리 옵션
         */
        processExcelInChunks: function(file, options) {
            var self = this;

            return new Promise(function(resolve, reject) {
                var reader = new FileReader();
                var chunks = [];
                var chunkCount = Math.ceil(file.size / self.options.chunkSize);
                var processedChunks = 0;

                function processNextChunk(index) {
                    if (index >= chunkCount) {
                        // 모든 청크 처리 완료
                        self.combineExcelChunks(chunks)
                            .then(resolve)
                            .catch(reject);
                        return;
                    }

                    var start = index * self.options.chunkSize;
                    var end = Math.min(start + self.options.chunkSize, file.size);
                    var chunk = file.slice(start, end);

                    reader.onload = function(e) {
                        try {
                            chunks[index] = new Uint8Array(e.target.result);
                            processedChunks++;

                            // 진행률 업데이트
                            if (options.onProgress) {
                                options.onProgress({
                                    loaded: processedChunks,
                                    total: chunkCount,
                                    percentage: Math.round((processedChunks / chunkCount) * 100)
                                });
                            }

                            // 메모리 정리를 위한 지연
                            setTimeout(function() {
                                processNextChunk(index + 1);
                            }, 10);

                        } catch (error) {
                            reject(new Error('Excel 청크 처리 실패: ' + error.message));
                        }
                    };

                    reader.onerror = function() {
                        reject(new Error('파일 읽기 오류 (청크 ' + index + ')'));
                    };

                    reader.readAsArrayBuffer(chunk);
                }

                processNextChunk(0);
            });
        },

        /**
         * Excel 청크들 결합 및 파싱
         * @param {Array} chunks - Excel 파일 청크들
         */
        combineExcelChunks: function(chunks) {
            var self = this;

            return new Promise(function(resolve, reject) {
                try {
                    // 청크들을 하나의 ArrayBuffer로 결합
                    var totalLength = chunks.reduce(function(sum, chunk) {
                        return sum + chunk.byteLength;
                    }, 0);

                    var combined = new Uint8Array(totalLength);
                    var offset = 0;

                    chunks.forEach(function(chunk) {
                        combined.set(chunk, offset);
                        offset += chunk.byteLength;
                    });

                    // XLSX 라이브러리로 파싱
                    if (typeof XLSX === 'undefined') {
                        throw new Error('XLSX 라이브러리가 로드되지 않았습니다.');
                    }

                    var workbook = XLSX.read(combined, {
                        type: 'array',
                        cellDates: true,
                        cellStyles: true
                    });

                    var result = {
                        workbook: workbook,
                        sheets: {},
                        metadata: {
                            sheetNames: workbook.SheetNames,
                            processedAt: new Date(),
                            fileSize: totalLength
                        }
                    };

                    // 각 시트 데이터 추출
                    workbook.SheetNames.forEach(function(sheetName) {
                        try {
                            result.sheets[sheetName] = XLSX.utils.sheet_to_json(
                                workbook.Sheets[sheetName],
                                { header: 1, raw: false }
                            );
                        } catch (sheetError) {
                            console.warn('시트 처리 경고:', sheetName, sheetError.message);
                            result.sheets[sheetName] = [];
                        }
                    });

                    resolve(result);

                } catch (error) {
                    reject(new Error('Excel 파싱 실패: ' + error.message));
                }
            });
        },

        /**
         * 직접 Excel 처리 (작은 파일용)
         * @param {File} file - Excel 파일
         * @param {Object} options - 처리 옵션
         */
        processExcelDirect: function(file, options) {
            var self = this;

            return new Promise(function(resolve, reject) {
                var reader = new FileReader();

                reader.onload = function(e) {
                    try {
                        if (typeof XLSX === 'undefined') {
                            throw new Error('XLSX 라이브러리가 로드되지 않았습니다.');
                        }

                        var workbook = XLSX.read(e.target.result, {
                            type: 'array',
                            cellDates: true,
                            cellStyles: true
                        });

                        var result = {
                            workbook: workbook,
                            sheets: {},
                            metadata: {
                                sheetNames: workbook.SheetNames,
                                processedAt: new Date(),
                                fileSize: file.size
                            }
                        };

                        workbook.SheetNames.forEach(function(sheetName) {
                            result.sheets[sheetName] = XLSX.utils.sheet_to_json(
                                workbook.Sheets[sheetName],
                                { header: 1, raw: false }
                            );
                        });

                        resolve(result);

                    } catch (error) {
                        reject(new Error('Excel 처리 실패: ' + error.message));
                    }
                };

                reader.onerror = function() {
                    reject(new Error('파일 읽기 실패: ' + file.name));
                };

                reader.readAsArrayBuffer(file);
            });
        },

        /**
         * 이미지 파일 처리
         * @param {File} file - 이미지 파일
         * @param {Object} options - 처리 옵션
         */
        processImageFile: function(file, options) {
            var self = this;

            return new Promise(function(resolve, reject) {
                // WorkerManager가 사용 가능하면 Web Worker로 처리
                if (self.workerManager && file.size > 1024 * 1024) { // 1MB 이상 파일만 Worker 사용
                    self.processImageWithWorker(file, options)
                        .then(resolve)
                        .catch(function(workerError) {
                            console.warn('Image Worker 처리 실패, 폴백 처리 시도:', workerError);
                            // Worker 실패시 기존 방식으로 폴백
                            self.processImageFallback(file, options)
                                .then(resolve)
                                .catch(reject);
                        });
                } else {
                    // Worker 미지원시 또는 작은 파일일 때 기존 방식 사용
                    self.processImageFallback(file, options)
                        .then(resolve)
                        .catch(reject);
                }
            });
        },

        /**
         * Web Worker를 이용한 이미지 처리
         * @param {File} file - 이미지 파일
         * @param {Object} options - 처리 옵션
         */
        processImageWithWorker: function(file, options) {
            var self = this;

            return new Promise(function(resolve, reject) {
                var reader = new FileReader();

                reader.onload = function(e) {
                    try {
                        var fileData = new Uint8Array(e.target.result);

                        // 진행률 콜백 설정
                        var onProgress = options.onProgress ? function(progressData) {
                            options.onProgress({
                                loaded: progressData.progress || 0,
                                total: 100,
                                percentage: progressData.progress || 0,
                                stage: progressData.stage || 'processing'
                            });
                        } : null;

                        // WorkerManager를 통해 이미지 처리
                        self.workerManager.processImageFile(
                            fileData,
                            file.type,
                            file.name,
                            {
                                optimize: options.optimize,
                                maxWidth: options.maxWidth,
                                maxHeight: options.maxHeight,
                                quality: options.quality
                            },
                            onProgress
                        )
                            .then(function(workerResult) {
                                console.log('Image Worker 처리 완료:', file.name);
                                resolve(workerResult);
                            })
                            .catch(function(error) {
                                console.error('Image Worker 처리 실패:', error);
                                reject(error);
                            });

                    } catch (error) {
                        reject(new Error('이미지 파일 읽기 실패: ' + error.message));
                    }
                };

                reader.onerror = function() {
                    reject(new Error('파일 읽기 실패: ' + file.name));
                };

                reader.readAsArrayBuffer(file);
            });
        },

        /**
         * 기존 방식 이미지 처리 (폴백)
         * @param {File} file - 이미지 파일
         * @param {Object} options - 처리 옵션
         */
        processImageFallback: function(file, options) {
            var self = this;

            return new Promise(function(resolve, reject) {
                var reader = new FileReader();

                reader.onload = function(e) {
                    var img = new Image();

                    img.onload = function() {
                        try {
                            var result = {
                                dataUrl: e.target.result,
                                width: img.width,
                                height: img.height,
                                size: file.size,
                                type: file.type,
                                name: file.name,
                                lastModified: new Date(file.lastModified)
                            };

                            // 이미지 최적화 옵션이 있으면 적용
                            if (options.optimize) {
                                self.optimizeImage(img, options.optimize)
                                    .then(function(optimized) {
                                        result.optimized = optimized;
                                        resolve(result);
                                    })
                                    .catch(function(optimizeError) {
                                        console.warn('이미지 최적화 실패:', optimizeError);
                                        resolve(result); // 최적화 실패해도 원본 반환
                                    });
                            } else {
                                resolve(result);
                            }

                        } catch (error) {
                            reject(new Error('이미지 처리 실패: ' + error.message));
                        }
                    };

                    img.onerror = function() {
                        reject(new Error('이미지 로드 실패: ' + file.name));
                    };

                    img.src = e.target.result;
                };

                reader.onerror = function() {
                    reject(new Error('이미지 파일 읽기 실패: ' + file.name));
                };

                reader.readAsDataURL(file);
            });
        },

        /**
         * 이미지 최적화 (리사이즈, 압축)
         * @param {HTMLImageElement} img - 이미지 엘리먼트
         * @param {Object} options - 최적화 옵션
         */
        optimizeImage: function(img, options) {
            return new Promise(function(resolve, reject) {
                try {
                    options = Object.assign({
                        maxWidth: 1920,
                        maxHeight: 1080,
                        quality: 0.8,
                        format: 'image/jpeg'
                    }, options);

                    var canvas = document.createElement('canvas');
                    var ctx = canvas.getContext('2d');

                    // 리사이즈 계산
                    var ratio = Math.min(
                        options.maxWidth / img.width,
                        options.maxHeight / img.height
                    );

                    if (ratio < 1) {
                        canvas.width = Math.round(img.width * ratio);
                        canvas.height = Math.round(img.height * ratio);
                    } else {
                        canvas.width = img.width;
                        canvas.height = img.height;
                    }

                    // 이미지 그리기
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    // Blob으로 변환
                    canvas.toBlob(function(blob) {
                        if (blob) {
                            var reader = new FileReader();
                            reader.onload = function(e) {
                                resolve({
                                    dataUrl: e.target.result,
                                    width: canvas.width,
                                    height: canvas.height,
                                    size: blob.size,
                                    compressionRatio: blob.size / img.src.length
                                });
                            };
                            reader.readAsDataURL(blob);
                        } else {
                            reject(new Error('이미지 압축 실패'));
                        }
                    }, options.format, options.quality);

                } catch (error) {
                    reject(error);
                }
            });
        },

        /**
         * 파일 검증
         * @param {File} file - 검증할 파일
         * @param {string} expectedType - 예상 파일 타입
         */
        validateFile: function(file, expectedType) {
            // 파일 존재 확인
            if (!file) {
                throw new Error('파일이 선택되지 않았습니다.');
            }

            // 파일 크기 확인
            if (file.size > this.options.maxFileSize) {
                var maxSizeMB = Math.round(this.options.maxFileSize / 1024 / 1024);
                throw new Error('파일 크기가 ' + maxSizeMB + 'MB를 초과합니다. (현재: ' +
                    Math.round(file.size / 1024 / 1024) + 'MB)');
            }

            // 빈 파일 확인
            if (file.size === 0) {
                throw new Error('빈 파일은 처리할 수 없습니다.');
            }

            // 파일 타입 확인
            if (expectedType) {
                if (!this.isValidFileType(file, expectedType)) {
                    throw new Error('지원하지 않는 파일 형식입니다. (' + expectedType + ' 타입만 지원)');
                }
            }

            return true;
        },

        /**
         * 파일 타입 검증
         * @param {File} file - 검증할 파일
         * @param {string} expectedType - 예상 타입 ('excel' or 'image')
         */
        isValidFileType: function(file, expectedType) {
            if (!this.supportedTypes[expectedType]) {
                return false;
            }

            var config = this.supportedTypes[expectedType];

            // MIME 타입 확인
            var mimeValid = config.mimeTypes.includes(file.type);

            // 확장자 확인
            var fileName = file.name.toLowerCase();
            var extValid = config.extensions.some(function(ext) {
                return fileName.endsWith(ext);
            });

            return mimeValid || extValid;
        },

        /**
         * Excel 파일 여부 확인
         * @param {File} file - 확인할 파일
         */
        isExcelFile: function(file) {
            return this.isValidFileType(file, 'excel');
        },

        /**
         * 이미지 파일 여부 확인
         * @param {File} file - 확인할 파일
         */
        isImageFile: function(file) {
            return this.isValidFileType(file, 'image');
        },

        /**
         * 재시도 가능한 오류인지 확인
         * @param {Error} error - 확인할 오류
         */
        isRetryableError: function(error) {
            var retryableMessages = [
                'network error',
                'timeout',
                'failed to fetch',
                'connection refused'
            ];

            var message = error.message.toLowerCase();
            return retryableMessages.some(function(msg) {
                return message.includes(msg);
            });
        },

        /**
         * 지연 함수
         * @param {number} ms - 지연 시간 (밀리초)
         */
        delay: function(ms) {
            return new Promise(function(resolve) {
                setTimeout(resolve, ms);
            });
        },

        /**
         * 고유 프로세스 ID 생성
         */
        generateProcessId: function() {
            return 'process_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        },

        /**
         * 현재 처리 상태 반환
         */
        getStatus: function() {
            return {
                queueLength: this.processingQueue.length,
                currentProcessing: this.currentProcessing,
                maxConcurrent: this.maxConcurrent
            };
        },

        /**
         * 처리 큐 정리
         */
        clearQueue: function() {
            this.processingQueue = [];
        },

        /**
         * WorkerManager 상태 확인
         */
        getWorkerStatus: function() {
            if (this.workerManager) {
                return this.workerManager.getStatus();
            }
            return { supported: false, message: 'WorkerManager를 사용할 수 없습니다' };
        },

        /**
         * 파일 검증 with Worker 지원
         * @param {Array} files - 검증할 파일들
         * @param {Object} rules - 검증 규칙
         */
        validateFilesWithWorker: function(files, rules) {
            var self = this;

            // WorkerManager가 있으면 Worker로 검증
            if (this.workerManager) {
                return this.workerManager.validateFiles(files, rules);
            }

            // 폴백: 메인 스레드에서 검증
            return new Promise(function(resolve) {
                var results = [];
                for (var i = 0; i < files.length; i++) {
                    var file = files[i];
                    var validation = {
                        index: i,
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        valid: true,
                        errors: []
                    };

                    try {
                        self.validateFile(file, rules.expectedType);
                    } catch (error) {
                        validation.valid = false;
                        validation.errors.push(error.message);
                    }

                    results.push(validation);
                }
                resolve({ results: results });
            });
        },

        /**
         * 리소스 정리 및 WorkerManager 종료
         */
        destroy: function() {
            // 처리 대기 중인 작업들 취소
            this.processingQueue.forEach(function(task) {
                if (task.reject) {
                    task.reject(new Error('FileProcessor가 종료되었습니다.'));
                }
            });

            this.clearQueue();
            this.currentProcessing = 0;

            // WorkerManager 종료
            if (this.workerManager) {
                try {
                    this.workerManager.terminate();
                    console.log('FileProcessor: WorkerManager 종료 완료');
                } catch (error) {
                    console.warn('FileProcessor: WorkerManager 종료 중 오류:', error);
                }
                this.workerManager = null;
            }

            console.log('FileProcessor 정리 완료');
        }
    };

    // 전역 싱글톤 인스턴스 생성
    global.fileProcessor = global.fileProcessor || new FileProcessor();

    // 클래스도 전역에 노출 (커스터마이징용)
    global.FileProcessor = FileProcessor;

    // AMD/CommonJS 지원
    if (typeof define === 'function' && define.amd) {
        define(function() { return global.fileProcessor; });
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = global.fileProcessor;
    }

})(typeof window !== 'undefined' ? window : this);