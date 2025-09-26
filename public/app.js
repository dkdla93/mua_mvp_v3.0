/**
 * 착공도서 자동생성 시스템 - 메인 애플리케이션 로직
 * Construction Document Auto Generator - Main Application Logic
 */

'use strict';

// 전역 애플리케이션 상태
var appState = {
    // 엑셀 관련 데이터
    excelData: null,
    allSheets: {},
    currentSheet: null,
    materials: [],

    // 이미지 관련 데이터
    minimapImage: null,
    sceneImages: [],

    // 공정 관리 (새 기능)
    processes: [
        {
            id: 'process_1',
            name: '공정1',
            selectedScenes: [],
            isActive: true
        }
    ],
    currentProcess: 'process_1',

    // 자재 매핑 (공정별로 분리)
    sceneMaterialMapping: {
        'process_1': {}
    },

    // 자재 위치 배치 (새 기능)
    sceneMaterialPositions: {
        'process_1': {}
    },

    // 미니맵 박스 (공정별로 분리)
    minimapBoxes: {
        'process_1': {}
    },

    // UI 상태
    currentStep: 1,
    currentSelectedScene: 0,
    nextPositionNumber: 1
};

// 유틸리티 함수들
var utils = {
    // 파일 크기 포맷
    formatFileSize: function(bytes) {
        if (bytes === 0) return '0 Bytes';
        var k = 1024;
        var sizes = ['Bytes', 'KB', 'MB', 'GB'];
        var i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    // 오류 모달 표시 (개선된 버전)
    showError: function(message, title, callback) {
        var modal = document.getElementById('error-modal');
        var titleElement = modal.querySelector('.modal-header h3');
        var messageElement = document.getElementById('error-message');

        // 제목 설정
        titleElement.textContent = title || '오류 발생';

        // 메시지 설정 (HTML 줄바꿈 지원)
        if (typeof message === 'string' && message.includes('\n')) {
            messageElement.innerHTML = message.replace(/\n/g, '<br>');
        } else {
            messageElement.textContent = message;
        }

        // 콜백 함수 설정
        if (callback && typeof callback === 'function') {
            var confirmButton = modal.querySelector('.modal-footer .btn-primary');
            confirmButton.onclick = function() {
                utils.closeModal('error-modal');
                callback();
            };
        }

        modal.style.display = 'flex';

        // 자동 스크롤 (모달이 화면을 벗어날 경우)
        setTimeout(function() {
            modal.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    },

    // 성공 모달 표시
    showSuccess: function(message, title, callback) {
        // 기존 오류 모달을 재사용하되, 스타일을 성공용으로 변경
        var modal = document.getElementById('error-modal');
        var titleElement = modal.querySelector('.modal-header h3');
        var messageElement = document.getElementById('error-message');

        titleElement.textContent = title || '완료';
        titleElement.style.color = '#28a745';

        if (typeof message === 'string' && message.includes('\n')) {
            messageElement.innerHTML = message.replace(/\n/g, '<br>');
        } else {
            messageElement.textContent = message;
        }

        if (callback && typeof callback === 'function') {
            var confirmButton = modal.querySelector('.modal-footer .btn-primary');
            confirmButton.onclick = function() {
                utils.closeModal('error-modal');
                callback();
            };
        }

        modal.style.display = 'flex';
    },

    // 모달 닫기
    closeModal: function(modalId) {
        var modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            // 제목 색상 초기화
            var titleElement = modal.querySelector('.modal-header h3');
            if (titleElement) {
                titleElement.style.color = '';
            }
        }
    },

    // 로딩 표시/숨김
    showLoading: function(message) {
        var loadingElement = document.getElementById('loading-message');
        var overlayElement = document.getElementById('loading-overlay');

        if (loadingElement) {
            loadingElement.textContent = message || '처리 중입니다...';
        }
        if (overlayElement) {
            overlayElement.style.display = 'flex';
        }
    },

    hideLoading: function() {
        var overlayElement = document.getElementById('loading-overlay');
        if (overlayElement) {
            overlayElement.style.display = 'none';
        }
    },

    // 고유 ID 생성
    generateId: function() {
        return 'id_' + Math.random().toString(36).substr(2, 9);
    },

    // 디바운스 함수
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

    // 안전한 JSON 파싱
    safeJSONParse: function(str, defaultValue) {
        try {
            return JSON.parse(str);
        } catch (e) {
            console.warn('JSON parse error:', e);
            return defaultValue || null;
        }
    },

    // 브라우저 지원 여부 검사
    checkBrowserSupport: function() {
        var criticalFeatures = [];
        var warningFeatures = [];

        // 필수 기능들
        if (!window.FileReader) criticalFeatures.push('FileReader API');
        if (!document.querySelector) criticalFeatures.push('CSS 선택자');

        // 선택적 기능들 (경고만 표시)
        if (!window.XLSX) warningFeatures.push('Excel 파싱 라이브러리');
        if (!window.PptxGenJS) warningFeatures.push('PowerPoint 생성 라이브러리');

        // 치명적 오류가 있는 경우만 차단
        if (criticalFeatures.length > 0) {
            this.showError(
                '현재 브라우저에서 지원하지 않는 필수 기능이 있습니다:\n' +
                criticalFeatures.join(', ') + '\n\n' +
                '최신 브라우저를 사용해 주세요.',
                '브라우저 호환성 문제'
            );
            return false;
        }

        // 경고 기능들이 있으면 콘솔에만 출력
        if (warningFeatures.length > 0) {
            console.warn('일부 기능이 제한될 수 있습니다:', warningFeatures.join(', '));
            console.warn('모든 기능을 사용하려면 페이지를 새로고침해주세요.');
        }

        return true;
    },

    // 정보 모달 표시
    showInfo: function(message, title) {
        this.showSuccess(message, title || '알림');
    },

    // 커스텀 모달 표시 (dragDropManager에서 사용)
    showModal: function(title, content, buttons) {
        // 동적으로 모달 생성
        var modalId = 'info-modal';
        var existingModal = document.getElementById(modalId);

        if (existingModal) {
            existingModal.remove();
        }

        var modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal info-modal';
        modal.style.display = 'flex';

        var modalContent = '<div class="modal-content">';
        modalContent += '<div class="modal-header">';
        modalContent += '<h3>' + title + '</h3>';
        modalContent += '<button type="button" class="modal-close" onclick="utils.closeModal(\'' + modalId + '\')">&times;</button>';
        modalContent += '</div>';
        modalContent += '<div class="modal-body">' + content + '</div>';

        if (buttons && buttons.length > 0) {
            modalContent += '<div class="modal-footer">';
            for (var i = 0; i < buttons.length; i++) {
                var btn = buttons[i];
                modalContent += '<button type="button" class="' + btn.className + '" onclick="' + btn.onclick + '">';
                modalContent += btn.text;
                modalContent += '</button> ';
            }
            modalContent += '</div>';
        }

        modalContent += '</div>';
        modal.innerHTML = modalContent;

        document.body.appendChild(modal);

        // ESC 키로 닫기
        var closeHandler = function(e) {
            if (e.key === 'Escape') {
                utils.closeModal(modalId);
                document.removeEventListener('keydown', closeHandler);
            }
        };
        document.addEventListener('keydown', closeHandler);
    }
};

// 파일 업로드 관리자
var fileUploadManager = {
    uploadProgress: {},
    maxFileSizes: {
        excel: 10 * 1024 * 1024, // 10MB
        image: 50 * 1024 * 1024  // 50MB
    },

    init: function() {
        this.setupDragAndDrop();
        this.setupFileInputs();
        this.setupProgressTracking();
    },

    setupDragAndDrop: function() {
        var uploadAreas = document.querySelectorAll('.file-upload-area');

        for (var i = 0; i < uploadAreas.length; i++) {
            var area = uploadAreas[i];

            area.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.stopPropagation();
                this.classList.add('dragover');
            });

            area.addEventListener('dragleave', function(e) {
                e.preventDefault();
                e.stopPropagation();
                this.classList.remove('dragover');
            });

            area.addEventListener('drop', function(e) {
                e.preventDefault();
                e.stopPropagation();
                this.classList.remove('dragover');

                var files = e.dataTransfer.files;
                var uploadType = this.id;

                fileUploadManager.handleFiles(files, uploadType);
            });
        }
    },

    setupProgressTracking: function() {
        // 진행률 추적을 위한 초기화
        this.uploadProgress = {
            excel: { loaded: 0, total: 0, percentage: 0 },
            minimap: { loaded: 0, total: 0, percentage: 0 },
            scenes: { loaded: 0, total: 0, percentage: 0, count: 0, completed: 0 }
        };
    },

    setupFileInputs: function() {
        var self = this;

        // 전체 업로드 영역을 클릭 가능하게 설정
        this.setupClickableUploadAreas();

        // 엑셀 파일 입력
        var excelInput = document.getElementById('excel-file');
        if (excelInput) {
            excelInput.addEventListener('change', function(e) {
                console.log('Excel file selected:', e.target.files);
                if (e.target.files.length > 0) {
                    self.handleFiles(e.target.files, 'excel-upload');
                } else {
                    console.warn('No excel file selected');
                }
            });
        } else {
            console.error('엑셀 파일 입력 요소를 찾을 수 없습니다.');
        }

        // 미니맵 파일 입력
        var minimapInput = document.getElementById('minimap-file');
        if (minimapInput) {
            minimapInput.addEventListener('change', function(e) {
                console.log('Minimap file selected:', e.target.files);
                if (e.target.files.length > 0) {
                    self.handleFiles(e.target.files, 'minimap-upload');
                } else {
                    console.warn('No minimap file selected');
                }
            });
        } else {
            console.error('미니맵 파일 입력 요소를 찾을 수 없습니다.');
        }

        // 장면 이미지 파일 입력
        var scenesInput = document.getElementById('scenes-files');
        if (scenesInput) {
            scenesInput.addEventListener('change', function(e) {
                console.log('Scene files selected:', e.target.files);
                if (e.target.files.length > 0) {
                    self.handleFiles(e.target.files, 'scenes-upload');
                } else {
                    console.warn('No scene files selected');
                }
            });
        } else {
            console.error('장면 파일 입력 요소를 찾을 수 없습니다.');
        }

        // 파일 입력 초기화 (재선택 허용)
        this.setupFileInputReset();
    },

    // 전체 업로드 영역을 클릭 가능하게 설정
    setupClickableUploadAreas: function() {
        var self = this;
        var uploadAreas = document.querySelectorAll('.file-upload-area');

        for (var i = 0; i < uploadAreas.length; i++) {
            var area = uploadAreas[i];
            area.classList.add('clickable');

            // 클릭 이벤트 추가
            area.addEventListener('click', function(e) {
                // 버튼 클릭이 아닌 경우에만 파일 선택 창 열기
                if (!e.target.classList.contains('btn') &&
                    !e.target.classList.contains('btn-reset') &&
                    !e.target.closest('.btn') &&
                    !e.target.closest('.file-status-actions')) {
                    var uploadId = this.id;
                    var inputId = '';

                    if (uploadId === 'excel-upload') {
                        inputId = 'excel-file';
                    } else if (uploadId === 'minimap-upload') {
                        inputId = 'minimap-file';
                    } else if (uploadId === 'scenes-upload') {
                        inputId = 'scenes-files';
                    }

                    if (inputId) {
                        var input = document.getElementById(inputId);
                        if (input) {
                            input.click();
                        }
                    }
                }
            });
        }
    },

    setupFileInputReset: function() {
        var fileInputs = ['excel-file', 'minimap-file', 'scenes-files'];

        for (var i = 0; i < fileInputs.length; i++) {
            var input = document.getElementById(fileInputs[i]);
            if (input) {
                input.addEventListener('click', function() {
                    this.value = ''; // 같은 파일 재선택 허용
                });
            }
        }
    },

    handleFiles: function(files, uploadType) {
        console.log('handleFiles called with:', files, uploadType);

        if (!files || files.length === 0) {
            console.warn('No files to handle');
            return;
        }

        switch(uploadType) {
            case 'excel-upload':
                console.log('Processing Excel file:', files[0].name);
                this.handleExcelFile(files[0]);
                break;
            case 'minimap-upload':
                console.log('Processing Minimap file:', files[0].name);
                this.handleMinimapFile(files[0]);
                break;
            case 'scenes-upload':
                console.log('Processing Scene files:', files.length, 'files');
                this.handleSceneFiles(files);
                break;
            default:
                console.error('Unknown upload type:', uploadType);
        }
    },

    handleExcelFile: function(file) {
        // 파일 유효성 검사
        if (!this.validateExcelFile(file)) return;

        var self = this;
        var progressKey = 'excel';

        // 진행률 초기화
        this.uploadProgress[progressKey] = { loaded: 0, total: file.size, percentage: 0 };

        this.showProgressStatus('excel-status', '엑셀 파일 업로드 중...', 0);

        var reader = new FileReader();

        // 진행률 추적
        reader.onprogress = function(e) {
            if (e.lengthComputable) {
                self.uploadProgress[progressKey].loaded = e.loaded;
                self.uploadProgress[progressKey].percentage = Math.round((e.loaded / e.total) * 100);
                self.showProgressStatus('excel-status', '엑셀 파일 분석 중... (' +
                    self.uploadProgress[progressKey].percentage + '%)',
                    self.uploadProgress[progressKey].percentage);
            }
        };

        reader.onload = function(e) {
            try {
                self.showProgressStatus('excel-status', '엑셀 데이터 파싱 중...', 90);

                // SheetJS로 엑셀 파일 파싱
                var workbook = XLSX.read(e.target.result, {type: 'binary'});
                excelParser.parseWorkbook(workbook, file.name);

                // 성공 상태 표시
                var materialCount = appState.materials.length;
                var statusMessage = '✅ 엑셀 파일 업로드 완료 (' + materialCount + '개 자재 추출)';

                // 엑셀 시트별 정보 표시
                if (appState.allSheets && Object.keys(appState.allSheets).length > 0) {
                    statusMessage += '<div class="excel-sheet-info">';
                    statusMessage += '<strong>업로드된 시트:</strong><br>';
                    var sheetNames = Object.keys(appState.allSheets);
                    for (var i = 0; i < sheetNames.length; i++) {
                        var sheetName = sheetNames[i];
                        if (sheetName.indexOf('MAIN') === -1) { // MAIN 시트는 제외
                            var sheetData = appState.allSheets[sheetName];
                            var itemCount = sheetData && sheetData.length ? sheetData.length : 0;
                            statusMessage += '<div class="excel-sheet-item">';
                            statusMessage += '<span>' + sheetName + '</span>';
                            statusMessage += '<span>' + itemCount + '개 자재</span>';
                            statusMessage += '</div>';
                        }
                    }
                    statusMessage += '</div>';
                }

                statusMessage += '<div class="file-status-actions">' +
                    '<button class="btn-reset" onclick="fileUploadManager.resetUploadArea(\'excel-upload\')">다시 선택</button>' +
                    '</div>';

                self.showFileStatus('excel-status', statusMessage, 'success');

                stepController.checkStep1Completion();

            } catch (error) {
                console.error('Excel parsing error:', error);
                self.showFileStatus('excel-status', '❌ 엑셀 파싱 실패: ' + error.message, 'error');
                utils.showError('엑셀 파일을 읽는 중 오류가 발생했습니다: ' + error.message);
            }
        };

        reader.onerror = function(error) {
            console.error('File reading error:', error);
            self.showFileStatus('excel-status', '❌ 파일 읽기 실패', 'error');
            utils.showError('파일을 읽는 중 오류가 발생했습니다.');
        };

        reader.readAsBinaryString(file);
    },

    handleMinimapFile: function(file) {
        if (!this.validateImageFile(file)) return;

        var self = this;
        var progressKey = 'minimap';

        // 진행률 초기화
        this.uploadProgress[progressKey] = { loaded: 0, total: file.size, percentage: 0 };
        this.showProgressStatus('minimap-status', '미니맵 이미지 업로드 중...', 0);

        var reader = new FileReader();

        // 진행률 추적
        reader.onprogress = function(e) {
            if (e.lengthComputable) {
                self.uploadProgress[progressKey].loaded = e.loaded;
                self.uploadProgress[progressKey].percentage = Math.round((e.loaded / e.total) * 100);
                self.showProgressStatus('minimap-status', '미니맵 이미지 처리 중... (' +
                    self.uploadProgress[progressKey].percentage + '%)',
                    self.uploadProgress[progressKey].percentage);
            }
        };

        reader.onload = function(e) {
            try {
                // 이미지 유효성 검사 (실제 이미지인지 확인)
                var img = new Image();
                img.onload = function() {
                    appState.minimapImage = e.target.result;
                    self.showFileStatus('minimap-status',
                        '✅ 미니맵 이미지 업로드 완료<br>' +
                        '<img src="' + e.target.result + '" class="file-thumbnail" alt="미니맵 썸네일">' +
                        '<small>크기: ' + img.width + ' × ' + img.height + 'px (' + utils.formatFileSize(file.size) + ')</small>' +
                        '<div class="file-status-actions">' +
                        '<button class="btn-reset" onclick="fileUploadManager.resetUploadArea(\'minimap-upload\')">다시 선택</button>' +
                        '</div>', 'success');
                    stepController.checkStep1Completion();
                };

                img.onerror = function() {
                    self.showFileStatus('minimap-status', '❌ 유효하지 않은 이미지 파일입니다.', 'error');
                };

                img.src = e.target.result;

            } catch (error) {
                console.error('Minimap processing error:', error);
                self.showFileStatus('minimap-status', '❌ 이미지 처리 실패: ' + error.message, 'error');
            }
        };

        reader.onerror = function(error) {
            console.error('File reading error:', error);
            self.showFileStatus('minimap-status', '❌ 파일 읽기 실패', 'error');
        };

        reader.readAsDataURL(file);
    },

    handleSceneFiles: function(files) {
        // 파일 개수 검증
        if (!this.validateMultipleFiles(files, 20)) return;

        var validFiles = [];
        var rejectedFiles = [];

        // 파일 유효성 검사
        for (var i = 0; i < files.length; i++) {
            if (this.validateImageFile(files[i], true)) {
                validFiles.push(files[i]);
            } else {
                rejectedFiles.push(files[i].name);
            }
        }

        if (validFiles.length === 0) {
            this.showFileStatus('scenes-status', '❌ 유효한 이미지 파일이 없습니다.', 'error');
            return;
        }

        var self = this;
        var progressKey = 'scenes';

        // 진행률 초기화
        this.uploadProgress[progressKey] = {
            loaded: 0,
            total: validFiles.length,
            percentage: 0,
            count: validFiles.length,
            completed: 0
        };

        this.showProgressStatus('scenes-status',
            validFiles.length + '개의 장면 이미지를 처리하는 중...', 0);

        var loadedCount = 0;
        var successCount = 0;
        var errorCount = 0;
        appState.sceneImages = [];

        for (var i = 0; i < validFiles.length; i++) {
            (function(file, index) {
                var reader = new FileReader();

                reader.onprogress = function(e) {
                    // 개별 파일의 진행률은 전체 진행률에 기여
                    if (e.lengthComputable) {
                        var fileProgress = (e.loaded / e.total) * (1 / validFiles.length);
                        var totalProgress = (successCount + fileProgress) / validFiles.length * 100;
                        self.showProgressStatus('scenes-status',
                            '장면 이미지 처리 중... (' + (index + 1) + '/' + validFiles.length + ')',
                            Math.round(totalProgress));
                    }
                };

                reader.onload = function(e) {
                    // 이미지 유효성 검사
                    var img = new Image();
                    img.onload = function() {
                        appState.sceneImages.push({
                            name: file.name,
                            data: e.target.result,
                            index: index,
                            width: img.width,
                            height: img.height,
                            size: file.size
                        });

                        successCount++;
                        loadedCount++;
                        checkCompletion();
                    };

                    img.onerror = function() {
                        console.error('Invalid image file:', file.name);
                        errorCount++;
                        loadedCount++;
                        checkCompletion();
                    };

                    img.src = e.target.result;
                };

                reader.onerror = function(error) {
                    console.error('File reading error for', file.name, ':', error);
                    errorCount++;
                    loadedCount++;
                    checkCompletion();
                };

                function checkCompletion() {
                    var progress = Math.round((loadedCount / validFiles.length) * 100);

                    if (loadedCount === validFiles.length) {
                        // 인덱스 순으로 정렬
                        appState.sceneImages.sort(function(a, b) {
                            return a.index - b.index;
                        });

                        // 결과 메시지 구성
                        var statusMessage = '';
                        if (successCount > 0) {
                            statusMessage += '✅ ' + successCount + '개의 장면 이미지 업로드 완료';

                            // 썸네일 표시 추가
                            statusMessage += '<div class="scenes-thumbnails">';
                            for (var i = 0; i < appState.sceneImages.length; i++) {
                                statusMessage += '<img src="' + appState.sceneImages[i].data + '" class="scene-thumbnail" alt="장면 ' + (i + 1) + '">';
                            }
                            statusMessage += '</div>';
                        }
                        if (errorCount > 0) {
                            statusMessage += (successCount > 0 ? '<br>' : '') +
                                '⚠️ ' + errorCount + '개의 파일 처리 실패';
                        }
                        if (rejectedFiles.length > 0) {
                            statusMessage += '<br><small>거부된 파일: ' + rejectedFiles.join(', ') + '</small>';
                        }

                        statusMessage += '<div class="file-status-actions">' +
                            '<button class="btn-reset" onclick="fileUploadManager.resetUploadArea(\'scenes-upload\')">다시 선택</button>' +
                            '</div>';

                        self.showFileStatus('scenes-status', statusMessage,
                            errorCount > 0 ? 'error' : 'success');

                        stepController.checkStep1Completion();
                    } else {
                        self.showProgressStatus('scenes-status',
                            '장면 이미지 처리 중... (' + loadedCount + '/' + validFiles.length + ')',
                            progress);
                    }
                }

                reader.readAsDataURL(file);
            })(validFiles[i], i);
        }
    },

    validateExcelFile: function(file) {
        // 기본 검증
        if (!file) {
            utils.showError('파일이 선택되지 않았습니다.');
            return false;
        }

        // 파일명 검증
        var fileName = file.name.toLowerCase();
        var allowedExtensions = ['.xlsx', '.xls'];
        var hasValidExtension = allowedExtensions.some(function(ext) {
            return fileName.endsWith(ext);
        });

        if (!hasValidExtension) {
            utils.showError('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.\n현재 파일: ' + file.name);
            return false;
        }

        // MIME 타입 검증
        var allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/excel',
            'application/x-excel',
            'application/x-msexcel'
        ];

        if (file.type && !allowedTypes.some(function(type) { return type === file.type; })) {
            utils.showError('올바른 엑셀 파일 형식이 아닙니다.\n파일 형식: ' + file.type);
            return false;
        }

        // 파일 크기 검증
        if (file.size > this.maxFileSizes.excel) {
            utils.showError('엑셀 파일 크기가 너무 큽니다.\n' +
                '최대 허용 크기: ' + utils.formatFileSize(this.maxFileSizes.excel) + '\n' +
                '현재 파일 크기: ' + utils.formatFileSize(file.size));
            return false;
        }

        // 최소 크기 검증 (빈 파일 방지)
        if (file.size < 100) {
            utils.showError('파일이 비어있거나 손상되었을 수 있습니다.');
            return false;
        }

        return true;
    },

    validateImageFile: function(file, isMultiple) {
        // 기본 검증
        if (!file) {
            utils.showError('파일이 선택되지 않았습니다.');
            return false;
        }

        // 파일명 검증
        var fileName = file.name.toLowerCase();
        var allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
        var hasValidExtension = allowedExtensions.some(function(ext) {
            return fileName.endsWith(ext);
        });

        if (!hasValidExtension) {
            utils.showError('지원하는 이미지 파일만 업로드 가능합니다.\n' +
                '지원 형식: ' + allowedExtensions.join(', ') + '\n' +
                '현재 파일: ' + file.name);
            return false;
        }

        // MIME 타입 검증
        if (file.type && !file.type.startsWith('image/')) {
            utils.showError('올바른 이미지 파일 형식이 아닙니다.\n파일 형식: ' + file.type);
            return false;
        }

        // 파일 크기 검증
        if (file.size > this.maxFileSizes.image) {
            var errorMsg = '이미지 파일 크기가 너무 큽니다.\n' +
                '최대 허용 크기: ' + utils.formatFileSize(this.maxFileSizes.image) + '\n' +
                '현재 파일 크기: ' + utils.formatFileSize(file.size);

            if (isMultiple) {
                errorMsg += '\n파일명: ' + file.name;
            }

            utils.showError(errorMsg);
            return false;
        }

        // 최소 크기 검증
        if (file.size < 100) {
            utils.showError('파일이 비어있거나 손상되었을 수 있습니다.\n파일명: ' + file.name);
            return false;
        }

        return true;
    },

    validateMultipleFiles: function(files, maxCount) {
        maxCount = maxCount || 50; // 기본 최대 50개

        if (files.length > maxCount) {
            utils.showError('한 번에 업로드할 수 있는 파일 개수를 초과했습니다.\n' +
                '최대 ' + maxCount + '개까지 가능합니다.\n' +
                '선택된 파일: ' + files.length + '개');
            return false;
        }

        return true;
    },

    showFileStatus: function(statusId, message, type) {
        var statusElement = document.getElementById(statusId);
        if (!statusElement) return;

        var parentElement = statusElement.parentNode;

        // placeholder 숨기고 status 표시
        var placeholder = parentElement.querySelector('.upload-placeholder');
        if (placeholder) {
            placeholder.style.display = 'none';
        }

        statusElement.style.display = 'block';
        statusElement.innerHTML = message;
        statusElement.className = 'file-status ' + (type || '');
    },

    showProgressStatus: function(statusId, message, percentage) {
        var statusElement = document.getElementById(statusId);
        if (!statusElement) return;

        var parentElement = statusElement.parentNode;

        // placeholder 숨기고 status 표시
        var placeholder = parentElement.querySelector('.upload-placeholder');
        if (placeholder) {
            placeholder.style.display = 'none';
        }

        statusElement.style.display = 'block';
        statusElement.className = 'file-status progress';

        // 진행률 바와 메시지 표시
        var progressHTML = '<div class="progress-info">' + message + '</div>';

        if (typeof percentage === 'number') {
            progressHTML += '<div class="progress-bar-container">' +
                '<div class="progress-bar" style="width: ' + percentage + '%"></div>' +
                '</div>' +
                '<div class="progress-percentage">' + percentage + '%</div>';
        }

        statusElement.innerHTML = progressHTML;
    },

    hideFileStatus: function(statusId) {
        var statusElement = document.getElementById(statusId);
        if (!statusElement) return;

        var parentElement = statusElement.parentNode;

        statusElement.style.display = 'none';

        // placeholder 다시 표시
        var placeholder = parentElement.querySelector('.upload-placeholder');
        if (placeholder) {
            placeholder.style.display = 'block';
        }
    },

    resetUploadArea: function(uploadAreaId) {
        var uploadArea = document.getElementById(uploadAreaId);
        if (!uploadArea) return;

        var statusId = uploadAreaId.replace('-upload', '-status');
        this.hideFileStatus(statusId);

        // 관련 상태 초기화
        if (uploadAreaId === 'excel-upload') {
            appState.excelData = null;
            appState.materials = [];
            appState.allSheets = {};
            appState.currentSheet = null;
        } else if (uploadAreaId === 'minimap-upload') {
            appState.minimapImage = null;
        } else if (uploadAreaId === 'scenes-upload') {
            appState.sceneImages = [];
        }

        stepController.checkStep1Completion();
    }
};

