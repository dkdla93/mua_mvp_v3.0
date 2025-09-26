/**
 * FileProcessor 종합 테스트 스크립트
 * Excel 파일 업로드, 이미지 처리, 파일 검증 기능을 종합적으로 테스트
 */

'use strict';

// 테스트 결과 저장 객체
var testResults = {
    excel: { tests: 0, passed: 0, failed: 0 },
    image: { tests: 0, passed: 0, failed: 0 },
    validation: { tests: 0, passed: 0, failed: 0 },
    worker: { tests: 0, passed: 0, failed: 0 },
    largeFile: { tests: 0, passed: 0, failed: 0 }
};

// 테스트 로그 저장
var testLogs = [];

function logTest(category, testName, result, details) {
    testResults[category].tests++;
    if (result) {
        testResults[category].passed++;
    } else {
        testResults[category].failed++;
    }

    var logEntry = {
        timestamp: new Date().toISOString(),
        category: category,
        testName: testName,
        result: result ? 'PASS' : 'FAIL',
        details: details
    };

    testLogs.push(logEntry);
    console.log(`[${logEntry.result}] ${category}/${testName}: ${details}`);
}

/**
 * Excel 파일 처리 테스트 모음
 */
function testExcelProcessing() {
    return new Promise(function(resolve) {
        console.log('\n=== Excel 파일 처리 테스트 시작 ===');

        // 1. FileProcessor 인스턴스 확인
        try {
            if (typeof fileProcessor !== 'undefined' && fileProcessor.processFile) {
                logTest('excel', 'FileProcessor 인스턴스 존재', true, 'FileProcessor 전역 인스턴스가 정상적으로 로드됨');
            } else {
                logTest('excel', 'FileProcessor 인스턴스 존재', false, 'FileProcessor 인스턴스를 찾을 수 없음');
            }
        } catch (error) {
            logTest('excel', 'FileProcessor 인스턴스 존재', false, error.message);
        }

        // 2. Excel 파일 타입 검증 테스트
        var mockExcelFile = {
            name: 'test.xlsx',
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            size: 1024 * 50 // 50KB
        };

        try {
            var isValidExcel = fileProcessor.isExcelFile(mockExcelFile);
            logTest('excel', 'Excel 파일 타입 검증', isValidExcel, 'Excel 파일 타입이 올바르게 인식됨');
        } catch (error) {
            logTest('excel', 'Excel 파일 타입 검증', false, error.message);
        }

        // 3. 지원되는 Excel 확장자 테스트
        var excelExtensions = ['.xlsx', '.xls', '.csv'];
        excelExtensions.forEach(function(ext) {
            var testFile = {
                name: 'test' + ext,
                type: ext === '.csv' ? 'text/csv' : 'application/vnd.ms-excel',
                size: 1024
            };

            try {
                var isValid = fileProcessor.isExcelFile(testFile);
                logTest('excel', 'Excel 확장자 지원 (' + ext + ')', isValid,
                    ext + ' 확장자 파일이 ' + (isValid ? '지원됨' : '지원되지 않음'));
            } catch (error) {
                logTest('excel', 'Excel 확장자 지원 (' + ext + ')', false, error.message);
            }
        });

        // 4. Excel 파일 크기 제한 테스트
        var largeExcelFile = {
            name: 'large.xlsx',
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            size: 100 * 1024 * 1024 // 100MB (기본 제한 50MB 초과)
        };

        try {
            fileProcessor.validateFile(largeExcelFile, 'excel');
            logTest('excel', 'Excel 파일 크기 제한', false, '크기 제한이 제대로 작동하지 않음');
        } catch (error) {
            logTest('excel', 'Excel 파일 크기 제한', true, '파일 크기 제한이 올바르게 작동: ' + error.message);
        }

        resolve();
    });
}

/**
 * 이미지 파일 처리 테스트 모음
 */
