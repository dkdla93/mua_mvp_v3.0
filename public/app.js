/**
 * 착공도서 자동생성 시스템 - 메인 애플리케이션 로직
 * Construction Document Auto Generator - Main Application Logic
 */

'use strict';

// 현재 세션의 이미지 데이터를 메모리에 저장 (localStorage에 저장하지 않음)
var sessionImageCache = {};

// 전역 애플리케이션 상태 - 일반 객체 사용
var appState = {
    // 기본 설정
    currentStep: 1,
    currentProcess: 'process_1',
    currentSelectedScene: 0,
    nextPositionNumber: 1,

    // 데이터
    processes: [
        {
            id: 'process_1',
            name: '공정1',
            selectedScenes: [],
            isActive: true
        }
    ],
    sceneImages: [],
    excelData: null,
    materials: [],
    minimapImage: null,
    allSheets: {},
    materialsBySheet: {},
    currentSheet: null,

    // 매핑 데이터
    sceneMaterialMapping: {
        process_1: {}
    },
    sceneMaterialPositions: {
        process_1: {}
    },
    sceneMaterialAssignments: {
        process_1: {}
    },
    minimapBoxes: {
        process_1: {}
    }
};

// StateManager 초기화 상태 확인 및 기존 데이터 병합
(function initializeAppState() {
    // StateManager가 로드되어 있지 않으면 건너뜀
    if (typeof stateManager === 'undefined') {
        console.log('StateManager 없음 - 기존 appState 사용');
        return;
    }

    console.log('StateManager 기반 상태 초기화 시작...');

    // 기존 상태가 있으면 로드, 없으면 기본값 사용
    var currentState = stateManager.getState();

    if (!currentState.processes || currentState.processes.length === 0) {
        // 기본 공정 설정
        stateManager.updateState('processes', [
            {
                id: 'process_1',
                name: '공정1',
                selectedScenes: [],
                isActive: true
            }
        ]);
        stateManager.updateState('currentProcess', 'process_1');
    }

    // 초기값 설정 (있으면 유지, 없으면 생성)
    var defaultValues = {
        'currentStep': 1,
        'currentSelectedScene': 0,
        'nextPositionNumber': 1,
        'sceneMaterialMapping.process_1': {},
        'sceneMaterialPositions.process_1': {},
        'sceneMaterialAssignments.process_1': {}, // 자재-장면 매칭 상태 저장
        'minimapBoxes.process_1': {},
        'sceneImages': [],
        'excelData': null,
        'materials': [],
        'minimapImage': null,
        'allSheets': {},
        'materialsBySheet': {},
        'currentSheet': null
    };

    Object.keys(defaultValues).forEach(function(key) {
        if (stateManager.getState(key) === undefined) {
            stateManager.updateState(key, defaultValues[key]);
        }
    });

    console.log('StateManager 기반 상태 초기화 완료');
    console.log('현재 상태:', stateManager.getInfo());
})();

// FileProcessor 연결 헬퍼 함수들
var fileUtils = {
    /**
     * 안전한 파일 처리 래퍼
     */
    processFile: function(file, type, onProgress) {
        return fileProcessor.processFile(file, {
            type: type,
            onProgress: onProgress,
            optimize: type === 'image' ? { maxWidth: 1920, maxHeight: 1080 } : false
        }).catch(function(error) {
            console.error('FileProcessor 오류:', error);
            utils.showError('파일 처리 중 오류가 발생했습니다: ' + error.message);
            throw error;
        });
    },

    /**
     * 여러 파일 배치 처리
     */
    processFiles: function(files, type, onProgress) {
        return fileProcessor.processFiles(files, {
            type: type,
            onProgress: onProgress
        }).catch(function(error) {
            console.error('파일들 처리 오류:', error);
            utils.showError('파일들 처리 중 오류가 발생했습니다: ' + error.message);
            throw error;
        });
    }
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
        eventManager.addListener(document, 'keydown', closeHandler);
    }
};