// 단계 컨트롤러
var stepController = {
    init: function() {
        this.setupNavigationButtons();
    },

    setupNavigationButtons: function() {
        // 1단계 다음 버튼
        document.getElementById('next-step-1').addEventListener('click', function() {
            stepController.goToStep(2);
        });

        // 2단계 버튼들
        document.getElementById('prev-step-2').addEventListener('click', function() {
            stepController.goToStep(1);
        });
        document.getElementById('next-step-2').addEventListener('click', function() {
            stepController.goToStep(3);
        });

        // 3단계 버튼들
        document.getElementById('prev-step-3').addEventListener('click', function() {
            stepController.goToStep(2);
        });
        document.getElementById('next-step-3').addEventListener('click', function() {
            stepController.goToStep(4);
        });

        // 4단계 버튼들
        document.getElementById('prev-step-4').addEventListener('click', function() {
            stepController.goToStep(3);
        });
        document.getElementById('generate-ppt').addEventListener('click', function() {
            stepController.generatePPT();
        });
    },

    goToStep: function(step) {
        // 이전 단계 비활성화
        var currentStepElement = document.querySelector('.step[data-step="' + appState.currentStep + '"]');
        var currentContentElement = document.getElementById('step-' + appState.currentStep);

        currentStepElement.classList.remove('active');
        currentStepElement.classList.add('completed');
        currentContentElement.classList.remove('active');

        // 새 단계 활성화
        var newStepElement = document.querySelector('.step[data-step="' + step + '"]');
        var newContentElement = document.getElementById('step-' + step);

        newStepElement.classList.add('active');
        newContentElement.classList.add('active');

        appState.currentStep = step;

        // 단계 변경 이벤트 발생
        var stepEvent = new CustomEvent('stepChanged', {
            detail: { step: step, previousStep: appState.currentStep }
        });
        document.dispatchEvent(stepEvent);

        // 단계별 초기화 로직
        switch(step) {
            case 2:
                processManager.init();
                break;
            case 3:
                // workspaceManager가 stepChanged 이벤트를 받아서 초기화됨
                this.checkStep3Completion();
                break;
            case 4:
                // 생성 & 다운로드 단계 초기화
                this.initStep4();
                break;
        }
    },

    checkStep1Completion: function() {
        var hasExcel = appState.excelData !== null;
        var hasMinimap = appState.minimapImage !== null;
        var hasScenes = appState.sceneImages.length > 0;

        var nextButton = document.getElementById('next-step-1');
        nextButton.disabled = !(hasExcel && hasMinimap && hasScenes);
    },

    checkStep3Completion: function() {
        var hasAnyMaterialPlacement = false;

        if (appState.sceneMaterialPositions) {
            for (var sceneId in appState.sceneMaterialPositions) {
                if (appState.sceneMaterialPositions[sceneId] &&
                    appState.sceneMaterialPositions[sceneId].length > 0) {
                    hasAnyMaterialPlacement = true;
                    break;
                }
            }
        }

        var nextButton = document.getElementById('next-step-3');
        if (nextButton) {
            nextButton.disabled = !hasAnyMaterialPlacement;

            if (hasAnyMaterialPlacement) {
                nextButton.title = '다음 단계로 진행합니다';
            } else {
                nextButton.title = '최소 하나의 장면에 자재를 배치해야 합니다';
            }
        }
    },

    // 4단계 초기화
    initStep4: function() {
        var previewArea = document.getElementById('preview-area');
        if (!previewArea) return;

        var html = '<div class="ppt-preview-container">';
        html += '<h3>착공도서 PPT 미리보기</h3>';
        html += '<div class="preview-summary">';
        html += '<div class="summary-card">';
        html += '<h4>프로젝트 정보</h4>';
        html += '<p><strong>공정:</strong> ' + appState.processes.length + '개</p>';
        html += '<p><strong>장면:</strong> ' + this.getSelectedScenesCount() + '개</p>';
        html += '<p><strong>배치된 자재:</strong> ' + this.getPlacedMaterialsCount() + '개</p>';
        html += '</div>';
        html += '<div class="summary-card">';
        html += '<h4>생성될 슬라이드</h4>';
        html += '<ul id="slide-preview-list"></ul>';
        html += '</div>';
        html += '</div>';
        html += '</div>';

        previewArea.innerHTML = html;

        // 슬라이드 미리보기 생성
        this.generateSlidePreview();

        // 생성 버튼 활성화
        var generateButton = document.getElementById('generate-ppt');
        if (generateButton) {
            generateButton.disabled = false;
            generateButton.textContent = 'PPT 생성';
        }
    },

    // 선택된 장면 개수 계산
    getSelectedScenesCount: function() {
        var count = 0;
        for (var i = 0; i < appState.processes.length; i++) {
            if (appState.processes[i].selectedScenes) {
                count += appState.processes[i].selectedScenes.length;
            }
        }
        return count;
    },

    // 배치된 자재 개수 계산
    getPlacedMaterialsCount: function() {
        var count = 0;
        if (appState.sceneMaterialPositions) {
            for (var sceneId in appState.sceneMaterialPositions) {
                count += appState.sceneMaterialPositions[sceneId].length;
            }
        }
        return count;
    },

    // 슬라이드 미리보기 생성
    generateSlidePreview: function() {
        var slideList = document.getElementById('slide-preview-list');
        if (!slideList) return;

        var html = '';
        html += '<li>표지 슬라이드</li>';

        for (var i = 0; i < appState.processes.length; i++) {
            var process = appState.processes[i];
            if (process.selectedScenes && process.selectedScenes.length > 0) {
                html += '<li>' + process.name + ' (' + process.selectedScenes.length + '개 장면)</li>';
            }
        }

        html += '<li>자재표 요약</li>';
        slideList.innerHTML = html;
    },

    // PPT 생성
    generatePPT: function() {
        utils.showLoading('PPT를 생성하고 있습니다...');

        try {
            // PptxGenJS 라이브러리 확인
            if (typeof PptxGenJS === 'undefined') {
                throw new Error('PPT 생성 라이브러리를 찾을 수 없습니다.');
            }

            var pptx = new PptxGenJS();

            // 표지 슬라이드 생성
            this.createCoverSlide(pptx);

            // 각 공정별 슬라이드 생성
            for (var i = 0; i < appState.processes.length; i++) {
                var process = appState.processes[i];
                if (process.selectedScenes && process.selectedScenes.length > 0) {
                    this.createProcessSlide(pptx, process);
                }
            }

            // 자재표 요약 슬라이드 생성
            this.createMaterialSummarySlide(pptx);

            // PPT 파일 다운로드
            pptx.save('착공도서_' + new Date().toISOString().substr(0, 10));

            utils.hideLoading();
            utils.showSuccess('PPT가 성공적으로 생성되었습니다!');

        } catch (error) {
            console.error('PPT 생성 오류:', error);
            utils.hideLoading();
            utils.showError('PPT 생성 중 오류가 발생했습니다: ' + error.message);
        }
    },

    // 표지 슬라이드 생성
    createCoverSlide: function(pptx) {
        var slide = pptx.addSlide();
        slide.addText('착공도서 자동생성 시스템', {
            x: 1, y: 2, w: 8, h: 1,
            fontSize: 36, color: '363636', bold: true, align: 'center'
        });
        slide.addText('인테리어 공사 착공도서', {
            x: 1, y: 3, w: 8, h: 0.5,
            fontSize: 24, color: '666666', align: 'center'
        });
        slide.addText('생성일: ' + new Date().toLocaleDateString('ko-KR'), {
            x: 1, y: 6, w: 8, h: 0.5,
            fontSize: 16, color: '888888', align: 'center'
        });
    },

    // 공정별 슬라이드 생성
    createProcessSlide: function(pptx, process) {
        var slide = pptx.addSlide();
        slide.addText(process.name, {
            x: 0.5, y: 0.5, w: 9, h: 1,
            fontSize: 28, color: '363636', bold: true
        });

        // 선택된 장면들 정보 추가
        var sceneText = '선택된 장면: ';
        for (var i = 0; i < process.selectedScenes.length; i++) {
            var sceneIndex = process.selectedScenes[i];
            var sceneData = appState.sceneImages[sceneIndex];
            if (sceneData) {
                sceneText += sceneData.name;
                if (i < process.selectedScenes.length - 1) sceneText += ', ';
            }
        }

        slide.addText(sceneText, {
            x: 0.5, y: 1.5, w: 9, h: 1,
            fontSize: 16, color: '666666'
        });

        // 배치된 자재 정보 추가
        var materialInfo = this.getMaterialInfoForProcess(process);
        if (materialInfo.length > 0) {
            slide.addText('배치된 자재:', {
                x: 0.5, y: 2.5, w: 9, h: 0.5,
                fontSize: 18, color: '363636', bold: true
            });

            var materialText = materialInfo.join('\n');
            slide.addText(materialText, {
                x: 0.5, y: 3, w: 9, h: 3,
                fontSize: 14, color: '555555'
            });
        }
    },

    // 자재표 요약 슬라이드 생성
    createMaterialSummarySlide: function(pptx) {
        var slide = pptx.addSlide();
        slide.addText('자재표 요약', {
            x: 0.5, y: 0.5, w: 9, h: 1,
            fontSize: 28, color: '363636', bold: true
        });

        var summary = this.generateMaterialSummary();
        slide.addText(summary, {
            x: 0.5, y: 1.5, w: 9, h: 5,
            fontSize: 14, color: '555555'
        });
    },

    // 공정별 자재 정보 생성
    getMaterialInfoForProcess: function(process) {
        var materials = [];
        if (!appState.sceneMaterialPositions || !process.selectedScenes) return materials;

        for (var i = 0; i < process.selectedScenes.length; i++) {
            var sceneIndex = process.selectedScenes[i];
            var placements = appState.sceneMaterialPositions[sceneIndex];

            if (placements && placements.length > 0) {
                for (var j = 0; j < placements.length; j++) {
                    materials.push('• ' + placements[j].materialName + ' (' + placements[j].materialCategory + ')');
                }
            }
        }

        return materials;
    },

    // 자재 요약 생성
    generateMaterialSummary: function() {
        var summary = '총 ' + this.getPlacedMaterialsCount() + '개의 자재가 배치되었습니다.\n\n';

        // 카테고리별 자재 개수
        var categories = {};
        if (appState.sceneMaterialPositions) {
            for (var sceneId in appState.sceneMaterialPositions) {
                var placements = appState.sceneMaterialPositions[sceneId];
                for (var i = 0; i < placements.length; i++) {
                    var category = placements[i].materialCategory;
                    categories[category] = (categories[category] || 0) + 1;
                }
            }
        }

        for (var category in categories) {
            summary += category + ': ' + categories[category] + '개\n';
        }

        return summary;
    }
};

