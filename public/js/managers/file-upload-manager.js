/**
 * 착공도서 자동생성 시스템 - 파일 업로드 매니저
 * Construction Document Auto Generator - File Upload Manager
 */

'use strict';

/**
 * FileUploadManager 모듈 팩토리
 * 의존성: EventManager, StateManager, FileProcessor
 */
window.FileUploadManager = function(eventManager, stateManager, fileProcessor) {

    // 의존성 검사
    if (!eventManager || !stateManager || !fileProcessor) {
        throw new Error('FileUploadManager: 필수 의존성이 누락되었습니다');
    }

    AppConfig.log('FileUploadManager 모듈 생성 시작');

    // 내부 상태
    let uploadProgress = {};
    let isInitialized = false;
    let sessionImageCache = window.sessionImageCache || {};

    // 설정값들 (Constants에서 가져오기)
    const maxFileSizes = {
        excel: AppConfig.get('FILES.MAX_SIZES.excel', 10 * 1024 * 1024),
        image: AppConfig.get('FILES.MAX_SIZES.image', 50 * 1024 * 1024)
    };

    /**
     * DOM 준비 상태 확인
     */
    function checkDOMReady() {
        AppConfig.log('DOM 준비 상태 확인...');

        const requiredElements = [
            'excel-upload', 'minimap-upload', 'scenes-upload',
            'excel-file', 'minimap-file', 'scenes-files'
        ];

        const missingElements = requiredElements.filter(id => !document.getElementById(id));

        if (missingElements.length > 0) {
            AppConfig.log(`일부 DOM 요소 누락: ${missingElements.join(', ')}`, 'warn');
            return false;
        }

        AppConfig.log('모든 필수 DOM 요소 확인됨');
        return true;
    }

    /**
     * 드래그앤드롭 설정
     */
    function setupDragAndDrop() {
        const uploadAreas = document.querySelectorAll('.file-upload-area');

        for (let i = 0; i < uploadAreas.length; i++) {
            const area = uploadAreas[i];

            // 드래그오버
            eventManager.onDragOver(area, function(e) {
                e.preventDefault();
                e.stopPropagation();
                this.classList.add('dragover');
            });

            // 드래그리브
            eventManager.addListener(area, 'dragleave', function(e) {
                e.preventDefault();
                e.stopPropagation();
                this.classList.remove('dragover');
            });

            // 드롭
            eventManager.onDrop(area, function(e) {
                e.preventDefault();
                e.stopPropagation();
                this.classList.remove('dragover');

                const files = e.dataTransfer.files;
                const uploadType = this.id;

                handleFiles(files, uploadType);
            });
        }
    }

    /**
     * 진행률 추적 설정
     */
    function setupProgressTracking() {
        uploadProgress = {
            excel: { loaded: 0, total: 0, percentage: 0 },
            minimap: { loaded: 0, total: 0, percentage: 0 },
            scenes: { loaded: 0, total: 0, percentage: 0, count: 0, completed: 0 }
        };
    }

    /**
     * 파일 입력 요소 설정
     */
    function setupFileInputs() {
        AppConfig.log('파일 입력 요소 설정 시작...');

        // 클릭 가능한 업로드 영역 설정
        try {
            setupClickableUploadAreas();
        } catch (error) {
            AppConfig.log(`클릭 가능한 영역 설정 실패: ${error.message}`, 'error');
        }

        // Excel 파일 입력
        setupSingleFileInput('excel-file', 'excel-upload', '📊 Excel');

        // 미니맵 파일 입력
        setupSingleFileInput('minimap-file', 'minimap-upload', '🗺️ Minimap');

        // 장면 파일 입력
        setupSingleFileInput('scenes-files', 'scenes-upload', '🏠 Scene');

        // 파일 입력 리셋 기능
        setupFileInputReset();

        AppConfig.log('파일 입력 요소 설정 완료');
    }

    /**
     * 개별 파일 입력 설정
     */
    function setupSingleFileInput(inputId, uploadType, logPrefix) {
        try {
            AppConfig.log(`${logPrefix} 파일 입력 설정...`);
            const input = document.getElementById(inputId);

            if (input) {
                input.addEventListener('change', function(e) {
                    const files = e.target.files;
                    AppConfig.log(`${logPrefix} 파일 선택됨: ${files.length}개`);

                    if (files.length > 0) {
                        for (let i = 0; i < files.length; i++) {
                            AppConfig.log(`- 파일 ${i+1}: ${files[i].name} (${(files[i].size / (1024*1024)).toFixed(2)}MB)`);
                        }
                        handleFiles(files, uploadType);
                    } else {
                        AppConfig.log(`${logPrefix} 파일이 선택되지 않음`, 'warn');
                    }
                });
            } else {
                AppConfig.log(`${logPrefix} 파일 입력 요소를 찾을 수 없음`, 'error');
            }
        } catch (error) {
            AppConfig.log(`${logPrefix} 파일 입력 설정 실패: ${error.message}`, 'error');
        }
    }

    /**
     * 클릭 가능한 업로드 영역 설정
     */
    function setupClickableUploadAreas() {
        const uploadAreas = document.querySelectorAll('.file-upload-area');
        AppConfig.log(`찾은 업로드 영역 개수: ${uploadAreas.length}`);

        if (uploadAreas.length === 0) {
            throw new Error('업로드 영역을 찾을 수 없습니다');
        }

        for (let i = 0; i < uploadAreas.length; i++) {
            setupSingleUploadArea(uploadAreas[i]);
        }
    }

    /**
     * 개별 업로드 영역 설정
     */
    function setupSingleUploadArea(area) {
        const uploadId = area.id;
        const inputId = getInputIdFromUploadId(uploadId);

        AppConfig.log(`업로드 영역 설정: ${uploadId} → ${inputId}`);

        if (!inputId) {
            AppConfig.log(`매핑되지 않은 업로드 ID: ${uploadId}`, 'error');
            return;
        }

        area.classList.add('clickable');

        // 클릭 이벤트 핸들러
        const clickHandler = function(e) {
            AppConfig.log(`업로드 영역 클릭: ${uploadId}, target: ${e.target.tagName}`);

            // 버튼 클릭 시 무시
            if (shouldIgnoreClick(e.target)) {
                AppConfig.log('클릭 무시됨 (버튼 또는 액션 영역)');
                return;
            }

            // 파일 입력 요소 클릭
            const input = document.getElementById(inputId);
            if (input) {
                AppConfig.log(`파일 입력 요소 클릭 실행: ${inputId}`);
                try {
                    input.click();
                } catch (clickError) {
                    AppConfig.log(`input.click() 실행 오류: ${clickError.message}`, 'error');
                }
            } else {
                AppConfig.log(`파일 입력 요소를 찾을 수 없음: ${inputId}`, 'error');
            }
        };

        area.addEventListener('click', clickHandler);
        AppConfig.log(`클릭 이벤트 등록 완료: ${uploadId}`);
    }

    /**
     * 클릭 무시 여부 판단
     */
    function shouldIgnoreClick(target) {
        return target.classList.contains('btn') ||
               target.classList.contains('btn-reset') ||
               target.closest('.btn') ||
               target.closest('.file-status-actions');
    }

    /**
     * 업로드 ID에서 입력 ID 매핑
     */
    function getInputIdFromUploadId(uploadId) {
        const mapping = {
            'excel-upload': 'excel-file',
            'minimap-upload': 'minimap-file',
            'scenes-upload': 'scenes-files'
        };
        return mapping[uploadId] || '';
    }

    /**
     * 파일 입력 리셋 설정
     */
    function setupFileInputReset() {
        const fileInputs = ['excel-file', 'minimap-file', 'scenes-files'];

        fileInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('click', function() {
                    this.value = ''; // 같은 파일 재선택 허용
                });
            }
        });
    }

    /**
     * 파일 처리 메인 함수
     */
    function handleFiles(files, uploadType) {
        AppConfig.log('파일 처리 시작', 'info');
        AppConfig.log({
            fileCount: files ? files.length : 0,
            uploadType: uploadType,
            files: Array.from(files || []).map(f => f.name)
        });

        if (!files || files.length === 0) {
            AppConfig.log('처리할 파일이 없습니다', 'warn');
            return;
        }

        try {
            switch(uploadType) {
                case 'excel-upload':
                    handleExcelFile(files[0]);
                    break;
                case 'minimap-upload':
                    handleMinimapFile(files[0]);
                    break;
                case 'scenes-upload':
                    handleSceneFiles(files);
                    break;
                default:
                    throw new Error(`알 수 없는 업로드 타입: ${uploadType}`);
            }
        } catch (error) {
            AppConfig.log(`파일 처리 중 오류: ${error.message}`, 'error');
            showFileStatus(getStatusIdFromUploadType(uploadType),
                `파일 처리 중 오류가 발생했습니다: ${error.message}`, 'error');
        }
    }

    /**
     * Excel 파일 처리
     */
    function handleExcelFile(file) {
        if (!validateExcelFile(file)) return;

        const progressKey = 'excel';
        uploadProgress[progressKey] = { loaded: 0, total: file.size, percentage: 0 };

        showProgressStatus('excel-status', 'Excel 파일 업로드 중...', 0);

        // FileReader 대신 FileProcessor 사용
        fileProcessor.processFile(file, {
            type: 'excel',
            onProgress: function(progress) {
                uploadProgress[progressKey].loaded = progress.loaded || 0;
                uploadProgress[progressKey].percentage = Math.round(progress.percentage || 0);
                showProgressStatus('excel-status',
                    `Excel 파일 분석 중... (${uploadProgress[progressKey].percentage}%)`,
                    uploadProgress[progressKey].percentage);
            }
        }).then(function(result) {
            // Excel 파싱 완료 - 이벤트 발생
            eventManager.emit('excel:loaded', {
                file: file,
                data: result,
                materials: result.materials || [],
                sheets: result.sheets || {}
            });

            // 성공 메시지 표시
            const materialCount = result.materials ? result.materials.length : 0;
            let statusMessage = `✅ Excel 파일 업로드 완료 (${materialCount}개 자재 추출)`;

            // 시트 정보 표시
            if (result.sheets && Object.keys(result.sheets).length > 0) {
                statusMessage += '<div class="excel-sheet-info">';
                statusMessage += '<strong>업로드된 시트:</strong><br>';
                Object.entries(result.sheets).forEach(([sheetName, sheetData]) => {
                    if (!sheetName.includes('MAIN')) {
                        const itemCount = Array.isArray(sheetData) ? sheetData.length : 0;
                        statusMessage += `<div class="excel-sheet-item">`;
                        statusMessage += `<span>${sheetName}</span>`;
                        statusMessage += `<span>${itemCount}개 자재</span>`;
                        statusMessage += `</div>`;
                    }
                });
                statusMessage += '</div>';
            }

            statusMessage += '<div class="file-status-actions">' +
                '<button class="btn-reset" onclick="fileUploadManagerInstance.resetUploadArea(\'excel-upload\')">다시 선택</button>' +
                '</div>';

            showFileStatus('excel-status', statusMessage, 'success');
            eventManager.emit('file:uploaded', { type: 'excel', success: true });

        }).catch(function(error) {
            AppConfig.log(`Excel 처리 실패: ${error.message}`, 'error');
            showFileStatus('excel-status', `❌ Excel 파싱 실패: ${error.message}`, 'error');
            eventManager.emit('file:uploaded', { type: 'excel', success: false, error: error.message });
        });
    }

    /**
     * 미니맵 파일 처리
     */
    function handleMinimapFile(file) {
        if (!validateImageFile(file)) return;

        const progressKey = 'minimap';
        uploadProgress[progressKey] = { loaded: 0, total: file.size, percentage: 0 };
        showProgressStatus('minimap-status', '미니맵 이미지 업로드 중...', 0);

        fileProcessor.processFile(file, {
            type: 'image',
            onProgress: function(progress) {
                uploadProgress[progressKey].loaded = progress.loaded || 0;
                uploadProgress[progressKey].percentage = Math.round(progress.percentage || 0);
                showProgressStatus('minimap-status',
                    `미니맵 이미지 처리 중... (${uploadProgress[progressKey].percentage}%)`,
                    uploadProgress[progressKey].percentage);
            }
        }).then(function(imageData) {
            // 미니맵 로드 완료 이벤트
            eventManager.emit('minimap:loaded', {
                file: file,
                imageData: imageData,
                width: imageData.width,
                height: imageData.height
            });

            const statusMessage = '✅ 미니맵 이미지 업로드 완료<br>' +
                `<img src="${imageData.dataUrl}" class="file-thumbnail" alt="미니맵 썸네일">` +
                `<small>크기: ${imageData.width} × ${imageData.height}px (${formatFileSize(file.size)})</small>` +
                '<div class="file-status-actions">' +
                '<button class="btn-reset" onclick="fileUploadManagerInstance.resetUploadArea(\'minimap-upload\')">다시 선택</button>' +
                '</div>';

            showFileStatus('minimap-status', statusMessage, 'success');
            eventManager.emit('file:uploaded', { type: 'minimap', success: true });

        }).catch(function(error) {
            AppConfig.log(`미니맵 처리 실패: ${error.message}`, 'error');
            showFileStatus('minimap-status', `❌ 이미지 처리 실패: ${error.message}`, 'error');
            eventManager.emit('file:uploaded', { type: 'minimap', success: false, error: error.message });
        });
    }

    /**
     * 장면 파일들 처리
     */
    function handleSceneFiles(files) {
        if (!validateMultipleFiles(files, AppConfig.get('PERFORMANCE.MAX_CONCURRENT_UPLOADS', 200))) return;

        const validFiles = [];
        const rejectedFiles = [];

        // 파일 유효성 검사
        Array.from(files).forEach(file => {
            if (validateImageFile(file, true)) {
                validFiles.push(file);
            } else {
                rejectedFiles.push(file.name);
            }
        });

        if (validFiles.length === 0) {
            showFileStatus('scenes-status', '❌ 유효한 이미지 파일이 없습니다.', 'error');
            return;
        }

        const progressKey = 'scenes';
        uploadProgress[progressKey] = {
            loaded: 0,
            total: validFiles.length,
            percentage: 0,
            count: validFiles.length,
            completed: 0
        };

        showProgressStatus('scenes-status', `${validFiles.length}개의 장면 이미지를 처리하는 중...`, 0);

        // 배치 처리로 성능 향상
        processScenesInBatches(validFiles, rejectedFiles);
    }

    /**
     * 장면들을 배치로 처리
     */
    function processScenesInBatches(validFiles, rejectedFiles) {
        const batchSize = AppConfig.get('PERFORMANCE.BATCH_SIZE', 5);
        let loadedCount = 0;
        let successCount = 0;
        let errorCount = 0;
        const sceneImages = [];

        function processBatch(startIndex) {
            const batch = validFiles.slice(startIndex, startIndex + batchSize);
            const promises = batch.map((file, index) => {
                return fileProcessor.processFile(file, {
                    type: 'image',
                    onProgress: function(progress) {
                        const totalProgress = ((successCount + (progress.percentage / 100)) / validFiles.length) * 100;
                        showProgressStatus('scenes-status',
                            `장면 이미지 처리 중... (${startIndex + index + 1}/${validFiles.length})`,
                            Math.round(totalProgress));
                    }
                });
            });

            Promise.allSettled(promises).then(results => {
                results.forEach((result, index) => {
                    const globalIndex = startIndex + index;
                    const file = batch[index];

                    if (result.status === 'fulfilled') {
                        const imageData = result.value;
                        const sceneId = `scene_${Date.now()}_${globalIndex}`;

                        // 세션 캐시에 저장
                        sessionImageCache[sceneId] = imageData.dataUrl;

                        // 메타데이터만 저장
                        sceneImages.push({
                            id: sceneId,
                            name: file.name,
                            data: 'current_session_stored',
                            index: globalIndex,
                            width: imageData.width,
                            height: imageData.height,
                            size: file.size,
                            isCurrentSession: true
                        });

                        successCount++;
                    } else {
                        AppConfig.log(`장면 파일 처리 실패: ${file.name}, ${result.reason}`, 'error');
                        errorCount++;
                    }

                    loadedCount++;
                });

                // 다음 배치 처리 또는 완료
                const nextStartIndex = startIndex + batchSize;
                if (nextStartIndex < validFiles.length) {
                    processBatch(nextStartIndex);
                } else {
                    // 모든 처리 완료
                    completeSceneProcessing(sceneImages, successCount, errorCount, rejectedFiles);
                }
            });
        }

        processBatch(0);
    }

    /**
     * 장면 처리 완료
     */
    function completeSceneProcessing(sceneImages, successCount, errorCount, rejectedFiles) {
        // 인덱스 순으로 정렬
        sceneImages.sort((a, b) => a.index - b.index);

        AppConfig.log(`장면 파일 업로드 완료: ${successCount}개 성공, ${errorCount}개 실패`);

        // 이벤트 발생
        eventManager.emit('scenes:loaded', {
            sceneImages: sceneImages,
            successCount: successCount,
            errorCount: errorCount
        });

        // 결과 메시지 구성
        let statusMessage = '';
        if (successCount > 0) {
            statusMessage += `✅ ${successCount}개의 장면 이미지 업로드 완료`;

            // 썸네일 그리드 표시
            statusMessage += '<div class="scenes-thumbnails-grid">';
            sceneImages.forEach(scene => {
                const sceneName = scene.name || `장면 ${scene.index + 1}`;
                const thumbnailSrc = sessionImageCache[scene.id] || '';

                statusMessage += '<div class="scene-thumbnail-item">';
                if (thumbnailSrc) {
                    statusMessage += `<img src="${thumbnailSrc}" class="scene-thumbnail" alt="${sceneName}">`;
                } else {
                    statusMessage += '<div class="scene-placeholder-small">🖼️</div>';
                }
                statusMessage += `<div class="scene-thumbnail-name">${sceneName}</div>`;
                statusMessage += '</div>';
            });
            statusMessage += '</div>';
        }

        if (errorCount > 0) {
            statusMessage += (successCount > 0 ? '<br>' : '') + `⚠️ ${errorCount}개의 파일 처리 실패`;
        }

        if (rejectedFiles.length > 0) {
            statusMessage += `<br><small>거부된 파일: ${rejectedFiles.join(', ')}</small>`;
        }

        statusMessage += '<div class="file-status-actions">' +
            '<button class="btn-reset" onclick="fileUploadManagerInstance.resetUploadArea(\'scenes-upload\')">다시 선택</button>' +
            '</div>';

        showFileStatus('scenes-status', statusMessage, errorCount > 0 ? 'error' : 'success');

        // 장면 업로드 영역에 has-files 클래스 추가
        const scenesUploadArea = document.getElementById('scenes-upload');
        if (scenesUploadArea && successCount > 0) {
            scenesUploadArea.classList.add('has-files');
        }

        eventManager.emit('file:uploaded', { type: 'scenes', success: successCount > 0 });
    }

    /**
     * 파일 유효성 검증 함수들
     */
    function validateExcelFile(file) {
        if (!file) {
            eventManager.emit('error:show', { message: '파일이 선택되지 않았습니다.' });
            return false;
        }

        const fileName = file.name.toLowerCase();
        const allowedExtensions = AppConfig.get('FILES.ALLOWED_EXTENSIONS.excel', ['.xlsx', '.xls']);

        if (!allowedExtensions.some(ext => fileName.endsWith(ext))) {
            eventManager.emit('error:show', {
                message: `Excel 파일(${allowedExtensions.join(', ')})만 업로드 가능합니다.\n현재 파일: ${file.name}`
            });
            return false;
        }

        if (!AppConfig.isValidMimeType(file.type, 'excel') && file.type) {
            eventManager.emit('error:show', {
                message: `올바른 Excel 파일 형식이 아닙니다.\n파일 형식: ${file.type}`
            });
            return false;
        }

        if (!AppConfig.isValidFileSize(file, 'excel')) {
            eventManager.emit('error:show', {
                message: `Excel 파일 크기가 너무 큽니다.\n최대: ${formatFileSize(maxFileSizes.excel)}\n현재: ${formatFileSize(file.size)}`
            });
            return false;
        }

        if (file.size < 100) {
            eventManager.emit('error:show', { message: '파일이 비어있거나 손상되었을 수 있습니다.' });
            return false;
        }

        return true;
    }

    function validateImageFile(file, isMultiple = false) {
        if (!file) {
            eventManager.emit('error:show', { message: '파일이 선택되지 않았습니다.' });
            return false;
        }

        const fileName = file.name.toLowerCase();
        const allowedExtensions = AppConfig.get('FILES.ALLOWED_EXTENSIONS.image', ['.jpg', '.jpeg', '.png', '.gif']);

        if (!allowedExtensions.some(ext => fileName.endsWith(ext))) {
            eventManager.emit('error:show', {
                message: `지원하는 이미지 파일만 업로드 가능합니다.\n지원 형식: ${allowedExtensions.join(', ')}\n현재 파일: ${file.name}`
            });
            return false;
        }

        if (!AppConfig.isValidFileSize(file, 'image')) {
            let errorMsg = `이미지 파일 크기가 너무 큽니다.\n최대: ${formatFileSize(maxFileSizes.image)}\n현재: ${formatFileSize(file.size)}`;
            if (isMultiple) errorMsg += `\n파일명: ${file.name}`;

            eventManager.emit('error:show', { message: errorMsg });
            return false;
        }

        if (file.size < 100) {
            eventManager.emit('error:show', { message: `파일이 비어있거나 손상되었을 수 있습니다.\n파일명: ${file.name}` });
            return false;
        }

        return true;
    }

    function validateMultipleFiles(files, maxCount = 200) {
        if (files.length > maxCount) {
            eventManager.emit('error:show', {
                message: `한 번에 업로드할 수 있는 파일 개수를 초과했습니다.\n최대 ${maxCount}개까지 가능합니다.\n선택된 파일: ${files.length}개`
            });
            return false;
        }
        return true;
    }

    /**
     * UI 상태 표시 함수들
     */
    function getStatusIdFromUploadType(uploadType) {
        const mapping = {
            'excel-upload': 'excel-status',
            'minimap-upload': 'minimap-status',
            'scenes-upload': 'scenes-status'
        };
        return mapping[uploadType] || 'unknown-status';
    }

    function showFileStatus(statusId, message, type) {
        const statusElement = document.getElementById(statusId);
        if (!statusElement) return;

        const parentElement = statusElement.parentNode;

        // placeholder 숨기고 status 표시
        const placeholder = parentElement.querySelector('.upload-placeholder');
        if (placeholder) {
            placeholder.style.display = 'none';
        }

        statusElement.style.display = 'block';
        statusElement.innerHTML = message;
        statusElement.className = `file-status ${type || ''}`;
    }

    function showProgressStatus(statusId, message, percentage) {
        const statusElement = document.getElementById(statusId);
        if (!statusElement) return;

        const parentElement = statusElement.parentNode;

        // placeholder 숨기고 status 표시
        const placeholder = parentElement.querySelector('.upload-placeholder');
        if (placeholder) {
            placeholder.style.display = 'none';
        }

        statusElement.style.display = 'block';
        statusElement.className = 'file-status progress';

        let progressHTML = `<div class="progress-info">${message}</div>`;

        if (typeof percentage === 'number') {
            progressHTML += `<div class="progress-bar-container">` +
                `<div class="progress-bar" style="width: ${percentage}%"></div>` +
                `</div>` +
                `<div class="progress-percentage">${percentage}%</div>`;
        }

        statusElement.innerHTML = progressHTML;
    }

    function hideFileStatus(statusId) {
        const statusElement = document.getElementById(statusId);
        if (!statusElement) return;

        const parentElement = statusElement.parentNode;
        statusElement.style.display = 'none';

        // placeholder 다시 표시
        const placeholder = parentElement.querySelector('.upload-placeholder');
        if (placeholder) {
            placeholder.style.display = 'block';
        }
    }

    /**
     * 업로드 영역 리셋
     */
    function resetUploadArea(uploadAreaId) {
        const uploadArea = document.getElementById(uploadAreaId);
        if (!uploadArea) return;

        const statusId = uploadAreaId.replace('-upload', '-status');
        hideFileStatus(statusId);

        // 상태 초기화 이벤트 발생
        eventManager.emit('upload:reset', {
            type: uploadAreaId.replace('-upload', ''),
            uploadAreaId: uploadAreaId
        });

        if (uploadAreaId === 'scenes-upload') {
            uploadArea.classList.remove('has-files');
        }
    }

    /**
     * 파일 크기 포맷팅
     */
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 모듈 초기화
     */
    function init() {
        if (isInitialized) {
            AppConfig.log('FileUploadManager가 이미 초기화되었습니다', 'warn');
            return Promise.resolve(true);
        }

        return new Promise((resolve, reject) => {
            try {
                AppConfig.log('FileUploadManager 초기화 시작...');

                // DOM 준비 확인
                const domReady = checkDOMReady();
                if (!domReady) {
                    AppConfig.log('일부 DOM 요소가 준비되지 않았지만 초기화를 계속합니다', 'warn');
                }

                // 각 단계별 초기화
                setupProgressTracking();
                setupDragAndDrop();
                setupFileInputs();

                isInitialized = true;
                AppConfig.log('FileUploadManager 초기화 완료');
                resolve(true);

            } catch (error) {
                AppConfig.log(`FileUploadManager 초기화 실패: ${error.message}`, 'error');
                reject(error);
            }
        });
    }

    /**
     * 모듈 정리
     */
    function cleanup() {
        AppConfig.log('FileUploadManager 정리 시작...');

        // 이벤트 리스너 정리는 EventManager가 자동으로 처리
        uploadProgress = {};
        isInitialized = false;

        AppConfig.log('FileUploadManager 정리 완료');
    }

    // Public API
    const publicAPI = {
        init: init,
        cleanup: cleanup,
        resetUploadArea: resetUploadArea,
        getUploadProgress: () => ({ ...uploadProgress }),

        // 개발자 도구용
        debug: {
            getSessionCache: () => sessionImageCache,
            getMaxFileSizes: () => ({ ...maxFileSizes }),
            isInitialized: () => isInitialized
        }
    };

    AppConfig.log('FileUploadManager 모듈 생성 완료');
    return publicAPI;
};

// 전역 변수로도 접근 가능하게 (레거시 호환)
let fileUploadManagerInstance = null;

// 모듈 등록
if (window.ModuleLoader) {
    ModuleLoader.define('FileUploadManager', function(eventManager, stateManager, fileProcessor) {
        fileUploadManagerInstance = FileUploadManager(eventManager, stateManager, fileProcessor);
        return fileUploadManagerInstance;
    }, ['EventManager', 'StateManager', 'FileProcessor']);
}

console.log('✅ FileUploadManager 모듈 등록 완료');