/**
 * File Worker - 대용량 파일 처리용 Web Worker
 * Excel 파싱, 이미지 처리 등 무거운 작업을 백그라운드에서 처리
 */

'use strict';

// Web Worker 내에서 사용할 전역 변수들
var XLSX = null;
var isXLSXLoaded = false;

/**
 * 메시지 처리 메인 핸들러
 */
self.addEventListener('message', function(event) {
    var data = event.data;
    var messageId = data.id;
    var type = data.type;
    var payload = data.payload;

    console.log('[Worker] 메시지 받음:', type);

    try {
        switch (type) {
            case 'PROCESS_EXCEL':
                processExcelFile(messageId, payload);
                break;

            case 'PROCESS_IMAGE':
                processImageFile(messageId, payload);
                break;

            case 'VALIDATE_FILES':
                validateFiles(messageId, payload);
                break;

            case 'CHUNK_PROCESS':
                processFileChunk(messageId, payload);
                break;

            case 'PING':
                sendResponse(messageId, 'PONG', { timestamp: Date.now() });
                break;

            default:
                sendError(messageId, 'UNKNOWN_TYPE', '알 수 없는 작업 타입: ' + type);
        }
    } catch (error) {
        console.error('[Worker] 처리 중 오류:', error);
        sendError(messageId, 'PROCESSING_ERROR', error.message);
    }
});

/**
 * Excel 파일 처리
 */
function processExcelFile(messageId, payload) {
    if (!isXLSXLoaded) {
        loadXLSXLibrary()
            .then(function() {
                return doProcessExcel(messageId, payload);
            })
            .catch(function(error) {
                sendError(messageId, 'XLSX_LOAD_ERROR', error.message);
            });
    } else {
        doProcessExcel(messageId, payload);
    }
}

/**
 * XLSX 라이브러리 동적 로딩
 */
function loadXLSXLibrary() {
    return new Promise(function(resolve, reject) {
        try {
            // Web Worker에서 XLSX 라이브러리 로드
            importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');

            if (typeof XLSX !== 'undefined') {
                isXLSXLoaded = true;
                console.log('[Worker] XLSX 라이브러리 로드 성공');
                resolve();
            } else {
                throw new Error('XLSX 라이브러리 로드 후에도 사용할 수 없음');
            }
        } catch (error) {
            console.error('[Worker] XLSX 라이브러리 로드 실패:', error);
            reject(error);
        }
    });
}

/**
 * 실제 Excel 처리 로직
 */
function doProcessExcel(messageId, payload) {
    try {
        var fileData = payload.fileData;
        var options = payload.options || {};

        console.log('[Worker] Excel 파싱 시작, 데이터 크기:', fileData.byteLength);

        // 진행률 업데이트
        sendProgress(messageId, { stage: 'parsing', progress: 0 });

        // XLSX로 파싱
        var workbook = XLSX.read(fileData, {
            type: 'array',
            cellDates: true,
            cellStyles: false,
            raw: false
        });

        sendProgress(messageId, { stage: 'parsing', progress: 50 });

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
        for (var i = 0; i < workbook.SheetNames.length; i++) {
            var sheetName = workbook.SheetNames[i];
            var sheet = workbook.Sheets[sheetName];

            try {
                // 시트를 JSON으로 변환
                var jsonData = XLSX.utils.sheet_to_json(sheet, {
                    header: 1,
                    raw: false,
                    dateNF: 'yyyy-mm-dd'
                });

                result.sheets[sheetName] = jsonData;

                // 진행률 업데이트
                var progress = 50 + Math.round(((i + 1) / workbook.SheetNames.length) * 50);
                sendProgress(messageId, {
                    stage: 'processing',
                    progress: progress,
                    currentSheet: sheetName,
                    sheetIndex: i + 1,
                    totalSheets: workbook.SheetNames.length
                });

            } catch (sheetError) {
                console.warn('[Worker] 시트 처리 경고:', sheetName, sheetError);
                result.sheets[sheetName] = [];
            }
        }

        console.log('[Worker] Excel 처리 완료:', result.metadata);
        sendResponse(messageId, 'EXCEL_PROCESSED', result);

    } catch (error) {
        console.error('[Worker] Excel 처리 오류:', error);
        sendError(messageId, 'EXCEL_PARSE_ERROR', error.message);
    }
}