// 모달 컨트롤
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// 엑셀 파서 (고도화된 지능형 파싱 엔진)
var excelParser = {
    // 키워드 매핑 테이블
    keywordMappings: {
        // 영역/구역 키워드 (새로운 자재 항목 시작점)
        AREA: ['area', 'AREA', '영역', '구역', '공간', '위치', 'space', 'location', 'zone'],

        // 자재명 키워드
        MATERIAL: ['material', 'MATERIAL', '자재', '자재명', '재료', '품목', 'item', 'product', '상품'],

        // 항목명 키워드
        ITEM: ['item', 'ITEM', '항목', '세부항목', '부품', 'component', 'part', '품명'],

        // 비고 키워드
        REMARKS: ['remarks', 'REMARKS', 'remark', 'REMARK', '비고', '특이사항', '메모', 'note', 'memo', 'comment'],

        // 브랜드 키워드
        BRAND: ['brand', 'BRAND', '브랜드', '제조사', 'manufacturer', 'maker', '회사'],

        // 이미지 키워드
        IMAGE: ['image', 'IMAGE', 'img', 'IMG', '이미지', '사진', 'photo', 'picture', 'pic', 'url']
    },

    // 시트 우선순위 규칙
    sheetPriorityRules: [
        // 숫자 접두사가 있는 시트 (1. 자재, 2. 조명 등)
        /^(\d+)\.?\s*/,
        // "1" 포함 시트
        /1/,
        // "자재" 포함 시트
        /자재|material/i,
        // "공정" 포함 시트
        /공정|process/i
    ],

    parseWorkbook: function(workbook, fileName) {
        try {
            console.log('엑셀 파싱 시작:', fileName);

            // 모든 시트 데이터 저장
            appState.allSheets = {};
            var sheetNames = workbook.SheetNames;

            console.log('발견된 시트들:', sheetNames);

            for (var i = 0; i < sheetNames.length; i++) {
                var sheetName = sheetNames[i];
                var worksheet = workbook.Sheets[sheetName];

                if (!worksheet) continue;

                // 시트를 2차원 배열로 변환 (빈 셀도 포함)
                var jsonData = XLSX.utils.sheet_to_json(worksheet, {
                    header: 1,
                    defval: '', // 빈 셀의 기본값
                    blankrows: true // 빈 행도 포함
                });

                appState.allSheets[sheetName] = jsonData;
                console.log('시트 "' + sheetName + '" 파싱 완료:', jsonData.length + '행');
            }

            // 모든 시트에서 자재 데이터 추출 (A.MAIN 제외)
            appState.materials = [];
            appState.materialsBySheet = {};

            for (var i = 0; i < sheetNames.length; i++) {
                var sheetName = sheetNames[i];

                // A.MAIN 시트는 표지이므로 스킵
                if (sheetName.toUpperCase().indexOf('MAIN') !== -1) {
                    continue;
                }

                console.log('시트 "' + sheetName + '" 자재 추출 시작');
                appState.currentSheet = sheetName;
                appState.excelData = appState.allSheets[sheetName];

                // 각 시트별로 자재 추출
                var sheetMaterials = this.extractMaterialsFromSheet(sheetName);
                appState.materialsBySheet[sheetName] = sheetMaterials;

                // 전체 자재 목록에 추가
                appState.materials = appState.materials.concat(sheetMaterials);
            }

            // 기본 시트 선택 (첫 번째 자료 시트)
            var firstDataSheet = null;
            for (var i = 0; i < sheetNames.length; i++) {
                if (sheetNames[i].toUpperCase().indexOf('MAIN') === -1) {
                    firstDataSheet = sheetNames[i];
                    break;
                }
            }
            appState.currentSheet = firstDataSheet;
            appState.excelData = appState.allSheets[firstDataSheet];

            console.log('엑셀 파싱 완료 - 총 자재:', appState.materials.length + '개');

        } catch (error) {
            console.error('엑셀 파싱 오류 상세:', error);
            throw new Error('엑셀 파싱 중 오류: ' + error.message);
        }
    },

    // 특정 시트에서 자재 추출
    extractMaterialsFromSheet: function(sheetName) {
        var sheetMaterials = [];
        var data = appState.allSheets[sheetName];

        if (!data || data.length === 0) {
            console.warn('시트 "' + sheetName + '" 데이터가 비어있습니다');
            return sheetMaterials;
        }

        console.log('시트 "' + sheetName + '"에서 자재 추출 시작 - 총', data.length, '행');

        // 헤더 위치 탐지
        var headerInfo = this.detectHeaders(data);
        console.log('시트 "' + sheetName + '" 헤더 정보:', headerInfo);

        if (!headerInfo.headerRow) {
            console.warn('시트 "' + sheetName + '"에서 헤더를 찾을 수 없습니다');
            return sheetMaterials;
        }

        // 그룹화 상태 추적
        var parsingState = {
            currentCategory: '',
            currentGroupLabel: '',
            currentArea: '',
            materialId: 1,
            sheetName: sheetName
        };

        // 헤더 이후 데이터 행들 처리
        for (var rowIndex = headerInfo.headerRow + 1; rowIndex < data.length; rowIndex++) {
            var row = data[rowIndex];
            if (!row || this.isEmptyRow(row)) continue;

            var result = this.parseRowIntelligent(row, parsingState, headerInfo);

            if (result.type === 'material' && result.data) {
                // 시트명을 카테고리에 추가
                result.data.category = sheetName;
                result.data.originalCategory = result.data.category;
                sheetMaterials.push(result.data);
            }

            // 파싱 상태 업데이트
            if (result.stateUpdate) {
                Object.assign(parsingState, result.stateUpdate);
            }
        }

        console.log('시트 "' + sheetName + '"에서 추출된 자재:', sheetMaterials.length + '개');
        return sheetMaterials;
    },

    selectPrioritySheet: function(sheetNames) {
        if (sheetNames.length === 1) {
            return sheetNames[0];
        }

        // 우선순위 규칙에 따라 시트 점수 계산
        var sheetScores = {};

        for (var i = 0; i < sheetNames.length; i++) {
            var sheetName = sheetNames[i];
            var score = 0;

            // 규칙별 점수 부여
            for (var j = 0; j < this.sheetPriorityRules.length; j++) {
                var rule = this.sheetPriorityRules[j];
                if (rule.test(sheetName)) {
                    score += (this.sheetPriorityRules.length - j) * 10;
                    break; // 첫 번째 매칭 규칙만 적용
                }
            }

            // 시트 데이터량 보너스 (많은 데이터가 있는 시트 우선)
            var sheetData = appState.allSheets[sheetName];
            if (sheetData && sheetData.length > 10) {
                score += Math.min(sheetData.length, 100); // 최대 100점
            }

            sheetScores[sheetName] = score;
        }

        // 가장 높은 점수의 시트 선택
        var bestSheet = sheetNames[0];
        var maxScore = sheetScores[bestSheet] || 0;

        for (var sheetName in sheetScores) {
            if (sheetScores[sheetName] > maxScore) {
                maxScore = sheetScores[sheetName];
                bestSheet = sheetName;
            }
        }

        console.log('시트 점수:', sheetScores);
        return bestSheet;
    },

    extractMaterialsIntelligent: function() {
        appState.materials = [];
        var data = appState.excelData;

        if (!data || data.length === 0) {
            console.warn('시트 데이터가 비어있습니다');
            return;
        }

        console.log('지능형 자재 추출 시작 - 총', data.length, '행');

        // 헤더 위치 탐지
        var headerInfo = this.detectHeaders(data);
        console.log('탐지된 헤더 정보:', headerInfo);

        if (!headerInfo.headerRow) {
            console.warn('헤더를 찾을 수 없습니다. 기본 추출 모드로 전환');
            this.extractBasicMaterials();
            return;
        }

        // 그룹화 상태 추적
        var parsingState = {
            currentCategory: '',
            currentGroupLabel: '',
            currentArea: '',
            materialId: 1
        };

        // 헤더 이후 데이터 행들 처리
        for (var rowIndex = headerInfo.headerRow + 1; rowIndex < data.length; rowIndex++) {
            var row = data[rowIndex];
            if (!row || this.isEmptyRow(row)) continue;

            var material = this.parseRowToMaterial(row, rowIndex, headerInfo, parsingState);

            if (material) {
                appState.materials.push(material);
                console.log('자재 추출 #' + material.id + ':', material.material);
            }
        }

        console.log('지능형 추출 완료:', appState.materials.length, '개 자재');
    },

    detectHeaders: function(data) {
        var headerInfo = {
            headerRow: -1,
            columns: {}
        };

        // 상위 40행 내에서 헤더 탐색
        var searchLimit = Math.min(40, data.length);

        for (var rowIndex = 0; rowIndex < searchLimit; rowIndex++) {
            var row = data[rowIndex];
            if (!row) continue;

            var columnMatches = 0;
            var tempColumns = {};

            // 각 셀에서 키워드 검색
            for (var colIndex = 0; colIndex < row.length; colIndex++) {
                var cellValue = String(row[colIndex] || '').trim().toUpperCase();

                // 각 키워드 타입에 대해 매칭 확인
                for (var keywordType in this.keywordMappings) {
                    var keywords = this.keywordMappings[keywordType];

                    for (var k = 0; k < keywords.length; k++) {
                        var keyword = keywords[k].toUpperCase();

                        if (cellValue === keyword || cellValue.includes(keyword)) {
                            tempColumns[keywordType] = colIndex;
                            columnMatches++;
                            console.log('헤더 발견:', keyword, '위치:', rowIndex, colIndex);
                            break;
                        }
                    }
                }
            }

            // 충분한 키워드가 발견되면 헤더로 인정 (최소 2개)
            if (columnMatches >= 2) {
                headerInfo.headerRow = rowIndex;
                headerInfo.columns = tempColumns;
                break;
            }
        }

        return headerInfo;
    },

    parseRowToMaterial: function(row, rowIndex, headerInfo, parsingState) {
        var material = null;

        // A열 값으로 그룹 상태 업데이트
        var aColValue = String(row[0] || '').trim();
        if (aColValue) {
            // 대분류 카테고리 감지 (MATERIAL, SWITCH, LIGHT 등)
            if (this.isCategoryLabel(aColValue)) {
                parsingState.currentCategory = aColValue;
                return null; // 카테고리 라벨은 자재가 아님
            }

            // 그룹 라벨 감지 (WALL COVERING, FLOORING 등)
            if (this.isGroupLabel(aColValue)) {
                parsingState.currentGroupLabel = aColValue;
                return null; // 그룹 라벨은 자재가 아님
            }
        }

        // AREA 키워드 탐지 (새로운 영역 시작)
        var areaValue = this.findCellValue(row, headerInfo.columns.AREA, 'AREA');
        if (areaValue) {
            parsingState.currentArea = areaValue;
            console.log('새로운 영역 시작:', areaValue);
        }

        // MATERIAL 값 추출
        var materialValue = this.findCellValue(row, headerInfo.columns.MATERIAL, 'MATERIAL');

        // MATERIAL이 비어있고 AREA가 있으면 자재 항목으로 처리하지 않음
        if (!materialValue && areaValue) {
            return null;
        }

        // MATERIAL이 비어있으면 폴백 전략 적용
        if (!materialValue) {
            materialValue = parsingState.currentGroupLabel || parsingState.currentCategory || appState.currentSheet;
        }

        // 유효한 자재 데이터인 경우만 처리
        if (materialValue && materialValue !== 'MATERIAL') {
            material = {
                id: parsingState.materialId++,
                tabName: appState.currentSheet,
                displayId: '#' + appState.currentSheet + '_' + parsingState.materialId,
                category: parsingState.currentCategory || 'MATERIAL',
                material: materialValue,
                area: parsingState.currentArea || this.findCellValue(row, headerInfo.columns.AREA),
                item: this.findCellValue(row, headerInfo.columns.ITEM, 'ITEM'),
                remarks: this.extractRemarks(row, headerInfo),
                brand: this.findCellValue(row, headerInfo.columns.BRAND, 'BRAND'),
                imageUrl: this.extractImageUrl(row, headerInfo),
                image: '' // imageUrl과 동일하게 설정됨
            };

            material.image = material.imageUrl;
        }

        return material;
    },

    findCellValue: function(row, columnIndex, keywordType) {
        // 지정된 컬럼에서 값 추출
        if (typeof columnIndex === 'number' && columnIndex >= 0 && columnIndex < row.length) {
            var value = String(row[columnIndex] || '').trim();
            if (value) return value;
        }

        // 키워드 기반 탐색 (라벨-값 쌍)
        if (keywordType && this.keywordMappings[keywordType]) {
            var keywords = this.keywordMappings[keywordType];

            for (var i = 0; i < row.length; i++) {
                var cellValue = String(row[i] || '').trim().toUpperCase();

                // 키워드 매칭 확인
                for (var k = 0; k < keywords.length; k++) {
                    var keyword = keywords[k].toUpperCase();

                    if (cellValue === keyword || cellValue.includes(keyword)) {
                        // 오른쪽 6칸 내에서 값 탐색
                        for (var j = i + 1; j < Math.min(i + 7, row.length); j++) {
                            var rightValue = String(row[j] || '').trim();
                            if (rightValue && rightValue !== keyword) {
                                return rightValue;
                            }
                        }
                    }
                }
            }
        }

        return '';
    },

    extractRemarks: function(row, headerInfo) {
        var remarks = this.findCellValue(row, headerInfo.columns.REMARKS, 'REMARKS');

        // 비고 라벨 자체는 필터링
        var filteredRemarks = this.keywordMappings.REMARKS || [];
        for (var i = 0; i < filteredRemarks.length; i++) {
            if (remarks === filteredRemarks[i]) {
                return '';
            }
        }

        return remarks;
    },

    extractImageUrl: function(row, headerInfo) {
        var imageUrl = this.findCellValue(row, headerInfo.columns.IMAGE, 'IMAGE');

        if (!imageUrl) return '';

        // 다양한 형태의 이미지 URL 처리
        return this.processImageUrl(imageUrl);
    },

    processImageUrl: function(rawUrl) {
        if (!rawUrl) return '';

        var url = rawUrl.trim();

        // 1. data:image 형태
        if (url.startsWith('data:image')) {
            return url;
        }

        // 2. http(s) URL
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }

        // 3. HYPERLINK 함수 형태 처리
        var hyperlinkMatch = url.match(/HYPERLINK\("([^"]+)"/i);
        if (hyperlinkMatch) {
            return hyperlinkMatch[1];
        }

        // 4. 단순 URL (프로토콜 없음)
        if (url.includes('.') && (url.includes('jpg') || url.includes('png') || url.includes('gif'))) {
            return 'https://' + url;
        }

        return url; // 원본 반환
    },

    isCategoryLabel: function(text) {
        var categoryPatterns = [
            /^MATERIAL$/i, /^SWITCH$/i, /^LIGHT$/i, /^LIGHTING$/i,
            /^FURNITURE$/i, /^APPLIANCE$/i, /^FIXTURE$/i,
            /^자재$/i, /^조명$/i, /^가구$/i, /^설비$/i
        ];

        return categoryPatterns.some(function(pattern) {
            return pattern.test(text);
        });
    },

    isGroupLabel: function(text) {
        var groupPatterns = [
            /WALL\s*COVERING/i, /FLOORING/i, /CEILING/i, /DOOR/i, /WINDOW/i,
            /벽지/i, /바닥재/i, /천장재/i, /문/i, /창호/i,
            /TILE/i, /STONE/i, /WOOD/i, /METAL/i,
            /타일/i, /석재/i, /목재/i, /금속/i
        ];

        return groupPatterns.some(function(pattern) {
            return pattern.test(text);
        });
    },

    isEmptyRow: function(row) {
        if (!row) return true;

        for (var i = 0; i < row.length; i++) {
            var cell = String(row[i] || '').trim();
            if (cell) return false;
        }

        return true;
    },

    // 폴백: 기본 자재 추출 (헤더를 찾을 수 없을 때)
    extractBasicMaterials: function() {
        console.log('기본 추출 모드 실행');

        appState.materials = [];
        var data = appState.excelData;

        if (!data || data.length === 0) return;

        // 첫 10행을 건너뛰고 데이터 추출 시도
        var startRow = Math.min(10, Math.floor(data.length * 0.1));

        for (var i = startRow; i < Math.min(data.length, 100); i++) {
            var row = data[i];
            if (!row || this.isEmptyRow(row)) continue;

            // A열에 의미있는 데이터가 있으면 자재로 간주
            var firstCol = String(row[0] || '').trim();
            if (firstCol && firstCol.length > 1) {
                appState.materials.push({
                    id: appState.materials.length + 1,
                    tabName: appState.currentSheet,
                    displayId: '#' + appState.currentSheet + '_' + (appState.materials.length + 1),
                    category: 'MATERIAL',
                    material: firstCol,
                    area: String(row[1] || '').trim(),
                    item: String(row[2] || '').trim(),
                    remarks: String(row[3] || '').trim(),
                    brand: String(row[4] || '').trim(),
                    imageUrl: String(row[5] || '').trim(),
                    image: String(row[5] || '').trim()
                });
            }
        }

        console.log('기본 추출 완료:', appState.materials.length, '개 자재');
    }
};

