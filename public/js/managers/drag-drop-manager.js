/**
 * 착공도서 자동생성 시스템 - 드래그앤드롭 매니저
 * Construction Document Auto Generator - Drag & Drop Manager
 */

'use strict';

/**
 * DragDropManager - 자재의 드래그앤드롭 배치 관리
 * 자재표의 자재를 장면 이미지로 드래그하여 배치하고,
 * 번호가 매겨진 배지로 표시하는 기능을 담당
 */
window.DragDropManager = function(eventManager, stateManager, workspaceManager) {

    let isInitialized = false;
    let draggedMaterial = null;
    let dragStartPosition = null;
    let materialCounter = 1; // 자재 번호 카운터

    // 설정값들
    const config = {
        maxFileSizes: {
            excel: AppConfig.get('FILES.MAX_SIZES.excel', 10 * 1024 * 1024),
            image: AppConfig.get('FILES.MAX_SIZES.image', 50 * 1024 * 1024)
        },
        performance: {
            batchSize: AppConfig.get('PERFORMANCE.BATCH_SIZE', 5)
        }
    };

    /**
     * DragDropManager 초기화
     */
    function init() {
        if (isInitialized) {
            AppConfig.log('DragDropManager가 이미 초기화되었습니다', 'warn');
            return Promise.resolve();
        }

        return new Promise(function(resolve, reject) {
            try {
                AppConfig.log('DragDropManager 초기화 시작');

                // 의존성 확인
                if (!eventManager || !stateManager || !workspaceManager) {
                    throw new Error('필수 의존성 누락: EventManager, StateManager, WorkspaceManager 필요');
                }

                // 이벤트 리스너 설정
                bindEvents();

                isInitialized = true;
                AppConfig.log('DragDropManager 초기화 완료');

                // 초기화 완료 이벤트 발생
                eventManager.emit('dragdrop:initialized');

                resolve();

            } catch (error) {
                AppConfig.log('DragDropManager 초기화 실패: ' + error.message, 'error');
                reject(error);
            }
        });
    }

    /**
     * 이벤트 바인딩
     */
    function bindEvents() {
        // 자재표 로드 완료 시 드래그 소스 설정
        eventManager.on('material-table:rendered', setupMaterialDragSources);

        // 작업공간 설정 완료 시 드롭 타겟 설정
        eventManager.on('workspace:setup-complete', setupSceneDropTargets);

        // 프로세스 변경 시 드래그 상태 업데이트
        eventManager.on('process:switched', function(data) {
            setupMaterialDragSources();
        });

        // 장면 선택 변경 시 드래그 상태 업데이트
        eventManager.on('scene:selection-changed', function(data) {
            setupMaterialDragSources();
        });

        AppConfig.log('DragDropManager 이벤트 바인딩 완료');
    }

    /**
     * 자재 테이블의 드래그 소스 설정
     */
    function setupMaterialDragSources() {
        const materialRows = document.querySelectorAll('#material-table tbody tr');

        for (let i = 0; i < materialRows.length; i++) {
            const row = materialRows[i];
            const materialIndex = parseInt(row.getAttribute('data-material-index'));

            // 매칭된 자재만 드래그 가능하도록 설정
            if (isMaterialAssignedToCurrentScene(materialIndex)) {
                makeMaterialRowDraggable(row, materialIndex);
            } else {
                makeMaterialRowNonDraggable(row);
            }
        }
    }

    /**
     * 자재가 현재 활성 장면에 매칭되었는지 확인
     */
    function isMaterialAssignedToCurrentScene(materialIndex) {
        return workspaceManager.isMaterialAssignedToScene(
            materialIndex,
            workspaceManager.getActiveSceneIndex(),
            workspaceManager.getCurrentProcess()?.id
        );
    }

    /**
     * 자재 행을 드래그 가능하게 설정
     */
    function makeMaterialRowDraggable(row, materialIndex) {
        row.draggable = true;
        row.style.cursor = 'grab';

        // 드래그 시작 이벤트
        row.addEventListener('dragstart', function(e) {
            const materials = stateManager.getState('materials') || [];
            draggedMaterial = {
                index: materialIndex,
                name: row.cells[1] ? row.cells[1].textContent : '자재 ' + (materialIndex + 1),
                category: row.cells[0] ? row.cells[0].textContent : '기본',
                data: materials[materialIndex] || null
            };

            dragStartPosition = {
                x: e.clientX,
                y: e.clientY
            };

            row.style.cursor = 'grabbing';
            row.style.opacity = '0.7';

            // 드래그 이미지 설정
            const dragImage = row.cloneNode(true);
            dragImage.style.backgroundColor = '#f0f4ff';
            dragImage.style.border = '2px solid #667eea';
            dragImage.style.borderRadius = '4px';

            e.dataTransfer.effectAllowed = 'copy';
            e.dataTransfer.setData('text/plain', 'material-' + materialIndex);

            AppConfig.log('드래그 시작: ' + draggedMaterial.name);
            eventManager.emit('material:drag-start', { material: draggedMaterial });
        });

        // 드래그 종료 이벤트
        row.addEventListener('dragend', function(e) {
            row.style.cursor = 'grab';
            row.style.opacity = '1';

            AppConfig.log('드래그 종료');
            eventManager.emit('material:drag-end', { material: draggedMaterial });

            draggedMaterial = null;
            dragStartPosition = null;
        });

        // 호버 효과
        row.addEventListener('mouseenter', function() {
            row.style.backgroundColor = '#f8f9ff';
        });

        row.addEventListener('mouseleave', function() {
            row.style.backgroundColor = '';
        });
    }

    /**
     * 자재 행을 드래그 불가능하게 설정
     */
    function makeMaterialRowNonDraggable(row) {
        // 드래그 비활성화
        row.draggable = false;
        row.style.cursor = 'not-allowed';

        // 기존 이벤트 리스너 제거 (새로운 클론으로 교체)
        const newRow = row.cloneNode(true);
        row.parentNode.replaceChild(newRow, row);

        // 비활성 상태 스타일 적용
        newRow.classList.add('material-drag-disabled');
        newRow.style.opacity = '0.5';

        // 클릭 시 안내 메시지
        newRow.addEventListener('click', function(e) {
            e.preventDefault();
            eventManager.emit('error:show', {
                message: '이 자재를 드래그하려면 먼저 현재 장면에 매칭해주세요.'
            });
        });

        // 호버 효과 (비활성 상태)
        newRow.addEventListener('mouseenter', function() {
            newRow.style.backgroundColor = '#f5f5f5';
        });

        newRow.addEventListener('mouseleave', function() {
            newRow.style.backgroundColor = '';
        });
    }

    /**
     * 장면 이미지의 드롭 타겟 설정
     */
    function setupSceneDropTargets() {
        const sceneContainers = document.querySelectorAll('.scene-workspace-item');

        for (let i = 0; i < sceneContainers.length; i++) {
            makeSceneDropTarget(sceneContainers[i]);
        }
    }

    /**
     * 장면 컨테이너를 드롭 타겟으로 설정
     */
    function makeSceneDropTarget(sceneContainer) {
        const sceneImage = sceneContainer.querySelector('.scene-workspace-image');
        const sceneId = sceneContainer.getAttribute('data-scene-id');

        if (!sceneImage || !sceneId) return;

        // 드래그 오버 이벤트
        sceneContainer.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';

            sceneContainer.style.backgroundColor = 'rgba(102, 126, 234, 0.1)';
            sceneContainer.style.border = '2px dashed #667eea';

            showDragCursor(e, sceneImage);
        });

        // 드래그 진입 이벤트
        sceneContainer.addEventListener('dragenter', function(e) {
            e.preventDefault();
        });

        // 드래그 벗어남 이벤트
        sceneContainer.addEventListener('dragleave', function(e) {
            sceneContainer.style.backgroundColor = '';
            sceneContainer.style.border = '';
            hideDragCursor();
        });

        // 드롭 이벤트
        sceneContainer.addEventListener('drop', function(e) {
            e.preventDefault();

            sceneContainer.style.backgroundColor = '';
            sceneContainer.style.border = '';
            hideDragCursor();

            if (!draggedMaterial) {
                AppConfig.log('드롭된 자재 정보 없음', 'warn');
                return;
            }

            // 이미지 내 좌표 계산
            const imageRect = sceneImage.getBoundingClientRect();
            const dropX = e.clientX - imageRect.left;
            const dropY = e.clientY - imageRect.top;

            // 정규화된 좌표 (0-1 범위)
            const normalizedX = dropX / imageRect.width;
            const normalizedY = dropY / imageRect.height;

            // 이미지 영역 내부 확인
            if (normalizedX < 0 || normalizedX > 1 || normalizedY < 0 || normalizedY > 1) {
                AppConfig.log('드롭 위치가 이미지 영역 밖임', 'warn');
                return;
            }

            AppConfig.log('드롭 좌표: ' + JSON.stringify({
                clientX: e.clientX,
                clientY: e.clientY,
                imageRect: imageRect,
                dropX: dropX,
                dropY: dropY,
                normalizedX: normalizedX,
                normalizedY: normalizedY
            }));

            addMaterialToScene(sceneId, draggedMaterial, normalizedX, normalizedY);
        });
    }

    /**
     * 장면에 자재 추가
     */
    function addMaterialToScene(sceneId, material, normalizedX, normalizedY) {
        // 데이터 구조 초기화
        let sceneMaterialPositions = stateManager.getState('sceneMaterialPositions') || {};

        if (!sceneMaterialPositions[sceneId]) {
            sceneMaterialPositions[sceneId] = [];
        }

        // 자재 배치 정보 저장
        const placement = {
            id: 'material-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            materialIndex: material.index,
            materialName: material.name,
            materialCategory: material.category,
            number: materialCounter++,
            normalizedX: normalizedX,
            normalizedY: normalizedY,
            timestamp: new Date().getTime()
        };

        sceneMaterialPositions[sceneId].push(placement);
        stateManager.updateState('sceneMaterialPositions', sceneMaterialPositions);

        // 화면에 번호 배지 표시
        renderMaterialBadge(sceneId, placement);

        // 자재 목록 업데이트
        updateMaterialList(sceneId);

        // 이벤트 발생
        eventManager.emit('material:placed', {
            sceneId: sceneId,
            material: material,
            placement: placement
        });

        AppConfig.log('자재 "' + material.name + '"이(가) 배치되었습니다. (번호: ' + placement.number + ')');
    }

    /**
     * 자재 번호 배지 렌더링
     */
    function renderMaterialBadge(sceneId, placement) {
        const sceneContainer = document.querySelector('.scene-workspace-item[data-scene-id="' + sceneId + '"]');
        if (!sceneContainer) return;

        const sceneImage = sceneContainer.querySelector('.scene-workspace-image');
        if (!sceneImage) return;

        // 배지 컨테이너 찾기 또는 생성
        let badgeContainer = sceneContainer.querySelector('.material-badges');
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
        const badge = document.createElement('div');
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
        badge.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        badge.style.pointerEvents = 'auto';
        badge.textContent = placement.number;

        // 배지 클릭 이벤트
        badge.addEventListener('click', function(e) {
            e.stopPropagation();
            showMaterialInfo(sceneId, placement);
        });

        badgeContainer.appendChild(badge);
    }

    /**
     * 자재 정보 모달 표시
     */
    function showMaterialInfo(sceneId, placement) {
        eventManager.emit('modal:show', {
            id: 'info-modal',
            title: '자재 정보',
            content: '<div class="material-info">' +
                     '<h4>자재명: ' + placement.materialName + '</h4>' +
                     '<p><strong>카테고리:</strong> ' + placement.materialCategory + '</p>' +
                     '<p><strong>번호:</strong> ' + placement.number + '</p>' +
                     '<p><strong>배치 시간:</strong> ' + new Date(placement.timestamp).toLocaleString() + '</p>' +
                     '</div>',
            buttons: [
                {
                    text: '위치 이동',
                    className: 'btn btn-secondary',
                    onclick: function() {
                        startMaterialMove(sceneId, placement.id);
                    }
                },
                {
                    text: '삭제',
                    className: 'btn btn-danger',
                    onclick: function() {
                        removeMaterialFromScene(sceneId, placement.id);
                    }
                },
                {
                    text: '닫기',
                    className: 'btn btn-primary',
                    onclick: function() {
                        eventManager.emit('modal:close', { id: 'info-modal' });
                    }
                }
            ]
        });
    }

    /**
     * 장면에서 자재 제거
     */
    function removeMaterialFromScene(sceneId, placementId) {
        let sceneMaterialPositions = stateManager.getState('sceneMaterialPositions') || {};

        if (!sceneMaterialPositions[sceneId]) return;

        const placements = sceneMaterialPositions[sceneId];
        let removedPlacement = null;

        for (let i = 0; i < placements.length; i++) {
            if (placements[i].id === placementId) {
                removedPlacement = placements.splice(i, 1)[0];
                break;
            }
        }

        if (removedPlacement) {
            // 상태 업데이트
            stateManager.updateState('sceneMaterialPositions', sceneMaterialPositions);

            // 배지 제거
            const badge = document.querySelector('.material-badge[data-placement-id="' + placementId + '"]');
            if (badge) {
                badge.remove();
            }

            // 자재 목록 업데이트
            updateMaterialList(sceneId);

            // 이벤트 발생
            eventManager.emit('material:removed', {
                sceneId: sceneId,
                placement: removedPlacement
            });

            // 모달 닫기
            eventManager.emit('modal:close', { id: 'info-modal' });

            AppConfig.log('자재 "' + removedPlacement.materialName + '"이(가) 제거되었습니다.');
        }
    }

    /**
     * 자재 이동 시작
     */
    function startMaterialMove(sceneId, placementId) {
        // 모달 닫기
        eventManager.emit('modal:close', { id: 'info-modal' });

        const sceneContainer = document.querySelector('.scene-workspace-item[data-scene-id="' + sceneId + '"]');
        if (!sceneContainer) return;

        const badge = sceneContainer.querySelector('.material-badge[data-placement-id="' + placementId + '"]');
        if (!badge) return;

        // 이동 모드 활성화
        badge.style.animation = 'pulse 1s infinite';
        badge.style.boxShadow = '0 0 10px #667eea';

        const moveHandler = function(e) {
            const sceneImage = sceneContainer.querySelector('.scene-workspace-image');
            const imageRect = sceneImage.getBoundingClientRect();

            const clickX = e.clientX - imageRect.left;
            const clickY = e.clientY - imageRect.top;

            const normalizedX = clickX / imageRect.width;
            const normalizedY = clickY / imageRect.height;

            if (normalizedX >= 0 && normalizedX <= 1 && normalizedY >= 0 && normalizedY <= 1) {
                moveMaterial(sceneId, placementId, normalizedX, normalizedY);

                sceneContainer.removeEventListener('click', moveHandler);
                badge.style.animation = '';
                badge.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
            }
        };

        sceneContainer.addEventListener('click', moveHandler);
        eventManager.emit('info:show', { message: '새로운 위치를 클릭하세요.' });
    }

    /**
     * 자재 위치 이동
     */
    function moveMaterial(sceneId, placementId, newNormalizedX, newNormalizedY) {
        let sceneMaterialPositions = stateManager.getState('sceneMaterialPositions') || {};

        if (!sceneMaterialPositions[sceneId]) return;

        const placements = sceneMaterialPositions[sceneId];
        let targetPlacement = null;

        for (let i = 0; i < placements.length; i++) {
            if (placements[i].id === placementId) {
                targetPlacement = placements[i];
                break;
            }
        }

        if (targetPlacement) {
            // 위치 업데이트
            targetPlacement.normalizedX = newNormalizedX;
            targetPlacement.normalizedY = newNormalizedY;
            targetPlacement.timestamp = new Date().getTime();

            // 상태 업데이트
            stateManager.updateState('sceneMaterialPositions', sceneMaterialPositions);

            // 배지 위치 업데이트
            const badge = document.querySelector('.material-badge[data-placement-id="' + placementId + '"]');
            if (badge) {
                badge.style.left = (newNormalizedX * 100) + '%';
                badge.style.top = (newNormalizedY * 100) + '%';
            }

            // 이벤트 발생
            eventManager.emit('material:moved', {
                sceneId: sceneId,
                placement: targetPlacement
            });

            AppConfig.log('자재 "' + targetPlacement.materialName + '"의 위치가 이동되었습니다.');
        }
    }

    /**
     * 자재 목록 업데이트
     */
    function updateMaterialList(sceneId) {
        const sceneMaterialPositions = stateManager.getState('sceneMaterialPositions') || {};
        const placements = sceneMaterialPositions[sceneId] || [];

        // 자재 목록 업데이트 이벤트 발생
        eventManager.emit('material-list:update', {
            sceneId: sceneId,
            placements: placements,
            count: placements.length
        });
    }

    /**
     * 자재 배치 데이터 검증
     */
    function validateMaterialPlacements() {
        const sceneMaterialPositions = stateManager.getState('sceneMaterialPositions') || {};
        let isValid = true;

        for (const sceneId in sceneMaterialPositions) {
            const placements = sceneMaterialPositions[sceneId];
            for (let i = 0; i < placements.length; i++) {
                const placement = placements[i];

                if (!placement.id || !placement.materialName ||
                    typeof placement.normalizedX !== 'number' ||
                    typeof placement.normalizedY !== 'number') {
                    AppConfig.log('잘못된 자재 배치 데이터: ' + JSON.stringify(placement), 'warn');
                    isValid = false;
                }
            }
        }

        return isValid;
    }

    /**
     * 드래그 커서 표시
     */
    function showDragCursor(e, sceneImage) {
        const cursorId = 'drag-cursor-indicator';
        let existingCursor = document.getElementById(cursorId);

        if (!existingCursor) {
            const cursor = document.createElement('div');
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
        const imageRect = sceneImage.getBoundingClientRect();
        const isInImage = (e.clientX >= imageRect.left && e.clientX <= imageRect.right &&
                         e.clientY >= imageRect.top && e.clientY <= imageRect.bottom);

        if (isInImage) {
            existingCursor.style.left = e.clientX + 'px';
            existingCursor.style.top = e.clientY + 'px';
            existingCursor.style.display = 'block';
        } else {
            existingCursor.style.display = 'none';
        }
    }

    /**
     * 드래그 커서 숨기기
     */
    function hideDragCursor() {
        const cursor = document.getElementById('drag-cursor-indicator');
        if (cursor) {
            cursor.style.display = 'none';
        }
    }

    /**
     * 정리 함수
     */
    function cleanup() {
        if (!isInitialized) return;

        AppConfig.log('DragDropManager 정리 시작');

        // 드래그 커서 제거
        hideDragCursor();
        const cursor = document.getElementById('drag-cursor-indicator');
        if (cursor) {
            cursor.remove();
        }

        // 이벤트 리스너 정리
        eventManager.off('material-table:rendered', setupMaterialDragSources);
        eventManager.off('workspace:setup-complete', setupSceneDropTargets);

        // 상태 초기화
        draggedMaterial = null;
        dragStartPosition = null;
        materialCounter = 1;
        isInitialized = false;

        AppConfig.log('DragDropManager 정리 완료');
    }

    // Public API
    return {
        init: init,
        cleanup: cleanup,

        // 드래그앤드롭 관리
        setupMaterialDragSources: setupMaterialDragSources,
        setupSceneDropTargets: setupSceneDropTargets,

        // 자재 배치 관리
        addMaterialToScene: addMaterialToScene,
        removeMaterialFromScene: removeMaterialFromScene,
        moveMaterial: moveMaterial,
        startMaterialMove: startMaterialMove,

        // 렌더링 및 UI
        renderMaterialBadge: renderMaterialBadge,
        updateMaterialList: updateMaterialList,

        // 유틸리티
        validateMaterialPlacements: validateMaterialPlacements,

        // 디버그 정보
        getState: function() {
            return {
                initialized: isInitialized,
                draggedMaterial: draggedMaterial,
                materialCounter: materialCounter
            };
        }
    };
};

// ModuleLoader와 통합
if (window.ModuleLoader) {
    let dragDropManagerInstance = null;

    ModuleLoader.define('DragDropManager', function(eventManager, stateManager, workspaceManager) {
        if (!dragDropManagerInstance) {
            dragDropManagerInstance = DragDropManager(eventManager, stateManager, workspaceManager);
        }
        return dragDropManagerInstance;
    }, ['EventManager', 'StateManager', 'WorkspaceManager']);
}

// 전역 접근을 위한 설정
window.dragDropManager = null;

console.log('✅ DragDropManager 모듈 로드 완료');