/**
 * 이미지 파일 처리
 */
function processImageFile(messageId, payload) {
    try {
        var fileData = payload.fileData;
        var options = payload.options || {};

        console.log('[Worker] 이미지 처리 시작');

        // FileReader 대신 Blob을 사용한 이미지 처리
        var blob = new Blob([fileData], { type: payload.mimeType || 'image/jpeg' });
        var imageUrl = URL.createObjectURL(blob);

        // 이미지 로드 및 처리
        var img = new Image();

        img.onload = function() {
            try {
                var result = {
                    width: img.width,
                    height: img.height,
                    size: fileData.byteLength,
                    type: payload.mimeType,
                    name: payload.fileName,
                    dataUrl: imageUrl,
                    processedAt: new Date().toISOString()
                };

                // 이미지 최적화 옵션이 있으면 적용
                if (options.optimize) {
                    optimizeImageInWorker(messageId, img, result, options.optimize);
                } else {
                    sendResponse(messageId, 'IMAGE_PROCESSED', result);
                }

                // URL 정리
                URL.revokeObjectURL(imageUrl);

            } catch (error) {
                URL.revokeObjectURL(imageUrl);
                sendError(messageId, 'IMAGE_PROCESS_ERROR', error.message);
            }
        };

        img.onerror = function() {
            URL.revokeObjectURL(imageUrl);
            sendError(messageId, 'IMAGE_LOAD_ERROR', '이미지 로드 실패');
        };

        img.src = imageUrl;

    } catch (error) {
        sendError(messageId, 'IMAGE_SETUP_ERROR', error.message);
    }
}

/**
 * Worker 내에서 이미지 최적화 (제한적)
 */
function optimizeImageInWorker(messageId, img, result, optimizeOptions) {
    try {
        // Web Worker에서는 Canvas API 제한이 있어서 OffscreenCanvas 사용
        if (typeof OffscreenCanvas !== 'undefined') {
            var canvas = new OffscreenCanvas(img.width, img.height);
            var ctx = canvas.getContext('2d');

            // 리사이즈 계산
            var maxWidth = optimizeOptions.maxWidth || 1920;
            var maxHeight = optimizeOptions.maxHeight || 1080;
            var quality = optimizeOptions.quality || 0.8;

            var ratio = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
            var newWidth = Math.round(img.width * ratio);
            var newHeight = Math.round(img.height * ratio);

            canvas.width = newWidth;
            canvas.height = newHeight;

            // 이미지 그리기
            ctx.drawImage(img, 0, 0, newWidth, newHeight);

            // Blob으로 변환
            canvas.convertToBlob({
                type: 'image/jpeg',
                quality: quality
            }).then(function(blob) {
                var reader = new FileReader();
                reader.onload = function(e) {
                    result.optimized = {
                        dataUrl: e.target.result,
                        width: newWidth,
                        height: newHeight,
                        size: blob.size,
                        compressionRatio: blob.size / result.size
                    };

                    sendResponse(messageId, 'IMAGE_PROCESSED', result);
                };
                reader.readAsDataURL(blob);
            }).catch(function(error) {
                console.warn('[Worker] 이미지 최적화 실패:', error);
                sendResponse(messageId, 'IMAGE_PROCESSED', result);
            });
        } else {
            console.log('[Worker] OffscreenCanvas 지원 안함, 최적화 건너뛰기');
            sendResponse(messageId, 'IMAGE_PROCESSED', result);
        }
    } catch (error) {
        console.warn('[Worker] 이미지 최적화 오류:', error);
        sendResponse(messageId, 'IMAGE_PROCESSED', result);
    }
}