// 공정 관리자 (2단계용)
var processManager = {
    maxProcesses: 10, // 최대 공정 개수

    init: function() {
        console.log('공정 관리자 초기화');
        this.validateProcessData();
        this.renderProcessTabs();
        this.renderProcessContent();
        this.updateNavigationState();
    },

    validateProcessData: function() {
        // 공정 데이터 유효성 검사 및 초기화
        if (!appState.processes || appState.processes.length === 0) {
            console.log('공정 데이터 초기화');
            appState.processes = [{
                id: 'process_1',
                name: '공정1',
                selectedScenes: [],
                isActive: true,
                createdAt: new Date().getTime()
            }];
            appState.currentProcess = 'process_1';
        }

        // 활성 공정이 없으면 첫 번째 공정을 활성화
        var hasActiveProcess = appState.processes.some(function(p) { return p.isActive; });
        if (!hasActiveProcess && appState.processes.length > 0) {
            appState.processes[0].isActive = true;
            appState.currentProcess = appState.processes[0].id;
        }

        // 필요한 데이터 구조 초기화
        this.ensureProcessDataStructures();
    },

    ensureProcessDataStructures: function() {
        // 각 공정에 대한 데이터 구조 보장
        for (var i = 0; i < appState.processes.length; i++) {
            var processId = appState.processes[i].id;

            if (!appState.sceneMaterialMapping[processId]) {
                appState.sceneMaterialMapping[processId] = {};
            }
            if (!appState.sceneMaterialPositions[processId]) {
                appState.sceneMaterialPositions[processId] = {};
            }
            if (!appState.minimapBoxes[processId]) {
                appState.minimapBoxes[processId] = {};
            }
        }
    },

    renderProcessTabs: function() {
        var tabsContainer = document.getElementById('process-tabs');
        if (!tabsContainer) {
            console.error('process-tabs 컨테이너를 찾을 수 없습니다');
            return;
        }

        tabsContainer.innerHTML = '';

        // 기존 공정 탭들
        for (var i = 0; i < appState.processes.length; i++) {
            var process = appState.processes[i];
            var tab = this.createProcessTab(process);
            tabsContainer.appendChild(tab);
        }

        // 공정 추가 버튼
        if (appState.processes.length < this.maxProcesses) {
            var addButton = document.createElement('button');
            addButton.className = 'add-process-btn';
            addButton.innerHTML = '<span class="add-icon">+</span> 공정 추가';
            addButton.title = '새 공정을 추가합니다 (최대 ' + this.maxProcesses + '개)';

            var self = this;
            addButton.addEventListener('click', function() {
                self.addNewProcess();
            });

            tabsContainer.appendChild(addButton);
        }

        // 공정 개수 정보 표시
        this.updateProcessInfo();
    },

    createProcessTab: function(process) {
        var tab = document.createElement('div');
        tab.className = 'process-tab-wrapper';

        var isActive = process.isActive;
        var selectedCount = process.selectedScenes ? process.selectedScenes.length : 0;

        tab.innerHTML =
            '<button class="process-tab' + (isActive ? ' active' : '') + '" ' +
            'data-process-id="' + process.id + '" title="' + process.name + ' (' + selectedCount + '개 장면)">' +
            '<span class="process-name">' + process.name + '</span>' +
            '<span class="scene-count">' + selectedCount + '</span>' +
            '</button>' +
            (appState.processes.length > 1 ?
                '<button class="process-delete-btn" data-process-id="' + process.id + '" ' +
                'title="' + process.name + ' 삭제">&times;</button>' : '');

        var self = this;

        // 탭 클릭 이벤트
        var tabButton = tab.querySelector('.process-tab');
        tabButton.addEventListener('click', function() {
            self.switchProcess(this.getAttribute('data-process-id'));
        });

        // 삭제 버튼 이벤트
        var deleteButton = tab.querySelector('.process-delete-btn');
        if (deleteButton) {
            deleteButton.addEventListener('click', function(e) {
                e.stopPropagation();
                self.deleteProcess(this.getAttribute('data-process-id'));
            });
        }

        return tab;
    },

    updateProcessInfo: function() {
        // 공정 정보 업데이트를 위한 영역이 있다면 업데이트
        var infoArea = document.getElementById('process-info');
        if (infoArea) {
            infoArea.textContent = appState.processes.length + '/' + this.maxProcesses + ' 공정';
        }
    },

    renderProcessContent: function() {
        var contentContainer = document.getElementById('process-content');
        var currentProcess = this.getCurrentProcess();

        if (!currentProcess) return;

        contentContainer.innerHTML = '<h3>' + currentProcess.name + ' - 장면 선택</h3>' +
            '<p>이 공정에 포함할 장면들을 선택하세요.</p>' +
            '<div id="scene-selection-grid" class="scene-grid"></div>';

        this.renderSceneSelection();
    },

    renderSceneSelection: function() {
        this.renderAvailableScenes();
        this.renderAllScenes();
    },

    renderAvailableScenes: function() {
        var gridContainer = document.getElementById('available-scenes-grid');
        if (!gridContainer) return;

        gridContainer.innerHTML = '';

        if (appState.sceneImages.length === 0) {
            gridContainer.innerHTML = '<p>업로드된 장면 이미지가 없습니다.</p>';
            return;
        }

        var currentProcess = this.getCurrentProcess();
        var availableScenes = this.getAvailableScenes();
        var currentProcessId = currentProcess.id;

        for (var i = 0; i < appState.sceneImages.length; i++) {
            var scene = appState.sceneImages[i];
            var isSelected = currentProcess.selectedScenes.indexOf(i) !== -1;
            var isUsedInOtherProcess = this.isSceneUsedInOtherProcess(i, currentProcessId);

            if (isUsedInOtherProcess && !isSelected) continue; // 다른 공정에서 사용 중인 장면은 표시하지 않음

            var sceneItem = document.createElement('div');
            sceneItem.className = 'scene-item' + (isSelected ? ' selected' : '') + (isUsedInOtherProcess ? ' disabled' : '');

            var usedInProcess = this.getProcessUsingScene(i);
            var statusText = isUsedInOtherProcess && !isSelected ? ' (사용 중: ' + usedInProcess + ')' : '';

            sceneItem.innerHTML =
                '<img src="' + scene.data + '" alt="' + scene.name + '" class="scene-thumbnail">' +
                '<div class="scene-name">' + scene.name + statusText + '</div>' +
                '<input type="checkbox" ' + (isSelected ? 'checked' : '') + ' data-scene-index="' + i + '" ' +
                (isUsedInOtherProcess && !isSelected ? 'disabled' : '') + '>';

            sceneItem.addEventListener('click', function(e) {
                if (e.target.type !== 'checkbox') {
                    var checkbox = this.querySelector('input[type="checkbox"]');
                    if (!checkbox.disabled) {
                        checkbox.checked = !checkbox.checked;
                        checkbox.dispatchEvent(new Event('change'));
                    }
                }
            });

            sceneItem.querySelector('input').addEventListener('change', function() {
                if (!this.disabled) {
                    processManager.toggleSceneSelection(parseInt(this.getAttribute('data-scene-index')), this.checked);
                }
            });

            gridContainer.appendChild(sceneItem);
        }
    },

    renderAllScenes: function() {
        var gridContainer = document.getElementById('all-scenes-grid');
        if (!gridContainer) return;

        gridContainer.innerHTML = '';

        if (appState.sceneImages.length === 0) {
            gridContainer.innerHTML = '<p>업로드된 장면 이미지가 없습니다.</p>';
            return;
        }

        var currentProcess = this.getCurrentProcess();
        var currentProcessId = currentProcess.id;

        for (var i = 0; i < appState.sceneImages.length; i++) {
            var scene = appState.sceneImages[i];
            var isSelected = currentProcess.selectedScenes.indexOf(i) !== -1;
            var usedInProcess = this.getProcessUsingScene(i);

            var sceneItem = document.createElement('div');
            sceneItem.className = 'scene-item readonly';

            var statusClass = '';
            var statusText = '';

            if (isSelected) {
                statusClass = ' current-selected';
                statusText = ' (현재 공정에서 선택됨)';
            } else if (usedInProcess) {
                statusClass = ' other-used';
                statusText = ' (사용 중: ' + usedInProcess + ')';
            } else {
                statusClass = ' available';
                statusText = ' (사용 가능)';
            }

            sceneItem.className += statusClass;
            sceneItem.innerHTML =
                '<img src="' + scene.data + '" alt="' + scene.name + '" class="scene-thumbnail">' +
                '<div class="scene-name">' + scene.name + statusText + '</div>';

            gridContainer.appendChild(sceneItem);
        }
    },

    addNewProcess: function() {
        if (appState.processes.length >= this.maxProcesses) {
            utils.showError(
                '최대 ' + this.maxProcesses + '개의 공정까지만 생성할 수 있습니다.',
                '공정 개수 제한'
            );
            return;
        }

        var newProcessId = 'process_' + (Date.now()); // 고유 ID 생성
        var newProcessNumber = appState.processes.length + 1;
        var newProcess = {
            id: newProcessId,
            name: '공정' + newProcessNumber,
            selectedScenes: [],
            isActive: false,
            createdAt: new Date().getTime()
        };

        appState.processes.push(newProcess);

        // 새 공정을 위한 빈 데이터 구조 초기화
        appState.sceneMaterialMapping[newProcessId] = {};
        appState.sceneMaterialPositions[newProcessId] = {};
        appState.minimapBoxes[newProcessId] = {};

        console.log('새 공정 추가됨:', newProcess.name);

        this.renderProcessTabs();

        // 새로 만든 공정으로 자동 전환
        this.switchProcess(newProcessId);
    },

    deleteProcess: function(processId) {
        if (appState.processes.length <= 1) {
            utils.showError(
                '최소 하나의 공정은 유지되어야 합니다.',
                '공정 삭제 불가'
            );
            return;
        }

        var processToDelete = null;
        var processIndex = -1;

        for (var i = 0; i < appState.processes.length; i++) {
            if (appState.processes[i].id === processId) {
                processToDelete = appState.processes[i];
                processIndex = i;
                break;
            }
        }

        if (!processToDelete) {
            utils.showError('삭제할 공정을 찾을 수 없습니다.');
            return;
        }

        var self = this;
        var confirmMessage = '공정 "' + processToDelete.name + '"을(를) 삭제하시겠습니까?\n\n' +
            '이 공정에 설정된 모든 데이터가 함께 삭제됩니다.\n' +
            '선택된 장면: ' + (processToDelete.selectedScenes.length || 0) + '개';

        // 간단한 확인 대화상자 (브라우저 기본)
        if (confirm(confirmMessage)) {
            // 공정 배열에서 제거
            appState.processes.splice(processIndex, 1);

            // 관련 데이터 구조 정리
            delete appState.sceneMaterialMapping[processId];
            delete appState.sceneMaterialPositions[processId];
            delete appState.minimapBoxes[processId];

            console.log('공정 삭제됨:', processToDelete.name);

            // 현재 활성 공정이 삭제된 경우 다른 공정으로 전환
            if (appState.currentProcess === processId) {
                var newActiveProcess = appState.processes[0];
                newActiveProcess.isActive = true;
                appState.currentProcess = newActiveProcess.id;
            }

            // 공정 이름 재정렬 (선택사항)
            this.renumberProcesses();

            this.renderProcessTabs();
            this.renderProcessContent();
            this.updateNavigationState();
        }
    },

    renumberProcesses: function() {
        // 공정 이름을 순서대로 다시 번호 매기기
        for (var i = 0; i < appState.processes.length; i++) {
            var newName = '공정' + (i + 1);
            if (appState.processes[i].name !== newName) {
                console.log('공정 이름 변경:', appState.processes[i].name, '->', newName);
                appState.processes[i].name = newName;
            }
        }
    },

    getCurrentProcess: function() {
        for (var i = 0; i < appState.processes.length; i++) {
            if (appState.processes[i].id === appState.currentProcess) {
                return appState.processes[i];
            }
        }
        return appState.processes[0] || null; // 폴백
    },

    switchProcess: function(processId) {
        if (appState.currentProcess === processId) {
            return; // 이미 선택된 공정
        }

        console.log('공정 전환:', appState.currentProcess, '->', processId);

        // 기존 활성 상태 제거
        for (var i = 0; i < appState.processes.length; i++) {
            appState.processes[i].isActive = false;
        }

        // 새 공정 활성화
        var targetProcess = null;
        for (var i = 0; i < appState.processes.length; i++) {
            if (appState.processes[i].id === processId) {
                appState.processes[i].isActive = true;
                targetProcess = appState.processes[i];
                break;
            }
        }

        if (!targetProcess) {
            console.error('존재하지 않는 공정 ID:', processId);
            return;
        }

        appState.currentProcess = processId;

        // UI 업데이트
        this.renderProcessTabs();
        this.renderProcessContent();
        this.updateNavigationState();

        console.log('공정 전환 완료:', targetProcess.name);
    },

    updateNavigationState: function() {
        // 2단계 다음 버튼 활성화 상태 업데이트
        this.checkStep2Completion();
    },

    renderProcessContent: function() {
        var contentContainer = document.getElementById('process-content');
        if (!contentContainer) {
            console.error('process-content 컨테이너를 찾을 수 없습니다');
            return;
        }

        var currentProcess = this.getCurrentProcess();
        if (!currentProcess) {
            contentContainer.innerHTML = '<p class="error">공정 데이터를 불러올 수 없습니다.</p>';
            return;
        }

        var totalScenes = appState.sceneImages.length;
        var selectedCount = currentProcess.selectedScenes.length;
        var availableScenes = this.getAvailableScenes();
        var usedScenes = this.getUsedScenes();

        contentContainer.innerHTML =
            '<div class="process-header">' +
                '<h3>' + currentProcess.name + ' - 장면 선택</h3>' +
                '<div class="process-summary">' +
                    '<p>이 공정에 포함할 장면들을 선택하세요. (' + selectedCount + '/' + totalScenes + ' 선택됨)</p>' +
                    '<div class="scene-status">' +
                        '<span class="status-item available">사용 가능: ' + availableScenes.length + '개</span>' +
                        '<span class="status-item used">다른 공정에서 사용 중: ' + usedScenes.length + '개</span>' +
                    '</div>' +
                    '<div class="process-actions">' +
                        '<button class="btn-secondary btn-small" onclick="processManager.selectAllAvailableScenes()">사용가능한 장면 모두 선택</button>' +
                        '<button class="btn-secondary btn-small" onclick="processManager.deselectAllScenes()">전체 해제</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="scene-lists-container">' +
                '<div class="scene-list-section">' +
                    '<h4>선택 가능한 장면</h4>' +
                    '<div id="available-scenes-grid" class="scene-grid"></div>' +
                '</div>' +
                '<div class="scene-list-section">' +
                    '<h4>전체 이미지 목록</h4>' +
                    '<div id="all-scenes-grid" class="scene-grid readonly"></div>' +
                '</div>' +
            '</div>';

        this.renderSceneSelection();
    },

    renderSceneSelection: function() {
        var gridContainer = document.getElementById('scene-selection-grid');
        if (!gridContainer) return;

        gridContainer.innerHTML = '';

        if (appState.sceneImages.length === 0) {
            gridContainer.innerHTML =
                '<div class="empty-state">' +
                    '<p>업로드된 장면 이미지가 없습니다.</p>' +
                    '<p>1단계에서 장면 이미지들을 먼저 업로드해 주세요.</p>' +
                '</div>';
            return;
        }

        var currentProcess = this.getCurrentProcess();

        for (var i = 0; i < appState.sceneImages.length; i++) {
            var scene = appState.sceneImages[i];
            var isSelected = currentProcess.selectedScenes.indexOf(i) !== -1;

            var sceneItem = this.createSceneItem(scene, i, isSelected);
            gridContainer.appendChild(sceneItem);
        }
    },

    createSceneItem: function(scene, sceneIndex, isSelected) {
        var sceneItem = document.createElement('div');
        sceneItem.className = 'scene-item' + (isSelected ? ' selected' : '');
        sceneItem.setAttribute('data-scene-index', sceneIndex);

        // 이미지 정보 표시
        var sizeInfo = '';
        if (scene.width && scene.height) {
            sizeInfo = scene.width + ' × ' + scene.height + 'px';
        }
        if (scene.size) {
            sizeInfo += '<br><small>' + utils.formatFileSize(scene.size) + '</small>';
        }

        sceneItem.innerHTML =
            '<div class="scene-checkbox-wrapper">' +
                '<input type="checkbox" id="scene-' + sceneIndex + '" ' +
                'data-scene-index="' + sceneIndex + '" ' + (isSelected ? 'checked' : '') + '>' +
                '<label for="scene-' + sceneIndex + '" class="scene-checkbox-label"></label>' +
            '</div>' +
            '<img src="' + scene.data + '" alt="' + scene.name + '" class="scene-thumbnail" ' +
            'title="' + scene.name + '">' +
            '<div class="scene-info">' +
                '<div class="scene-name" title="' + scene.name + '">' + scene.name + '</div>' +
                '<div class="scene-details">' + sizeInfo + '</div>' +
            '</div>';

        var self = this;

        // 체크박스 변경 이벤트
        var checkbox = sceneItem.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', function() {
            self.toggleSceneSelection(parseInt(this.getAttribute('data-scene-index')), this.checked);
        });

        // 전체 아이템 클릭 이벤트 (체크박스 토글)
        sceneItem.addEventListener('click', function(e) {
            if (e.target.type !== 'checkbox' && !e.target.classList.contains('scene-checkbox-label')) {
                var checkbox = this.querySelector('input[type="checkbox"]');
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change'));
            }
        });

        return sceneItem;
    },

    toggleSceneSelection: function(sceneIndex, isSelected) {
        var currentProcess = this.getCurrentProcess();
        if (!currentProcess) return;

        var selectedScenes = currentProcess.selectedScenes;
        var currentIndex = selectedScenes.indexOf(sceneIndex);

        if (isSelected && currentIndex === -1) {
            selectedScenes.push(sceneIndex);
            console.log('장면 추가됨:', sceneIndex, '공정:', currentProcess.name);
        } else if (!isSelected && currentIndex !== -1) {
            selectedScenes.splice(currentIndex, 1);
            console.log('장면 제거됨:', sceneIndex, '공정:', currentProcess.name);
        }

        // UI 업데이트
        this.updateSceneItemAppearance(sceneIndex, isSelected);
        this.updateProcessSummary();
        this.updateProcessTabs(); // 탭의 장면 개수 업데이트
        this.checkStep2Completion();
    },

    // 사용 가능한 장면들 가져오기 (다른 공정에서 사용하지 않는 장면들)
    getAvailableScenes: function() {
        var available = [];
        var currentProcess = this.getCurrentProcess();
        var currentProcessId = currentProcess ? currentProcess.id : null;

        for (var i = 0; i < appState.sceneImages.length; i++) {
            if (!this.isSceneUsedInOtherProcess(i, currentProcessId)) {
                available.push(i);
            }
        }
        return available;
    },

    // 다른 공정에서 사용 중인 장면들 가져오기
    getUsedScenes: function() {
        var used = [];
        var currentProcess = this.getCurrentProcess();
        var currentProcessId = currentProcess ? currentProcess.id : null;

        for (var i = 0; i < appState.sceneImages.length; i++) {
            if (this.isSceneUsedInOtherProcess(i, currentProcessId)) {
                used.push(i);
            }
        }
        return used;
    },

    // 특정 장면이 다른 공정에서 사용 중인지 확인
    isSceneUsedInOtherProcess: function(sceneIndex, currentProcessId) {
        for (var i = 0; i < appState.processes.length; i++) {
            var process = appState.processes[i];
            if (process.id !== currentProcessId &&
                process.selectedScenes &&
                process.selectedScenes.indexOf(sceneIndex) !== -1) {
                return true;
            }
        }
        return false;
    },

    // 특정 장면을 사용하고 있는 공정 이름 반환
    getProcessUsingScene: function(sceneIndex) {
        for (var i = 0; i < appState.processes.length; i++) {
            var process = appState.processes[i];
            if (process.selectedScenes && process.selectedScenes.indexOf(sceneIndex) !== -1) {
                return process.name;
            }
        }
        return null;
    },

    // 사용 가능한 장면들만 모두 선택
    selectAllAvailableScenes: function() {
        var currentProcess = this.getCurrentProcess();
        if (!currentProcess) return;

        var availableScenes = this.getAvailableScenes();
        currentProcess.selectedScenes = availableScenes.slice(); // 배열 복사

        console.log('사용 가능한 모든 장면 선택:', currentProcess.name, availableScenes.length + '개');
        this.renderSceneSelection();
        this.updateProcessSummary();
        this.updateProcessTabs();
        this.checkStep2Completion();
    },

    selectAllScenes: function() {
        var currentProcess = this.getCurrentProcess();
        if (!currentProcess) return;

        currentProcess.selectedScenes = [];
        for (var i = 0; i < appState.sceneImages.length; i++) {
            currentProcess.selectedScenes.push(i);
        }

        console.log('전체 장면 선택:', currentProcess.name);
        this.renderSceneSelection();
        this.updateProcessSummary();
        this.updateProcessTabs();
        this.checkStep2Completion();
    },

    deselectAllScenes: function() {
        var currentProcess = this.getCurrentProcess();
        if (!currentProcess) return;

        currentProcess.selectedScenes = [];

        console.log('전체 장면 선택 해제:', currentProcess.name);
        this.renderSceneSelection();
        this.updateProcessSummary();
        this.updateProcessTabs();
        this.checkStep2Completion();
    },

    updateSceneItemAppearance: function(sceneIndex, isSelected) {
        var sceneItem = document.querySelector('.scene-item[data-scene-index="' + sceneIndex + '"]');
        if (!sceneItem) return;

        if (isSelected) {
            sceneItem.classList.add('selected');
        } else {
            sceneItem.classList.remove('selected');
        }
    },

    updateProcessSummary: function() {
        var summaryElement = document.querySelector('.process-summary p');
        if (!summaryElement) return;

        var currentProcess = this.getCurrentProcess();
        var totalScenes = appState.sceneImages.length;
        var selectedCount = currentProcess ? currentProcess.selectedScenes.length : 0;

        summaryElement.textContent =
            '이 공정에 포함할 장면들을 선택하세요. (' + selectedCount + '/' + totalScenes + ' 선택됨)';
    },

    updateProcessTabs: function() {
        // 기존 탭들의 장면 개수만 업데이트 (전체 재렌더링 없이)
        for (var i = 0; i < appState.processes.length; i++) {
            var process = appState.processes[i];
            var sceneCountElement = document.querySelector(
                '.process-tab[data-process-id="' + process.id + '"] .scene-count'
            );

            if (sceneCountElement) {
                sceneCountElement.textContent = process.selectedScenes.length;
            }
        }
    },

    checkStep2Completion: function() {
        var hasSelectedScenes = false;

        for (var i = 0; i < appState.processes.length; i++) {
            if (appState.processes[i].selectedScenes.length > 0) {
                hasSelectedScenes = true;
                break;
            }
        }

        var nextButton = document.getElementById('next-step-2');
        if (nextButton) {
            nextButton.disabled = !hasSelectedScenes;

            if (hasSelectedScenes) {
                nextButton.title = '다음 단계로 진행합니다';
            } else {
                nextButton.title = '최소 하나의 공정에서 장면을 선택해야 합니다';
            }
        }
    },

    // 데이터 내보내기/가져오기 (향후 확장용)
    exportProcessData: function() {
        return {
            processes: appState.processes,
            sceneMaterialMapping: appState.sceneMaterialMapping,
            sceneMaterialPositions: appState.sceneMaterialPositions,
            minimapBoxes: appState.minimapBoxes
        };
    },

    importProcessData: function(data) {
        if (data.processes) appState.processes = data.processes;
        if (data.sceneMaterialMapping) appState.sceneMaterialMapping = data.sceneMaterialMapping;
        if (data.sceneMaterialPositions) appState.sceneMaterialPositions = data.sceneMaterialPositions;
        if (data.minimapBoxes) appState.minimapBoxes = data.minimapBoxes;

        this.validateProcessData();
        this.renderProcessTabs();
        this.renderProcessContent();
    }
};

