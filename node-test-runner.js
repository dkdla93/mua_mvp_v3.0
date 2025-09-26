/**
 * Node.js 환경에서 FileProcessor 테스트 실행
 * 브라우저 환경을 시뮬레이션하여 코드 검증
 */

'use strict';

// Node.js 환경에서 브라우저 API 모킹
global.window = global;
global.document = {
    createElement: function(tag) {
        if (tag === 'canvas') {
            return {
                getContext: function() {
                    return {
                        drawImage: function() {},
                        canvas: { width: 0, height: 0 }
                    };
                },
                width: 0,
                height: 0,
                toBlob: function(callback) {
                    // 모킹된 Blob 생성
                    callback(new Blob(['mock'], { type: 'image/jpeg' }));
                }
            };
        }
        return {};
    }
};

global.Image = function() {
    return {
        onload: null,
        onerror: null,
        src: '',
        width: 1920,
        height: 1080
    };
};

global.FileReader = function() {
    return {
        onload: null,
        onerror: null,
        readAsArrayBuffer: function(file) {
            setTimeout(() => {
                if (this.onload) {
                    this.onload({ target: { result: new ArrayBuffer(1024) } });
                }
            }, 10);
        },
        readAsDataURL: function(file) {
            setTimeout(() => {
                if (this.onload) {
                    this.onload({ target: { result: 'data:image/jpeg;base64,mockdata' } });
                }
            }, 10);
        }
    };
};

global.Worker = undefined; // Web Worker 미지원으로 설정
global.Blob = function(data, options) {
    return {
        size: data.length > 0 ? data[0].length : 0,
        type: options?.type || 'application/octet-stream'
    };
};

global.URL = {
    createObjectURL: function() { return 'blob:mock-url'; },
    revokeObjectURL: function() {}
};

// XLSX 라이브러리 모킹
global.XLSX = {
    read: function(data, options) {
        return {
            SheetNames: ['Sheet1'],
            Sheets: {
                'Sheet1': {}
            },
            Props: {}
        };
    },
    utils: {
        sheet_to_json: function(sheet, options) {
            return [
                ['MATERIAL', 'AREA', 'ITEM', 'SIZE'],
                ['타일', '욕실', '바닥타일', '300x300'],
                ['페인트', '거실', '벽면페인트', '1L']
            ];
        }
    }
};

// FileProcessor 로드 전에 폴리필 설정
try {
    require('./public/js/polyfills/polyfills.js');
} catch (e) {
    // 폴리필이 없어도 계속 진행
}

// FileProcessor와 관련 유틸리티 로드
let fileProcessor, FileProcessor, WorkerManager;

try {
    // WorkerManager 먼저 로드
    const workerManagerCode = require('fs').readFileSync('./public/js/utils/worker-manager.js', 'utf8');
    eval(workerManagerCode);
    WorkerManager = global.WorkerManager;
    console.log('✅ WorkerManager 로드됨');
} catch (error) {
    console.warn('⚠️ WorkerManager 로드 실패:', error.message);
}

try {
    // FileProcessor 로드
    const fileProcessorCode = require('fs').readFileSync('./public/js/utils/file-processor.js', 'utf8');
    eval(fileProcessorCode);
    fileProcessor = global.fileProcessor;
    FileProcessor = global.FileProcessor;
    console.log('✅ FileProcessor 로드됨');
} catch (error) {
    console.error('❌ FileProcessor 로드 실패:', error);
    process.exit(1);
}

// 테스트 스크립트 로드 및 실행
try {
    const testCode = require('fs').readFileSync('./file-processor-test.js', 'utf8');
    eval(testCode);

    console.log('\n🚀 FileProcessor 테스트 시작 (Node.js 환경)');
    console.log('='.repeat(60));

    // 테스트 실행 (파일에서 노출된 함수명 확인)
    const testFunction = typeof runAllTests === 'function' ? runAllTests :
                         typeof window.runFileProcessorTests === 'function' ? window.runFileProcessorTests :
                         typeof runFileProcessorTests === 'function' ? runFileProcessorTests : null;

    if (testFunction) {
        testFunction()
            .then(results => {
                console.log('\n📊 최종 테스트 결과:');
                console.log('='.repeat(40));

                if (results.error) {
                    console.error('❌ 테스트 실행 오류:', results.error);
                } else {
                    const { summary, detailed } = results;
                    const successRate = Math.round((summary.totalPassed / summary.totalTests) * 100);

                    console.log(`전체: ${summary.totalPassed}/${summary.totalTests} 통과 (${successRate}%)`);

                    console.log('\n📋 카테고리별 결과:');
                    Object.entries(detailed).forEach(([category, result]) => {
                        const categorySuccess = result.tests > 0 ? Math.round((result.passed / result.tests) * 100) : 0;
                        const status = result.failed === 0 ? '✅' : '❌';
                        console.log(`  ${status} ${category}: ${result.passed}/${result.tests} (${categorySuccess}%)`);

                        if (result.failed > 0) {
                            console.log(`    실패: ${result.failed}개`);
                        }
                    });

                    // 성능 메트릭
                    console.log('\n⚡ 성능 정보:');
                    console.log(`  FileProcessor 옵션:`, {
                        maxFileSize: `${Math.round(fileProcessor.options.maxFileSize / 1024 / 1024)}MB`,
                        chunkSize: `${Math.round(fileProcessor.options.chunkSize / 1024 / 1024)}MB`,
                        maxRetries: fileProcessor.options.maxRetries,
                        timeout: `${fileProcessor.options.timeout / 1000}초`
                    });

                    const workerStatus = fileProcessor.getWorkerStatus();
                    console.log(`  Worker 지원:`, workerStatus.supported ? '✅' : '❌');
                    console.log(`  처리 큐:`, fileProcessor.getStatus());

                    // 권장사항
                    console.log('\n💡 검증 결과 및 권장사항:');

                    if (successRate >= 90) {
                        console.log('✅ 우수: 파일 처리 시스템이 안정적으로 구현되어 있습니다.');
                    } else if (successRate >= 70) {
                        console.log('⚠️ 보통: 일부 기능에 개선이 필요합니다.');
                    } else {
                        console.log('❌ 미흡: 파일 처리 시스템에 중대한 문제가 있습니다.');
                    }

                    // 실제 브라우저 테스트 권장
                    console.log('\n🌐 실제 브라우저 테스트:');
                    console.log('  Node.js 환경에서의 테스트는 제한적입니다.');
                    console.log('  실제 파일 업로드 테스트는 다음 URL에서 수행하세요:');
                    console.log('  http://localhost:8080/test-runner.html');
                }

                process.exit(results.error ? 1 : 0);
            })
            .catch(error => {
                console.error('❌ 테스트 실행 중 예외:', error);
                process.exit(1);
            });
    } else {
        console.error('❌ 테스트 함수를 찾을 수 없습니다.');
        process.exit(1);
    }
} catch (error) {
    console.error('❌ 테스트 스크립트 로드 실패:', error);
    process.exit(1);
}