function testImageProcessing() {
    return new Promise(function(resolve) {
        console.log('\n=== 이미지 파일 처리 테스트 시작 ===');

        // 1. 이미지 파일 타입 검증
        var imageTypes = [
            { name: 'test.jpg', type: 'image/jpeg' },
            { name: 'test.png', type: 'image/png' },
            { name: 'test.gif', type: 'image/gif' },
            { name: 'test.webp', type: 'image/webp' }
        ];

        imageTypes.forEach(function(imageType) {
            var testFile = {
                name: imageType.name,
                type: imageType.type,
                size: 1024 * 100 // 100KB
            };

            try {
                var isValid = fileProcessor.isImageFile(testFile);
                logTest('image', '이미지 타입 지원 (' + imageType.type + ')', isValid,
                    imageType.type + ' 타입이 ' + (isValid ? '지원됨' : '지원되지 않음'));
            } catch (error) {
                logTest('image', '이미지 타입 지원 (' + imageType.type + ')', false, error.message);
            }
        });

        // 2. 다중 이미지 파일 배치 처리 시뮬레이션
        var multipleImageFiles = [
            { name: 'img1.jpg', type: 'image/jpeg', size: 1024 * 200 },
            { name: 'img2.png', type: 'image/png', size: 1024 * 150 },
            { name: 'img3.gif', type: 'image/gif', size: 1024 * 300 }
        ];

        try {
            // 모든 파일이 유효한지 검증
            var allValid = multipleImageFiles.every(function(file) {
                try {
                    fileProcessor.validateFile(file, 'image');
                    return true;
                } catch (e) {
                    return false;
                }
            });

            logTest('image', '다중 이미지 파일 검증', allValid,
                '다중 이미지 파일 검증이 ' + (allValid ? '성공' : '실패'));
        } catch (error) {
            logTest('image', '다중 이미지 파일 검증', false, error.message);
        }

        // 3. 이미지 최적화 옵션 구조 검증
        try {
            var optimizeOptions = {
                maxWidth: 1920,
                maxHeight: 1080,
                quality: 0.8,
                format: 'image/jpeg'
            };

            // optimizeImage 메서드가 존재하는지 확인
            var hasOptimizeMethod = typeof fileProcessor.optimizeImage === 'function';
            logTest('image', '이미지 최적화 메서드 존재', hasOptimizeMethod,
                '이미지 최적화 메서드가 ' + (hasOptimizeMethod ? '존재함' : '존재하지 않음'));
        } catch (error) {
            logTest('image', '이미지 최적화 메서드 존재', false, error.message);
        }

        resolve();
    });
}

/**
 * 파일 검증 시스템 테스트
 */
function testFileValidation() {
    return new Promise(function(resolve) {
        console.log('\n=== 파일 검증 시스템 테스트 시작 ===');

        // 1. 빈 파일 검증 테스트
        try {
            var emptyFile = { name: 'empty.xlsx', type: 'application/vnd.ms-excel', size: 0 };
            fileProcessor.validateFile(emptyFile, 'excel');
            logTest('validation', '빈 파일 검증', false, '빈 파일이 잘못 승인됨');
        } catch (error) {
            logTest('validation', '빈 파일 검증', true, '빈 파일이 올바르게 거부됨: ' + error.message);
        }

        // 2. null/undefined 파일 검증
        try {
            fileProcessor.validateFile(null, 'excel');
            logTest('validation', 'null 파일 검증', false, 'null 파일이 잘못 승인됨');
        } catch (error) {
            logTest('validation', 'null 파일 검증', true, 'null 파일이 올바르게 거부됨: ' + error.message);
        }

        // 3. 지원하지 않는 파일 타입 검증
        try {
            var unsupportedFile = { name: 'test.txt', type: 'text/plain', size: 1024 };
            fileProcessor.validateFile(unsupportedFile, 'excel');
            logTest('validation', '지원하지 않는 타입 검증', false, '지원하지 않는 파일이 잘못 승인됨');
        } catch (error) {
            logTest('validation', '지원하지 않는 타입 검증', true, '지원하지 않는 파일이 올바르게 거부됨: ' + error.message);
        }

        // 4. 파일 크기 경계값 테스트
        var maxSize = fileProcessor.options.maxFileSize;
        var borderlineFile = {
            name: 'borderline.xlsx',
            type: 'application/vnd.ms-excel',
            size: maxSize - 1 // 제한 크기보다 1바이트 작게
        };

        try {
            fileProcessor.validateFile(borderlineFile, 'excel');
            logTest('validation', '경계값 파일 크기 검증', true, '경계값 파일이 올바르게 승인됨');
        } catch (error) {
            logTest('validation', '경계값 파일 크기 검증', false, '경계값 파일이 잘못 거부됨: ' + error.message);
        }

        // 5. 확장자와 MIME 타입 불일치 검증
        try {
            var mismatchFile = {
                name: 'test.xlsx',
                type: 'image/jpeg', // 잘못된 MIME 타입
                size: 1024
            };

            // 확장자 기반으로는 통과해야 함
            var isValid = fileProcessor.isValidFileType(mismatchFile, 'excel');
            logTest('validation', 'MIME/확장자 불일치 처리', isValid,
                'MIME 타입과 확장자가 불일치해도 ' + (isValid ? '확장자로 인식됨' : '거부됨'));
        } catch (error) {
            logTest('validation', 'MIME/확장자 불일치 처리', false, error.message);
        }

        resolve();
    });
}