/**
 * 파일 유효성 검증
 */
function validateFiles(messageId, payload) {
    try {
        var files = payload.files;
        var validationRules = payload.rules || {};
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

            // 파일 크기 검증
            if (validationRules.maxSize && file.size > validationRules.maxSize) {
                validation.valid = false;
                validation.errors.push('파일 크기 초과: ' + Math.round(file.size / 1024 / 1024) + 'MB');
            }

            // 파일 타입 검증
            if (validationRules.allowedTypes && validationRules.allowedTypes.indexOf(file.type) === -1) {
                validation.valid = false;
                validation.errors.push('지원하지 않는 파일 타입: ' + file.type);
            }

            // 파일 확장자 검증
            if (validationRules.allowedExtensions) {
                var extension = '.' + file.name.split('.').pop().toLowerCase();
                if (validationRules.allowedExtensions.indexOf(extension) === -1) {
                    validation.valid = false;
                    validation.errors.push('지원하지 않는 확장자: ' + extension);
                }
            }

            results.push(validation);
        }

        sendResponse(messageId, 'FILES_VALIDATED', { results: results });

    } catch (error) {
        sendError(messageId, 'VALIDATION_ERROR', error.message);
    }
}

/**
 * 파일 청크 처리
 */
function processFileChunk(messageId, payload) {
    try {
        var chunkData = payload.chunkData;
        var chunkIndex = payload.chunkIndex;
        var totalChunks = payload.totalChunks;
        var processingType = payload.processingType;

        // 청크별 처리 로직 (예: 체크섬 계산, 데이터 변환 등)
        var processedChunk = {
            index: chunkIndex,
            size: chunkData.byteLength,
            checksum: calculateSimpleChecksum(chunkData),
            processedAt: Date.now()
        };

        // 진행률 계산
        var progress = Math.round(((chunkIndex + 1) / totalChunks) * 100);

        sendProgress(messageId, {
            stage: 'chunk_processing',
            progress: progress,
            chunkIndex: chunkIndex,
            totalChunks: totalChunks
        });

        sendResponse(messageId, 'CHUNK_PROCESSED', processedChunk);

    } catch (error) {
        sendError(messageId, 'CHUNK_PROCESS_ERROR', error.message);
    }
}

/**
 * 간단한 체크섬 계산 (CRC32 대신 단순 해시)
 */
function calculateSimpleChecksum(data) {
    var hash = 0;
    var view = new Uint8Array(data);

    for (var i = 0; i < Math.min(view.length, 1024); i++) { // 성능을 위해 첫 1KB만 사용
        hash = ((hash << 5) - hash + view[i]) & 0xffffffff;
    }

    return hash.toString(16);
}

/**
 * 성공 응답 전송
 */
function sendResponse(messageId, type, data) {
    self.postMessage({
        id: messageId,
        type: type,
        success: true,
        data: data,
        timestamp: Date.now()
    });
}

/**
 * 오류 응답 전송
 */
function sendError(messageId, errorType, message) {
    self.postMessage({
        id: messageId,
        type: errorType,
        success: false,
        error: {
            type: errorType,
            message: message,
            timestamp: Date.now()
        }
    });
}

/**
 * 진행률 업데이트 전송
 */
function sendProgress(messageId, progressData) {
    self.postMessage({
        id: messageId,
        type: 'PROGRESS',
        success: true,
        data: progressData,
        timestamp: Date.now()
    });
}

// Worker 초기화 로그
console.log('[Worker] File Worker 초기화 완료');
console.log('[Worker] 지원 기능:', {
    OffscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    ImageBitmap: typeof createImageBitmap !== 'undefined',
    Blob: typeof Blob !== 'undefined',
    URL: typeof URL !== 'undefined'
});