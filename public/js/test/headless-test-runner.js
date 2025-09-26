/**
 * 헤드리스 테스트 러너 - Node.js 환경에서 Worker 시스템 테스트
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class HeadlessTestRunner {
    constructor(options = {}) {
        this.options = {
            headless: true,
            timeout: 300000, // 5분
            ...options
        };
        this.browser = null;
        this.page = null;
    }

    async init() {
        this.browser = await puppeteer.launch({
            headless: this.options.headless,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        this.page = await this.browser.newPage();

        // 콘솔 메시지 캡처
        this.page.on('console', msg => {
            console.log('PAGE LOG:', msg.text());
        });

        // 에러 캡처
        this.page.on('pageerror', error => {
            console.error('PAGE ERROR:', error.message);
        });
    }

    async runTests(testUrl) {
        if (!this.page) {
            await this.init();
        }

        console.log('테스트 페이지 로딩:', testUrl);
        await this.page.goto(testUrl, { waitUntil: 'networkidle0' });

        // 페이지가 완전히 로드될 때까지 대기
        await this.page.waitForSelector('#runAllTests');

        console.log('전체 테스트 실행 시작...');

        // 테스트 실행
        const testResults = await this.page.evaluate(async () => {
            // 전체 테스트 실행
            const testPromise = WorkerPerformanceTest.runAllTests();

            // 진행 상황 모니터링
            const startTime = Date.now();
            let lastUpdate = startTime;

            while (true) {
                const currentTime = Date.now();

                // 진행 상황 체크 (5초마다)
                if (currentTime - lastUpdate > 5000) {
                    console.log('테스트 진행 중... (' + Math.round((currentTime - startTime) / 1000) + '초 경과)');
                    lastUpdate = currentTime;
                }

                // Promise 완료 체크
                const isResolved = await Promise.race([
                    testPromise.then(() => true),
                    new Promise(resolve => setTimeout(() => resolve(false), 100))
                ]);

                if (isResolved) {
                    return await testPromise;
                }

                // 타임아웃 체크 (5분)
                if (currentTime - startTime > 300000) {
                    throw new Error('테스트 타임아웃 (5분 초과)');
                }

                await new Promise(resolve => setTimeout(resolve, 100));
            }
        });

        console.log('테스트 완료!');
        return testResults;
    }

    async generateReport(testResults, outputPath) {
        const report = this.createDetailedReport(testResults);

        if (outputPath) {
            fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
            console.log('상세 리포트 저장됨:', outputPath);
        }

        return report;
    }

    createDetailedReport(results) {
        const report = {
            testSummary: {
                executionTime: results.summary.totalDuration,
                overallScore: results.summary.overallSuccess.score,
                success: results.summary.overallSuccess.success,
                issues: results.summary.overallSuccess.issues,
                timestamp: results.summary.completedAt
            },
            workerManagerAnalysis: this.analyzeWorkerManager(results.workerManager),
            performanceAnalysis: this.analyzePerformance(results.performance),
            fallbackAnalysis: this.analyzeFallback(results.fallback),
            stabilityAnalysis: this.analyzeStability(results.stability),
            recommendations: this.generateRecommendations(results)
        };

        return report;
    }

    analyzeWorkerManager(results) {
        return {
            initialization: {
                status: results.initialization.success ? 'PASS' : 'FAIL',
                workersCreated: results.initialization.workersCreated,
                workerSupport: results.initialization.supported
            },
            poolManagement: {
                status: results.poolManagement.queueHandled ? 'PASS' : 'FAIL',
                tasksCompleted: results.poolManagement.completedTasks,
                tasksFailed: results.poolManagement.failedTasks,
                successRate: results.poolManagement.completedTasks /
                    (results.poolManagement.completedTasks + results.poolManagement.failedTasks)
            },
            errorRecovery: {
                status: results.errorRecovery.recovered ? 'PASS' : 'FAIL',
                recoveryWorked: results.errorRecovery.recovered,
                workersActive: results.errorRecovery.workersStillActive
            }
        };
    }

    analyzePerformance(results) {
        const excelBenchmarks = results.excelPerformance.map(test => ({
            testName: test.name,
            duration: test.duration,
            dataSize: test.result.dataSize,
            throughput: test.result.dataSize / test.duration * 1000 // bytes per second
        }));

        const imageBenchmarks = results.imagePerformance.map(test => ({
            testName: test.name,
            duration: test.duration,
            imageSize: test.result.processedWidth + 'x' + test.result.processedHeight,
            hasOptimization: test.result.hasOptimized
        }));

        return {
            excelProcessing: {
                benchmarks: excelBenchmarks,
                averageDuration: excelBenchmarks.reduce((sum, b) => sum + b.duration, 0) / excelBenchmarks.length,
                averageThroughput: excelBenchmarks.reduce((sum, b) => sum + b.throughput, 0) / excelBenchmarks.length
            },
            imageProcessing: {
                benchmarks: imageBenchmarks,
                averageDuration: imageBenchmarks.reduce((sum, b) => sum + b.duration, 0) / imageBenchmarks.length
            },
            concurrentProcessing: {
                totalTasks: results.concurrentProcessing.totalTasks,
                successfulTasks: results.concurrentProcessing.successfulTasks,
                efficiency: results.concurrentProcessing.concurrencyEfficiency,
                status: results.concurrentProcessing.concurrencyEfficiency > 0.7 ? 'PASS' : 'FAIL'
            }
        };
    }

    analyzeFallback(results) {
        return {
            mechanismTest: {
                status: results.mechanism.fallbackWorked ? 'PASS' : 'FAIL',
                fallbackWorked: results.mechanism.fallbackWorked,
                dataValidation: results.mechanism.fallbackDataValid
            },
            performanceComparison: results.performance ? {
                workerDuration: results.performance.workerDuration,
                fallbackDuration: results.performance.fallbackDuration,
                performanceDelta: results.performance.performanceDifference,
                fallbackAcceptable: results.performance.performanceDifference < 5000
            } : null
        };
    }

    analyzeStability(results) {
        const analysis = {
            longRunning: {
                status: results.longRunning.successRate > 0.95 ? 'PASS' : 'FAIL',
                duration: 30000,
                tasksCompleted: results.longRunning.completedTasks,
                tasksFailed: results.longRunning.failedTasks,
                successRate: results.longRunning.successRate,
                throughput: results.longRunning.tasksPerSecond
            },
            highLoad: {
                status: results.highLoad.systemStable ? 'PASS' : 'FAIL',
                totalTasks: results.highLoad.totalTasks,
                successfulTasks: results.highLoad.successfulTasks,
                successRate: results.highLoad.successfulTasks / results.highLoad.totalTasks,
                averageDuration: results.highLoad.averageDuration
            }
        };

        if (!results.memoryLeak.skipped) {
            analysis.memoryLeak = {
                status: !results.memoryLeak.memoryLeakSuspected ? 'PASS' : 'FAIL',
                iterations: results.memoryLeak.iterations,
                memoryIncrease: results.memoryLeak.totalMemoryIncrease,
                averageIncrease: results.memoryLeak.averageMemoryIncrease,
                suspected: results.memoryLeak.memoryLeakSuspected
            };
        }

        return analysis;
    }

    generateRecommendations(results) {
        const recommendations = [];

        // WorkerManager 관련
        if (!results.workerManager.initialization.success) {
            recommendations.push({
                category: 'WorkerManager',
                priority: 'HIGH',
                issue: 'Worker 초기화 실패',
                recommendation: 'Worker 파일 경로와 브라우저 호환성을 확인하세요.'
            });
        }

        // 성능 관련
        if (results.performance.concurrentProcessing.concurrencyEfficiency < 0.7) {
            recommendations.push({
                category: 'Performance',
                priority: 'MEDIUM',
                issue: '동시 처리 효율성 낮음',
                recommendation: 'Worker 풀 크기를 조정하거나 작업 큐 관리를 개선하세요.'
            });
        }

        // 안정성 관련
        if (results.stability.highLoad && !results.stability.highLoad.systemStable) {
            recommendations.push({
                category: 'Stability',
                priority: 'HIGH',
                issue: '높은 부하 상황에서 시스템 불안정',
                recommendation: '메모리 관리와 오류 처리 로직을 개선하세요.'
            });
        }

        // 메모리 누수
        if (results.stability.memoryLeak && results.stability.memoryLeak.suspected) {
            recommendations.push({
                category: 'Memory',
                priority: 'HIGH',
                issue: '메모리 누수 의심',
                recommendation: '객체 참조 해제와 가비지 컬렉션을 확인하세요.'
            });
        }

        return recommendations;
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

// CLI 실행
async function runCLI() {
    const testUrl = process.argv[2] || 'http://localhost:8081/test-worker-performance.html';
    const outputPath = process.argv[3] || 'worker-test-results.json';

    const runner = new HeadlessTestRunner();

    try {
        const results = await runner.runTests(testUrl);
        const report = await runner.generateReport(results, outputPath);

        console.log('\n=== 테스트 결과 요약 ===');
        console.log('전체 점수:', report.testSummary.overallScore);
        console.log('성공 여부:', report.testSummary.success ? '성공' : '실패');
        console.log('실행 시간:', Math.round(report.testSummary.executionTime / 1000) + '초');

        if (report.testSummary.issues.length > 0) {
            console.log('발견된 이슈:', report.testSummary.issues.join(', '));
        }

        if (report.recommendations.length > 0) {
            console.log('\n=== 권장사항 ===');
            report.recommendations.forEach((rec, index) => {
                console.log(`${index + 1}. [${rec.priority}] ${rec.issue}`);
                console.log(`   → ${rec.recommendation}`);
            });
        }

        console.log('\n상세 결과는', outputPath, '파일에 저장되었습니다.');

    } catch (error) {
        console.error('테스트 실행 중 오류:', error);
        process.exit(1);
    } finally {
        await runner.cleanup();
    }
}

// 모듈로 사용하거나 직접 실행
if (require.main === module) {
    runCLI();
}

module.exports = HeadlessTestRunner;