/**
 * 대용량 파일 및 청크 처리 테스트
 */
function testLargeFileProcessing() {
    return new Promise(function(resolve) {
        console.log('\n=== 대용량 파일 처리 테스트 시작 ===');

        // 1. 청크 크기 설정 확인
        try {
            var chunkSize = fileProcessor.options.chunkSize;
            var hasChunkSize = typeof chunkSize === 'number' && chunkSize > 0;
            logTest('largeFile', '청크 크기 설정', hasChunkSize,
                '청크 크기: ' + (chunkSize / 1024 / 1024) + 'MB');
        } catch (error) {
            logTest('largeFile', '청크 크기 설정', false, error.message);
        }

        // 2. 청크 처리 메서드 존재 확인
        try {
            var hasChunkMethod = typeof fileProcessor.processExcelInChunks === 'function';
            logTest('largeFile', '청크 처리 메서드', hasChunkMethod,
                '청크 처리 메서드가 ' + (hasChunkMethod ? '존재함' : '존재하지 않음'));
        } catch (error) {
            logTest('largeFile', '청크 처리 메서드', false, error.message);
        }

        // 3. 청크 결합 메서드 확인
        try {
            var hasCombineMethod = typeof fileProcessor.combineExcelChunks === 'function';
            logTest('largeFile', '청크 결합 메서드', hasCombineMethod,
                '청크 결합 메서드가 ' + (hasCombineMethod ? '존재함' : '존재하지 않음'));
        } catch (error) {
            logTest('largeFile', '청크 결합 메서드', false, error.message);
        }

        // 4. 재시도 메커니즘 확인
        try {
            var maxRetries = fileProcessor.options.maxRetries;
            var hasRetryLogic = typeof maxRetries === 'number' && maxRetries > 0;
            logTest('largeFile', '재시도 메커니즘', hasRetryLogic,
                '최대 재시도 횟수: ' + maxRetries + '회');
        } catch (error) {
            logTest('largeFile', '재시도 메커니즘', false, error.message);
        }

        // 5. 타임아웃 설정 확인
        try {
            var timeout = fileProcessor.options.timeout;
            var hasTimeout = typeof timeout === 'number' && timeout > 0;
            logTest('largeFile', '타임아웃 설정', hasTimeout,
                '타임아웃: ' + (timeout / 1000) + '초');
        } catch (error) {
            logTest('largeFile', '타임아웃 설정', false, error.message);
        }

        resolve();
    });
}

/**
 * Web Worker 및 WorkerManager 기능 테스트
 */