// ============================================================================
// 작업공간 관리자 (3단계: 매칭 & 배치)
// ============================================================================
var workspaceManager = {
    currentProcessId: null,
    materialTableRendered: false,

    init: function() {
        this.bindEvents();
        console.log('작업공간 관리자 초기화 완료');
    },

    // 3단계 진입 시 작업공간 구성
    setupWorkspace: function() {
        console.log('workspaceManager.setupWorkspace 시작');

        try {
            var workspaceElement = document.getElementById('workspace');
            if (!workspaceElement) {
                console.error('작업공간 엘리먼트를 찾을 수 없습니다.');
                utils.showError('작업공간을 초기화할 수 없습니다.\n페이지를 새로고침해주세요.');
                return;
            }

            // 데이터 유효성 검사
            if (!appState.processes || appState.processes.length === 0) {
                utils.showError('공정 데이터가 없습니다.\n2단계에서 공정을 먼저 설정해주세요.');
                return;
            }

            if (!appState.sceneImages || appState.sceneImages.length === 0) {
                utils.showError('장면 이미지가 없습니다.\n1단계에서 이미지를 먼저 업로드해주세요.');
                return;
            }

            console.log('데이터 상태:', {
                processes: appState.processes.length,
                sceneImages: appState.sceneImages.length,
                materials: appState.materials ? appState.materials.length : 0
            });

            // 기존 내용 제거
            workspaceElement.innerHTML = '';

            // 공정 선택 드롭다운 생성
            this.renderProcessSelector(workspaceElement);

            // 작업공간 컨테이너 생성 (3열 레이아웃: 미니맵 | 장면 이미지 | 자재표)
            var container = document.createElement('div');
            container.className = 'workspace-container';
            container.innerHTML =
                '<div class="minimap-workspace" id="minimap-workspace">' +
                    '<h3>미니맵</h3>' +
                    '<div id="minimap-workspace-content"></div>' +
                '</div>' +
                '<div class="scene-workspace" id="scene-workspace">' +
                    '<h3>장면 이미지</h3>' +
                    '<div id="scene-workspace-content"></div>' +
                '</div>' +
                '<div class="material-workspace" id="material-workspace">' +
                    '<h3>자재표</h3>' +
                    '<div id="material-workspace-content"></div>' +
                '</div>';

            workspaceElement.appendChild(container);

            // 첫 번째 공정이 있으면 자동 선택
            this.selectProcess(appState.processes[0].id);

            console.log('workspaceManager.setupWorkspace 완료');

        } catch (error) {
            console.error('workspaceManager.setupWorkspace 오류:', error);
            utils.showError('작업공간 초기화 중 오류가 발생했습니다:\n' + error.message);
        }
    },

    // 공정 선택 탭 렌더링 (드롭다운에서 탭으로 변경)
    renderProcessSelector: function(parentElement) {
        var selectorHTML = '<div class="process-tabs-workspace">';
        selectorHTML += '<div class="workspace-tabs">';

        for (var i = 0; i < appState.processes.length; i++) {
            var process = appState.processes[i];
            var sceneCount = process.selectedScenes.length;
            var isActive = i === 0 ? ' active' : '';
            selectorHTML += '<button class="workspace-tab' + isActive + '" data-process-id="' + process.id + '">';
            selectorHTML += process.name + ' (' + sceneCount + '개 장면)';
            selectorHTML += '</button>';
        }

        selectorHTML += '</div></div>';

        var selectorElement = document.createElement('div');
        selectorElement.innerHTML = selectorHTML;
        parentElement.appendChild(selectorElement);

        // 탭 클릭 이벤트 바인딩
        var tabButtons = selectorElement.querySelectorAll('.workspace-tab');
        var self = this;

        for (var i = 0; i < tabButtons.length; i++) {
            tabButtons[i].addEventListener('click', function(e) {
                // 모든 탭의 active 클래스 제거
                for (var j = 0; j < tabButtons.length; j++) {
                    tabButtons[j].classList.remove('active');
                }

                // 클릭된 탭에 active 클래스 추가
                this.classList.add('active');

                var processId = this.getAttribute('data-process-id');
                if (processId) {
                self.selectProcess(processId);
            } else {
                self.clearWorkspace();
            }
        });
    },

    // 공정 선택
    selectProcess: function(processId) {
        this.currentProcessId = processId;

        var process = appState.processes.find(function(p) { return p.id === processId; });
        if (!process) {
            console.error('공정을 찾을 수 없습니다:', processId);
            return;
        }

        // 선택 드롭다운 업데이트
        var selectElement = document.getElementById('workspace-process-select');
        if (selectElement) {
            selectElement.value = processId;
        }

        // 미니맵 작업공간 렌더링
        this.renderMinimapWorkspace(process);

        // 장면 작업공간 렌더링
        this.renderSceneWorkspace(process);

        // 자재표 작업공간 렌더링
        this.renderMaterialWorkspace();

        console.log('공정 선택됨:', process.name, '(' + process.selectedScenes.length + '개 장면)');
    },

    // 미니맵 작업공간 렌더링 (선택된 장면을 빨간 박스로 표시)
    renderMinimapWorkspace: function(process) {
        console.log('renderMinimapWorkspace 시작');

        try {
            var contentElement = document.getElementById('minimap-workspace-content');
            if (!contentElement) {
                console.error('minimap-workspace-content 요소를 찾을 수 없습니다.');
                return;
            }

            if (!appState.minimapImage) {
                contentElement.innerHTML = '<p class="empty-state">미니맵 이미지가 업로드되지 않았습니다.</p>';
                return;
            }

            // 미니맵 컨테이너 생성
            var html = '<div class="minimap-container" style="position: relative; display: inline-block;">';
            html += '<img src="' + appState.minimapImage + '" alt="미니맵" class="minimap-image" style="max-width: 100%; height: auto;">';

            // 선택된 장면들에 대해 빨간 박스 표시
            if (process.selectedScenes && process.selectedScenes.length > 0) {
                html += '<div class="minimap-overlays" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">';

                for (var i = 0; i < process.selectedScenes.length; i++) {
                    var sceneIndex = process.selectedScenes[i];
                    var sceneData = appState.sceneImages[sceneIndex];

                    if (sceneData) {
                        // 각 장면에 대해 빨간 박스 생성 (임시로 랜덤 위치)
                        // 실제로는 장면과 미니맵의 매핑 정보가 필요
                        var boxStyle = this.generateSceneBox(i, process.selectedScenes.length);
                        html += '<div class="scene-box" data-scene-index="' + sceneIndex + '" ';
                        html += 'style="position: absolute; border: 2px solid #ff4444; background: rgba(255, 68, 68, 0.2); ';
                        html += boxStyle + 'cursor: pointer;" ';
                        html += 'title="' + sceneData.name + '">';
                        html += '<span style="position: absolute; top: -20px; left: 2px; background: #ff4444; color: white; padding: 2px 6px; font-size: 12px; border-radius: 3px;">';
                        html += (i + 1);
                        html += '</span>';
                        html += '</div>';
                    }
                }

                html += '</div>';
            }

            html += '</div>';

            // 범례 추가
            html += '<div class="minimap-legend" style="margin-top: 10px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;">';
            html += '<h4 style="margin: 0 0 8px 0; font-size: 14px;">선택된 장면</h4>';

            if (process.selectedScenes && process.selectedScenes.length > 0) {
                for (var i = 0; i < process.selectedScenes.length; i++) {
                    var sceneIndex = process.selectedScenes[i];
                    var sceneData = appState.sceneImages[sceneIndex];

                    if (sceneData) {
                        html += '<div style="display: flex; align-items: center; margin-bottom: 4px;">';
                        html += '<span style="display: inline-block; width: 20px; height: 20px; background: #ff4444; margin-right: 8px; text-align: center; color: white; font-size: 12px; line-height: 20px; border-radius: 2px;">';
                        html += (i + 1);
                        html += '</span>';
                        html += '<span style="font-size: 13px;">' + sceneData.name + '</span>';
                        html += '</div>';
                    }
                }
            } else {
                html += '<p style="margin: 0; color: #666; font-size: 13px;">선택된 장면이 없습니다.</p>';
            }

            html += '</div>';

            contentElement.innerHTML = html;

            // 클릭 이벤트 추가
            this.bindMinimapEvents();

            console.log('미니맵 렌더링 완료');

        } catch (error) {
            console.error('renderMinimapWorkspace 오류:', error);
            var contentElement = document.getElementById('minimap-workspace-content');
            if (contentElement) {
                contentElement.innerHTML = '<p class="empty-state">미니맵 표시 중 오류가 발생했습니다.</p>';
            }
        }
    },

    // 장면 박스 위치 생성 (임시 구현 - 실제로는 매핑 데이터 필요)
    generateSceneBox: function(index, total) {
        // 임시로 미니맵을 격자로 나누어 배치
        var rows = Math.ceil(Math.sqrt(total));
        var cols = Math.ceil(total / rows);

        var row = Math.floor(index / cols);
        var col = index % cols;

        var boxWidth = 80 / cols;  // 미니맵의 80% 영역을 사용
        var boxHeight = 60 / rows; // 미니맵의 60% 영역을 사용

        var left = 10 + (col * boxWidth);  // 10%부터 시작
        var top = 20 + (row * boxHeight);  // 20%부터 시작

        return 'left: ' + left + '%; top: ' + top + '%; width: ' + (boxWidth - 2) + '%; height: ' + (boxHeight - 2) + '%;';
    },

    // 미니맵 이벤트 바인딩
    bindMinimapEvents: function() {
        var self = this;
        var sceneBoxes = document.querySelectorAll('.scene-box');

        for (var i = 0; i < sceneBoxes.length; i++) {
            sceneBoxes[i].addEventListener('click', function() {
                var sceneIndex = this.getAttribute('data-scene-index');
                console.log('미니맵에서 장면 클릭:', sceneIndex);

                // 해당 장면으로 스크롤 이동
                self.scrollToScene(sceneIndex);
            });
        }

        // 미니맵 이미지에 드래그 기능 추가
        this.setupMinimapDrawing();
    },

    // 미니맵 드래그 그리기 기능 설정
    setupMinimapDrawing: function() {
        var self = this;
        var minimapImage = document.querySelector('.minimap-image');
        var minimapContainer = document.querySelector('.minimap-container');
        var overlaysContainer = document.querySelector('.minimap-overlays');

        if (!minimapImage || !minimapContainer) return;

        // 오버레이 컨테이너가 없으면 생성
        if (!overlaysContainer) {
            overlaysContainer = document.createElement('div');
            overlaysContainer.className = 'minimap-overlays';
            overlaysContainer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;';
            minimapContainer.appendChild(overlaysContainer);
        }

        var isDrawing = false;
        var startX, startY;
        var currentBox = null;

        minimapImage.addEventListener('mousedown', function(e) {
            e.preventDefault();
            isDrawing = true;

            var rect = minimapImage.getBoundingClientRect();
            startX = e.clientX - rect.left;
            startY = e.clientY - rect.top;

            // 새로운 박스 생성
            currentBox = document.createElement('div');
            currentBox.className = 'minimap-draw-box';
            currentBox.style.cssText =
                'position: absolute; border: 2px solid #ff4444; background: rgba(255, 68, 68, 0.2); ' +
                'left: ' + startX + 'px; top: ' + startY + 'px; width: 0; height: 0; pointer-events: none;';

            overlaysContainer.appendChild(currentBox);
        });

        minimapImage.addEventListener('mousemove', function(e) {
            if (!isDrawing || !currentBox) return;

            var rect = minimapImage.getBoundingClientRect();
            var currentX = e.clientX - rect.left;
            var currentY = e.clientY - rect.top;

            var left = Math.min(startX, currentX);
            var top = Math.min(startY, currentY);
            var width = Math.abs(currentX - startX);
            var height = Math.abs(currentY - startY);

            currentBox.style.left = left + 'px';
            currentBox.style.top = top + 'px';
            currentBox.style.width = width + 'px';
            currentBox.style.height = height + 'px';
        });

        minimapImage.addEventListener('mouseup', function(e) {
            if (!isDrawing || !currentBox) return;

            isDrawing = false;

            // 너무 작은 박스는 제거
            if (parseInt(currentBox.style.width) < 10 || parseInt(currentBox.style.height) < 10) {
                overlaysContainer.removeChild(currentBox);
            } else {
                // 박스에 삭제 버튼 추가
                self.addBoxControls(currentBox);
            }

            currentBox = null;
        });

        // 초기화 버튼 추가
        this.addResetButton();
    },

    // 박스에 삭제 컨트롤 추가
    addBoxControls: function(box) {
        var deleteBtn = document.createElement('div');
        deleteBtn.innerHTML = '×';
        deleteBtn.style.cssText =
            'position: absolute; top: -10px; right: -10px; width: 20px; height: 20px; ' +
            'background: #ff4444; color: white; border-radius: 50%; text-align: center; ' +
            'line-height: 20px; cursor: pointer; font-weight: bold; font-size: 14px; pointer-events: auto;';

        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            box.parentNode.removeChild(box);
        });

        box.appendChild(deleteBtn);
        box.style.pointerEvents = 'auto';
    },

    // 미니맵 초기화 버튼 추가
    addResetButton: function() {
        var minimapContainer = document.querySelector('.minimap-container');
        if (!minimapContainer) return;

        // 기존 버튼이 있으면 제거
        var existingBtn = document.querySelector('.minimap-reset-btn');
        if (existingBtn) {
            existingBtn.parentNode.removeChild(existingBtn);
        }

        var resetBtn = document.createElement('button');
        resetBtn.innerHTML = '미니맵 초기화';
        resetBtn.className = 'btn btn-secondary minimap-reset-btn';
        resetBtn.style.cssText = 'margin-top: 10px; margin-right: 10px;';
        resetBtn.addEventListener('click', function() {
            var overlaysContainer = document.querySelector('.minimap-overlays');
            if (overlaysContainer) {
                var drawBoxes = overlaysContainer.querySelectorAll('.minimap-draw-box');
                for (var i = 0; i < drawBoxes.length; i++) {
                    overlaysContainer.removeChild(drawBoxes[i]);
                }
            }
        });

        minimapContainer.parentNode.insertBefore(resetBtn, minimapContainer.nextSibling);
    },

    // 장면으로 스크롤 이동
    scrollToScene: function(sceneIndex) {
        var sceneElement = document.querySelector('[data-scene-id="' + sceneIndex + '"]');
        if (sceneElement) {
            sceneElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // 잠깐 하이라이트 효과
            sceneElement.style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.5)';
            setTimeout(function() {
                sceneElement.style.boxShadow = '';
            }, 2000);
        }
    },

    // 장면 작업공간 렌더링
    renderSceneWorkspace: function(process) {
        console.log('renderSceneWorkspace 시작:', process);

        try {
            var contentElement = document.getElementById('scene-workspace-content');
            if (!contentElement) {
                console.error('scene-workspace-content 엘리먼트를 찾을 수 없습니다.');
                return;
            }

            if (!process.selectedScenes || process.selectedScenes.length === 0) {
                contentElement.innerHTML = '<p class="empty-state">선택된 장면이 없습니다.</p>';
                console.log('선택된 장면이 없음');
                return;
            }

            console.log('선택된 장면들:', process.selectedScenes);
            console.log('전체 장면 이미지 수:', appState.sceneImages.length);

            var html = '<div class="scene-workspace-grid">';

            for (var i = 0; i < process.selectedScenes.length; i++) {
                var sceneIndex = process.selectedScenes[i];
                var sceneData = appState.sceneImages[sceneIndex];

                console.log('장면', i, ':', { sceneIndex: sceneIndex, sceneData: sceneData });

                if (sceneData) {
                    // 장면 데이터를 workspaceManager에서 사용할 수 있도록 변환
                    var workspaceSceneData = {
                        id: sceneIndex,  // 인덱스를 ID로 사용
                        name: sceneData.name,
                        url: sceneData.data  // data 속성을 url로 매핑
                    };
                    html += this.renderSceneWorkspaceItem(workspaceSceneData);
                } else {
                    console.warn('장면 데이터가 없음:', sceneIndex);
                }
            }

            html += '</div>';
            contentElement.innerHTML = html;

            console.log('장면 작업공간 HTML 설정 완료');

            // 드롭 타겟 설정
            setTimeout(function() {
                dragDropManager.setupSceneDropTargets();
                console.log('드롭 타겟 설정 완료');
            }, 100);

        } catch (error) {
            console.error('renderSceneWorkspace 오류:', error);
            var contentElement = document.getElementById('scene-workspace-content');
            if (contentElement) {
                contentElement.innerHTML = '<p class="empty-state">장면을 표시하는 중 오류가 발생했습니다.</p>';
            }
        }
    },

    // 개별 장면 작업공간 아이템 렌더링
    renderSceneWorkspaceItem: function(sceneData) {
        var html = '<div class="scene-workspace-item" data-scene-id="' + sceneData.id + '">';
        html += '<h4>' + sceneData.name + '</h4>';
        html += '<img src="' + sceneData.url + '" alt="' + sceneData.name + '" class="scene-workspace-image">';
        html += '<div id="scene-' + sceneData.id + '-material-list" class="scene-material-list">';
        html += '<p class="empty-state">배치된 자재가 없습니다.</p>';
        html += '</div>';
        html += '</div>';

        return html;
    },

    // 자재표 작업공간 렌더링
    renderMaterialWorkspace: function() {
        console.log('renderMaterialWorkspace 시작');

        try {
            var contentElement = document.getElementById('material-workspace-content');
            if (!contentElement) {
                console.error('material-workspace-content 요소를 찾을 수 없습니다.');
                return;
            }

            // 자재 데이터 확인 (materials 배열 사용)
            if (!appState.materials || appState.materials.length === 0) {
                console.log('자재 데이터 없음:', appState.materials);
                contentElement.innerHTML = '<p class="empty-state">자재표를 먼저 업로드해주세요.</p>';
                return;
            }

            console.log('자재 데이터 확인:', appState.materials.length, '개 자재');

            var html = '<div class="material-table-container">';
            html += '<p class="drag-instruction">자재를 클릭하고 드래그하여 장면 이미지에 배치하세요.</p>';

            // 자재 탭 생성
            if (appState.materialsBySheet && Object.keys(appState.materialsBySheet).length > 0) {
                html += '<div class="material-tabs" id="material-tabs">';
                var sheetNames = Object.keys(appState.materialsBySheet);

                // 전체 탭 추가
                html += '<button class="material-tab active" data-sheet="all">전체 (' + appState.materials.length + '개)</button>';

                // 각 시트별 탭 추가
                for (var i = 0; i < sheetNames.length; i++) {
                    var sheetName = sheetNames[i];
                    var sheetMaterials = appState.materialsBySheet[sheetName];
                    html += '<button class="material-tab" data-sheet="' + sheetName + '">';
                    html += sheetName + ' (' + sheetMaterials.length + '개)</button>';
                }
                html += '</div>';
            }

            html += '<div class="material-table-content" id="material-table-content">';
            html += '<table class="material-table" id="material-table">';
            html += '<thead><tr>';
            html += '<th>번호</th><th>분류</th><th>자재명</th><th>세부내용</th>';
            html += '</tr></thead><tbody id="material-table-body">';
            html += '</tbody></table>';
            html += '</div>';
            html += '</div>';

            contentElement.innerHTML = html;

            // 탭 클릭 이벤트 바인딩
            this.bindMaterialTabEvents();

            this.materialTableRendered = true;

            console.log('자재표 렌더링 완료:', appState.materials.length, '개 행');

            // 드래그 소스 설정
            setTimeout(function() {
                dragDropManager.setupMaterialDragSources();
                console.log('드래그 소스 설정 완료');

                // 커스텀 이벤트 발생
                document.dispatchEvent(new Event('materialTableUpdated'));
            }, 100);

        } catch (error) {
            console.error('renderMaterialWorkspace 오류:', error);
            var contentElement = document.getElementById('material-workspace-content');
            if (contentElement) {
                contentElement.innerHTML = '<p class="empty-state">자재표 표시 중 오류가 발생했습니다.</p>';
            }
        }
    },

    // 자재 탭 이벤트 바인딩
    bindMaterialTabEvents: function() {
        var self = this;
        var tabButtons = document.querySelectorAll('.material-tab');

        for (var i = 0; i < tabButtons.length; i++) {
            tabButtons[i].addEventListener('click', function(e) {
                // 모든 탭의 active 클래스 제거
                for (var j = 0; j < tabButtons.length; j++) {
                    tabButtons[j].classList.remove('active');
                }

                // 클릭된 탭에 active 클래스 추가
                this.classList.add('active');

                var sheetName = this.getAttribute('data-sheet');
                self.displayMaterialsForSheet(sheetName);
            });
        }

        // 기본적으로 전체 자재 표시
        this.displayMaterialsForSheet('all');
    },

    // 특정 시트의 자재들을 표시
    displayMaterialsForSheet: function(sheetName) {
        var tableBody = document.getElementById('material-table-body');
        if (!tableBody) return;

        var materialsToShow = [];

        if (sheetName === 'all') {
            materialsToShow = appState.materials || [];
        } else if (appState.materialsBySheet && appState.materialsBySheet[sheetName]) {
            materialsToShow = appState.materialsBySheet[sheetName];
        }

        var html = '';
        for (var i = 0; i < materialsToShow.length; i++) {
            var material = materialsToShow[i];
            var globalIndex = appState.materials.indexOf(material);

            html += '<tr data-material-index="' + globalIndex + '">';
            html += '<td>' + (material.id || i + 1) + '</td>';
            html += '<td>' + (material.category || '일반') + '</td>';
            html += '<td>' + (material.material || material.displayId || '자재 ' + (i + 1)) + '</td>';
            html += '<td>' + (material.item || material.area || '') + '</td>';
            html += '</tr>';
        }

        tableBody.innerHTML = html;

        // 드래그 소스 재설정
        setTimeout(function() {
            dragDropManager.setupMaterialDragSources();
        }, 100);
    },

    // 작업공간 초기화
    clearWorkspace: function() {
        this.currentProcessId = null;
        this.materialTableRendered = false;

        var sceneContent = document.getElementById('scene-workspace-content');
        if (sceneContent) {
            sceneContent.innerHTML = '<p class="empty-state">공정을 선택하세요.</p>';
        }

        var materialContent = document.getElementById('material-workspace-content');
        if (materialContent) {
            materialContent.innerHTML = '<p class="empty-state">공정을 선택하세요.</p>';
        }
    },

    // 이벤트 바인딩
    bindEvents: function() {
        var self = this;

        // 3단계 진입 시 작업공간 설정
        document.addEventListener('stepChanged', function(e) {
            if (e.detail && e.detail.step === 3) {
                self.setupWorkspace();
            }
        });

        // 공정 변경 시 작업공간 업데이트
        document.addEventListener('processUpdated', function() {
            if (self.currentProcessId) {
                var process = appState.processes.find(function(p) { return p.id === self.currentProcessId; });
                if (process) {
                    self.renderSceneWorkspace(process);
                }
            }
        });
    },

    // 현재 공정의 자재 배치 데이터 가져오기
    getCurrentProcessMaterialData: function() {
        if (!this.currentProcessId || !appState.sceneMaterialPositions) return {};

        var self = this;
        var currentProcess = appState.processes.find(function(p) { return p.id === self.currentProcessId; });
        if (!currentProcess) return {};

        var processData = {};
        for (var i = 0; i < currentProcess.selectedScenes.length; i++) {
            var sceneId = currentProcess.selectedScenes[i];
            if (appState.sceneMaterialPositions[sceneId]) {
                processData[sceneId] = appState.sceneMaterialPositions[sceneId];
            }
        }

        return processData;
    },

    // 현재 공정의 완료 상태 확인
    checkCurrentProcessCompletion: function() {
        if (!this.currentProcessId) return false;

        var materialData = this.getCurrentProcessMaterialData();
        var hasAnyPlacements = false;

        for (var sceneId in materialData) {
            if (materialData[sceneId] && materialData[sceneId].length > 0) {
                hasAnyPlacements = true;
                break;
            }
        }

        return hasAnyPlacements;
    }
};