// 파일 업로드 관리자
var fileUploadManager = {
    uploadProgress: {},
    maxFileSizes: {
        excel: 10 * 1024 * 1024, // 10MB
        image: 50 * 1024 * 1024  // 50MB
    },

    initialized: false,

    init: function() {
        // 중복 초기화 방지
        if (this.initialized) {
            console.log('⏭️ fileUploadManager 이미 초기화됨, 건너뜀');
            return;
        }

        console.log('📋 fileUploadManager.init() 시작...');

        try {
            // DOM이 준비되었는지 확인 (경고만 출력, 오류 던지지 않음)
            var domReady = this.checkDOMReady();
            if (!domReady) {
                console.warn('⚠️ 일부 DOM 요소가 준비되지 않았지만 초기화를 계속합니다.');
            }

            // 각 단계별 초기화 (개별 try-catch로 부분 실패 허용)
            this.setupProgressTracking();
            this.setupDragAndDrop();
            this.setupFileInputs();

            this.initialized = true;
            console.log('✅ fileUploadManager 초기화 완료');
        } catch (error) {
            console.error('💥 fileUploadManager 초기화 중 치명적 오류:', error);
            // 기본 파일 업로드만이라도 설정
            this.setupBasicFileUpload();
        }
    },

    // DOM 준비 상태 확인 (오류 대신 true/false 반환)
    checkDOMReady: function() {
        console.log('🔍 DOM 준비 상태 확인...');

        var requiredElements = [
            'excel-upload', 'minimap-upload', 'scenes-upload',
            'excel-file', 'minimap-file', 'scenes-files'
        ];

        var missingElements = [];

        for (var i = 0; i < requiredElements.length; i++) {
            var element = document.getElementById(requiredElements[i]);
            if (!element) {
                missingElements.push(requiredElements[i]);
            }
        }

        if (missingElements.length > 0) {
            console.warn('⚠️ 일부 DOM 요소 누락:', missingElements);
            return false;
        }

        console.log('✅ 모든 필수 DOM 요소 확인됨');
        return true;
    },

    // 기본 파일 업로드 기능 (폴백용)
    setupBasicFileUpload: function() {
        console.log('🔧 기본 파일 업로드 설정...');

        var fileInputs = [
            { id: 'excel-file', name: '엑셀 파일' },
            { id: 'minimap-file', name: '미니맵 파일' },
            { id: 'scenes-files', name: '장면 파일들' }
        ];

        for (var i = 0; i < fileInputs.length; i++) {
            var input = document.getElementById(fileInputs[i].id);
            if (input) {
                console.log('📁 기본 파일 입력 설정:', fileInputs[i].name);
                input.addEventListener('change', function(e) {
                    if (e.target.files.length > 0) {
                        console.log('✅ 파일 선택됨:', e.target.files[0].name);
                    }
                });
            }
        }

        console.log('✅ 기본 파일 업로드 설정 완료');
    },

    setupDragAndDrop: function() {
        var uploadAreas = document.querySelectorAll('.file-upload-area');
        var self = this;

        for (var i = 0; i < uploadAreas.length; i++) {
            var area = uploadAreas[i];

            // 기본 addEventListener 사용 (eventManager 없이)
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

                self.handleFiles(files, uploadType);
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
        console.log('🔧 setupFileInputs 시작...');
        var self = this;

        // 전체 업로드 영역을 클릭 가능하게 설정 (안전하게)
        try {
            this.setupClickableUploadAreas();
        } catch (error) {
            console.error('❌ 클릭 가능한 영역 설정 실패:', error);
        }

        // 엑셀 파일 입력 - 기본 addEventListener 사용
        try {
            console.log('📊 엑셀 파일 입력 설정...');
            var excelInput = document.getElementById('excel-file');
            if (excelInput) {
                console.log('✅ 엑셀 파일 입력 요소 발견:', excelInput);
                excelInput.addEventListener('change', function(e) {
                    console.log('📊 Excel 파일 선택됨:', e.target.files.length, '개');
                    if (e.target.files.length > 0) {
                        console.log(' - 파일명:', e.target.files[0].name);
                        console.log(' - 파일크기:', (e.target.files[0].size / (1024*1024)).toFixed(2), 'MB');
                        console.log('🚀 Excel 파일 처리 시작...');
                        self.handleFiles(e.target.files, 'excel-upload');
                    } else {
                        console.warn('⚠️ 엑셀 파일이 선택되지 않음');
                    }
                });
            } else {
                console.error('❌ 엑셀 파일 입력 요소를 찾을 수 없습니다.');
            }
        } catch (error) {
            console.error('❌ 엑셀 파일 입력 설정 실패:', error);
        }

        // 미니맵 파일 입력 - 기본 addEventListener 사용
        try {
            console.log('🗺️ 미니맵 파일 입력 설정...');
            var minimapInput = document.getElementById('minimap-file');
            if (minimapInput) {
                console.log('✅ 미니맵 파일 입력 요소 발견:', minimapInput);
                minimapInput.addEventListener('change', function(e) {
                    console.log('🗺️ Minimap 파일 선택됨:', e.target.files.length, '개');
                    if (e.target.files.length > 0) {
                        console.log(' - 파일명:', e.target.files[0].name);
                        console.log(' - 파일크기:', (e.target.files[0].size / (1024*1024)).toFixed(2), 'MB');
                        console.log('🚀 미니맵 파일 처리 시작...');
                        self.handleFiles(e.target.files, 'minimap-upload');
                    } else {
                        console.warn('⚠️ 미니맵 파일이 선택되지 않음');
                    }
                });
            } else {
                console.error('❌ 미니맵 파일 입력 요소를 찾을 수 없습니다.');
            }
        } catch (error) {
            console.error('❌ 미니맵 파일 입력 설정 실패:', error);
        }

        // 장면 이미지 파일 입력 - 기본 addEventListener 사용
        try {
            console.log('🏠 장면 파일 입력 설정...');
            var scenesInput = document.getElementById('scenes-files');
            if (scenesInput) {
                console.log('✅ 장면 파일 입력 요소 발견:', scenesInput);
                scenesInput.addEventListener('change', function(e) {
                    console.log('🏠 Scene 파일들 선택됨:', e.target.files.length, '개');
                    if (e.target.files.length > 0) {
                        var totalSize = 0;
                        for (var i = 0; i < e.target.files.length; i++) {
                            console.log(' - 파일', (i+1) + ':', e.target.files[i].name,
                                '(' + (e.target.files[i].size / (1024*1024)).toFixed(2) + 'MB)');
                            totalSize += e.target.files[i].size;
                        }
                        console.log(' - 총 크기:', (totalSize / (1024*1024)).toFixed(2), 'MB');
                        console.log('🚀 장면 파일들 처리 시작...');
                        self.handleFiles(e.target.files, 'scenes-upload');
                    } else {
                        console.warn('⚠️ 장면 파일이 선택되지 않음');
                    }
                });
            } else {
                console.error('❌ 장면 파일 입력 요소를 찾을 수 없습니다.');
            }
        } catch (error) {
            console.error('❌ 장면 파일 입력 설정 실패:', error);
        }

        // 파일 입력 초기화 (재선택 허용)
        try {
            this.setupFileInputReset();
        } catch (error) {
            console.error('❌ 파일 입력 리셋 설정 실패:', error);
        }

        console.log('✅ setupFileInputs 완료');
    },

    // 전체 업로드 영역을 클릭 가능하게 설정 - 완전히 재작성
    setupClickableUploadAreas: function() {
        console.log('🔧 setupClickableUploadAreas 시작...');
        var self = this;

        try {
            var uploadAreas = document.querySelectorAll('.file-upload-area');
            console.log('📦 찾은 업로드 영역 개수:', uploadAreas.length);

            if (uploadAreas.length === 0) {
                console.error('❌ 업로드 영역을 찾을 수 없습니다. DOM이 준비되지 않았을 수 있습니다.');
                return;
            }

            // 각 업로드 영역에 대해 개별적으로 처리 (클로저 문제 해결)
            for (var i = 0; i < uploadAreas.length; i++) {
                this.setupSingleUploadArea(uploadAreas[i]);
            }

            console.log('✅ setupClickableUploadAreas 완료');
        } catch (error) {
            console.error('💥 setupClickableUploadAreas 오류:', error);
        }
    },

    // 개별 업로드 영역 설정 (클로저 문제 해결)
    setupSingleUploadArea: function(area) {
        var self = this;
        var uploadId = area.id;
        var inputId = this.getInputIdFromUploadId(uploadId);

        console.log('🎯 업로드 영역 설정:', uploadId, '→', inputId);

        if (!inputId) {
            console.error('❌ 매핑되지 않은 업로드 ID:', uploadId);
            return;
        }

        area.classList.add('clickable');

        // 클릭 이벤트 핸들러 - 클로저로 uploadId와 inputId 보존
        var clickHandler = function(e) {
            console.log('🖱️ 업로드 영역 클릭:', uploadId, 'target:', e.target.tagName);

            // 버튼이나 액션 영역, 또는 INPUT 요소 자체 클릭 시 무시
            if (self.shouldIgnoreClick(e.target)) {
                console.log('⏭️ 클릭 무시됨 (버튼, 액션 영역, 또는 INPUT 요소)');
                return;
            }

            // 이벤트 전파 방지 (중복 호출 방지)
            e.stopPropagation();
            e.preventDefault();

            // 파일 입력 요소 찾기 및 클릭
            var input = document.getElementById(inputId);
            if (input) {
                console.log('🚀 파일 입력 요소 클릭 실행:', inputId);
                try {
                    input.click();
                } catch (clickError) {
                    console.error('💥 input.click() 실행 오류:', clickError);
                }
            } else {
                console.error('❌ 파일 입력 요소를 찾을 수 없음:', inputId);
            }
        };

        // 이벤트 리스너 등록
        area.addEventListener('click', clickHandler);
        console.log('✅ 클릭 이벤트 등록 완료:', uploadId);
    },

    // 클릭 무시 여부 판단
    shouldIgnoreClick: function(target) {
        return target.tagName === 'INPUT' ||
               target.classList.contains('btn') ||
               target.classList.contains('btn-reset') ||
               target.closest('.btn') ||
               target.closest('.file-status-actions');
    },

    // 업로드 ID에서 입력 ID 매핑
    getInputIdFromUploadId: function(uploadId) {
        var mapping = {
            'excel-upload': 'excel-file',
            'minimap-upload': 'minimap-file',
            'scenes-upload': 'scenes-files'
        };
        return mapping[uploadId] || '';
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
        console.log('📁 handleFiles 호출됨:', {
            fileCount: files ? files.length : 0,
            uploadType: uploadType,
            files: files
        });

        if (!files || files.length === 0) {
            console.warn('⚠️ 처리할 파일이 없습니다');
            return;
        }

        console.log('🔄 파일 처리 시작:', uploadType);

        try {
            switch(uploadType) {
                case 'excel-upload':
                    console.log('📊 Excel 파일 처리:', files[0].name, '크기:', files[0].size);
                    this.handleExcelFile(files[0]);
                    break;
                case 'minimap-upload':
                    console.log('🗺️ Minimap 파일 처리:', files[0].name, '크기:', files[0].size);
                    this.handleMinimapFile(files[0]);
                    break;
                case 'scenes-upload':
                    console.log('🏠 Scene 파일들 처리:', files.length, '개 파일');
                    this.handleSceneFiles(files);
                    break;
                default:
                    console.error('❌ 알 수 없는 업로드 타입:', uploadType);
                    this.showFileStatus(this.getStatusIdFromUploadType(uploadType),
                        '지원하지 않는 파일 타입입니다.', 'error');
            }
        } catch (error) {
            console.error('💥 파일 처리 중 오류 발생:', error);
            this.showFileStatus(this.getStatusIdFromUploadType(uploadType),
                '파일 처리 중 오류가 발생했습니다: ' + error.message, 'error');
        }
    },

    // 업로드 타입에서 상태 ID 매핑
    getStatusIdFromUploadType: function(uploadType) {
        var mapping = {
            'excel-upload': 'excel-status',
            'minimap-upload': 'minimap-status',
            'scenes-upload': 'scenes-status'
        };
        return mapping[uploadType] || 'unknown-status';
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
                excelParser.parseWorkbook(workbook, file.name.normalize('NFC'));

                // 성공 상태 표시
                var materialCount = appState.materials.length;
                var statusMessage = '✅ 엑셀 파일 업로드 완료 (' + materialCount + '개 자재 추출)';

                // 엑셀 시트별 정보 표시 (실제 파싱된 자재 개수 기준)
                if (appState.allSheets && Object.keys(appState.allSheets).length > 0) {
                    statusMessage += '<div class="excel-sheet-info">';
                    statusMessage += '<strong>업로드된 시트:</strong><br>';
                    var sheetNames = Object.keys(appState.allSheets);
                    for (var i = 0; i < sheetNames.length; i++) {
                        var sheetName = sheetNames[i];
                        // A.로 시작하는 표지 시트는 제외
                        if (sheetName.indexOf('A.') !== 0) {
                            var sheetData = appState.allSheets[sheetName];
                            var totalRows = sheetData && sheetData.length ? sheetData.length : 0;

                            // 실제 파싱된 자재 개수 및 MATERIAL 종류 가져오기
                            var actualMaterialCount = 0;
                            var materialTypes = [];
                            if (appState.materialsBySheet && appState.materialsBySheet[sheetName]) {
                                var materials = appState.materialsBySheet[sheetName];
                                actualMaterialCount = materials.length;

                                // 중복 제거하여 유니크한 MATERIAL 목록 생성
                                var uniqueMaterials = {};
                                for (var j = 0; j < materials.length; j++) {
                                    var material = materials[j];
                                    if (material.material && material.material.trim()) {
                                        uniqueMaterials[material.material] = true;
                                    }
                                }
                                materialTypes = Object.keys(uniqueMaterials);
                            }

                            statusMessage += '<div class="excel-sheet-item">';
                            statusMessage += '<span class="sheet-summary">';
                            statusMessage += '<strong>' + sheetName + '</strong> 총 <span class="material-count">' + actualMaterialCount + '개 자재</span>';
                            if (materialTypes.length > 0) {
                                statusMessage += ' <span class="material-types">(' + materialTypes.join(', ') + ')</span>';
                            }
                            statusMessage += '</span>';
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
                    // 미니맵을 장면 이미지와 동일한 구조로 저장
                    var minimapId = 'minimap_' + Date.now();
                    sessionImageCache[minimapId] = e.target.result;

                    appState.minimapImage = {
                        id: minimapId,
                        name: file.name.normalize('NFC'), // 한글 파일명 정규화
                        data: 'current_session_stored',
                        width: img.width,
                        height: img.height,
                        size: file.size
                    };

                    console.log('🗺️ 미니맵 이미지 저장 완료:', {
                        id: minimapId,
                        name: file.name.normalize('NFC'),
                        size: file.size,
                        dimensions: img.width + 'x' + img.height
                    });

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
        // 파일 개수 검증 (최대 200개)
        if (!this.validateMultipleFiles(files, 200)) return;

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
                        var sceneId = 'scene_' + Date.now() + '_' + index;

                        // 실제 이미지 데이터는 메모리 캐시에 저장
                        sessionImageCache[sceneId] = e.target.result;

                        // appState에는 메타데이터만 저장
                        appState.sceneImages.push({
                            id: sceneId, // 고유 ID 추가
                            name: file.name.normalize('NFC'), // 한글 파일명 정규화 (macOS NFD -> NFC)
                            data: 'current_session_stored', // localStorage에 저장되지 않음을 표시
                            index: index,
                            width: img.width,
                            height: img.height,
                            size: file.size,
                            isCurrentSession: true // 현재 세션에서 업로드된 이미지 표시
                        });

                        // 메모리 캐시에 저장 완료

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

                        console.log('✅ 장면 파일 업로드 완료:', successCount + '개 성공');
                        console.log('📋 메모리 캐시 보존:', Object.keys(sessionImageCache).length + '개 이미지');

                        // 결과 메시지 구성
                        var statusMessage = '';
                        if (successCount > 0) {
                            statusMessage += '✅ ' + successCount + '개의 장면 이미지 업로드 완료';

                            // 썸네일 표시 추가 (가로 그리드 형태)
                            statusMessage += '<div class="scenes-thumbnails-grid">';
                            for (var i = 0; i < appState.sceneImages.length; i++) {
                                var scene = appState.sceneImages[i];
                                var sceneName = scene.name || '장면 ' + (i + 1);
                                var thumbnailSrc = '';

                                // 메모리 캐시에서 이미지 데이터 가져오기
                                if (scene.id && sessionImageCache[scene.id]) {
                                    thumbnailSrc = sessionImageCache[scene.id];
                                } else if (scene.data && scene.data.startsWith && scene.data.startsWith('data:image/')) {
                                    thumbnailSrc = scene.data;
                                }

                                statusMessage += '<div class="scene-thumbnail-item">';
                                if (thumbnailSrc) {
                                    statusMessage += '<img src="' + thumbnailSrc + '" class="scene-thumbnail" alt="' + sceneName + '">';
                                } else {
                                    statusMessage += '<div class="scene-placeholder-small">🖼️</div>';
                                }
                                statusMessage += '<div class="scene-thumbnail-name">' + sceneName + '</div>';
                                statusMessage += '</div>';
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

                        // 장면 업로드 영역에 has-files 클래스 추가 (그리드 확장용)
                        var scenesUploadArea = document.getElementById('scenes-upload');
                        if (scenesUploadArea && successCount > 0) {
                            scenesUploadArea.classList.add('has-files');
                        }

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
        maxCount = maxCount || 200; // 기본 최대 200개

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
            // has-files 클래스 제거
            uploadArea.classList.remove('has-files');
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
        var self = this;

        // 1단계 다음 버튼 - 직접 이벤트 바인딩
        var nextStep1Btn = document.getElementById('next-step-1');
        if (nextStep1Btn) {
            nextStep1Btn.addEventListener('click', function() {
                console.log('1단계 → 2단계 이동');
                self.goToStep(2);
            });
        }

        // 2단계 버튼들 - 직접 이벤트 바인딩
        var prevStep2Btn = document.getElementById('prev-step-2');
        if (prevStep2Btn) {
            prevStep2Btn.addEventListener('click', function() {
                console.log('2단계 → 1단계 이동');
                self.goToStep(1);
            });
        }

        var nextStep2Btn = document.getElementById('next-step-2');
        if (nextStep2Btn) {
            nextStep2Btn.addEventListener('click', function() {
                console.log('2단계 → 3단계 이동');
                self.goToStep(3);
            });
        }

        // 3단계 버튼들 - 직접 이벤트 바인딩
        var prevStep3Btn = document.getElementById('prev-step-3');
        if (prevStep3Btn) {
            prevStep3Btn.addEventListener('click', function() {
                console.log('3단계 → 2단계 이동');
                self.goToStep(2);
            });
        }

        var nextStep3Btn = document.getElementById('next-step-3');
        if (nextStep3Btn) {
            nextStep3Btn.addEventListener('click', function() {
                console.log('3단계 → 4단계 이동');
                self.goToStep(4);
            });
        }

        // 4단계 버튼들 - 직접 이벤트 바인딩
        var prevStep4Btn = document.getElementById('prev-step-4');
        if (prevStep4Btn) {
            prevStep4Btn.addEventListener('click', function() {
                console.log('4단계 → 3단계 이동');
                self.goToStep(3);
            });
        }

        var generatePptBtn = document.getElementById('generate-ppt');
        if (generatePptBtn) {
            generatePptBtn.addEventListener('click', function() {
                console.log('PPT 생성 시작');
                if (typeof stepController !== 'undefined' && stepController.generatePPT) {
                    stepController.generatePPT();
                } else {
                    console.error('PPT 생성 기능을 찾을 수 없습니다');
                    utils.showError('PPT 생성 기능이 초기화되지 않았습니다. 페이지를 새로고침해 주세요.');
                }
            });
        }

        console.log('네비게이션 버튼 이벤트 바인딩 완료');
    },

    goToStep: function(step) {
        var self = this;

        console.log('🔄 단계 전환:', appState.currentStep, '→', step);

        // 페이지 상단으로 부드럽게 스크롤
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });

        // 이전 단계 요소들
        var currentStepElement = document.querySelector('.step[data-step="' + appState.currentStep + '"]');
        var currentContentElement = document.getElementById('step-' + appState.currentStep);

        // 새 단계 요소들
        var newStepElement = document.querySelector('.step[data-step="' + step + '"]');
        var newContentElement = document.getElementById('step-' + step);

        // 단계 전환 애니메이션 시작
        if (currentContentElement) {
            currentContentElement.classList.add('leaving');
        }

        // 약간의 지연 후 실제 전환 수행
        setTimeout(function() {
            // 이전 단계 비활성화
            if (currentStepElement) {
                currentStepElement.classList.remove('active');
                currentStepElement.classList.add('completed');
            }
            if (currentContentElement) {
                currentContentElement.classList.remove('active', 'leaving');
            }

            // 새 단계 활성화 준비
            if (newContentElement) {
                newContentElement.classList.add('entering');
                newContentElement.classList.add('active');
            }
            if (newStepElement) {
                newStepElement.classList.add('active');
                // 이전 단계들도 완료 상태로 표시
                for (var i = 1; i < step; i++) {
                    var prevStep = document.querySelector('.step[data-step="' + i + '"]');
                    if (prevStep) {
                        prevStep.classList.add('completed');
                    }
                }
            }

            // 상태 업데이트
            appState.currentStep = step;

            // 진입 애니메이션 완료
            setTimeout(function() {
                if (newContentElement) {
                    newContentElement.classList.remove('entering');
                }

                // 단계 변경 이벤트 발생
                var stepEvent = new CustomEvent('stepChanged', {
                    detail: { step: step, previousStep: appState.currentStep }
                });
                document.dispatchEvent(stepEvent);

                // 단계별 초기화 로직
                switch(step) {
                    case 2:
                        if (typeof processManager !== 'undefined' && processManager.init) {
                            processManager.init();
                        }
                        break;
                    case 3:
                        // workspaceManager가 stepChanged 이벤트를 받아서 초기화됨
                        self.checkStep3Completion();
                        break;
                    case 4:
                        // 생성 & 다운로드 단계 초기화
                        self.initStep4();
                        break;
                }

                console.log('✅ 단계 전환 완료:', step);
            }, 100);
        }, 200);
    },

    checkStep1Completion: function() {
        var hasExcel = appState.excelData !== null;
        var hasMinimap = appState.minimapImage !== null;
        var hasScenes = appState.sceneImages && appState.sceneImages.length > 0;

        var nextButton = document.getElementById('next-step-1');
        if (nextButton) {
            nextButton.disabled = !(hasExcel && hasMinimap && hasScenes);
        }
    },

    checkStep3Completion: function() {
        var hasAnyMaterialAssignment = false;

        // 자재 매칭 상태 확인 (sceneMaterialAssignments)
        if (appState.sceneMaterialAssignments) {
            for (var processId in appState.sceneMaterialAssignments) {
                var processAssignments = appState.sceneMaterialAssignments[processId];
                if (processAssignments) {
                    for (var sceneId in processAssignments) {
                        if (processAssignments[sceneId] && processAssignments[sceneId].length > 0) {
                            hasAnyMaterialAssignment = true;
                            break;
                        }
                    }
                }
                if (hasAnyMaterialAssignment) break;
            }
        }

        console.log('🔍 3단계 완료 상태 검사:', {
            hasAnyMaterialAssignment: hasAnyMaterialAssignment,
            sceneMaterialAssignments: appState.sceneMaterialAssignments
        });

        var nextButton = document.getElementById('next-step-3');
        if (nextButton) {
            nextButton.disabled = !hasAnyMaterialAssignment;

            if (hasAnyMaterialAssignment) {
                nextButton.title = '다음 단계로 진행합니다';
                nextButton.classList.remove('disabled');
            } else {
                nextButton.title = '최소 하나의 장면에 자재를 매칭해야 합니다';
                nextButton.classList.add('disabled');
            }

            console.log('🎯 3단계 다음 버튼 상태:', hasAnyMaterialAssignment ? '활성화' : '비활성화');
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

    // 크로스 플랫폼 한글 폰트 선택
    getKoreanFont: function() {
        var userAgent = navigator.userAgent || navigator.platform;
        var isMac = /Mac|iPhone|iPad|iPod/.test(userAgent);

        if (isMac) {
            return 'Apple SD Gothic Neo';
        } else {
            return '맑은 고딕';
        }
    },

    // PPT 생성
    generatePPT: function() {
        var self = this;
        utils.showLoading('PPT를 생성하고 있습니다...');

        // 비동기 처리를 위해 setTimeout 사용
        setTimeout(function() {
            try {
                console.log('PPT 생성 시작 - PptxGenJS 확인 중...');

                // PptxGenJS 라이브러리 확인
                if (typeof PptxGenJS === 'undefined') {
                    throw new Error('PPT 생성 라이브러리를 찾을 수 없습니다. PptxGenJS가 로드되지 않았습니다.');
                }

                console.log('PptxGenJS 확인 완료, PPT 인스턴스 생성 중...');
                var pptx = new PptxGenJS();

                // 표지 슬라이드 생성
                console.log('표지 슬라이드 생성 중...');
                self.createCoverSlide(pptx);

                // 각 공정별 슬라이드 생성
                console.log('공정별 슬라이드 생성 중...', appState.processes.length + '개 공정');
                for (var i = 0; i < appState.processes.length; i++) {
                    var process = appState.processes[i];
                    if (process.selectedScenes && process.selectedScenes.length > 0) {
                        console.log('공정 슬라이드 생성:', process.name);
                        self.createProcessSlide(pptx, process);
                    }
                }

                // 자재표 요약 슬라이드 생성
                console.log('자재표 요약 슬라이드 생성 중...');
                self.createMaterialSummarySlide(pptx);

                // 파일명 생성 (한글 파일명 지원)
                var fileName = '착공도서_' + new Date().toLocaleDateString('ko-KR').replace(/\./g, '-');
                console.log('PPT 다운로드 시도, 파일명:', fileName);

                // PPT 파일 다운로드 - Promise 기반 처리
                try {
                    // PptxGenJS writeFile() 메서드 호출 (v3.x 정확한 API)
                    var saveResult = pptx.writeFile({ fileName: fileName + '.pptx' });

                    // Promise를 반환하는 경우
                    if (saveResult && typeof saveResult.then === 'function') {
                        console.log('Promise 기반 저장 시도...');
                        saveResult.then(function() {
                            console.log('PPT 다운로드 성공!');
                            utils.hideLoading();
                            utils.showSuccess('PPT가 성공적으로 생성되고 다운로드되었습니다!');
                        }).catch(function(saveError) {
                            console.error('PPT 저장 오류:', saveError);
                            utils.hideLoading();

                            var errorMsg = 'PPT 저장 중 오류가 발생했습니다.\n\n';
                            if (saveError.message.includes('라이브러리가 로드되지')) {
                                errorMsg += '라이브러리 로딩 문제입니다. 페이지를 새로고침해주세요.';
                            } else {
                                errorMsg += '가능한 해결방법:\n';
                                errorMsg += '1. 브라우저에서 팝업/다운로드 차단을 해제해주세요\n';
                                errorMsg += '2. 다른 브라우저(Chrome, Firefox)를 사용해보세요\n';
                                errorMsg += '3. 시크릿/인코그니토 모드를 사용해보세요';
                            }
                            utils.showError(errorMsg);
                        });
                    } else {
                        // 동기식 저장 (일반적인 경우)
                        console.log('동기식 저장 완료');

                        // 다운로드 후 짧은 지연 후 성공 메시지
                        setTimeout(function() {
                            utils.hideLoading();

                            // 브라우저 다운로드 안내
                            var successMsg = 'PPT가 성공적으로 생성되었습니다!\n\n';
                            successMsg += '파일명: ' + fileName + '.pptx\n\n';
                            successMsg += '다운로드가 시작되지 않은 경우:\n';
                            successMsg += '• 브라우저 하단의 다운로드 표시줄 확인\n';
                            successMsg += '• 브라우저 다운로드 폴더 확인\n';
                            successMsg += '• 팝업 차단 해제 후 재시도';

                            utils.showSuccess(successMsg);
                        }, 500);
                    }
                } catch (saveError) {
                    console.error('PPT 저장 예외:', saveError);
                    utils.hideLoading();
                    utils.showError('PPT 저장 중 예외가 발생했습니다: ' + saveError.message + '\n\n페이지를 새로고침 후 다시 시도해주세요.');
                }

            } catch (error) {
                console.error('PPT 생성 오류:', error);
                console.error('Error stack:', error.stack);
                utils.hideLoading();

                var errorMessage = 'PPT 생성 중 오류가 발생했습니다: ' + error.message;
                if (error.message.includes('PptxGenJS')) {
                    errorMessage += '\n\n페이지를 새로고침 후 다시 시도해주세요.';
                }
                utils.showError(errorMessage);
            }
        }, 100); // 100ms 지연으로 UI 업데이트 보장
    },

    // 표지 슬라이드 생성
    createCoverSlide: function(pptx) {
        var koreanFont = this.getKoreanFont();
        var slide = pptx.addSlide();
        slide.addText('착공도서 자동생성 시스템', {
            x: 1, y: 2, w: 8, h: 1,
            fontSize: 36, color: '363636', bold: true, align: 'center',
            fontFace: koreanFont,
            lang: 'ko-KR'
        });
        slide.addText('인테리어 공사 착공도서', {
            x: 1, y: 3, w: 8, h: 0.5,
            fontSize: 24, color: '666666', align: 'center',
            fontFace: koreanFont,
            lang: 'ko-KR'
        });
        slide.addText('생성일: ' + new Date().toLocaleDateString('ko-KR'), {
            x: 1, y: 6, w: 8, h: 0.5,
            fontSize: 16, color: '888888', align: 'center',
            fontFace: koreanFont,
            lang: 'ko-KR'
        });
    },

    // 공정별 슬라이드 생성
    createProcessSlide: function(pptx, process) {
        if (!process.selectedScenes || process.selectedScenes.length === 0) {
            console.warn('공정에 선택된 장면이 없습니다:', process.name);
            return;
        }

        var koreanFont = this.getKoreanFont();

        for (var i = 0; i < process.selectedScenes.length; i++) {
            var sceneIndex = process.selectedScenes[i];
            var sceneData = appState.sceneImages[sceneIndex];

            if (!sceneData) {
                console.warn('장면 데이터를 찾을 수 없습니다:', sceneIndex);
                continue;
            }

            var slide = pptx.addSlide();

            slide.addText(process.name + ' - ' + sceneData.name, {
                x: 0.5, y: 0.3, w: 9, h: 0.5,
                fontSize: 20, color: '363636', bold: true,
                fontFace: koreanFont,
                lang: 'ko-KR'
            });

            var actualImageData = null;
            if (sceneData.data === 'current_session_stored' && sceneData.id && sessionImageCache[sceneData.id]) {
                actualImageData = sessionImageCache[sceneData.id];
            } else if (sceneData.data && sceneData.data !== 'current_session_stored') {
                actualImageData = sceneData.data;
            }

            if (actualImageData) {
                try {
                    slide.addImage({
                        data: actualImageData,
                        x: 0.5,
                        y: 0.9,
                        w: 6.5,
                        h: 2.33
                    });
                    console.log('슬라이드에 장면 이미지 추가 완료:', sceneData.name);
                } catch (error) {
                    console.error('이미지 추가 중 오류:', error);
                    slide.addText('이미지 로드 실패: ' + sceneData.name, {
                        x: 0.5, y: 2.0, w: 9, h: 1,
                        fontSize: 14, color: 'FF0000',
                        fontFace: koreanFont,
                        lang: 'ko-KR'
                    });
                }
            } else {
                console.warn('이미지 데이터를 찾을 수 없습니다:', sceneData.name);
                slide.addText('이미지 데이터 없음: ' + sceneData.name, {
                    x: 0.5, y: 2.0, w: 9, h: 1,
                    fontSize: 14, color: 'FF0000',
                    fontFace: koreanFont,
                    lang: 'ko-KR'
                });
            }

            var minimapData = null;
            if (appState.minimapImage) {
                if (appState.minimapImage.data === 'current_session_stored' && appState.minimapImage.id && sessionImageCache[appState.minimapImage.id]) {
                    minimapData = sessionImageCache[appState.minimapImage.id];
                } else if (appState.minimapImage.data && appState.minimapImage.data !== 'current_session_stored') {
                    minimapData = appState.minimapImage.data;
                }

                if (minimapData) {
                    try {
                        var minimapX = 7.2;
                        var minimapY = 0.9;
                        var minimapW = 2.3;
                        var minimapH = 2.33;

                        slide.addImage({
                            data: minimapData,
                            x: minimapX,
                            y: minimapY,
                            w: minimapW,
                            h: minimapH
                        });
                        console.log('슬라이드에 미니맵 추가 완료');

                        if (appState.minimapBoxes && appState.minimapBoxes[sceneIndex]) {
                            var boxData = appState.minimapBoxes[sceneIndex];

                            var boxX = minimapX + (boxData.x * minimapW);
                            var boxY = minimapY + (boxData.y * minimapH);
                            var boxW = boxData.width * minimapW;
                            var boxH = boxData.height * minimapH;

                            slide.addShape('rect', {
                                x: boxX,
                                y: boxY,
                                w: boxW,
                                h: boxH,
                                fill: { type: 'solid', color: 'FF0000', transparency: 70 },
                                line: { color: 'FF0000', width: 2 }
                            });
                            console.log('슬라이드에 빨간박스 추가 완료:', sceneData.name);
                        }
                    } catch (error) {
                        console.error('미니맵 추가 중 오류:', error);
                    }
                }
            }

            this.addMaterialTableToSlide(slide, process, sceneIndex);
        }
    },

    // 자재표 요약 슬라이드 생성
    createMaterialSummarySlide: function(pptx) {
        var koreanFont = this.getKoreanFont();
        var slide = pptx.addSlide();
        slide.addText('자재표 요약', {
            x: 0.5, y: 0.5, w: 9, h: 1,
            fontSize: 28, color: '363636', bold: true,
            fontFace: koreanFont,
            lang: 'ko-KR'
        });

        var summary = this.generateMaterialSummary();
        slide.addText(summary, {
            x: 0.5, y: 1.5, w: 9, h: 5,
            fontSize: 14, color: '555555',
            fontFace: koreanFont,
            lang: 'ko-KR'
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

    getMaterialInfoForScene: function(process, sceneIndex) {
        var materials = [];

        if (!appState.sceneMaterialAssignments || !process.id) {
            return materials;
        }

        var processAssignments = appState.sceneMaterialAssignments[process.id];
        if (!processAssignments || !processAssignments[sceneIndex]) {
            return materials;
        }

        var materialIds = processAssignments[sceneIndex];
        if (!materialIds || materialIds.length === 0) {
            return materials;
        }

        for (var i = 0; i < materialIds.length; i++) {
            var materialId = materialIds[i];
            var material = null;

            if (appState.materials) {
                for (var j = 0; j < appState.materials.length; j++) {
                    if (appState.materials[j].id === materialId) {
                        material = appState.materials[j];
                        break;
                    }
                }
            }

            if (material) {
                var materialText = '• ' + (material.material || material.MATERIAL || material['자재명'] || '자재');
                if (material.area || material.AREA || material['구역']) {
                    materialText += ' (' + (material.area || material.AREA || material['구역']) + ')';
                }
                materials.push(materialText);
            }
        }

        return materials;
    },

    addMaterialTableToSlide: function(slide, process, sceneIndex) {
        if (!appState.sceneMaterialAssignments || !process.id) {
            console.log('자재 매칭 데이터 없음');
            return;
        }

        var processAssignments = appState.sceneMaterialAssignments[process.id];
        if (!processAssignments || !processAssignments[sceneIndex]) {
            console.log('해당 장면에 매칭된 자재 없음');
            return;
        }

        var materialIds = processAssignments[sceneIndex];
        if (!materialIds || materialIds.length === 0) {
            console.log('자재 ID 목록이 비어있음');
            return;
        }

        var assignedMaterials = [];
        for (var i = 0; i < materialIds.length; i++) {
            var materialId = materialIds[i];
            var material = null;

            if (appState.materials) {
                for (var j = 0; j < appState.materials.length; j++) {
                    if (appState.materials[j].id === materialId) {
                        material = appState.materials[j];
                        break;
                    }
                }
            }

            if (material) {
                assignedMaterials.push(material);
            }
        }

        if (assignedMaterials.length === 0) {
            console.log('매칭된 자재를 찾을 수 없음');
            return;
        }

        var koreanFont = this.getKoreanFont();

        slide.addText('배치된 자재 상세 (' + assignedMaterials.length + '개)', {
            x: 0.5,
            y: 3.4,
            w: 9,
            h: 0.25,
            fontSize: 10,
            color: '363636',
            bold: true,
            fontFace: koreanFont,
            lang: 'ko-KR'
        });

        var tableRows = [];

        tableRows.push([
            { text: 'No.', options: { bold: true, fontSize: 8, color: 'FFFFFF', fill: '4472C4', align: 'center', valign: 'middle', fontFace: koreanFont } },
            { text: 'MATERIAL', options: { bold: true, fontSize: 8, color: 'FFFFFF', fill: '4472C4', align: 'center', valign: 'middle', fontFace: koreanFont } },
            { text: 'ITEM', options: { bold: true, fontSize: 8, color: 'FFFFFF', fill: '4472C4', align: 'center', valign: 'middle', fontFace: koreanFont } },
            { text: 'AREA', options: { bold: true, fontSize: 8, color: 'FFFFFF', fill: '4472C4', align: 'center', valign: 'middle', fontFace: koreanFont } },
            { text: 'REMARKS', options: { bold: true, fontSize: 8, color: 'FFFFFF', fill: '4472C4', align: 'center', valign: 'middle', fontFace: koreanFont } },
            { text: 'IMAGE', options: { bold: true, fontSize: 8, color: 'FFFFFF', fill: '4472C4', align: 'center', valign: 'middle', fontFace: koreanFont } }
        ]);

        var maxRows = 10;
        for (var i = 0; i < Math.min(assignedMaterials.length, maxRows); i++) {
            var mat = assignedMaterials[i];
            console.log('자재 데이터:', i, mat);

            var displayId = mat.displayId || (i + 1);
            var materialName = String(mat.material || mat.MATERIAL || mat['자재명'] || '-').replace(/[\r\n]+/g, ' ').trim();
            var item = String(mat.item || mat.ITEM || mat['품목'] || '-').replace(/[\r\n]+/g, ' ').trim();
            var area = String(mat.area || mat.AREA || mat['구역'] || '-').replace(/[\r\n]+/g, ' ').trim();
            var remarks = String(mat.remarks || mat.REMARKS || mat['비고'] || '-').replace(/[\r\n]+/g, ' ').trim();
            var imageIcon = (mat.image || mat.IMAGE || mat['이미지']) ? '🖼️' : '-';

            console.log('변환된 데이터:', {displayId: displayId, material: materialName, item: item, area: area, remarks: remarks, image: imageIcon});

            tableRows.push([
                { text: String(displayId), options: { fontSize: 8, color: '000000', align: 'center', valign: 'middle', fontFace: koreanFont } },
                { text: String(materialName), options: { fontSize: 8, color: '000000', align: 'left', valign: 'middle', fontFace: koreanFont } },
                { text: String(item), options: { fontSize: 8, color: '000000', align: 'left', valign: 'middle', fontFace: koreanFont } },
                { text: String(area), options: { fontSize: 8, color: '000000', align: 'center', valign: 'middle', fontFace: koreanFont } },
                { text: String(remarks), options: { fontSize: 8, color: '000000', align: 'left', valign: 'middle', fontFace: koreanFont } },
                { text: imageIcon, options: { fontSize: 8, color: '000000', align: 'center', valign: 'middle', fontFace: koreanFont } }
            ]);
        }

        slide.addTable(tableRows, {
            x: 0.5,
            y: 3.7,
            w: 9.0,
            h: 0.17 * tableRows.length,
            colW: [0.4, 2.8, 1.5, 1.8, 1.8, 0.7],
            border: { type: 'solid', pt: 1, color: 'CFCFCF' }
        });

        console.log('슬라이드에 자재표 추가 완료:', assignedMaterials.length + '개 자재');
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

            // 모든 시트에서 자재 데이터 추출 (A.로 시작하는 탭 제외)
            appState.materials = [];
            appState.materialsBySheet = {};
            var globalMaterialId = 1; // 전역 자재 넘버링

            for (var i = 0; i < sheetNames.length; i++) {
                var sheetName = sheetNames[i];

                // A.로 시작하는 시트는 표지이므로 스킵 (예: A.MAIN, A.표지 등)
                if (sheetName.indexOf('A.') === 0) {
                    console.log('표지 탭 스킵:', sheetName);
                    continue;
                }

                console.log('시트 "' + sheetName + '" 자재 추출 시작');
                appState.currentSheet = sheetName;
                appState.excelData = appState.allSheets[sheetName];

                // 각 시트별로 자재 추출 (전역 넘버링 전달)
                var sheetMaterials = this.extractMaterialsFromSheet(sheetName, globalMaterialId);
                appState.materialsBySheet[sheetName] = sheetMaterials;

                // 전역 넘버링 업데이트
                globalMaterialId += sheetMaterials.length;

                // 전체 자재 목록에 추가
                appState.materials = appState.materials.concat(sheetMaterials);
            }

            // 기본 시트 선택 (첫 번째 자료 시트)
            var firstDataSheet = null;
            for (var i = 0; i < sheetNames.length; i++) {
                if (sheetNames[i].indexOf('A.') !== 0) {
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

    // 특정 시트에서 자재 추출 (새로운 구조에 맞춘 1행 단위 처리)
    extractMaterialsFromSheet: function(sheetName, startMaterialId) {
        var sheetMaterials = [];
        var data = appState.allSheets[sheetName];

        if (!data || data.length === 0) {
            console.warn('시트 "' + sheetName + '" 데이터가 비어있습니다');
            return sheetMaterials;
        }

        console.log('🔍 시트 "' + sheetName + '"에서 자재 추출 시작 - 총', data.length, '행, 시작ID:', startMaterialId);

        // 데이터 구조 분석을 위한 상세 로깅 (모든 행 출력)
        console.log('📊 시트 데이터 구조 분석 - 전체 행:');
        for (var i = 0; i < data.length; i++) {
            console.log('행 ' + i + ':', data[i]);
            // MATERIAL 컬럼 특별 확인
            if (data[i] && data[i][0]) {
                var materialValue = String(data[i][0] || '').trim();
                if (materialValue && materialValue !== 'MATERIAL') {
                    console.log('  📌 A열 MATERIAL 값:', materialValue);
                }
            }
        }

        // 올바른 컬럼 매핑 (2행 단위 처리)
        var COLUMN_MAPPING = {
            MATERIAL: 0,    // A열: MATERIAL (병합된 셀)
            TYPE: 1,        // B열: "AREA" 또는 "ITEM" (항목 타입)
            VALUE: 2,       // C열: AREA 또는 ITEM 값
            REMARKS_TYPE: 3, // D열: "REMARKS" (AREA 행에만)
            REMARKS_VALUE: 4, // E열: REMARKS 값 (AREA 행에만)
            IMAGE: 5        // F열: IMAGE (2행 병합)
        };

        var currentMaterialId = startMaterialId || 1;

        // 헤더 행 찾기
        var headerRowIndex = this.findHeaderRow(data);
        var startRowIndex = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;

        console.log('📝 헤더 행 인덱스:', headerRowIndex, ', 데이터 시작 행:', startRowIndex);

        var currentMaterial = null; // 현재 처리 중인 MATERIAL 값

        // A열 MATERIAL 값 기반 처리 (새로운 접근법)
        console.log('🔄 A열 MATERIAL 기반 처리 시작:', { startRowIndex: startRowIndex, totalRows: data.length });

        // 1단계: 모든 MATERIAL 시작 행 찾기
        var materialStartRows = [];
        for (var i = startRowIndex; i < data.length; i++) {
            var row = data[i];
            if (row && row[COLUMN_MAPPING.MATERIAL]) {
                var materialValue = String(row[COLUMN_MAPPING.MATERIAL] || '').trim();
                if (materialValue && materialValue !== '' && materialValue !== 'MATERIAL') {
                    materialStartRows.push({ rowIndex: i, material: materialValue });
                    console.log('🎯 MATERIAL 시작 행 발견:', i, materialValue);
                }
            }
        }

        console.log('📋 발견된 MATERIAL 그룹:', materialStartRows.length + '개');

        // 2단계: 각 MATERIAL 그룹별로 처리
        for (var groupIndex = 0; groupIndex < materialStartRows.length; groupIndex++) {
            var materialGroup = materialStartRows[groupIndex];
            var nextGroup = materialStartRows[groupIndex + 1];

            // 현재 그룹의 범위 계산
            var groupStartRow = materialGroup.rowIndex;
            var groupEndRow = nextGroup ? nextGroup.rowIndex - 1 : data.length - 1;

            currentMaterial = materialGroup.material;

            console.log('🔍 MATERIAL 그룹 처리:', {
                material: currentMaterial,
                startRow: groupStartRow,
                endRow: groupEndRow,
                rowCount: groupEndRow - groupStartRow + 1
            });

            // 3단계: 해당 MATERIAL 그룹 내에서 AREA/ITEM 쌍 찾기
            for (var rowIndex = groupStartRow; rowIndex <= groupEndRow - 1; rowIndex++) {
                var currentRow = data[rowIndex];
                var nextRow = data[rowIndex + 1];

                if (!currentRow || !nextRow) continue;

                // B열 값으로 AREA/ITEM 구조 확인
                var currentType = String(currentRow[COLUMN_MAPPING.TYPE] || '').trim().toLowerCase();
                var nextType = String(nextRow[COLUMN_MAPPING.TYPE] || '').trim().toLowerCase();

                console.log('🔍 행 쌍 검사:', {
                    rowIndex: rowIndex,
                    currentType: currentType,
                    nextType: nextType
                });

                // AREA-ITEM 쌍이거나, 최소한 데이터가 있는 2행 연속이면 처리
                var isAreaItemPair = (currentType === 'area' && nextType === 'item') ||
                                   (currentType && nextType) ||
                                   (currentRow[COLUMN_MAPPING.VALUE] && nextRow[COLUMN_MAPPING.VALUE]);

                if (isAreaItemPair) {
                    // 데이터 추출
                    var areaValue = String(currentRow[COLUMN_MAPPING.VALUE] || '').trim();
                    var itemValue = String(nextRow[COLUMN_MAPPING.VALUE] || '').trim();
                    var remarksValue = String(nextRow[COLUMN_MAPPING.REMARKS_VALUE] || '').trim();
                    var imageValue = String(currentRow[COLUMN_MAPPING.IMAGE] || '').trim();

                    // 자재 데이터 구성
                    var material = {
                        id: currentMaterialId,
                        tabName: sheetName,
                        category: sheetName,
                        material: currentMaterial,
                        area: areaValue || '',
                        item: itemValue || '',
                        remarks: remarksValue || '',
                        image: imageValue || '',
                        displayId: '#' + currentMaterialId,
                        rawAreaRow: currentRow,
                        rawItemRow: nextRow,
                        rowIndex: rowIndex
                    };

                    sheetMaterials.push(material);
                    currentMaterialId++;

                    console.log('✅ 자재 추출 #' + material.id + ':', {
                        material: material.material,
                        area: material.area,
                        item: material.item,
                        remarks: material.remarks,
                        image: material.image,
                        rowPair: [rowIndex, rowIndex + 1]
                    });

                    // 다음 행은 이미 처리했으므로 건너뛰기
                    rowIndex++;
                }
            }
        }

        console.log('🎯 시트 "' + sheetName + '"에서 추출된 자재:', sheetMaterials.length + '개');
        return sheetMaterials;
    },

    // 헤더 행 찾기 (개선된 로직)
    findHeaderRow: function(data) {
        var headerKeywords = ['자재', '품목', 'material', '영역', 'area', '항목', 'item', 'description'];

        for (var i = 0; i < Math.min(10, data.length); i++) {
            var row = data[i];
            if (!row) continue;

            var matchCount = 0;
            for (var j = 0; j < row.length; j++) {
                var cellValue = String(row[j] || '').toLowerCase().trim();
                for (var k = 0; k < headerKeywords.length; k++) {
                    if (cellValue.indexOf(headerKeywords[k]) >= 0) {
                        matchCount++;
                        break;
                    }
                }
            }

            // 2개 이상의 키워드가 매치되면 헤더로 간주
            if (matchCount >= 2) {
                console.log('📋 헤더 행 발견 (행 ' + i + '):', row);
                return i;
            }
        }

        console.log('⚠️ 헤더 행을 찾을 수 없음, 첫 번째 행부터 시작');
        return -1;
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
        console.log('🚀 공정 관리자 초기화 시작');

        try {
            console.log('1️⃣ validateProcessData() 호출');
            this.validateProcessData();
            console.log('✅ validateProcessData() 완료');

            console.log('2️⃣ renderProcessTabs() 호출');
            this.renderProcessTabs();
            console.log('✅ renderProcessTabs() 완료');

            console.log('3️⃣ renderProcessContent() 호출 시작');
            this.renderProcessContent();
            console.log('✅ renderProcessContent() 완료');

            console.log('4️⃣ updateNavigationState() 호출');
            this.updateNavigationState();
            console.log('✅ updateNavigationState() 완료');

            console.log('🎉 공정 관리자 초기화 완료');
        } catch (error) {
            console.error('💥 공정 관리자 초기화 중 오류:', error);
            console.error('💥 오류 스택:', error.stack);
        }
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
            '<button class="process-edit-btn" data-process-id="' + process.id + '" ' +
            'title="' + process.name + ' 이름 수정">✏️</button>' +
            (appState.processes.length > 1 ?
                '<button class="process-delete-btn" data-process-id="' + process.id + '" ' +
                'title="' + process.name + ' 삭제">&times;</button>' : '');

        var self = this;

        // 탭 클릭 이벤트
        var tabButton = tab.querySelector('.process-tab');
        tabButton.addEventListener('click', function() {
            self.switchProcess(this.getAttribute('data-process-id'));
        });

        // 편집 버튼 이벤트
        var editButton = tab.querySelector('.process-edit-btn');
        if (editButton) {
            editButton.addEventListener('click', function(e) {
                e.stopPropagation();
                self.editProcessName(this.getAttribute('data-process-id'));
            });
        }

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
        console.log('🎯 renderProcessContent 시작');

        var contentContainer = document.getElementById('process-content');
        console.log('📦 contentContainer 찾기 결과:', contentContainer);

        if (!contentContainer) {
            console.error('❌ process-content 요소를 찾을 수 없습니다');
            return;
        }

        var currentProcess = this.getCurrentProcess();
        console.log('🔍 currentProcess 찾기 결과:', currentProcess);

        if (!currentProcess) {
            console.error('❌ 현재 공정을 찾을 수 없습니다');
            return;
        }

        var totalScenes = appState.sceneImages ? appState.sceneImages.length : 0;
        var selectedCount = currentProcess.selectedScenes ? currentProcess.selectedScenes.length : 0;

        console.log('📊 장면 정보 - 전체:', totalScenes, '선택:', selectedCount);

        contentContainer.innerHTML =
            '<div class="process-header">' +
                '<h3>' + currentProcess.name + ' - 장면 선택</h3>' +
                '<p>이 공정에 포함할 장면들을 선택하세요. (' + selectedCount + '/' + totalScenes + ' 선택됨)</p>' +
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

        console.log('✅ DOM 업데이트 완료, renderSceneSelection() 호출');
        this.renderSceneSelection();
        console.log('✅ renderProcessContent 완료');
    },

    renderSceneSelection: function() {
        console.log('🎭 renderSceneSelection 시작');
        this.renderAvailableScenes();
        this.renderAllScenes();
        console.log('🎭 renderSceneSelection 완료');
    },

    renderAvailableScenes: function() {
        console.log('🔍 renderAvailableScenes 디버깅 시작');
        console.log('- sessionImageCache 키 개수:', Object.keys(sessionImageCache).length);
        console.log('- sessionImageCache 키들:', Object.keys(sessionImageCache));
        console.log('- appState.sceneImages 개수:', appState.sceneImages ? appState.sceneImages.length : 0);
        if (appState.sceneImages && appState.sceneImages.length > 0) {
            console.log('- 첫 번째 이미지:', appState.sceneImages[0]);
        }

        var gridContainer = document.getElementById('available-scenes-grid');
        if (!gridContainer) return;

        gridContainer.innerHTML = '';

        if (!appState.sceneImages || appState.sceneImages.length === 0) {
            gridContainer.innerHTML = '<p>업로드된 장면 이미지가 없습니다.</p>';
            return;
        }

        // 현재 세션에 실제 이미지 데이터가 있는지 확인
        var hasValidImages = false;
        for (var i = 0; i < appState.sceneImages.length; i++) {
            var scene = appState.sceneImages[i];
            if (scene.id && sessionImageCache[scene.id]) {
                hasValidImages = true;
                break;
            }
        }

        // 메타데이터만 있고 실제 이미지가 없는 경우
        if (!hasValidImages) {
            console.warn('⚠️ 이미지 메타데이터는 있지만 실제 데이터가 메모리에 없습니다');
            gridContainer.innerHTML =
                '<div class="empty-state">' +
                    '<p>이미지 데이터를 찾을 수 없습니다.</p>' +
                    '<p>1단계에서 장면 이미지들을 다시 업로드해 주세요.</p>' +
                    '<button class="btn btn-secondary" onclick="navigation.goToStep(1)">1단계로 이동</button>' +
                '</div>';
            return;
        }

        var currentProcess = this.getCurrentProcess();
        var availableScenes = this.getAvailableScenes();
        var currentProcessId = currentProcess.id;

        console.log('🔍 장면 루프 시작:', {
            totalScenes: appState.sceneImages.length,
            currentProcessId: currentProcessId,
            selectedScenes: currentProcess.selectedScenes
        });

        for (var i = 0; i < appState.sceneImages.length; i++) {
            var scene = appState.sceneImages[i];
            var isSelected = currentProcess.selectedScenes.indexOf(i) !== -1;
            var isUsedInOtherProcess = this.isSceneUsedInOtherProcess(i, currentProcessId);

            console.log('🎬 장면 ' + i + ' 처리:', {
                sceneName: scene.name,
                isSelected: isSelected,
                isUsedInOtherProcess: isUsedInOtherProcess,
                selectedScenesArray: currentProcess.selectedScenes,
                indexInSelected: currentProcess.selectedScenes.indexOf(i)
            });

            if (isUsedInOtherProcess && !isSelected) {
                console.log('⏭️ 장면 ' + i + ' 스킵: 다른 공정에서 사용 중');
                continue; // 다른 공정에서 사용 중인 장면은 표시하지 않음
            }

            // 실제 이미지 데이터 가져오기
            var actualImageData = scene.data;
            if (scene.data === 'current_session_stored' && scene.id && sessionImageCache[scene.id]) {
                actualImageData = sessionImageCache[scene.id];
                console.log('🎯 메모리 캐시에서 이미지 복원:', scene.name);
            }

            var sceneItem = document.createElement('div');
            sceneItem.className = 'scene-item' + (isSelected ? ' selected' : '') + (isUsedInOtherProcess ? ' disabled' : '');
            sceneItem.setAttribute('data-scene-index', i);

            var usedInProcess = this.getProcessUsingScene(i);
            var statusText = isUsedInOtherProcess && !isSelected ? ' (사용 중: ' + usedInProcess + ')' : '';

            // 모든 장면을 기본적으로 드래그 가능하도록 설정
            sceneItem.setAttribute('draggable', 'true');
            sceneItem.classList.add('draggable');

            // 선택된 장면 로그 출력
            if (isSelected) {
                var orderIndex = currentProcess.selectedScenes.indexOf(i);

                console.log('✅ 장면 ' + i + ' 선택됨 (드래그 가능):', {
                    sceneName: scene.name,
                    orderIndex: orderIndex,
                    isDraggable: true
                });
            }

            sceneItem.innerHTML =
                '<img src="' + actualImageData + '" alt="' + scene.name + '" class="scene-thumbnail">' +
                '<div class="scene-name">' + scene.name + statusText + '</div>' +
                '<input type="checkbox" ' + (isSelected ? 'checked' : '') + ' data-scene-index="' + i + '" ' +
                (isUsedInOtherProcess && !isSelected ? 'disabled' : '') + '>' +
                '<div class="drag-handle">⋮⋮</div>';

            sceneItem.addEventListener('click', function(e) {
                if (e.target.type !== 'checkbox' && !e.target.classList.contains('drag-handle')) {
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

            // 모든 장면에 드래그 기능 기본 제공 (선택 여부와 무관)
            console.log('🎯 장면 ' + i + ' 드래그 이벤트 등록:', scene.name);
            this.addDragDropEvents(sceneItem);

            gridContainer.appendChild(sceneItem);
        }

        console.log('🏁 장면 루프 완료');
    },

    // 드래그앤드롭 이벤트 추가
    addDragDropEvents: function(sceneItem) {
        var self = this;

        sceneItem.addEventListener('dragstart', function(e) {
            e.dataTransfer.setData('text/plain', this.getAttribute('data-scene-index'));
            e.dataTransfer.effectAllowed = 'move';
            this.classList.add('dragging');
            console.log('드래그 시작:', this.getAttribute('data-scene-index'));
        });

        sceneItem.addEventListener('dragend', function(e) {
            this.classList.remove('dragging');
            // 모든 드롭 대상 스타일 제거
            var allItems = document.querySelectorAll('.scene-item.selected');
            for (var i = 0; i < allItems.length; i++) {
                allItems[i].classList.remove('drag-over');
            }
            console.log('드래그 종료');
        });

        sceneItem.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            console.log('📍 드래그오버 상세:', {
                targetIndex: this.getAttribute('data-scene-index'),
                isDragging: this.classList.contains('dragging'),
                dataTransfer: e.dataTransfer.getData ? e.dataTransfer.getData('text/plain') : 'N/A',
                effectAllowed: e.dataTransfer.effectAllowed,
                dropEffect: e.dataTransfer.dropEffect
            });

            // 드래그 중인 요소가 아닌 경우에만 스타일 적용
            if (!this.classList.contains('dragging')) {
                this.classList.add('drag-over');
            }
        });

        sceneItem.addEventListener('dragleave', function(e) {
            this.classList.remove('drag-over');
        });

        sceneItem.addEventListener('drop', function(e) {
            console.log('🎯 드롭 이벤트 발생 - 시작');

            e.preventDefault();
            this.classList.remove('drag-over');

            var draggedSceneIndex = parseInt(e.dataTransfer.getData('text/plain'));
            var dropTargetSceneIndex = parseInt(this.getAttribute('data-scene-index'));

            console.log('🎯 드롭 이벤트 상세:', {
                draggedSceneIndex: draggedSceneIndex,
                dropTargetSceneIndex: dropTargetSceneIndex,
                dataTransfer: e.dataTransfer.getData('text/plain'),
                targetAttribute: this.getAttribute('data-scene-index'),
                isSameIndex: draggedSceneIndex === dropTargetSceneIndex
            });

            if (draggedSceneIndex !== dropTargetSceneIndex) {
                console.log('✅ 장면 순서 변경 실행:', draggedSceneIndex, '→', dropTargetSceneIndex);
                self.reorderScenes(draggedSceneIndex, dropTargetSceneIndex);
            } else {
                console.log('❌ 같은 장면으로 드롭 - 순서 변경 안함');
            }
        });

        console.log('✅ 드래그앤드롭 이벤트 등록 완료:', sceneItem.getAttribute('data-scene-index'));
    },

    // 장면 순서 변경
    reorderScenes: function(draggedIndex, dropTargetIndex) {
        var currentProcess = this.getCurrentProcess();
        if (!currentProcess || !currentProcess.selectedScenes) return;

        var selectedScenes = currentProcess.selectedScenes;
        var draggedPos = selectedScenes.indexOf(draggedIndex);
        var targetPos = selectedScenes.indexOf(dropTargetIndex);

        if (draggedPos === -1 || targetPos === -1) return;

        // 배열에서 드래그된 요소를 제거
        var draggedElement = selectedScenes.splice(draggedPos, 1)[0];

        // 새 위치에 삽입
        selectedScenes.splice(targetPos, 0, draggedElement);

        console.log('새로운 순서:', selectedScenes);

        // UI 다시 렌더링
        this.renderAvailableScenes();
        this.renderAllScenes();

        // 상태 저장 (현재 비활성화)
        // stateManager 없이 작동 중
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

            // 실제 이미지 데이터 가져오기
            var actualImageData = scene.data;
            if (scene.data === 'current_session_stored' && scene.id && sessionImageCache[scene.id]) {
                actualImageData = sessionImageCache[scene.id];
            }

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
                '<img src="' + actualImageData + '" alt="' + scene.name + '" class="scene-thumbnail">' +
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

        var self = this;
        var newProcessNumber = appState.processes.length + 1;
        var defaultName = '공정' + newProcessNumber;

        // 공정 이름 입력 받기
        var processName = prompt('새 공정의 이름을 입력해주세요:', defaultName);

        // 취소한 경우
        if (processName === null) {
            return;
        }

        // 빈 문자열인 경우 기본 이름 사용
        if (processName.trim() === '') {
            processName = defaultName;
        }

        // 이름 중복 체크
        var isDuplicate = false;
        for (var i = 0; i < appState.processes.length; i++) {
            if (appState.processes[i].name === processName.trim()) {
                isDuplicate = true;
                break;
            }
        }

        if (isDuplicate) {
            utils.showError(
                '이미 같은 이름의 공정이 존재합니다.\n다른 이름을 사용해주세요.',
                '공정 이름 중복'
            );
            // 재시도
            setTimeout(function() {
                self.addNewProcess();
            }, 100);
            return;
        }

        var newProcessId = 'process_' + (Date.now()); // 고유 ID 생성
        var newProcess = {
            id: newProcessId,
            name: processName.trim(),
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

    editProcessName: function(processId) {
        var process = null;
        for (var i = 0; i < appState.processes.length; i++) {
            if (appState.processes[i].id === processId) {
                process = appState.processes[i];
                break;
            }
        }

        if (!process) {
            console.error('공정을 찾을 수 없습니다:', processId);
            return;
        }

        var self = this;
        var currentName = process.name;

        // 현재 공정 이름을 기본값으로 하는 입력 창
        var newName = prompt('공정 이름을 수정해주세요:', currentName);

        // 취소한 경우
        if (newName === null) {
            return;
        }

        // 빈 문자열인 경우 원래 이름 유지
        if (newName.trim() === '') {
            utils.showError('공정 이름은 비어있을 수 없습니다.', '잘못된 입력');
            return;
        }

        // 같은 이름인 경우 변경 안함
        if (newName.trim() === currentName) {
            return;
        }

        // 이름 중복 체크 (다른 공정과)
        var isDuplicate = false;
        for (var i = 0; i < appState.processes.length; i++) {
            if (appState.processes[i].id !== processId && appState.processes[i].name === newName.trim()) {
                isDuplicate = true;
                break;
            }
        }

        if (isDuplicate) {
            utils.showError(
                '이미 같은 이름의 공정이 존재합니다.\n다른 이름을 사용해주세요.',
                '공정 이름 중복'
            );
            // 재시도
            setTimeout(function() {
                self.editProcessName(processId);
            }, 100);
            return;
        }

        // 공정 이름 변경
        process.name = newName.trim();
        console.log('공정 이름 변경됨:', currentName, '->', process.name);

        // UI 업데이트
        this.renderProcessTabs();
        this.updateProcessSummary();
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

    // 장면 선택/해제 토글
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

        // UI 실시간 업데이트 (좌측 선택가능한 장면 + 우측 전체 장면 목록)
        this.renderAvailableScenes();
        this.renderAllScenes();
        this.updateProcessTabs();
        this.checkStep2Completion();

        // 장면 선택 변경 이벤트 발생 (드래그 상태 실시간 업데이트)
        var event = new CustomEvent('sceneSelectionChanged', {
            detail: {
                processId: currentProcess.id,
                sceneIndex: sceneIndex,
                isSelected: isSelected,
                selectedScenes: selectedScenes
            }
        });
        document.dispatchEvent(event);
        console.log('🔄 장면 선택 변경 이벤트 발생:', sceneIndex, isSelected ? '선택' : '해제');
    },

    // 프로세스 탭 업데이트 (장면 개수 표시)
    updateProcessTabs: function() {
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

};

// ============================================================================
// 반응형 좌표 시스템 관리자
// ============================================================================
var coordinateSystemManager = {
    systems: new Map(), // 각 컨테이너별 좌표 시스템 저장

    /**
     * 좌표 시스템 초기화
     */
    init: function() {
        console.log('좌표 시스템 관리자 초기화');
    },

    /**
     * 특정 컨테이너에 좌표 시스템 생성
     * @param {string} containerId - 컨테이너 ID
     * @param {Object} options - 좌표 시스템 옵션
     */
    createSystem: function(containerId, options) {
        var container = document.getElementById(containerId);
        if (!container) {
            console.error('좌표 시스템: 컨테이너를 찾을 수 없습니다:', containerId);
            return null;
        }

        // 기존 시스템이 있으면 정리
        if (this.systems.has(containerId)) {
            var existing = this.systems.get(containerId);
            if (existing && existing.destroy) {
                existing.destroy();
            }
        }

        // 간단한 좌표 시스템 객체 생성 (ResponsiveCoordinateSystem 없이)
        var system = {
            container: container,
            options: options || {},

            // 화면 좌표를 정규화된 좌표로 변환 (0~1 범위)
            toNormalized: function(screenX, screenY) {
                var rect = this.container.getBoundingClientRect();
                return {
                    x: (screenX - rect.left) / rect.width,
                    y: (screenY - rect.top) / rect.height
                };
            },

            // 정규화된 좌표를 화면 좌표로 변환
            toScreen: function(normalizedX, normalizedY) {
                var rect = this.container.getBoundingClientRect();
                return {
                    x: normalizedX * rect.width + rect.left,
                    y: normalizedY * rect.height + rect.top
                };
            },

            destroy: function() {
                // 정리 작업
            }
        };

        this.systems.set(containerId, system);

        console.log('좌표 시스템 생성:', containerId);
        return system;
    },

    /**
     * 좌표 시스템 가져오기
     * @param {string} containerId - 컨테이너 ID
     */
    getSystem: function(containerId) {
        return this.systems.get(containerId) || null;
    },

    /**
     * 좌표 시스템 제거
     * @param {string} containerId - 컨테이너 ID
     */
    destroySystem: function(containerId) {
        var system = this.systems.get(containerId);
        if (system) {
            system.destroy();
            this.systems.delete(containerId);
            console.log('좌표 시스템 제거:', containerId);
        }
    },

    /**
     * 모든 좌표 시스템 정리
     */
    destroyAll: function() {
        this.systems.forEach(function(system, containerId) {
            system.destroy();
        });
        this.systems.clear();
        console.log('모든 좌표 시스템 정리 완료');
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

            // 공정 하위 장면탭 컨테이너 생성
            var sceneTabsContainer = document.createElement('div');
            sceneTabsContainer.id = 'scene-tabs-container-step3';
            sceneTabsContainer.className = 'scene-tabs-container-step3';
            sceneTabsContainer.innerHTML = '<div id="scene-tabs-step3" class="scene-tabs-step3"></div>';

            workspaceElement.appendChild(sceneTabsContainer);

            // 작업공간 컨테이너 생성 (좌우 레이아웃: 좌측(합성된 장면+미니맵) | 우측(자재표))
            var container = document.createElement('div');
            container.className = 'workspace-container';
            container.innerHTML =
                '<div class="workspace-main-row">' +
                    '<div class="left-panel">' +
                        '<div class="scene-workspace" id="scene-workspace">' +
                            '<h3>현재 작업 장면 (PPT 미리보기)</h3>' +
                            '<div id="scene-workspace-content"></div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="right-panel">' +
                        '<div class="material-workspace" id="material-workspace">' +
                            '<h3>자재표</h3>' +
                            '<div id="material-workspace-content"></div>' +
                        '</div>' +
                    '</div>' +
                '</div>';

            workspaceElement.appendChild(container);

            // 반응형 좌표 시스템 생성
            this.setupCoordinateSystems();

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
        }
    },

    // 공정 선택
    selectProcess: function(processId) {
        this.currentProcessId = processId;
        appState.currentProcess = processId;  // 전역 상태도 업데이트

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

        // 3단계 장면탭 렌더링
        this.renderSceneTabsStep3(process);

        // 현재 활성 장면 정보 가져오기 및 명시적 설정 (핵심 수정!)
        var activeSceneIndex = this.getActiveSceneForProcess(process);

        // 3단계에서 activeSceneStep3가 설정되지 않았으면 첫 번째 선택된 장면으로 설정
        if (process.selectedScenes && process.selectedScenes.length > 0 && process.activeSceneStep3 === undefined) {
            process.activeSceneStep3 = process.selectedScenes[0];
            activeSceneIndex = process.activeSceneStep3;
            console.log('🎯 활성 장면 자동 설정:', activeSceneIndex, '(', appState.sceneImages[activeSceneIndex]?.name, ')');
        }

        console.log('📋 selectProcess 상태 확인:', {
            processId: processId,
            selectedScenes: process.selectedScenes,
            activeSceneStep3: process.activeSceneStep3,
            finalActiveSceneIndex: activeSceneIndex
        });

        // 미니맵 작업공간 렌더링 (활성 장면 전달)
        this.renderMinimapWorkspace(process, activeSceneIndex);

        // 장면 작업공간 렌더링
        this.renderSceneWorkspace(process);

        // 자재표 작업공간 렌더링
        this.renderMaterialWorkspace();

        console.log('공정 선택됨:', process.name, '(' + process.selectedScenes.length + '개 장면)');
    },

    // 3단계 장면탭 렌더링
    renderSceneTabsStep3: function(process) {
        var tabsContainer = document.getElementById('scene-tabs-step3');
        if (!tabsContainer) {
            console.error('장면탭 컨테이너를 찾을 수 없습니다.');
            return;
        }

        if (!process.selectedScenes || process.selectedScenes.length === 0) {
            tabsContainer.innerHTML = '<p class="no-scenes">이 공정에 선택된 장면이 없습니다.</p>';
            return;
        }

        var html = '';
        for (var i = 0; i < process.selectedScenes.length; i++) {
            var sceneIndex = process.selectedScenes[i];
            var sceneData = appState.sceneImages[sceneIndex];

            if (sceneData) {
                var isActive = (i === 0) ? ' active' : ''; // 첫 번째 장면을 기본 활성
                html += '<div class="scene-tab-step3' + isActive + '" data-scene-index="' + sceneIndex + '" data-process-id="' + process.id + '">';
                html += '<span class="scene-tab-name">' + sceneData.name + '</span>';
                html += '<span class="scene-tab-number">' + (i + 1) + '</span>';
                html += '</div>';
            }
        }

        tabsContainer.innerHTML = html;

        // 장면탭 클릭 이벤트 바인딩
        this.bindSceneTabsStep3Events();

        console.log('3단계 장면탭 렌더링 완료:', process.selectedScenes.length + '개 탭');
    },

    // 3단계 장면탭 클릭 이벤트 바인딩
    bindSceneTabsStep3Events: function() {
        var self = this;
        var tabs = document.querySelectorAll('.scene-tab-step3');

        for (var i = 0; i < tabs.length; i++) {
            tabs[i].addEventListener('click', function() {
                var sceneIndex = parseInt(this.dataset.sceneIndex);
                var processId = this.dataset.processId;

                // 모든 탭에서 active 클래스 제거
                var allTabs = document.querySelectorAll('.scene-tab-step3');
                for (var j = 0; j < allTabs.length; j++) {
                    allTabs[j].classList.remove('active');
                }

                // 클릭된 탭에 active 클래스 추가
                this.classList.add('active');

                // 해당 공정에 활성 장면 저장
                var process = appState.processes.find(function(p) { return p.id === processId; });
                if (process) {
                    process.activeSceneStep3 = sceneIndex;
                }

                // 미니맵, 장면 작업공간, 자재표 다시 렌더링
                self.renderMinimapWorkspace(process, sceneIndex);
                self.renderSceneWorkspace(process);
                self.renderMaterialWorkspace(); // 자재표 기능 재활성화

                // 새로 선택된 장면의 자재 리스트 업데이트 (핵심!)
                self.updateSceneMaterialList(sceneIndex);

                console.log('3단계 장면탭 전환:', sceneIndex, appState.sceneImages[sceneIndex]?.name);
            });
        }
    },

    // 공정의 현재 활성 장면 가져오기
    getActiveSceneForProcess: function(process) {
        // 저장된 활성 장면이 있으면 사용
        if (process.activeSceneStep3 !== undefined && process.selectedScenes.indexOf(process.activeSceneStep3) !== -1) {
            return process.activeSceneStep3;
        }

        // 없으면 첫 번째 선택된 장면을 기본으로 설정
        if (process.selectedScenes && process.selectedScenes.length > 0) {
            process.activeSceneStep3 = process.selectedScenes[0];
            return process.selectedScenes[0];
        }

        return null;
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

            // 활성 장면 정보 가져오기
            var activeSceneIndex = this.getActiveSceneForProcess(process);
            var activeSceneData = activeSceneIndex !== null ? appState.sceneImages[activeSceneIndex] : null;

            // 미니맵 컨테이너 생성 (초기에는 빨간박스 없음)
            var html = '<div class="minimap-container" id="minimap-container" style="position: relative; display: inline-block; cursor: crosshair;">';
            html += '<img src="' + appState.minimapImage + '" alt="미니맵" class="minimap-image" style="max-width: 100%; height: auto;">';
            html += '<div class="minimap-overlays" id="minimap-overlays" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></div>';
            html += '</div>';

            // 사용자 안내 정보
            html += '<div class="minimap-controls" style="margin-top: 10px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;">';
            html += '<h4 style="margin: 0 0 8px 0; font-size: 14px;">현재 작업 장면</h4>';

            if (activeSceneData) {
                html += '<div style="display: flex; align-items: center; margin-bottom: 8px;">';
                html += '<span style="display: inline-block; width: 60px; height: 20px; background: #667eea; margin-right: 8px; text-align: center; color: white; font-size: 11px; line-height: 20px; border-radius: 2px; font-weight: bold;">';
                html += '작업중';
                html += '</span>';
                html += '<span style="font-size: 13px; font-weight: 500;">' + activeSceneData.name + '</span>';
                html += '</div>';
                html += '<p style="margin: 0; color: #666; font-size: 12px;">📍 마우스를 드래그하여 이 장면의 위치를 표시하세요</p>';
                html += '<button id="clear-minimap-boxes" class="btn btn-sm btn-secondary" style="margin-top: 8px;">빨간박스 전체 제거</button>';
            } else {
                html += '<p style="margin: 0; color: #666; font-size: 13px;">활성 장면이 선택되지 않았습니다.</p>';
            }

            html += '</div>';

            contentElement.innerHTML = html;

            // 드래그 그리기 이벤트 추가
            this.setupMinimapDragDrawing();

            console.log('미니맵 렌더링 완료');

        } catch (error) {
            console.error('renderMinimapWorkspace 오류:', error);
            var contentElement = document.getElementById('minimap-workspace-content');
            if (contentElement) {
                contentElement.innerHTML = '<p class="empty-state">미니맵 표시 중 오류가 발생했습니다.</p>';
            }
        }
    },

    // 미니맵 드래그 그리기 설정 (성능 개선 버전)
    setupMinimapDragDrawing: function() {
        var self = this;
        var minimapContainer = document.getElementById('minimap-container');
        var overlaysContainer = document.getElementById('minimap-overlays');
        var clearButton = document.getElementById('clear-minimap-boxes');

        if (!minimapContainer || !overlaysContainer) {
            console.error('미니맵 컨테이너를 찾을 수 없습니다.');
            return;
        }

        console.log('🗺️ 미니맵 컨테이너 확인:', {
            minimapContainer: !!minimapContainer,
            overlaysContainer: !!overlaysContainer,
            minimapContainerId: minimapContainer ? minimapContainer.id : 'none',
            minimapImage: minimapContainer ? minimapContainer.querySelector('.minimap-image') : null
        });

        var isDrawing = false;
        var currentBox = null;
        var startX = 0;
        var startY = 0;
        var lastUpdateTime = 0;
        var updateThreshold = 16; // 60fps를 위한 16ms 간격

        // 성능 최적화된 박스 업데이트 함수
        function updateBoxPosition(currentX, currentY) {
            if (!currentBox || !isDrawing) return;

            var now = performance.now();
            if (now - lastUpdateTime < updateThreshold) return;

            var left = Math.min(startX, currentX);
            var top = Math.min(startY, currentY);
            var width = Math.abs(currentX - startX);
            var height = Math.abs(currentY - startY);

            // requestAnimationFrame으로 부드러운 업데이트
            requestAnimationFrame(function() {
                if (currentBox) {
                    currentBox.style.left = left + 'px';
                    currentBox.style.top = top + 'px';
                    currentBox.style.width = width + 'px';
                    currentBox.style.height = height + 'px';
                }
            });

            lastUpdateTime = now;
        }

        // 마우스 다운 - 드래그 시작
        minimapContainer.addEventListener('mousedown', function(e) {
            console.log('🖱️ 미니맵 마우스다운 이벤트:', {
                target: e.target.tagName,
                className: e.target.className,
                hasMinimapImageClass: e.target.classList.contains('minimap-image'),
                targetElement: e.target
            });

            if (e.target.classList.contains('minimap-image')) {
                // 이벤트 전파 및 기본 동작 즉시 차단
                e.preventDefault();
                e.stopPropagation();

                isDrawing = true;
                lastUpdateTime = 0; // 초기화

                var rect = minimapContainer.getBoundingClientRect();
                startX = e.clientX - rect.left;
                startY = e.clientY - rect.top;

                // 새 빨간박스 생성
                currentBox = document.createElement('div');
                currentBox.className = 'minimap-box';
                currentBox.style.cssText =
                    'position: absolute; border: 3px solid #ff4444; background: rgba(255, 68, 68, 0.2); ' +
                    'left: ' + startX + 'px; top: ' + startY + 'px; width: 0px; height: 0px; ' +
                    'pointer-events: auto; cursor: move; will-change: transform;';

                overlaysContainer.appendChild(currentBox);

                console.log('빨간박스 그리기 시작:', startX, startY);
            } else {
                console.log('❌ 미니맵 이미지가 아닌 요소 클릭됨');
            }
        });

        // 마우스 이동 - 드래그 중 (성능 최적화)
        minimapContainer.addEventListener('mousemove', function(e) {
            if (!isDrawing || !currentBox) return;

            var rect = minimapContainer.getBoundingClientRect();
            var currentX = e.clientX - rect.left;
            var currentY = e.clientY - rect.top;

            // Throttled update with requestAnimationFrame
            updateBoxPosition(currentX, currentY);
        });

        // 마우스 업 - 드래그 종료
        minimapContainer.addEventListener('mouseup', function(e) {
            if (!isDrawing || !currentBox) return;

            isDrawing = false;

            // 너무 작은 박스는 제거
            if (parseInt(currentBox.style.width) < 10 || parseInt(currentBox.style.height) < 10) {
                overlaysContainer.removeChild(currentBox);
                console.log('너무 작은 박스 제거됨');
            } else {
                // will-change 속성 제거 (완성된 요소는 최적화 해제)
                currentBox.style.willChange = 'auto';

                // 박스에 삭제 버튼 추가
                self.addBoxDeleteButton(currentBox);
                console.log('빨간박스 생성 완료:', currentBox.style.left, currentBox.style.top, currentBox.style.width, currentBox.style.height);
            }

            currentBox = null;
        });

        // 터치 이벤트 지원 추가 (모바일 호환성)
        minimapContainer.addEventListener('touchstart', function(e) {
            e.preventDefault();
            var touch = e.touches[0];
            var mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY,
                bubbles: true
            });
            minimapContainer.dispatchEvent(mouseEvent);
        }, { passive: false });

        minimapContainer.addEventListener('touchmove', function(e) {
            e.preventDefault();
            var touch = e.touches[0];
            var mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY,
                bubbles: true
            });
            minimapContainer.dispatchEvent(mouseEvent);
        }, { passive: false });

        minimapContainer.addEventListener('touchend', function(e) {
            e.preventDefault();
            var mouseEvent = new MouseEvent('mouseup', {
                bubbles: true
            });
            minimapContainer.dispatchEvent(mouseEvent);
        });

        // 전체 제거 버튼 이벤트
        if (clearButton) {
            clearButton.addEventListener('click', function() {
                var boxes = overlaysContainer.querySelectorAll('.minimap-box');
                for (var i = 0; i < boxes.length; i++) {
                    overlaysContainer.removeChild(boxes[i]);
                }
                console.log('모든 빨간박스 제거됨');
            });
        }

        console.log('미니맵 드래그 그리기 설정 완료 (성능 최적화 적용)');
    },

    // 박스에 삭제 버튼 추가
    addBoxDeleteButton: function(box) {
        var deleteBtn = document.createElement('div');
        deleteBtn.innerHTML = '×';
        deleteBtn.className = 'box-delete-btn';
        deleteBtn.style.cssText =
            'position: absolute; top: -10px; right: -10px; width: 20px; height: 20px; ' +
            'background: #ff4444; color: white; border-radius: 50%; text-align: center; ' +
            'line-height: 20px; cursor: pointer; font-weight: bold; font-size: 14px; ' +
            'pointer-events: auto; z-index: 10;';

        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            box.parentNode.removeChild(box);
            console.log('빨간박스 개별 삭제됨');
        });

        box.appendChild(deleteBtn);
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
                // 박스 데이터를 appState에 저장
                self.saveMinimapBox(currentBox, minimapImage);

                // 박스에 삭제 버튼 추가
                self.addBoxControls(currentBox);
            }

            currentBox = null;
        });

        // 초기화 버튼 추가
        this.addResetButton();

        // 미니맵 이미지가 완전히 로드된 후 빨간박스 복원
        var self = this;
        if (minimapImage.complete) {
            // 이미 로드된 경우 즉시 복원
            setTimeout(function() {
                self.restoreMinimapBoxes();
            }, 100);
        } else {
            // 로드 완료 대기 후 복원
            minimapImage.addEventListener('load', function() {
                setTimeout(function() {
                    self.restoreMinimapBoxes();
                }, 100);
            });
        }
    },

    // 미니맵 박스 데이터를 appState에 저장
    saveMinimapBox: function(boxElement, minimapImage) {
        try {
            // 현재 활성 장면 인덱스 가져오기
            var currentProcess = this.getCurrentProcess();
            if (!currentProcess) {
                console.warn('⚠️ 현재 공정을 찾을 수 없어 빨간박스를 저장할 수 없습니다.');
                return;
            }

            var activeSceneIndex = this.getActiveSceneForProcess(currentProcess);
            if (activeSceneIndex === null || activeSceneIndex === undefined) {
                console.warn('⚠️ 활성 장면을 찾을 수 없어 빨간박스를 저장할 수 없습니다.');
                return;
            }

            // 미니맵 이미지 크기 (실제 렌더링된 크기)
            var rect = minimapImage.getBoundingClientRect();
            var minimapWidth = rect.width;
            var minimapHeight = rect.height;

            // 박스 위치와 크기 (픽셀)
            var left = parseInt(boxElement.style.left);
            var top = parseInt(boxElement.style.top);
            var width = parseInt(boxElement.style.width);
            var height = parseInt(boxElement.style.height);

            // 상대 좌표로 정규화 (0~1 범위)
            var normalizedBox = {
                x: left / minimapWidth,
                y: top / minimapHeight,
                width: width / minimapWidth,
                height: height / minimapHeight
            };

            // appState에 저장
            if (!appState.minimapBoxes) {
                appState.minimapBoxes = {};
            }

            appState.minimapBoxes[activeSceneIndex] = normalizedBox;

            console.log('💾 빨간박스 저장:', {
                sceneIndex: activeSceneIndex,
                pixelBox: { left: left, top: top, width: width, height: height },
                normalizedBox: normalizedBox,
                minimapSize: { width: minimapWidth, height: minimapHeight }
            });

        } catch (error) {
            console.error('💥 빨간박스 저장 중 오류:', error);
        }
    },

    // 저장된 미니맵 박스들을 복원
    restoreMinimapBoxes: function() {
        try {
            var currentProcess = this.getCurrentProcess();
            if (!currentProcess) return;

            var activeSceneIndex = this.getActiveSceneForProcess(currentProcess);
            if (activeSceneIndex === null || activeSceneIndex === undefined) return;

            // 저장된 박스 데이터 확인
            if (!appState.minimapBoxes || !appState.minimapBoxes[activeSceneIndex]) {
                console.log('📦 복원할 빨간박스 데이터 없음:', activeSceneIndex);
                return;
            }

            var boxData = appState.minimapBoxes[activeSceneIndex];
            var minimapImage = document.querySelector('.minimap-image');
            var overlaysContainer = document.querySelector('.minimap-overlays');

            if (!minimapImage || !overlaysContainer) {
                console.warn('⚠️ 미니맵 요소를 찾을 수 없어 빨간박스를 복원할 수 없습니다.');
                return;
            }

            // 미니맵 이미지 크기 (실제 렌더링된 크기)
            var rect = minimapImage.getBoundingClientRect();
            var minimapWidth = rect.width;
            var minimapHeight = rect.height;

            // 정규화된 좌표를 픽셀 좌표로 변환
            var left = boxData.x * minimapWidth;
            var top = boxData.y * minimapHeight;
            var width = boxData.width * minimapWidth;
            var height = boxData.height * minimapHeight;

            // 빨간박스 DOM 요소 생성
            var restoredBox = document.createElement('div');
            restoredBox.className = 'minimap-draw-box';
            restoredBox.style.cssText =
                'position: absolute; border: 2px solid #ff4444; background: rgba(255, 68, 68, 0.2); ' +
                'left: ' + left + 'px; top: ' + top + 'px; width: ' + width + 'px; height: ' + height + 'px; pointer-events: auto;';

            overlaysContainer.appendChild(restoredBox);

            // 삭제 버튼 추가
            this.addBoxControls(restoredBox);

            console.log('🔄 빨간박스 복원 완료:', {
                sceneIndex: activeSceneIndex,
                restoredBox: { left: left, top: top, width: width, height: height }
            });

        } catch (error) {
            console.error('💥 빨간박스 복원 중 오류:', error);
        }
    },

    // 박스에 삭제 컨트롤 추가
    addBoxControls: function(box) {
        var self = this;
        var deleteBtn = document.createElement('div');
        deleteBtn.innerHTML = '×';
        deleteBtn.style.cssText =
            'position: absolute; top: -10px; right: -10px; width: 20px; height: 20px; ' +
            'background: #ff4444; color: white; border-radius: 50%; text-align: center; ' +
            'line-height: 20px; cursor: pointer; font-weight: bold; font-size: 14px; pointer-events: auto;';

        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();

            // DOM에서 박스 제거
            box.parentNode.removeChild(box);

            // appState에서도 해당 장면의 빨간박스 데이터 제거
            self.removeMinimapBoxData();

            console.log('🗑️ 빨간박스 삭제 완료');
        });

        box.appendChild(deleteBtn);
        box.style.pointerEvents = 'auto';
    },

    // appState에서 현재 장면의 미니맵 박스 데이터 제거
    removeMinimapBoxData: function() {
        try {
            var currentProcess = this.getCurrentProcess();
            if (!currentProcess) return;

            var activeSceneIndex = this.getActiveSceneForProcess(currentProcess);
            if (activeSceneIndex === null || activeSceneIndex === undefined) return;

            if (appState.minimapBoxes && appState.minimapBoxes[activeSceneIndex]) {
                delete appState.minimapBoxes[activeSceneIndex];
                console.log('🗑️ 장면', activeSceneIndex, '의 빨간박스 데이터 삭제됨');
            }
        } catch (error) {
            console.error('💥 빨간박스 데이터 삭제 중 오류:', error);
        }
    },

    // 미니맵 초기화 버튼 추가
    addResetButton: function() {
        var self = this;
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
            // DOM에서 모든 빨간박스 제거
            var overlaysContainer = document.querySelector('.minimap-overlays');
            if (overlaysContainer) {
                var drawBoxes = overlaysContainer.querySelectorAll('.minimap-draw-box');
                for (var i = 0; i < drawBoxes.length; i++) {
                    overlaysContainer.removeChild(drawBoxes[i]);
                }
            }

            // appState에서도 현재 장면의 빨간박스 데이터 제거
            self.removeMinimapBoxData();

            console.log('🧹 미니맵 초기화 완료');
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

    // 장면 작업공간 렌더링 (분리된 레이아웃)
    renderSceneWorkspace: function(process) {
        console.log('renderSceneWorkspace 시작:', process);

        try {
            var contentElement = document.getElementById('scene-workspace-content');
            if (!contentElement) {
                console.error('scene-workspace-content 엘리먼트를 찾을 수 없습니다.');
                return;
            }

            // 현재 활성 장면만 가져오기 (3단계용)
            var activeSceneIndex = this.getActiveSceneForProcess(process);
            if (activeSceneIndex === null) {
                contentElement.innerHTML = '<p class="empty-state">선택된 활성 장면이 없습니다.</p>';
                console.log('활성 장면이 없음');
                return;
            }

            var sceneData = appState.sceneImages[activeSceneIndex];
            if (!sceneData) {
                contentElement.innerHTML = '<p class="empty-state">장면 데이터를 찾을 수 없습니다.</p>';
                console.log('장면 데이터 없음:', activeSceneIndex);
                return;
            }

            console.log('활성 장면 표시:', activeSceneIndex, sceneData.name);

            // 실제 이미지 데이터 가져오기 (메모리 캐시 확인)
            var actualImageData = sceneData.data;
            if (sceneData.data === 'current_session_stored' && sceneData.id && sessionImageCache[sceneData.id]) {
                actualImageData = sessionImageCache[sceneData.id];
                console.log('🎯 3단계 메모리 캐시에서 이미지 복원:', sceneData.name);
            }

            // 분리된 레이아웃: 좌측 장면 + 우측 미니맵
            var html = '<div class="scene-workspace-layout">';

            // 좌측: 현재 작업 장면
            html += '<div class="current-scene-section">';
            html += '<h4>현재 작업 장면</h4>';
            html += '<div class="scene-display" data-scene-id="' + activeSceneIndex + '">';
            html += '<img src="' + actualImageData + '" alt="' + sceneData.name + '" class="scene-image">';
            html += '<div class="scene-info">';
            html += '<span class="scene-name">' + sceneData.name + '</span>';
            html += '</div>';
            html += '</div>';

            // 자재 배치된 위치 표시
            html += '<div class="scene-material-positions" id="scene-' + activeSceneIndex + '-positions"></div>';
            html += '</div>';

            // 우측: 미니맵 영역
            html += '<div class="minimap-section">';
            html += '<h4>미니맵</h4>';
            if (appState.minimapImage && appState.minimapImage.data) {
                var minimapData = appState.minimapImage.data;
                if (appState.minimapImage.data === 'current_session_stored' &&
                    appState.minimapImage.id && sessionImageCache[appState.minimapImage.id]) {
                    minimapData = sessionImageCache[appState.minimapImage.id];
                }

                html += '<div class="minimap-container">';
                html += '<img src="' + minimapData + '" alt="미니맵" class="minimap-image">';
                html += '<div class="minimap-overlays"></div>';
                html += '</div>';
            } else {
                html += '<div class="minimap-placeholder">미니맵 이미지가 없습니다</div>';
            }
            html += '</div>';

            html += '</div>';

            // 하단: 자재 리스트
            html += '<div class="scene-material-list-section">';
            html += '<div id="scene-' + activeSceneIndex + '-material-list" class="scene-material-list"></div>';
            html += '</div>';

            contentElement.innerHTML = html;
            console.log('장면 작업공간 HTML 설정 완료 (분리된 레이아웃)');

            // 드롭 타겟 설정 및 자재 리스트 초기화
            var self = this;
            setTimeout(function() {
                dragDropManager.setupSceneDropTargets();
                console.log('드롭 타겟 설정 완료');

                // 미니맵 빨간박스 그리기 기능 설정
                self.setupMinimapDrawing();

                // 현재 활성 장면의 자재 리스트 초기화 (핵심!)
                self.updateSceneMaterialList(activeSceneIndex);
                console.log('장면 자재 리스트 초기화 완료');
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

    // 자재표 작업공간 렌더링 (삭제됨 - 재구현 예정)
    renderMaterialWorkspace: function() {
        console.log('🔧 자재표 작업공간 렌더링 시작');

        var contentElement = document.getElementById('material-workspace-content');
        if (!contentElement) {
            console.error('❌ material-workspace-content 요소를 찾을 수 없습니다');
            return;
        }

        // 자재 데이터 확인
        if (!appState.materials || appState.materials.length === 0) {
            console.log('📭 자재 데이터가 없습니다');
            contentElement.innerHTML = '<div class="empty-state">자재 데이터를 먼저 업로드해주세요.</div>';
            return;
        }

        console.log('📦 총 자재 개수:', appState.materials.length);
        console.log('📋 시트별 자재:', appState.materialsBySheet);

        // 시트별 탭과 자재표 생성
        var html = '';

        // 시트 탭 생성
        if (appState.materialsBySheet && Object.keys(appState.materialsBySheet).length > 1) {
            html += '<div class="material-tabs">';
            var sheetNames = Object.keys(appState.materialsBySheet);

            for (var i = 0; i < sheetNames.length; i++) {
                var sheetName = sheetNames[i];
                var materialCount = appState.materialsBySheet[sheetName].length;
                var activeClass = i === 0 ? 'active' : '';

                html += '<button class="material-tab ' + activeClass + '" data-sheet="' + sheetName + '">';
                html += sheetName + ' (' + materialCount + '개)';
                html += '</button>';
            }
            html += '</div>';
        }

        // 자재표 컨테이너
        html += '<div class="material-table-container">';
        html += '<table class="material-table" id="material-table">';
        html += '<thead>';
        html += '<tr>';
        html += '<th class="material-select-col">선택</th>';
        html += '<th class="material-id-col">No.</th>';
        html += '<th class="material-name-col">MATERIAL</th>';
        html += '<th class="material-item-col">ITEM</th>';
        html += '<th class="material-area-col">AREA</th>';
        html += '<th class="material-remarks-col">REMARKS</th>';
        html += '<th class="material-image-col">IMAGE</th>';
        html += '</tr>';
        html += '</thead>';
        html += '<tbody id="material-table-body">';
        html += '</tbody>';
        html += '</table>';
        html += '</div>';

        contentElement.innerHTML = html;

        // 첫 번째 시트의 자재 데이터 렌더링
        var firstSheet = Object.keys(appState.materialsBySheet)[0] || null;
        if (firstSheet) {
            this.renderMaterialTableData(firstSheet);
        } else {
            // materialsBySheet가 없으면 전체 materials 사용
            this.renderMaterialTableData(null);
        }

        // 탭 이벤트 바인딩
        this.bindMaterialTabEvents();

        // 드래그 상태 업데이트 (중요! 장면 선택 변경 시 실시간 반영)
        var self = this;
        setTimeout(function() {
            if (typeof dragDropManager !== 'undefined' && dragDropManager.updateMaterialDragStates) {
                dragDropManager.updateMaterialDragStates();
                console.log('🎯 자재표 렌더링 후 드래그 상태 업데이트 완료');
            }
        }, 100);

        console.log('✅ 자재표 작업공간 렌더링 완료');
    },

    // 자재표 데이터 렌더링
    renderMaterialTableData: function(sheetName) {
        var tbody = document.getElementById('material-table-body');
        if (!tbody) return;

        var materials = sheetName && appState.materialsBySheet
            ? appState.materialsBySheet[sheetName]
            : appState.materials || [];

        console.log('📋 자재표 데이터 렌더링:', sheetName, materials.length + '개');

        if (materials.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">자재가 없습니다.</td></tr>';
            return;
        }

        var html = '';
        for (var i = 0; i < materials.length; i++) {
            var material = materials[i];

            html += '<tr class="material-row" data-material-index="' + material.id + '">';

            // 선택 체크박스
            html += '<td class="material-select-col">';
            html += '<input type="checkbox" class="material-select-checkbox" ';
            html += 'data-material-index="' + material.id + '" ';
            html += 'title="장면에 매칭하려면 체크하세요">';
            html += '</td>';

            // No.
            html += '<td class="material-id-col">' + material.displayId + '</td>';

            // MATERIAL
            html += '<td class="material-name-col">' + this.escapeHtml(material.material) + '</td>';

            // ITEM
            html += '<td class="material-item-col">' + this.escapeHtml(material.item) + '</td>';

            // AREA
            html += '<td class="material-area-col">' + this.escapeHtml(material.area) + '</td>';

            // REMARKS
            html += '<td class="material-remarks-col">' + this.escapeHtml(material.remarks) + '</td>';

            // IMAGE
            html += '<td class="material-image-col">';
            if (material.image && material.image.trim()) {
                html += '<a href="' + this.escapeHtml(material.image) + '" target="_blank">🖼️</a>';
            } else {
                html += '-';
            }
            html += '</td>';

            html += '</tr>';
        }

        tbody.innerHTML = html;

        // 체크박스 이벤트 바인딩
        this.bindMaterialSelectEvents();
    },

    // HTML 이스케이프 처리
    escapeHtml: function(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    // 자재 탭 이벤트 바인딩
    bindMaterialTabEvents: function() {
        var self = this;
        var tabButtons = document.querySelectorAll('.material-tab');

        for (var i = 0; i < tabButtons.length; i++) {
            tabButtons[i].addEventListener('click', function(e) {
                var sheetName = this.getAttribute('data-sheet');

                // 모든 탭 비활성화
                var allTabs = document.querySelectorAll('.material-tab');
                for (var j = 0; j < allTabs.length; j++) {
                    allTabs[j].classList.remove('active');
                }

                // 현재 탭 활성화
                this.classList.add('active');

                // 해당 시트의 자재 데이터 렌더링
                self.renderMaterialTableData(sheetName);

                console.log('🔄 자재 탭 전환:', sheetName);
            });
        }
    },

    // 자재 선택 체크박스 이벤트 바인딩 (행 전체 클릭 지원)
    bindMaterialSelectEvents: function() {
        var self = this;

        // 1. 체크박스 이벤트 바인딩
        var checkboxes = document.querySelectorAll('.material-select-checkbox');
        console.log('🔗 자재 선택 이벤트 바인딩 시작:', checkboxes.length + '개 체크박스 발견');

        for (var i = 0; i < checkboxes.length; i++) {
            var checkbox = checkboxes[i];

            // 기존 이벤트 리스너 제거
            checkbox.removeEventListener('change', this.handleMaterialCheckboxChange);
            checkbox.removeEventListener('click', this.handleMaterialCheckboxClick);

            // 체크박스 change 이벤트
            checkbox.addEventListener('change', function(e) {
                console.log('📋 체크박스 change 이벤트 발생:', this);
                self.handleMaterialCheckboxChange.call(this, e, self);
            });

            console.log('✅ 체크박스 이벤트 바인딩 완료:', checkbox.getAttribute('data-material-index'));
        }

        // 2. 행 전체 클릭 이벤트 바인딩 (새로운 기능!)
        var materialRows = document.querySelectorAll('.material-row');
        console.log('🎯 자재 행 클릭 이벤트 바인딩 시작:', materialRows.length + '개 행 발견');

        for (var i = 0; i < materialRows.length; i++) {
            var row = materialRows[i];

            // 기존 이벤트 리스너 제거
            row.removeEventListener('click', this.handleMaterialRowClick);

            // 행 클릭 이벤트 추가
            row.addEventListener('click', function(e) {
                // 체크박스를 직접 클릭한 경우는 제외 (중복 방지)
                if (e.target.type === 'checkbox') {
                    console.log('📋 체크박스 직접 클릭 - 행 클릭 이벤트 무시');
                    return;
                }

                var materialId = parseInt(this.getAttribute('data-material-index'));
                var checkbox = this.querySelector('.material-select-checkbox');

                if (checkbox) {
                    console.log('🖱️ 자재 행 클릭 - 체크박스 토글:', materialId);

                    // 체크박스 상태 토글
                    checkbox.checked = !checkbox.checked;

                    // 체크박스 change 이벤트 수동 발생
                    var changeEvent = new Event('change', { bubbles: true });
                    checkbox.dispatchEvent(changeEvent);
                } else {
                    console.warn('⚠️ 체크박스를 찾을 수 없음:', materialId);
                }
            });

            console.log('✅ 자재 행 클릭 이벤트 바인딩 완료:', row.getAttribute('data-material-index'));
        }

        console.log('🎯 모든 자재 선택 이벤트 바인딩 완료');
    },

    // 체크박스 변경 이벤트 핸들러
    handleMaterialCheckboxChange: function(e, self) {
        try {
            console.log('🔄 체크박스 이벤트 핸들러 실행 시작');

            var materialId = parseInt(this.getAttribute('data-material-index'));
            var isChecked = this.checked;

            console.log('📝 자재 선택 변경:', {
                materialId: materialId,
                isChecked: isChecked,
                checkbox: this
            });

            // 자재 매칭 상태 업데이트
            self.updateMaterialAssignment(materialId, isChecked);

            // 행 스타일 업데이트
            var row = this.closest('.material-row');
            if (row) {
                if (isChecked) {
                    row.classList.add('material-selected');
                    console.log('✅ 자재 행 선택 스타일 추가');
                } else {
                    row.classList.remove('material-selected');
                    console.log('❌ 자재 행 선택 스타일 제거');
                }
            }

            console.log('🎯 체크박스 이벤트 핸들러 완료');

        } catch (error) {
            console.error('💥 체크박스 이벤트 핸들러 오류:', error);
            alert('체크박스 처리 중 오류가 발생했습니다: ' + error.message);
        }
    },

    // 자재 매칭 상태 업데이트 (개선된 버전)
    updateMaterialAssignment: function(materialId, isAssigned) {
        console.log('🔄 자재 매칭 상태 업데이트 시작:', { materialId: materialId, isAssigned: isAssigned });

        var currentProcess = this.getCurrentProcess();
        var activeSceneIndex = this.getActiveSceneIndex();

        console.log('📋 현재 상태 확인:', {
            currentProcess: currentProcess,
            activeSceneIndex: activeSceneIndex,
            appStateCurrentProcess: appState.currentProcess,
            appStateProcesses: appState.processes
        });

        if (!currentProcess) {
            console.warn('⚠️ 현재 공정 정보가 없습니다');
            alert('공정을 먼저 생성해주세요.\n(2단계에서 공정을 설정할 수 있습니다)');
            this.revertCheckboxState(materialId, isAssigned);
            return;
        }

        if (activeSceneIndex === null || activeSceneIndex === undefined) {
            console.warn('⚠️ 활성 장면 정보가 없습니다');
            console.log('📸 현재 공정의 선택된 장면들:', currentProcess.selectedScenes);
            alert('장면을 먼저 선택해주세요.\n(2단계에서 공정별 장면을 선택할 수 있습니다)');
            this.revertCheckboxState(materialId, isAssigned);
            return;
        }

        var processId = currentProcess.id;
        console.log('✅ 유효한 공정과 장면:', { processId: processId, activeSceneIndex: activeSceneIndex });

        // 자재 매칭 데이터 초기화
        if (!appState.sceneMaterialAssignments) {
            appState.sceneMaterialAssignments = {};
            console.log('🔨 sceneMaterialAssignments 초기화');
        }
        if (!appState.sceneMaterialAssignments[processId]) {
            appState.sceneMaterialAssignments[processId] = {};
            console.log('🔨 공정별 자재 매칭 데이터 초기화:', processId);
        }
        if (!appState.sceneMaterialAssignments[processId][activeSceneIndex]) {
            appState.sceneMaterialAssignments[processId][activeSceneIndex] = [];
            console.log('🔨 장면별 자재 매칭 데이터 초기화:', activeSceneIndex);
        }

        var assignments = appState.sceneMaterialAssignments[processId][activeSceneIndex];
        var materialIndex = assignments.indexOf(materialId);

        console.log('📊 현재 할당 상태:', {
            assignments: assignments,
            materialIndex: materialIndex,
            isAssigned: isAssigned
        });

        if (isAssigned && materialIndex === -1) {
            // 자재 추가
            assignments.push(materialId);
            console.log('✅ 자재 매칭 추가:', materialId, '→ 공정', processId, '장면', activeSceneIndex);
            console.log('📋 업데이트된 할당 목록:', assignments);
        } else if (!isAssigned && materialIndex !== -1) {
            // 자재 제거
            assignments.splice(materialIndex, 1);
            console.log('❌ 자재 매칭 해제:', materialId, '→ 공정', processId, '장면', activeSceneIndex);
            console.log('📋 업데이트된 할당 목록:', assignments);
        } else {
            console.log('ℹ️ 자재 할당 상태 변경 없음 (이미 처리됨)');
        }

        // 장면 자재 리스트 UI 업데이트 (핵심!)
        this.updateSceneMaterialList(activeSceneIndex);

        // 드래그앤드롭 상태 업데이트
        try {
            setTimeout(function() {
                if (typeof dragDropManager !== 'undefined' && dragDropManager.updateMaterialDragStates) {
                    dragDropManager.updateMaterialDragStates();
                    console.log('🎯 드래그앤드롭 상태 업데이트 완료');
                } else {
                    console.warn('⚠️ dragDropManager.updateMaterialDragStates 함수를 찾을 수 없음');
                }
            }, 100);
        } catch (error) {
            console.error('💥 드래그앤드롭 상태 업데이트 오류:', error);
        }

        console.log('🎯 자재 매칭 상태 업데이트 완료');

        // 3단계 완료 상태 검사 (중요!)
        if (appState.currentStep === 3) {
            stepController.checkStep3Completion();
        }
    },

    // 장면 자재 리스트 UI 업데이트 (핵심 함수!)
    updateSceneMaterialList: function(sceneIndex) {
        console.log('🎨 장면 자재 리스트 업데이트 시작:', sceneIndex);

        if (sceneIndex === null || sceneIndex === undefined) {
            console.warn('⚠️ 유효하지 않은 장면 인덱스:', sceneIndex);
            return;
        }

        var currentProcess = this.getCurrentProcess();
        if (!currentProcess) {
            console.warn('⚠️ 현재 공정을 찾을 수 없음');
            return;
        }

        var processId = currentProcess.id;

        // 장면 자재 리스트 DOM 엘리먼트 찾기
        var materialListElement = document.getElementById('scene-' + sceneIndex + '-material-list');
        if (!materialListElement) {
            console.warn('⚠️ 장면 자재 리스트 DOM을 찾을 수 없음:', 'scene-' + sceneIndex + '-material-list');
            return;
        }

        console.log('📋 DOM 엘리먼트 발견:', materialListElement);

        // 해당 장면에 할당된 자재 ID들 가져오기
        var assignments = appState.sceneMaterialAssignments &&
                         appState.sceneMaterialAssignments[processId] &&
                         appState.sceneMaterialAssignments[processId][sceneIndex] || [];

        console.log('📦 할당된 자재 ID들:', assignments);

        if (assignments.length === 0) {
            // 할당된 자재가 없는 경우도 테이블 구조 유지
            var html = '<div class="scene-material-table-container">';
            html += '<h5>현재 장면 매칭 자재 (0개)</h5>';
            html += '<table class="scene-material-table">';
            html += '<thead>';
            html += '<tr>';
            html += '<th class="material-id-col">No.</th>';
            html += '<th class="material-name-col">MATERIAL</th>';
            html += '<th class="material-item-col">ITEM</th>';
            html += '<th class="material-area-col">AREA</th>';
            html += '<th class="material-remarks-col">REMARKS</th>';
            html += '<th class="material-image-col">IMAGE</th>';
            html += '<th class="material-action-col">작업</th>';
            html += '</tr>';
            html += '</thead>';
            html += '<tbody>';
            html += '<tr><td colspan="7" class="empty-state">이 장면에 매칭된 자재가 없습니다.<br>좌측 자재표에서 체크박스를 선택하여 자재를 추가해주세요.</td></tr>';
            html += '</tbody>';
            html += '</table>';
            html += '</div>';

            materialListElement.innerHTML = html;
            console.log('📭 할당된 자재 없음 - 빈 테이블 표시');
            return;
        }

        // 할당된 자재들의 상세 정보 찾기
        var assignedMaterials = [];
        for (var i = 0; i < assignments.length; i++) {
            var materialId = assignments[i];
            var material = this.findMaterialById(materialId);
            if (material) {
                assignedMaterials.push(material);
                console.log('✅ 자재 발견:', material.id, material.material, material.item);
            } else {
                console.warn('⚠️ 자재 ID ' + materialId + '에 해당하는 자재를 찾을 수 없음');
            }
        }

        // 자재표와 동일한 테이블 형태로 HTML 생성
        var html = '<div class="scene-material-table-container">';
        html += '<h5>현재 장면 매칭 자재 (' + assignedMaterials.length + '개)</h5>';
        html += '<table class="scene-material-table">';
        html += '<thead>';
        html += '<tr>';
        html += '<th class="material-id-col">No.</th>';
        html += '<th class="material-name-col">MATERIAL</th>';
        html += '<th class="material-item-col">ITEM</th>';
        html += '<th class="material-area-col">AREA</th>';
        html += '<th class="material-remarks-col">REMARKS</th>';
        html += '<th class="material-image-col">IMAGE</th>';
        html += '<th class="material-action-col">작업</th>';
        html += '</tr>';
        html += '</thead>';
        html += '<tbody>';

        for (var i = 0; i < assignedMaterials.length; i++) {
            var material = assignedMaterials[i];
            html += '<tr class="scene-material-row" data-material-id="' + material.id + '">';

            // No.
            html += '<td class="material-id-col">' + material.displayId + '</td>';

            // MATERIAL
            html += '<td class="material-name-col">' + this.escapeHtml(material.material) + '</td>';

            // ITEM
            html += '<td class="material-item-col">' + this.escapeHtml(material.item) + '</td>';

            // AREA
            html += '<td class="material-area-col">' + this.escapeHtml(material.area) + '</td>';

            // REMARKS
            html += '<td class="material-remarks-col">' + this.escapeHtml(material.remarks) + '</td>';

            // IMAGE
            html += '<td class="material-image-col">';
            if (material.image && material.image.trim()) {
                html += '<a href="' + this.escapeHtml(material.image) + '" target="_blank">🖼️</a>';
            } else {
                html += '-';
            }
            html += '</td>';

            // 작업 (제거 버튼)
            html += '<td class="material-action-col">';
            html += '<button type="button" class="btn-remove-material" onclick="workspaceManager.removeMaterialFromScene(' + sceneIndex + ', ' + material.id + ')" title="자재 제거">';
            html += '🗑️';
            html += '</button>';
            html += '</td>';

            html += '</tr>';
        }

        html += '</tbody>';
        html += '</table>';
        html += '</div>';

        // DOM 업데이트
        materialListElement.innerHTML = html;
        console.log('🎯 장면 자재 리스트 업데이트 완료:', assignedMaterials.length + '개 자재 표시');
    },

    // 자재 ID로 자재 정보 찾기
    findMaterialById: function(materialId) {
        if (!appState.materials || appState.materials.length === 0) {
            console.warn('⚠️ 자재 데이터가 없음');
            return null;
        }

        for (var i = 0; i < appState.materials.length; i++) {
            if (appState.materials[i].id === materialId) {
                return appState.materials[i];
            }
        }

        console.warn('⚠️ 자재 ID ' + materialId + '를 찾을 수 없음');
        return null;
    },

    // 장면에서 자재 제거
    removeMaterialFromScene: function(sceneIndex, materialId) {
        console.log('🗑️ 장면에서 자재 제거:', { sceneIndex: sceneIndex, materialId: materialId });

        var currentProcess = this.getCurrentProcess();
        if (!currentProcess) {
            console.warn('⚠️ 현재 공정을 찾을 수 없음');
            return;
        }

        var processId = currentProcess.id;

        // 자재 할당에서 제거
        if (appState.sceneMaterialAssignments &&
            appState.sceneMaterialAssignments[processId] &&
            appState.sceneMaterialAssignments[processId][sceneIndex]) {

            var assignments = appState.sceneMaterialAssignments[processId][sceneIndex];
            var index = assignments.indexOf(materialId);
            if (index !== -1) {
                assignments.splice(index, 1);
                console.log('✅ 자재 할당에서 제거됨');

                // 해당 자재의 체크박스 해제
                var checkbox = document.querySelector('.material-select-checkbox[data-material-index="' + materialId + '"]');
                if (checkbox) {
                    checkbox.checked = false;
                    var row = checkbox.closest('.material-row');
                    if (row) {
                        row.classList.remove('material-selected');
                    }
                }

                // UI 업데이트
                this.updateSceneMaterialList(sceneIndex);

                // 드래그앤드롭 상태 업데이트
                if (typeof dragDropManager !== 'undefined' && dragDropManager.updateMaterialDragStates) {
                    dragDropManager.updateMaterialDragStates();
                }
            }
        }
    },

    // 체크박스 상태 되돌리기 헬퍼 함수
    revertCheckboxState: function(materialId, currentState) {
        var checkbox = document.querySelector('.material-select-checkbox[data-material-index="' + materialId + '"]');
        if (checkbox) {
            checkbox.checked = !currentState;
            console.log('🔄 체크박스 상태 되돌림:', materialId, '→', !currentState);
        }
    },

    // 특정 시트의 자재들을 표시 (삭제됨 - 재구현 예정)
    displayMaterialsForSheet: function(sheetName) {
        // 삭제됨
    },

    // 현재 공정 가져오기
    getCurrentProcess: function() {
        var currentProcessId = appState.currentProcess || 'process_1';
        return appState.processes ? appState.processes.find(function(p) { return p.id === currentProcessId; }) : null;
    },

    // 현재 활성 장면 인덱스 가져오기
    getActiveSceneIndex: function() {
        var currentProcess = this.getCurrentProcess();
        if (!currentProcess) return null;

        // 3단계에서 선택된 활성 장면이 있으면 그것 사용, 없으면 첫 번째 선택 장면
        if (currentProcess.activeSceneStep3 !== undefined) {
            return currentProcess.activeSceneStep3;
        }
        if (currentProcess.selectedScenes && currentProcess.selectedScenes.length > 0) {
            return currentProcess.selectedScenes[0];
        }
        return null;
    },

    // 자재가 특정 장면에 할당되었는지 확인
    isMaterialAssignedToScene: function(materialIndex, sceneIndex, processId) {
        // 삭제됨 - 자재표 기능 재구현 예정
        return false;
    },

    // 자재 매칭 체크박스 이벤트 바인딩
    bindMaterialAssignEvents: function() {
        // 삭제됨 - 자재표 기능 재구현 예정
    },

    // 자재 매칭 토글
    toggleMaterialAssignment: function(materialIndex, isAssigned) {
        // 삭제됨 - 자재표 기능 재구현 예정
    },

    // 자재 행 시각적 업데이트
    updateMaterialRowVisuals: function() {
        // 삭제됨 - 자재표 기능 재구현 예정
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
    },

    /**
     * 반응형 좌표 시스템 설정
     */
    setupCoordinateSystems: function() {
        console.log('좌표 시스템 설정 시작');

        // 미니맵 좌표 시스템 설정
        coordinateSystemManager.createSystem('minimap-workspace-content', {
            itemSelector: '.minimap-box',
            dataPrefix: 'normal'
        });

        // 장면 이미지 좌표 시스템 설정
        coordinateSystemManager.createSystem('scene-workspace-content', {
            itemSelector: '.material-badge',
            dataPrefix: 'normal'
        });

        console.log('좌표 시스템 설정 완료');
    },

    /**
     * 좌표 시스템 정리
     */
    cleanupCoordinateSystems: function() {
        coordinateSystemManager.destroySystem('minimap-workspace-content');
        coordinateSystemManager.destroySystem('scene-workspace-content');
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
        this.setupMaterialDragSources(); // 자재표 기능 재활성화
        this.setupSceneDropTargets();
        this.bindEvents();
        console.log('드래그앤드롭 시스템 초기화 완료');
    },

    // 자재 테이블의 드래그 소스 설정
    setupMaterialDragSources: function() {
        console.log('🎯 자재 드래그 소스 설정 시작');
        this.updateMaterialDragStates();
    },

    // 자재 드래그 상태 업데이트 (새로운 함수)
    updateMaterialDragStates: function() {
        var materialRows = document.querySelectorAll('#material-table tbody tr.material-row');

        console.log('🔄 자재 드래그 상태 업데이트:', materialRows.length + '개 행');

        for (var i = 0; i < materialRows.length; i++) {
            var row = materialRows[i];
            var materialId = parseInt(row.getAttribute('data-material-index'));

            if (this.isMaterialAssignedToCurrentScene(materialId)) {
                this.makeMaterialRowDraggable(row, materialId);
            } else {
                this.makeMaterialRowNonDraggable(row);
            }
        }
    },

    // 자재가 현재 상황에서 드래그 가능한지 확인 (수정된 로직)
    isMaterialAssignedToCurrentScene: function(materialIndex) {
        var currentProcess = workspaceManager.getCurrentProcess();
        var activeSceneIndex = workspaceManager.getActiveSceneIndex();

        console.log('🔍 드래그 가능 여부 확인:', {
            materialIndex: materialIndex,
            currentProcess: currentProcess ? currentProcess.id : null,
            activeSceneIndex: activeSceneIndex,
            selectedScenes: currentProcess ? currentProcess.selectedScenes : null
        });

        // 현재 공정이 없으면 드래그 불가
        if (!currentProcess) {
            console.log('❌ 현재 공정 없음 - 드래그 불가');
            return false;
        }

        // 현재 공정에 선택된 장면이 없으면 드래그 불가
        if (!currentProcess.selectedScenes || currentProcess.selectedScenes.length === 0) {
            console.log('❌ 선택된 장면 없음 - 드래그 불가');
            return false;
        }

        // 현재 활성 장면이 없으면 드래그 불가
        if (activeSceneIndex === null || activeSceneIndex === undefined) {
            console.log('❌ 활성 장면 없음 - 드래그 불가');
            return false;
        }

        // 활성 장면이 현재 공정의 선택된 장면 중 하나인지 확인
        var isActiveSceneSelected = currentProcess.selectedScenes.indexOf(activeSceneIndex) !== -1;

        console.log('✅ 드래그 가능 여부:', isActiveSceneSelected ? '가능' : '불가능');
        return isActiveSceneSelected;
    },

    makeMaterialRowDraggable: function(row, materialIndex) {
        var self = this;

        // 이미 드래그 가능한 상태면 스킵
        if (row.draggable) return;

        row.draggable = true;
        row.style.cursor = 'grab';
        row.classList.add('material-draggable');
        row.classList.remove('material-disabled');

        // 드래그 시작 이벤트
        row.addEventListener('dragstart', function(e) {
            // 자재 정보 찾기
            var material = self.findMaterialById(materialIndex);
            if (!material) return;

            self.draggedMaterial = {
                index: materialIndex,
                id: material.id,
                name: material.material,
                area: material.area,
                item: material.item,
                data: material
            };

            self.dragStartPosition = {
                x: e.clientX,
                y: e.clientY
            };

            row.style.cursor = 'grabbing';
            row.style.opacity = '0.7';

            e.dataTransfer.effectAllowed = 'copy';
            e.dataTransfer.setData('text/plain', 'material-' + materialIndex);

            console.log('🎯 드래그 시작:', self.draggedMaterial);
        });

        // 드래그 종료 이벤트
        row.addEventListener('dragend', function(e) {
            row.style.cursor = 'grab';
            row.style.opacity = '1';

            self.draggedMaterial = null;
            self.dragStartPosition = null;

            console.log('🏁 드래그 종료');
        });

        // 호버 효과
        row.addEventListener('mouseenter', function() {
            if (!row.style.backgroundColor) {
                row.style.backgroundColor = '#f0f8ff';
            }
        });

        row.addEventListener('mouseleave', function() {
            row.style.backgroundColor = '';
        });
    },

    // 자재 ID로 자재 정보 찾기
    findMaterialById: function(materialId) {
        if (!appState.materials) return null;

        for (var i = 0; i < appState.materials.length; i++) {
            if (appState.materials[i].id === materialId) {
                return appState.materials[i];
            }
        }
        return null;
    },

    // 자재 행을 드래그 불가능하게 설정
    makeMaterialRowNonDraggable: function(row) {
        row.draggable = false;
        row.style.cursor = 'default';
        row.classList.remove('material-draggable');
        row.classList.add('material-disabled');
        row.style.opacity = '0.7';

        // 드래그 불가능한 행을 클릭했을 때의 처리는 체크박스에서 자동으로 처리됨
    },

    // 장면 이미지의 드롭 타겟 설정
    setupSceneDropTargets: function() {
        // 기존 scene-workspace-item 방식
        var sceneContainers = document.querySelectorAll('.scene-workspace-item');
        for (var i = 0; i < sceneContainers.length; i++) {
            this.makeSceneDropTarget(sceneContainers[i]);
        }

        // 새로운 합성 Canvas 방식
        var compositeCanvas = document.getElementById('composite-scene-canvas');
        if (compositeCanvas) {
            this.makeCompositeCanvasDropTarget(compositeCanvas);
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

    // 합성 Canvas를 드롭 타겟으로 설정
    makeCompositeCanvasDropTarget: function(canvas) {
        var self = this;

        // 현재 활성 장면 ID 가져오기
        var getCurrentSceneId = function() {
            var currentProcess = workspaceManager.getCurrentProcess();
            if (!currentProcess) return null;

            var activeSceneIndex = workspaceManager.getActiveSceneForProcess(currentProcess);
            return activeSceneIndex !== null ? activeSceneIndex.toString() : null;
        };

        // 드래그 오버
        canvas.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';

            // Canvas 좌측 70% 영역에서만 드롭 허용
            var canvasRect = canvas.getBoundingClientRect();
            var dropX = e.clientX - canvasRect.left;
            var sceneAreaWidth = canvasRect.width * 0.7;

            if (dropX <= sceneAreaWidth) {
                canvas.classList.add('drag-over');
                canvas.style.borderColor = '#667eea';

                // 드래그 커서 표시
                self.showDragCursor(e, canvas);
            } else {
                canvas.classList.remove('drag-over');
                canvas.style.borderColor = '';
                self.hideDragCursor();
            }
        });

        // 드래그 진입
        canvas.addEventListener('dragenter', function(e) {
            e.preventDefault();
        });

        // 드래그 떠남
        canvas.addEventListener('dragleave', function(e) {
            canvas.classList.remove('drag-over');
            canvas.style.borderColor = '';
            self.hideDragCursor();
        });

        // 드롭 처리
        canvas.addEventListener('drop', function(e) {
            e.preventDefault();

            canvas.classList.remove('drag-over');
            canvas.style.borderColor = '';
            self.hideDragCursor();

            if (!self.draggedMaterial) return;

            var sceneId = getCurrentSceneId();
            if (!sceneId) {
                console.error('활성 장면 ID를 찾을 수 없습니다.');
                return;
            }

            // Canvas 좌표 계산
            var canvasRect = canvas.getBoundingClientRect();
            var dropX = e.clientX - canvasRect.left;
            var dropY = e.clientY - canvasRect.top;

            // 장면 영역 (좌측 70%)에서만 드롭 허용
            var sceneAreaWidth = canvasRect.width * 0.7;
            if (dropX > sceneAreaWidth) {
                console.log('미니맵 영역에 드롭 시도 - 무시됨');
                return;
            }

            // 장면 영역 내에서의 정규화된 좌표 계산
            var normalizedX = Math.max(0, Math.min(1, dropX / sceneAreaWidth));
            var normalizedY = Math.max(0, Math.min(1, dropY / canvasRect.height));

            console.log('합성 Canvas 드롭 좌표:', {
                clientX: e.clientX,
                clientY: e.clientY,
                canvasRect: canvasRect,
                dropX: dropX,
                dropY: dropY,
                sceneAreaWidth: sceneAreaWidth,
                normalizedX: normalizedX,
                normalizedY: normalizedY
            });

            self.addMaterialToScene(sceneId, self.draggedMaterial, normalizedX, normalizedY);

            console.log('합성 Canvas 자재 배치:', {
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

        // 장면 선택 변경 후 드롭 타겟 재설정 및 자재 드래그 상태 업데이트
        document.addEventListener('sceneSelectionChanged', function() {
            setTimeout(function() {
                self.setupSceneDropTargets();
                // 자재 드래그 상태도 즉시 업데이트
                self.updateMaterialDragStates();
                console.log('🔄 장면 선택 변경으로 인한 자재 드래그 상태 업데이트 완료');
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
        coordinateSystemManager.init();
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