function testWorkerFunctionality() {
    return new Promise(function(resolve) {
        console.log('\n=== Web Worker 기능 테스트 시작 ===');

        // 1. WorkerManager 인스턴스 확인
        try {
            var hasWorkerManager = typeof WorkerManager !== 'undefined';
            logTest('worker', 'WorkerManager 클래스', hasWorkerManager,
                'WorkerManager 클래스가 ' + (hasWorkerManager ? '로드됨' : '로드되지 않음'));
        } catch (error) {
            logTest('worker', 'WorkerManager 클래스', false, error.message);
        }

        // 2. FileProcessor의 WorkerManager 연동 확인
        try {
            var workerStatus = fileProcessor.getWorkerStatus();
            var hasWorkerIntegration = !!workerStatus;
            logTest('worker', 'WorkerManager 연동', hasWorkerIntegration,
                'Worker 상태: ' + JSON.stringify(workerStatus));
        } catch (error) {
            logTest('worker', 'WorkerManager 연동', false, error.message);
        }

        // 3. Web Worker 지원 여부 확인
        try {
            var isWorkerSupported = typeof Worker !== 'undefined';
            logTest('worker', 'Web Worker 브라우저 지원', isWorkerSupported,
                'Web Worker가 ' + (isWorkerSupported ? '지원됨' : '지원되지 않음'));
        } catch (error) {
            logTest('worker', 'Web Worker 브라우저 지원', false, error.message);
        }

        // 4. Worker 폴백 메커니즘 확인
        try {
            var hasFallbackMethods =
                typeof fileProcessor.processExcelFallback === 'function' &&
                typeof fileProcessor.processImageFallback === 'function';
            logTest('worker', 'Worker 폴백 메커니즘', hasFallbackMethods,
                '폴백 메서드들이 ' + (hasFallbackMethods ? '존재함' : '존재하지 않음'));
        } catch (error) {
            logTest('worker', 'Worker 폴백 메커니즘', false, error.message);
        }

        // 5. 처리 큐 시스템 확인
        try {
            var queueStatus = fileProcessor.getStatus();
            var hasQueueSystem = queueStatus && typeof queueStatus.queueLength === 'number';
            logTest('worker', '처리 큐 시스템', hasQueueSystem,
                '큐 상태: ' + JSON.stringify(queueStatus));
        } catch (error) {
            logTest('worker', '처리 큐 시스템', false, error.message);
        }

        resolve();
    });
}

/**
 * 전체 테스트 실행
 */
function runAllTests() {
    console.log('파일 업로드 및 처리 기능 종합 테스트 시작\n');
    console.log('테스트 시작 시간:', new Date().toISOString());

    return testExcelProcessing()
        .then(testImageProcessing)
        .then(testFileValidation)
        .then(testLargeFileProcessing)
        .then(testWorkerFunctionality)
        .then(function() {
            console.log('\n=== 테스트 결과 요약 ===');

            var totalTests = 0;
            var totalPassed = 0;
            var totalFailed = 0;

            Object.keys(testResults).forEach(function(category) {
                var result = testResults[category];
                totalTests += result.tests;
                totalPassed += result.passed;
                totalFailed += result.failed;

                console.log(`${category}: ${result.passed}/${result.tests} 통과 (실패: ${result.failed})`);
            });

            console.log(`\n전체: ${totalPassed}/${totalTests} 통과 (${Math.round((totalPassed/totalTests)*100)}%)`);
            console.log('테스트 완료 시간:', new Date().toISOString());

            return {
                summary: { totalTests, totalPassed, totalFailed },
                detailed: testResults,
                logs: testLogs
            };
        })
        .catch(function(error) {
            console.error('테스트 실행 중 오류 발생:', error);
            return { error: error.message };
        });
}

// 브라우저 환경에서 실행
if (typeof window !== 'undefined') {
    window.runFileProcessorTests = runAllTests;
    console.log('FileProcessor 테스트가 준비되었습니다. runFileProcessorTests()를 호출하세요.');
} else {
    // Node.js 환경에서는 전역으로 노출
    global.runAllTests = runAllTests;
    global.runFileProcessorTests = runAllTests;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { runAllTests };
    }
}