// ============================================================================
// 드래그 앤 드롭 자재 배치 시스템
// ============================================================================
var dragDropManager = {
    draggedMaterial: null,
    dragStartPosition: null,
    materialCounter: 1, // 자재 번호 카운터

    init: function() {
        this.setupMaterialDragSources();
        this.setupSceneDropTargets();
        this.bindEvents();
        console.log('드래그앤드롭 시스템 초기화 완료');
    },

    // 자재 테이블의 드래그 소스 설정
    setupMaterialDragSources: function() {
        // 자재표가 로드된 후 호출될 예정
        var materialRows = document.querySelectorAll('#material-table tbody tr');

        for (var i = 0; i < materialRows.length; i++) {
            var row = materialRows[i];
            this.makeMaterialRowDraggable(row, i);
        }
    },

    makeMaterialRowDraggable: function(row, materialIndex) {
        var self = this;
        row.draggable = true;
        row.style.cursor = 'grab';

        // 드래그 시작
        row.addEventListener('dragstart', function(e) {
            self.draggedMaterial = {
                index: materialIndex,
                name: row.cells[1] ? row.cells[1].textContent : '자재 ' + (materialIndex + 1),
                category: row.cells[0] ? row.cells[0].textContent : '기본',
                data: appState.materials ? appState.materials[materialIndex] : null
            };

            self.dragStartPosition = {
                x: e.clientX,
                y: e.clientY
            };

            row.style.cursor = 'grabbing';
            row.style.opacity = '0.7';

            // 드래그 이미지 설정
            var dragImage = row.cloneNode(true);
            dragImage.style.backgroundColor = '#f0f4ff';
            dragImage.style.border = '2px solid #667eea';
            dragImage.style.borderRadius = '4px';

            e.dataTransfer.effectAllowed = 'copy';
            e.dataTransfer.setData('text/plain', 'material-' + materialIndex);

            console.log('드래그 시작:', self.draggedMaterial);
        });

        // 드래그 종료
        row.addEventListener('dragend', function(e) {
            row.style.cursor = 'grab';
            row.style.opacity = '1';

            self.draggedMaterial = null;
            self.dragStartPosition = null;

            console.log('드래그 종료');
        });

        // 호버 효과
        row.addEventListener('mouseenter', function() {
            row.style.backgroundColor = '#f8f9ff';
        });

        row.addEventListener('mouseleave', function() {
            row.style.backgroundColor = '';
        });
    },

    // 장면 이미지의 드롭 타겟 설정
    setupSceneDropTargets: function() {
        var sceneContainers = document.querySelectorAll('.scene-workspace-item');

        for (var i = 0; i < sceneContainers.length; i++) {
            this.makeSceneDropTarget(sceneContainers[i]);
        }
    },

    makeSceneDropTarget: function(sceneContainer) {
        var self = this;
        var sceneImage = sceneContainer.querySelector('.scene-workspace-image');
        var sceneId = sceneContainer.getAttribute('data-scene-id');

        if (!sceneImage || !sceneId) return;

        // 드래그 오버
        sceneContainer.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';

            sceneContainer.style.borderColor = '#667eea';
            sceneContainer.style.backgroundColor = '#f0f4ff';
            sceneContainer.style.transform = 'scale(1.02)';

            // 드래그 커서 표시
            self.showDragCursor(e, sceneImage);
        });

        // 드래그 진입
        sceneContainer.addEventListener('dragenter', function(e) {
            e.preventDefault();
        });

        // 드래그 떠남
        sceneContainer.addEventListener('dragleave', function(e) {
            if (!sceneContainer.contains(e.relatedTarget)) {
                sceneContainer.style.borderColor = '';
                sceneContainer.style.backgroundColor = '';
                sceneContainer.style.transform = '';
                self.hideDragCursor();
            }
        });

        // 드롭 처리
        sceneContainer.addEventListener('drop', function(e) {
            e.preventDefault();

            sceneContainer.style.borderColor = '';
            sceneContainer.style.backgroundColor = '';
            sceneContainer.style.transform = '';
            self.hideDragCursor();

            if (!self.draggedMaterial) return;

            // 이미지 좌표 계산 (더 정확한 계산)
            var imageRect = sceneImage.getBoundingClientRect();

            // 스크롤 오프셋 고려
            var scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
            var scrollTop = window.pageYOffset || document.documentElement.scrollTop;

            var dropX = e.clientX - imageRect.left;
            var dropY = e.clientY - imageRect.top;

            // 좌표 정규화 (0-1 범위)
            var normalizedX = Math.max(0, Math.min(1, dropX / imageRect.width));
            var normalizedY = Math.max(0, Math.min(1, dropY / imageRect.height));

            console.log('드롭 좌표:', {
                clientX: e.clientX,
                clientY: e.clientY,
                imageRect: imageRect,
                dropX: dropX,
                dropY: dropY,
                normalizedX: normalizedX,
                normalizedY: normalizedY
            });

            self.addMaterialToScene(sceneId, self.draggedMaterial, normalizedX, normalizedY);

            console.log('자재 배치:', {
                scene: sceneId,
                material: self.draggedMaterial,
                position: {x: normalizedX, y: normalizedY}
            });
        });
    },

    // 장면에 자재 추가
    addMaterialToScene: function(sceneId, material, normalizedX, normalizedY) {
        // 데이터 구조 초기화
        if (!appState.sceneMaterialPositions) {
            appState.sceneMaterialPositions = {};
        }

        if (!appState.sceneMaterialPositions[sceneId]) {
            appState.sceneMaterialPositions[sceneId] = [];
        }

        // 자재 배치 정보 저장
        var placement = {
            id: 'material-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            materialIndex: material.index,
            materialName: material.name,
            materialCategory: material.category,
            number: this.materialCounter++,
            normalizedX: normalizedX,
            normalizedY: normalizedY,
            timestamp: new Date().getTime()
        };

        appState.sceneMaterialPositions[sceneId].push(placement);

        // 화면에 번호 배지 표시
        this.renderMaterialBadge(sceneId, placement);

        // 자재 목록 업데이트
        this.updateMaterialList(sceneId);

        // 3단계 완료 상태 확인
        if (appState.currentStep === 3) {
            stepController.checkStep3Completion();
        }

        utils.showSuccess('자재 "' + material.name + '"이(가) 배치되었습니다. (번호: ' + placement.number + ')');
    },

    // 자재 번호 배지 렌더링
    renderMaterialBadge: function(sceneId, placement) {
        var sceneContainer = document.querySelector('.scene-workspace-item[data-scene-id="' + sceneId + '"]');
        if (!sceneContainer) return;

        var sceneImage = sceneContainer.querySelector('.scene-workspace-image');
        if (!sceneImage) return;

        // 배지 컨테이너 찾기 또는 생성
        var badgeContainer = sceneContainer.querySelector('.material-badges');
        if (!badgeContainer) {
            badgeContainer = document.createElement('div');
            badgeContainer.className = 'material-badges';
            badgeContainer.style.position = 'absolute';
            badgeContainer.style.top = '0';
            badgeContainer.style.left = '0';
            badgeContainer.style.width = '100%';
            badgeContainer.style.height = '100%';
            badgeContainer.style.pointerEvents = 'none';
            sceneContainer.appendChild(badgeContainer);
        }

        // 배지 엘리먼트 생성
        var badge = document.createElement('div');
        badge.className = 'material-badge';
        badge.setAttribute('data-placement-id', placement.id);
        badge.style.position = 'absolute';
        badge.style.left = (placement.normalizedX * 100) + '%';
        badge.style.top = (placement.normalizedY * 100) + '%';
        badge.style.transform = 'translate(-50%, -50%)';
        badge.style.width = '24px';
        badge.style.height = '24px';
        badge.style.backgroundColor = '#667eea';
        badge.style.color = 'white';
        badge.style.borderRadius = '50%';
        badge.style.display = 'flex';
        badge.style.alignItems = 'center';
        badge.style.justifyContent = 'center';
        badge.style.fontSize = '12px';
        badge.style.fontWeight = 'bold';
        badge.style.cursor = 'pointer';
        badge.style.pointerEvents = 'auto';
        badge.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        badge.style.border = '2px solid white';
        badge.style.zIndex = '10';
        badge.textContent = placement.number;
        badge.title = placement.materialName + ' (' + placement.materialCategory + ')';

        // 배지 클릭 이벤트 (자재 정보 모달)
        var self = this;
        badge.addEventListener('click', function(e) {
            e.stopPropagation();
            self.showMaterialInfo(sceneId, placement);
        });

        // 배지 우클릭 이벤트 (삭제)
        badge.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.removeMaterialFromScene(sceneId, placement.id);
        });

        badgeContainer.appendChild(badge);
    },

    // 자재 정보 모달 표시
    showMaterialInfo: function(sceneId, placement) {
        var materialData = appState.materials ? appState.materials[placement.materialIndex] : null;

        var content = '<h4>' + placement.materialName + '</h4>';
        content += '<p><strong>카테고리:</strong> ' + placement.materialCategory + '</p>';
        content += '<p><strong>배치 번호:</strong> ' + placement.number + '</p>';

        if (materialData) {
            content += '<hr>';
            for (var key in materialData) {
                if (materialData.hasOwnProperty(key) && key !== '분류' && key !== '품명') {
                    content += '<p><strong>' + key + ':</strong> ' + materialData[key] + '</p>';
                }
            }
        }

        content += '<hr>';
        content += '<p><small>우클릭으로 삭제할 수 있습니다.</small></p>';

        utils.showModal(
            '자재 정보',
            content,
            [
                {
                    text: '위치 이동',
                    className: 'btn btn-secondary',
                    onclick: 'dragDropManager.startMaterialMove("' + sceneId + '", "' + placement.id + '")'
                },
                {
                    text: '삭제',
                    className: 'btn btn-danger',
                    onclick: 'dragDropManager.removeMaterialFromScene("' + sceneId + '", "' + placement.id + '")'
                },
                {
                    text: '닫기',
                    className: 'btn btn-primary',
                    onclick: 'utils.closeModal("info-modal")'
                }
            ]
        );
    },

    // 장면에서 자재 제거
    removeMaterialFromScene: function(sceneId, placementId) {
        if (!appState.sceneMaterialPositions || !appState.sceneMaterialPositions[sceneId]) return;

        var placements = appState.sceneMaterialPositions[sceneId];
        var removedPlacement = null;

        for (var i = 0; i < placements.length; i++) {
            if (placements[i].id === placementId) {
                removedPlacement = placements.splice(i, 1)[0];
                break;
            }
        }

        if (removedPlacement) {
            // 배지 제거
            var badge = document.querySelector('.material-badge[data-placement-id="' + placementId + '"]');
            if (badge) {
                badge.remove();
            }

            // 자재 목록 업데이트
            this.updateMaterialList(sceneId);

            // 3단계 완료 상태 확인
            if (appState.currentStep === 3) {
                stepController.checkStep3Completion();
            }

            utils.showSuccess('자재 "' + removedPlacement.materialName + '"이(가) 제거되었습니다.');
        }
    },

    // 자재 이동 시작
    startMaterialMove: function(sceneId, placementId) {
        utils.closeModal('info-modal');

        var sceneContainer = document.querySelector('.scene-workspace-item[data-scene-id="' + sceneId + '"]');
        if (!sceneContainer) return;

        var badge = sceneContainer.querySelector('.material-badge[data-placement-id="' + placementId + '"]');
        if (!badge) return;

        // 이동 모드 활성화
        badge.style.animation = 'pulse 1s infinite';
        badge.style.boxShadow = '0 0 10px #667eea';

        var self = this;
        var moveHandler = function(e) {
            var sceneImage = sceneContainer.querySelector('.scene-workspace-image');
            var imageRect = sceneImage.getBoundingClientRect();

            var clickX = e.clientX - imageRect.left;
            var clickY = e.clientY - imageRect.top;

            var normalizedX = clickX / imageRect.width;
            var normalizedY = clickY / imageRect.height;

            if (normalizedX >= 0 && normalizedX <= 1 && normalizedY >= 0 && normalizedY <= 1) {
                self.moveMaterial(sceneId, placementId, normalizedX, normalizedY);

                sceneContainer.removeEventListener('click', moveHandler);
                badge.style.animation = '';
                badge.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
            }
        };

        sceneContainer.addEventListener('click', moveHandler);
        utils.showInfo('새로운 위치를 클릭하세요.');
    },

    // 자재 위치 이동
    moveMaterial: function(sceneId, placementId, newNormalizedX, newNormalizedY) {
        if (!appState.sceneMaterialPositions || !appState.sceneMaterialPositions[sceneId]) return;

        var placements = appState.sceneMaterialPositions[sceneId];
        var targetPlacement = null;

        for (var i = 0; i < placements.length; i++) {
            if (placements[i].id === placementId) {
                targetPlacement = placements[i];
                break;
            }
        }

        if (targetPlacement) {
            targetPlacement.normalizedX = newNormalizedX;
            targetPlacement.normalizedY = newNormalizedY;

            // 배지 위치 업데이트
            var badge = document.querySelector('.material-badge[data-placement-id="' + placementId + '"]');
            if (badge) {
                badge.style.left = (newNormalizedX * 100) + '%';
                badge.style.top = (newNormalizedY * 100) + '%';
            }

            utils.showSuccess('자재 위치가 이동되었습니다.');
        }
    },

    // 자재 목록 업데이트
    updateMaterialList: function(sceneId) {
        var listContainer = document.querySelector('#scene-' + sceneId + '-material-list');
        if (!listContainer) return;

        var placements = appState.sceneMaterialPositions[sceneId] || [];

        if (placements.length === 0) {
            listContainer.innerHTML = '<p class="empty-state">배치된 자재가 없습니다.</p>';
            return;
        }

        var html = '<div class="material-list">';
        html += '<h4>배치된 자재 목록</h4>';
        html += '<ul>';

        for (var i = 0; i < placements.length; i++) {
            var placement = placements[i];
            html += '<li>';
            html += '<span class="material-number">' + placement.number + '</span>';
            html += '<span class="material-name">' + placement.materialName + '</span>';
            html += '<span class="material-category">(' + placement.materialCategory + ')</span>';
            html += '</li>';
        }

        html += '</ul></div>';
        listContainer.innerHTML = html;
    },

    // 장면별 배치된 자재 초기화
    clearSceneMaterials: function(sceneId) {
        if (appState.sceneMaterialPositions && appState.sceneMaterialPositions[sceneId]) {
            delete appState.sceneMaterialPositions[sceneId];
        }

        var badgeContainer = document.querySelector('.scene-workspace-item[data-scene-id="' + sceneId + '"] .material-badges');
        if (badgeContainer) {
            badgeContainer.remove();
        }

        this.updateMaterialList(sceneId);
    },

    // 모든 자재 배치 초기화
    clearAllMaterials: function() {
        appState.sceneMaterialPositions = {};
        this.materialCounter = 1;

        var badgeContainers = document.querySelectorAll('.material-badges');
        for (var i = 0; i < badgeContainers.length; i++) {
            badgeContainers[i].remove();
        }

        var listContainers = document.querySelectorAll('[id$="-material-list"]');
        for (var i = 0; i < listContainers.length; i++) {
            listContainers[i].innerHTML = '<p class="empty-state">배치된 자재가 없습니다.</p>';
        }
    },

    // 이벤트 바인딩
    bindEvents: function() {
        var self = this;

        // 자재표 로드 후 드래그 소스 재설정
        document.addEventListener('materialTableUpdated', function() {
            setTimeout(function() {
                self.setupMaterialDragSources();
            }, 100);
        });

        // 장면 선택 변경 후 드롭 타겟 재설정
        document.addEventListener('sceneSelectionChanged', function() {
            setTimeout(function() {
                self.setupSceneDropTargets();
            }, 100);
        });
    },

    // 데이터 유효성 검사
    validateMaterialPlacements: function() {
        if (!appState.sceneMaterialPositions) return true;

        var isValid = true;
        for (var sceneId in appState.sceneMaterialPositions) {
            var placements = appState.sceneMaterialPositions[sceneId];
            for (var i = 0; i < placements.length; i++) {
                var placement = placements[i];

                if (!placement.id || !placement.materialName ||
                    typeof placement.normalizedX !== 'number' ||
                    typeof placement.normalizedY !== 'number') {
                    console.warn('잘못된 자재 배치 데이터:', placement);
                    isValid = false;
                }
            }
        }

        return isValid;
    },

    // 드래그 커서 표시
    showDragCursor: function(e, sceneImage) {
        var cursorId = 'drag-cursor-indicator';
        var existingCursor = document.getElementById(cursorId);

        if (!existingCursor) {
            var cursor = document.createElement('div');
            cursor.id = cursorId;
            cursor.style.cssText =
                'position: fixed; width: 20px; height: 20px; ' +
                'background: rgba(102, 126, 234, 0.8); ' +
                'border: 2px solid #667eea; ' +
                'border-radius: 50%; ' +
                'pointer-events: none; ' +
                'z-index: 9999; ' +
                'transform: translate(-50%, -50%);';
            document.body.appendChild(cursor);
            existingCursor = cursor;
        }

        // 이미지 영역 내에서만 표시
        var imageRect = sceneImage.getBoundingClientRect();
        var isInImage = (e.clientX >= imageRect.left && e.clientX <= imageRect.right &&
                        e.clientY >= imageRect.top && e.clientY <= imageRect.bottom);

        if (isInImage) {
            existingCursor.style.left = e.clientX + 'px';
            existingCursor.style.top = e.clientY + 'px';
            existingCursor.style.display = 'block';
        } else {
            existingCursor.style.display = 'none';
        }
    },

    // 드래그 커서 숨기기
    hideDragCursor: function() {
        var cursor = document.getElementById('drag-cursor-indicator');
        if (cursor) {
            cursor.style.display = 'none';
        }
    }
};

