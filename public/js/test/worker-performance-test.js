/**
 * Web Worker 시스템 성능 및 안정성 종합 테스트 스위트
 * WorkerManager와 file-worker.js의 성능, 안정성, 폴백 메커니즘을 테스트
 */

'use strict';

(function(global) {

    /**
     * 테스트 유틸리티
     */
    var TestUtils = {
        /**
         * 테스트 Excel 데이터 생성
         */
        generateTestExcelData: function(rows, cols) {
            var workbook = {
                SheetNames: ['테스트시트'],
                Sheets: {
                    '테스트시트': {}
                }
            };

            var sheet = workbook.Sheets['테스트시트'];
            var range = { s: { c: 0, r: 0 }, e: { c: cols - 1, r: rows - 1 } };

            for (var R = 0; R < rows; R++) {
                for (var C = 0; C < cols; C++) {
                    var cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                    var cellValue = 'Row' + R + 'Col' + C;

                    if (R === 0) {
                        cellValue = 'Header' + C; // 헤더 행
                    }

                    sheet[cellAddress] = { v: cellValue, t: 's' };
                }
            }

            sheet['!ref'] = XLSX.utils.encode_range(range);

            // ArrayBuffer로 변환
            var wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            return wbout;
        },

        /**
         * 테스트 이미지 데이터 생성
         */
        generateTestImageData: function(width, height) {
            var canvas = document.createElement('canvas');
            canvas.width = width || 800;
            canvas.height = height || 600;

            var ctx = canvas.getContext('2d');

            // 테스트용 패턴 그리기
            ctx.fillStyle = '#4CAF50';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = '#FFFFFF';
            ctx.font = '48px Arial';
            ctx.fillText('테스트 이미지', 50, canvas.height / 2);

            return new Promise(function(resolve) {
                canvas.toBlob(function(blob) {
                    var reader = new FileReader();
                    reader.onload = function(e) {
                        resolve(e.target.result);
                    };
                    reader.readAsArrayBuffer(blob);
                }, 'image/png');
            });
        },

        /**
         * 성능 측정
         */
        measurePerformance: function(name, fn) {
            var start = performance.now();
            return Promise.resolve(fn()).then(function(result) {
                var end = performance.now();
                var duration = end - start;

                return {
                    name: name,
                    duration: duration,
                    result: result,
                    timestamp: new Date().toISOString()
                };
            });
        },

        /**
         * 메모리 사용량 측정
         */
        getMemoryUsage: function() {
            if (performance.memory) {
                return {
                    used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                    total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                    limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
                };
            }
            return null;
        },

        /**
         * 결과 로깅
         */
        log: function(message, data) {
            console.log('[Performance Test]', message, data || '');
        }
    };

    /**
     * WorkerManager 기능 검증 테스트
     */
    var WorkerManagerTests = {
        /**
         * 기본 초기화 테스트
         */
        testInitialization: function() {
            TestUtils.log('WorkerManager 초기화 테스트 시작');

            var manager = new WorkerManager({
                workerPath: 'js/workers/file-worker.js',
                maxWorkers: 2,
                workerTimeout: 30000
            });

            return new Promise(function(resolve) {
                setTimeout(function() {
                    var status = manager.getStatus();

                    var result = {
                        supported: status.supported,
                        workersCreated: status.totalWorkers,
                        availableWorkers: status.availableWorkers,
                        success: status.totalWorkers > 0 || !status.supported
                    };

                    TestUtils.log('초기화 결과:', result);
                    resolve(result);
                }, 1000);
            });
        },

        /**
         * Worker 풀 관리 테스트
         */
        testWorkerPoolManagement: function() {
            TestUtils.log('Worker 풀 관리 테스트 시작');

            var manager = global.workerManager;
            var initialStatus = manager.getStatus();

            // 동시에 여러 작업 요청
            var promises = [];
            for (var i = 0; i < 5; i++) {
                promises.push(
                    manager.sendWorkerMessage('PING', { test: true })
                        .catch(function(error) {
                            return { error: error.message };
                        })
                );
            }

            return Promise.all(promises).then(function(results) {
                var finalStatus = manager.getStatus();

                return {
                    initialWorkers: initialStatus.totalWorkers,
                    finalWorkers: finalStatus.totalWorkers,
                    completedTasks: results.filter(function(r) { return !r.error; }).length,
                    failedTasks: results.filter(function(r) { return r.error; }).length,
                    queueHandled: finalStatus.queueLength === 0
                };
            });
        },

        /**
         * 오류 복구 메커니즘 테스트
         */
        testErrorRecovery: function() {
            TestUtils.log('오류 복구 메커니즘 테스트 시작');

            var manager = global.workerManager;
            var initialStatus = manager.getStatus();

            // 의도적으로 오류를 발생시키는 작업
            return manager.sendWorkerMessage('INVALID_TYPE', { test: true })
                .then(function() {
                    return { recovered: false, error: 'Expected error did not occur' };
                })
                .catch(function(error) {
                    // 오류가 발생한 후 정상 작업이 가능한지 확인
                    return manager.sendWorkerMessage('PING', { test: true })
                        .then(function() {
                            var finalStatus = manager.getStatus();

                            return {
                                recovered: true,
                                errorHandled: true,
                                workersStillActive: finalStatus.totalWorkers >= initialStatus.totalWorkers,
                                errorMessage: error.message
                            };
                        });
                });
        }
    };

    /**
     * 성능 벤치마크 테스트
     */
    var PerformanceTests = {
        /**
         * Excel 파싱 성능 테스트
         */
        testExcelPerformance: function() {
            TestUtils.log('Excel 파싱 성능 테스트 시작');

            var testCases = [
                { rows: 100, cols: 10, name: 'Small Excel (100x10)' },
                { rows: 1000, cols: 20, name: 'Medium Excel (1000x20)' },
                { rows: 5000, cols: 30, name: 'Large Excel (5000x30)' }
            ];

            return Promise.all(testCases.map(function(testCase) {
                return TestUtils.measurePerformance(testCase.name, function() {
                    var testData = TestUtils.generateTestExcelData(testCase.rows, testCase.cols);
                    var memoryBefore = TestUtils.getMemoryUsage();

                    return global.workerManager.processExcelFile(testData, {}, function(progress) {
                        // 진행률 모니터링
                    }).then(function(result) {
                        var memoryAfter = TestUtils.getMemoryUsage();

                        return {
                            sheets: Object.keys(result.sheets).length,
                            dataSize: testData.byteLength,
                            memoryDelta: memoryAfter ? (memoryAfter.used - memoryBefore.used) : null,
                            rowsProcessed: testCase.rows,
                            colsProcessed: testCase.cols
                        };
                    });
                });
            }));
        },

        /**
         * 이미지 처리 성능 테스트
         */
        testImagePerformance: function() {
            TestUtils.log('이미지 처리 성능 테스트 시작');

            var testCases = [
                { width: 800, height: 600, name: 'Small Image (800x600)' },
                { width: 1920, height: 1080, name: 'Medium Image (1920x1080)' },
                { width: 3840, height: 2160, name: 'Large Image (4K)' }
            ];

            return Promise.all(testCases.map(function(testCase) {
                return TestUtils.generateTestImageData(testCase.width, testCase.height)
                    .then(function(imageData) {
                        return TestUtils.measurePerformance(testCase.name, function() {
                            var memoryBefore = TestUtils.getMemoryUsage();

                            return global.workerManager.processImageFile(
                                imageData,
                                'image/png',
                                'test.png',
                                { optimize: { maxWidth: 1920, maxHeight: 1080, quality: 0.8 } }
                            ).then(function(result) {
                                var memoryAfter = TestUtils.getMemoryUsage();

                                return {
                                    originalSize: imageData.byteLength,
                                    processedWidth: result.width,
                                    processedHeight: result.height,
                                    memoryDelta: memoryAfter ? (memoryAfter.used - memoryBefore.used) : null,
                                    hasOptimized: !!result.optimized
                                };
                            });
                        });
                    });
            }));
        },

        /**
         * 동시 처리 성능 테스트
         */
        testConcurrentProcessing: function() {
            TestUtils.log('동시 처리 성능 테스트 시작');

            var concurrentTasks = [];
            var taskCount = 10;

            for (var i = 0; i < taskCount; i++) {
                concurrentTasks.push(
                    TestUtils.measurePerformance('Concurrent Task ' + i, function() {
                        var testData = TestUtils.generateTestExcelData(500, 10);
                        return global.workerManager.processExcelFile(testData);
                    })
                );
            }

            var startTime = performance.now();

            return Promise.all(concurrentTasks).then(function(results) {
                var endTime = performance.now();
                var totalDuration = endTime - startTime;

                var successCount = results.filter(function(r) { return r.result; }).length;
                var avgDuration = results.reduce(function(sum, r) { return sum + r.duration; }, 0) / results.length;

                return {
                    totalTasks: taskCount,
                    successfulTasks: successCount,
                    totalDuration: totalDuration,
                    averageTaskDuration: avgDuration,
                    concurrencyEfficiency: (avgDuration * taskCount) / totalDuration
                };
            });
        }
    };

    /**
     * 폴백 메커니즘 테스트
     */
    var FallbackTests = {
        /**
         * Worker 미지원 환경 시뮬레이션
         */
        testFallbackMechanism: function() {
            TestUtils.log('폴백 메커니즘 테스트 시작');

            // 원래 Worker 백업
            var originalWorker = global.Worker;

            return new Promise(function(resolve) {
                try {
                    // Worker를 임시로 undefined로 만들어 폴백 모드 테스트
                    global.Worker = undefined;

                    var fallbackManager = new WorkerManager({
                        enableFallback: true
                    });

                    var testData = TestUtils.generateTestExcelData(100, 5);
                    var fallbackStart = performance.now();

                    fallbackManager.processExcelFile(testData).then(function(result) {
                        var fallbackEnd = performance.now();
                        var fallbackDuration = fallbackEnd - fallbackStart;

                        // Worker 복원
                        global.Worker = originalWorker;

                        // 일반 모드와 비교
                        var normalStart = performance.now();
                        global.workerManager.processExcelFile(testData).then(function(normalResult) {
                            var normalEnd = performance.now();
                            var normalDuration = normalEnd - normalStart;

                            resolve({
                                fallbackWorked: !!result,
                                fallbackDuration: fallbackDuration,
                                normalDuration: normalDuration,
                                performanceDifference: fallbackDuration - normalDuration,
                                fallbackDataValid: result.sheets && Object.keys(result.sheets).length > 0
                            });
                        }).catch(function(error) {
                            global.Worker = originalWorker;
                            resolve({
                                fallbackWorked: !!result,
                                normalFailed: true,
                                error: error.message
                            });
                        });

                    }).catch(function(error) {
                        global.Worker = originalWorker;
                        resolve({
                            fallbackWorked: false,
                            error: error.message
                        });
                    });

                } catch (error) {
                    global.Worker = originalWorker;
                    resolve({
                        fallbackWorked: false,
                        setupError: error.message
                    });
                }
            });
        },

        /**
         * 폴백 모드 성능 비교
         */
        testFallbackPerformance: function() {
            TestUtils.log('폴백 모드 성능 비교 테스트 시작');

            var testData = TestUtils.generateTestExcelData(1000, 15);
            var originalWorker = global.Worker;

            // Worker 모드 테스트
            return TestUtils.measurePerformance('Worker Mode', function() {
                return global.workerManager.processExcelFile(testData);
            }).then(function(workerResult) {

                // 폴백 모드 테스트
                global.Worker = undefined;
                var fallbackManager = new WorkerManager({ enableFallback: true });

                return TestUtils.measurePerformance('Fallback Mode', function() {
                    return fallbackManager.processExcelFile(testData);
                }).then(function(fallbackResult) {

                    global.Worker = originalWorker;

                    return {
                        workerDuration: workerResult.duration,
                        fallbackDuration: fallbackResult.duration,
                        performanceDifference: fallbackResult.duration - workerResult.duration,
                        workerDataValid: !!(workerResult.result && workerResult.result.sheets),
                        fallbackDataValid: !!(fallbackResult.result && fallbackResult.result.sheets),
                        fallbackSlower: fallbackResult.duration > workerResult.duration
                    };
                });
            }).catch(function(error) {
                global.Worker = originalWorker;
                throw error;
            });
        }
    };

    /**
     * 안정성 및 부하 테스트
     */
    var StabilityTests = {
        /**
         * 메모리 누수 테스트
         */
        testMemoryLeak: function() {
            TestUtils.log('메모리 누수 테스트 시작');

            if (!performance.memory) {
                return Promise.resolve({
                    skipped: true,
                    reason: 'Memory API not available'
                });
            }

            var initialMemory = TestUtils.getMemoryUsage();
            var iterations = 20;
            var results = [];

            function runIteration(i) {
                if (i >= iterations) {
                    var finalMemory = TestUtils.getMemoryUsage();
                    var avgMemoryIncrease = results.reduce(function(sum, r) { return sum + r.memoryIncrease; }, 0) / results.length;

                    return {
                        iterations: iterations,
                        initialMemory: initialMemory.used,
                        finalMemory: finalMemory.used,
                        totalMemoryIncrease: finalMemory.used - initialMemory.used,
                        averageMemoryIncrease: avgMemoryIncrease,
                        memoryLeakSuspected: (finalMemory.used - initialMemory.used) > 50 // 50MB 증가 시 의심
                    };
                }

                var beforeMemory = TestUtils.getMemoryUsage();
                var testData = TestUtils.generateTestExcelData(200, 8);

                return global.workerManager.processExcelFile(testData).then(function() {
                    // 가비지 컬렉션 유도
                    if (global.gc) {
                        global.gc();
                    }

                    setTimeout(function() {
                        var afterMemory = TestUtils.getMemoryUsage();
                        results.push({
                            iteration: i,
                            memoryIncrease: afterMemory.used - beforeMemory.used
                        });

                        return runIteration(i + 1);
                    }, 100);
                }).catch(function() {
                    return runIteration(i + 1);
                });
            }

            return runIteration(0);
        },

        /**
         * 장시간 안정성 테스트
         */
        testLongRunningStability: function() {
            TestUtils.log('장시간 안정성 테스트 시작');

            var testDuration = 30000; // 30초
            var startTime = Date.now();
            var completedTasks = 0;
            var failedTasks = 0;

            function runContinuousTest() {
                var currentTime = Date.now();

                if (currentTime - startTime >= testDuration) {
                    return {
                        duration: testDuration,
                        completedTasks: completedTasks,
                        failedTasks: failedTasks,
                        tasksPerSecond: completedTasks / (testDuration / 1000),
                        successRate: completedTasks / (completedTasks + failedTasks)
                    };
                }

                var testData = TestUtils.generateTestExcelData(100, 5);

                return global.workerManager.processExcelFile(testData).then(function() {
                    completedTasks++;
                    return runContinuousTest();
                }).catch(function() {
                    failedTasks++;
                    return runContinuousTest();
                });
            }

            return runContinuousTest();
        },

        /**
         * 높은 부하 상황 테스트
         */
        testHighLoad: function() {
            TestUtils.log('높은 부하 상황 테스트 시작');

            var highLoadTasks = [];
            var taskCount = 50;

            for (var i = 0; i < taskCount; i++) {
                var taskSize = Math.floor(Math.random() * 1000) + 500; // 500-1500 행
                highLoadTasks.push(function() {
                    var testData = TestUtils.generateTestExcelData(taskSize, 10);
                    return global.workerManager.processExcelFile(testData);
                });
            }

            var startTime = performance.now();
            var memoryBefore = TestUtils.getMemoryUsage();

            return Promise.all(highLoadTasks.map(function(task, index) {
                return task().then(function(result) {
                    return { success: true, index: index };
                }).catch(function(error) {
                    return { success: false, index: index, error: error.message };
                });
            })).then(function(results) {
                var endTime = performance.now();
                var memoryAfter = TestUtils.getMemoryUsage();

                var successCount = results.filter(function(r) { return r.success; }).length;

                return {
                    totalTasks: taskCount,
                    successfulTasks: successCount,
                    failedTasks: taskCount - successCount,
                    totalDuration: endTime - startTime,
                    averageDuration: (endTime - startTime) / taskCount,
                    memoryIncrease: memoryAfter ? (memoryAfter.used - memoryBefore.used) : null,
                    systemStable: successCount > taskCount * 0.8 // 80% 성공률 기준
                };
            });
        }
    };

    /**
     * 메인 테스트 실행기
     */
    var WorkerPerformanceTest = {
        /**
         * 모든 테스트 실행
         */
        runAllTests: function() {
            TestUtils.log('=== Web Worker 시스템 종합 테스트 시작 ===');

            var startTime = Date.now();
            var testResults = {};

            return this.runWorkerManagerTests()
                .then(function(results) {
                    testResults.workerManager = results;
                    return this.runPerformanceTests();
                }.bind(this))
                .then(function(results) {
                    testResults.performance = results;
                    return this.runFallbackTests();
                }.bind(this))
                .then(function(results) {
                    testResults.fallback = results;
                    return this.runStabilityTests();
                }.bind(this))
                .then(function(results) {
                    testResults.stability = results;

                    var endTime = Date.now();
                    var totalDuration = endTime - startTime;

                    testResults.summary = {
                        totalDuration: totalDuration,
                        completedAt: new Date().toISOString(),
                        overallSuccess: this.evaluateOverallSuccess(testResults)
                    };

                    TestUtils.log('=== 테스트 완료 ===', testResults.summary);
                    return testResults;
                }.bind(this))
                .catch(function(error) {
                    TestUtils.log('테스트 실행 중 오류:', error);
                    throw error;
                });
        },

        /**
         * WorkerManager 테스트 실행
         */
        runWorkerManagerTests: function() {
            TestUtils.log('--- WorkerManager 기능 테스트 ---');

            return Promise.all([
                WorkerManagerTests.testInitialization(),
                WorkerManagerTests.testWorkerPoolManagement(),
                WorkerManagerTests.testErrorRecovery()
            ]).then(function(results) {
                return {
                    initialization: results[0],
                    poolManagement: results[1],
                    errorRecovery: results[2]
                };
            });
        },

        /**
         * 성능 테스트 실행
         */
        runPerformanceTests: function() {
            TestUtils.log('--- 성능 벤치마크 테스트 ---');

            return Promise.all([
                PerformanceTests.testExcelPerformance(),
                PerformanceTests.testImagePerformance(),
                PerformanceTests.testConcurrentProcessing()
            ]).then(function(results) {
                return {
                    excelPerformance: results[0],
                    imagePerformance: results[1],
                    concurrentProcessing: results[2]
                };
            });
        },

        /**
         * 폴백 테스트 실행
         */
        runFallbackTests: function() {
            TestUtils.log('--- 폴백 메커니즘 테스트 ---');

            return Promise.all([
                FallbackTests.testFallbackMechanism(),
                FallbackTests.testFallbackPerformance()
            ]).then(function(results) {
                return {
                    mechanism: results[0],
                    performance: results[1]
                };
            });
        },

        /**
         * 안정성 테스트 실행
         */
        runStabilityTests: function() {
            TestUtils.log('--- 안정성 및 부하 테스트 ---');

            return Promise.all([
                StabilityTests.testMemoryLeak(),
                StabilityTests.testLongRunningStability(),
                StabilityTests.testHighLoad()
            ]).then(function(results) {
                return {
                    memoryLeak: results[0],
                    longRunning: results[1],
                    highLoad: results[2]
                };
            });
        },

        /**
         * 전체 성공 여부 평가
         */
        evaluateOverallSuccess: function(testResults) {
            var issues = [];

            // WorkerManager 테스트 평가
            if (!testResults.workerManager.initialization.success) {
                issues.push('WorkerManager 초기화 실패');
            }

            // 성능 테스트 평가
            if (testResults.performance.concurrentProcessing.concurrencyEfficiency < 0.7) {
                issues.push('동시 처리 효율성 낮음');
            }

            // 안정성 테스트 평가
            if (testResults.stability.highLoad.systemStable === false) {
                issues.push('높은 부하 상황에서 시스템 불안정');
            }

            return {
                success: issues.length === 0,
                issues: issues,
                score: Math.max(0, 100 - issues.length * 20)
            };
        }
    };

    // 전역에 노출
    global.WorkerPerformanceTest = WorkerPerformanceTest;
    global.WorkerTestUtils = TestUtils;

})(typeof window !== 'undefined' ? window : this);