// 애플리케이션 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('착공도서 자동생성 시스템 초기화 중...');

    // 브라우저 호환성 검사
    if (!utils.checkBrowserSupport()) {
        return; // 호환성 문제 시 초기화 중단
    }

    try {
        // 각 매니저 초기화
        fileUploadManager.init();
        stepController.init();
        workspaceManager.init();
        dragDropManager.init();

        console.log('초기화 완료');

        // 초기화 완료 후 사용자 안내
        setTimeout(function() {
            var hasVisited = localStorage.getItem('construction_docs_visited');
            if (!hasVisited) {
                utils.showSuccess(
                    '착공도서 자동생성 시스템에 오신 것을 환영합니다!\n\n' +
                    '1단계부터 차례대로 파일을 업로드해 주세요.\n' +
                    '엑셀 자재표, 미니맵 이미지, 장면 이미지들을 준비해 주세요.',
                    '시작하기',
                    function() {
                        localStorage.setItem('construction_docs_visited', 'true');
                    }
                );
            }
        }, 1000);

    } catch (error) {
        console.error('초기화 오류:', error);
        utils.showError(
            '애플리케이션 초기화 중 오류가 발생했습니다.\n' +
            '페이지를 새로고침하거나 브라우저를 재시작해 주세요.\n\n' +
            '오류 상세: ' + error.message,
            '초기화 실패'
        );
    }
});

// 전역 함수로 노출 (HTML에서 사용)
window.closeModal = function(modalId) {
    utils.closeModal(modalId);
};

// dragDropManager 메소드를 전역으로 노출
window.dragDropManager = dragDropManager;

// 전역 오류 처리
window.addEventListener('error', function(event) {
    console.error('전역 오류:', event.error);
    utils.showError(
        '예상치 못한 오류가 발생했습니다.\n' +
        '페이지를 새로고침해 주세요.\n\n' +
        '지속적으로 문제가 발생하면 브라우저를 변경해 보세요.',
        '시스템 오류'
    );
});

// 처리되지 않은 Promise 거부 처리
window.addEventListener('unhandledrejection', function(event) {
    console.error('처리되지 않은 Promise 거부:', event.reason);
    utils.showError(
        '데이터 처리 중 오류가 발생했습니다.\n' +
        '작업을 다시 시도해 주세요.',
        'Promise 오류'
    );
});