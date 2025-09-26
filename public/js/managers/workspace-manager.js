/**
 * 착공도서 자동생성 시스템 - 작업공간 관리 매니저
 * Construction Document Auto Generator - Workspace Manager
 */

'use strict';

/**
 * WorkspaceManager 모듈 팩토리
 * 의존성: EventManager, StateManager
 */
window.WorkspaceManager = function(eventManager, stateManager) {

    // 의존성 검사
    if (!eventManager || !stateManager) {
        throw new Error('WorkspaceManager: 필수 의존성이 누락되었습니다');
    }

    AppConfig.log('WorkspaceManager 모듈 생성 시작');

    // 내부 상태
    let isInitialized = false;
    let currentProcessId = null;
    let materialTableRendered = false;
    let sessionImageCache = window.sessionImageCache || {};

    /**
     * 3단계 진입 시 작업공간 구성
     */
    function setupWorkspace() {
        AppConfig.log('작업공간 설정 시작');

        try {
            const workspaceElement = document.getElementById('workspace');
            if (!workspaceElement) {
                throw new Error('작업공간 엘리먼트를 찾을 수 없습니다');
            }

            // 데이터 유효성 검사
            const processes = stateManager.getState('processes') || [];
            const sceneImages = stateManager.getState('sceneImages') || [];

            if (processes.length === 0) {
                eventManager.emit('error:show', {
                    message: '공정 데이터가 없습니다.\n2단계에서 공정을 먼저 설정해주세요.'
                });
                return;
            }

            if (sceneImages.length === 0) {
                eventManager.emit('error:show', {
                    message: '장면 이미지가 없습니다.\n1단계에서 이미지를 먼저 업로드해주세요.'
                });
                return;
            }

            AppConfig.log('데이터 상태', {
                processes: processes.length,
                sceneImages: sceneImages.length,
                materials: stateManager.getState('materials')?.length || 0
            });

            // 기존 내용 제거
            workspaceElement.innerHTML = '';

            // 공정 선택 탭 생성
            renderProcessSelector(workspaceElement);

            // 공정 하위 장면탭 컨테이너 생성
            const sceneTabsContainer = document.createElement('div');
            sceneTabsContainer.id = 'scene-tabs-container-step3';
            sceneTabsContainer.className = 'scene-tabs-container-step3';
            sceneTabsContainer.innerHTML = '<div id="scene-tabs-step3" class="scene-tabs-step3"></div>';
            workspaceElement.appendChild(sceneTabsContainer);

            // 작업공간 컨테이너 생성 (2행 레이아웃)
            const container = document.createElement('div');
            container.className = 'workspace-container';
            container.innerHTML = `
                <div class="workspace-top-row">
                    <div class="minimap-workspace" id="minimap-workspace">
                        <h3>미니맵</h3>
                        <div id="minimap-workspace-content"></div>
                    </div>
                    <div class="scene-workspace" id="scene-workspace">
                        <h3>현재 작업 장면</h3>
                        <div id="scene-workspace-content"></div>
                    </div>
                </div>
                <div class="workspace-bottom-row">
                    <div class="material-workspace" id="material-workspace">
                        <h3>자재표</h3>
                        <div id="material-workspace-content"></div>
                    </div>
                </div>
            `;
            workspaceElement.appendChild(container);

            // 반응형 좌표 시스템 생성
            setupCoordinateSystems();

            // 첫 번째 공정이 있으면 자동 선택
            selectProcess(processes[0].id);

            AppConfig.log('작업공간 설정 완료');

        } catch (error) {
            AppConfig.log(`작업공간 설정 오류: ${error.message}`, 'error');
            eventManager.emit('error:show', {
                message: `작업공간 초기화 중 오류가 발생했습니다:\n${error.message}`
            });
        }
    }

    /**
     * 공정 선택 탭 렌더링
     */
    function renderProcessSelector(parentElement) {
        const processes = stateManager.getState('processes') || [];

        let selectorHTML = '<div class="process-tabs-workspace">';
        selectorHTML += '<div class="workspace-tabs">';

        processes.forEach((process, i) => {
            const sceneCount = process.selectedScenes.length;
            const isActive = i === 0 ? ' active' : '';
            selectorHTML += `<button class="workspace-tab${isActive}" data-process-id="${process.id}">`;
            selectorHTML += `${process.name} (${sceneCount}개 장면)`;
            selectorHTML += '</button>';
        });

        selectorHTML += '</div></div>';

        const selectorElement = document.createElement('div');
        selectorElement.innerHTML = selectorHTML;
        parentElement.appendChild(selectorElement);

        // 탭 클릭 이벤트 바인딩
        const tabButtons = selectorElement.querySelectorAll('.workspace-tab');

        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                // 모든 탭의 active 클래스 제거
                tabButtons.forEach(tab => tab.classList.remove('active'));

                // 클릭된 탭에 active 클래스 추가
                this.classList.add('active');

                const processId = this.getAttribute('data-process-id');
                if (processId) {
                    selectProcess(processId);
                } else {
                    clearWorkspace();
                }
            });
        });
    }

    /**
     * 공정 선택
     */
    function selectProcess(processId) {
        currentProcessId = processId;

        const processes = stateManager.getState('processes') || [];
        const process = processes.find(p => p.id === processId);

        if (!process) {
            AppConfig.log(`공정을 찾을 수 없습니다: ${processId}`, 'error');
            return;
        }

        // 3단계 장면탭 렌더링
        renderSceneTabsStep3(process);

        // 현재 활성 장면 정보 가져오기
        const activeSceneIndex = getActiveSceneForProcess(process);

        // 미니맵 작업공간 렌더링
        renderMinimapWorkspace(process, activeSceneIndex);

        // 장면 작업공간 렌더링
        renderSceneWorkspace(process);

        // 자재표 작업공간 렌더링
        renderMaterialWorkspace();

        AppConfig.log(`공정 선택됨: ${process.name} (${process.selectedScenes.length}개 장면)`);

        // 이벤트 발생
        eventManager.emit('workspace:process-selected', {
            processId,
            processName: process.name,
            sceneCount: process.selectedScenes.length
        });
    }

    /**
     * 3단계 장면탭 렌더링
     */
    function renderSceneTabsStep3(process) {
        const tabsContainer = document.getElementById('scene-tabs-step3');
        if (!tabsContainer) {
            AppConfig.log('장면탭 컨테이너를 찾을 수 없습니다', 'error');
            return;
        }

        if (!process.selectedScenes || process.selectedScenes.length === 0) {
            tabsContainer.innerHTML = '<p class="no-scenes">이 공정에 선택된 장면이 없습니다.</p>';
            return;
        }

        const sceneImages = stateManager.getState('sceneImages') || [];
        let html = '';

        process.selectedScenes.forEach((sceneIndex, i) => {
            const sceneData = sceneImages[sceneIndex];
            if (sceneData) {
                const isActive = (i === 0) ? ' active' : '';
                html += `<div class="scene-tab-step3${isActive}" data-scene-index="${sceneIndex}" data-process-id="${process.id}">`;
                html += `<span class="scene-tab-name">${sceneData.name}</span>`;
                html += `<span class="scene-tab-number">${i + 1}</span>`;
                html += '</div>';
            }
        });

        tabsContainer.innerHTML = html;

        // 장면탭 클릭 이벤트 바인딩
        bindSceneTabsStep3Events();

        AppConfig.log(`3단계 장면탭 렌더링 완료: ${process.selectedScenes.length}개 탭`);
    }

    /**
     * 3단계 장면탭 클릭 이벤트 바인딩
     */
    function bindSceneTabsStep3Events() {
        const tabs = document.querySelectorAll('.scene-tab-step3');

        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const sceneIndex = parseInt(this.dataset.sceneIndex);
                const processId = this.dataset.processId;

                // 모든 탭에서 active 클래스 제거
                tabs.forEach(t => t.classList.remove('active'));

                // 클릭된 탭에 active 클래스 추가
                this.classList.add('active');

                // 해당 공정에 활성 장면 저장
                const processes = stateManager.getState('processes') || [];
                const processIndex = processes.findIndex(p => p.id === processId);
                if (processIndex !== -1) {
                    processes[processIndex].activeSceneStep3 = sceneIndex;
                    stateManager.updateState('processes', processes);
                }

                // 미니맵과 장면 작업공간 다시 렌더링
                const process = processes[processIndex];
                if (process) {
                    renderMinimapWorkspace(process, sceneIndex);
                    renderSceneWorkspace(process);
                }

                const sceneImages = stateManager.getState('sceneImages') || [];
                AppConfig.log(`3단계 장면탭 전환: ${sceneIndex}, ${sceneImages[sceneIndex]?.name}`);

                // 이벤트 발생
                eventManager.emit('workspace:scene-selected', {
                    processId,
                    sceneIndex,
                    sceneName: sceneImages[sceneIndex]?.name
                });
            });
        });
    }

    /**
     * 공정의 현재 활성 장면 가져오기
     */
    function getActiveSceneForProcess(process) {
        // 저장된 활성 장면이 있으면 사용
        if (process.activeSceneStep3 !== undefined && process.selectedScenes.indexOf(process.activeSceneStep3) !== -1) {
            return process.activeSceneStep3;
        }

        // 없으면 첫 번째 선택된 장면을 기본으로 설정
        if (process.selectedScenes && process.selectedScenes.length > 0) {
            const processes = stateManager.getState('processes') || [];
            const processIndex = processes.findIndex(p => p.id === process.id);
            if (processIndex !== -1) {
                processes[processIndex].activeSceneStep3 = process.selectedScenes[0];
                stateManager.updateState('processes', processes);
            }
            return process.selectedScenes[0];
        }

        return null;
    }

    /**
     * 미니맵 작업공간 렌더링
     */
    function renderMinimapWorkspace(process) {
        AppConfig.log('미니맵 작업공간 렌더링 시작');

        try {
            const contentElement = document.getElementById('minimap-workspace-content');
            if (!contentElement) {
                AppConfig.log('minimap-workspace-content 요소를 찾을 수 없습니다', 'error');
                return;
            }

            const minimapImage = stateManager.getState('minimapImage');
            if (!minimapImage) {
                contentElement.innerHTML = '<p class="empty-state">미니맵 이미지가 업로드되지 않았습니다.</p>';
                return;
            }

            // 활성 장면 정보 가져오기
            const activeSceneIndex = getActiveSceneForProcess(process);
            const sceneImages = stateManager.getState('sceneImages') || [];
            const activeSceneData = activeSceneIndex !== null ? sceneImages[activeSceneIndex] : null;

            // 미니맵 컨테이너 생성
            let html = '<div class="minimap-container" id="minimap-container" style="position: relative; display: inline-block; cursor: crosshair;">';
            html += `<img src="${minimapImage}" alt="미니맵" class="minimap-image" style="max-width: 100%; height: auto;">`;
            html += '<div class="minimap-overlays" id="minimap-overlays" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></div>';
            html += '</div>';

            // 사용자 안내 정보
            html += '<div class="minimap-controls" style="margin-top: 10px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;">';
            html += '<h4 style="margin: 0 0 8px 0; font-size: 14px;">현재 작업 장면</h4>';

            if (activeSceneData) {
                html += '<div style="display: flex; align-items: center; margin-bottom: 8px;">';
                html += '<span style="display: inline-block; width: 60px; height: 20px; background: #667eea; margin-right: 8px; text-align: center; color: white; font-size: 11px; line-height: 20px; border-radius: 2px; font-weight: bold;">작업중</span>';
                html += `<span style="font-size: 13px; font-weight: 500;">${activeSceneData.name}</span>`;
                html += '</div>';
                html += '<p style="margin: 0; color: #666; font-size: 12px;">📍 마우스를 드래그하여 이 장면의 위치를 표시하세요</p>';
                html += '<button id="clear-minimap-boxes" class="btn btn-sm btn-secondary" style="margin-top: 8px;">빨간박스 전체 제거</button>';
            } else {
                html += '<p style="margin: 0; color: #666; font-size: 13px;">활성 장면이 선택되지 않았습니다.</p>';
            }

            html += '</div>';

            contentElement.innerHTML = html;

            // 드래그 그리기 이벤트 추가
            setupMinimapDragDrawing();

            AppConfig.log('미니맵 렌더링 완료');

        } catch (error) {
            AppConfig.log(`미니맵 작업공간 렌더링 오류: ${error.message}`, 'error');
            const contentElement = document.getElementById('minimap-workspace-content');
            if (contentElement) {
                contentElement.innerHTML = '<p class="empty-state">미니맵 표시 중 오류가 발생했습니다.</p>';
            }
        }
    }

    /**
     * 미니맵 드래그 그리기 설정 (성능 최적화 버전)
     */
    function setupMinimapDragDrawing() {
        const minimapContainer = document.getElementById('minimap-container');
        const overlaysContainer = document.getElementById('minimap-overlays');
        const clearButton = document.getElementById('clear-minimap-boxes');

        if (!minimapContainer || !overlaysContainer) {
            AppConfig.log('미니맵 컨테이너를 찾을 수 없습니다', 'error');
            return;
        }

        AppConfig.log('미니맵 컨테이너 확인', {
            minimapContainer: !!minimapContainer,
            overlaysContainer: !!overlaysContainer,
            minimapImage: !!minimapContainer.querySelector('.minimap-image')
        });

        let isDrawing = false;
        let currentBox = null;
        let startX = 0;
        let startY = 0;
        let animationFrameId = null;
        let lastUpdateTime = 0;
        const updateThreshold = 16; // 60fps를 위한 16ms 간격

        // 성능 최적화된 박스 업데이트 함수
        function updateBoxPosition(currentX, currentY) {
            if (!currentBox || !isDrawing) return;

            const now = performance.now();
            if (now - lastUpdateTime < updateThreshold) return;

            const left = Math.min(startX, currentX);
            const top = Math.min(startY, currentY);
            const width = Math.abs(currentX - startX);
            const height = Math.abs(currentY - startY);

            // CSS transform 사용으로 리플로우 최소화
            requestAnimationFrame(() => {
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
            AppConfig.log('미니맵 마우스다운 이벤트', {
                target: e.target.tagName,
                className: e.target.className,
                hasMinimapImageClass: e.target.classList.contains('minimap-image')
            });

            if (e.target.classList.contains('minimap-image')) {
                e.preventDefault();
                e.stopPropagation();

                isDrawing = true;
                lastUpdateTime = 0; // 초기화

                const rect = minimapContainer.getBoundingClientRect();
                startX = e.clientX - rect.left;
                startY = e.clientY - rect.top;

                // 새 빨간박스 생성
                currentBox = document.createElement('div');
                currentBox.className = 'minimap-box';
                currentBox.style.cssText = `
                    position: absolute;
                    border: 3px solid #ff4444;
                    background: rgba(255, 68, 68, 0.2);
                    left: ${startX}px;
                    top: ${startY}px;
                    width: 0px;
                    height: 0px;
                    pointer-events: auto;
                    cursor: move;
                    will-change: transform;
                `;

                overlaysContainer.appendChild(currentBox);

                AppConfig.log(`빨간박스 그리기 시작: ${startX}, ${startY}`);
            } else {
                AppConfig.log('미니맵 이미지가 아닌 요소 클릭됨');
            }
        });

        // 마우스 이동 - 드래그 중 (성능 최적화)
        minimapContainer.addEventListener('mousemove', function(e) {
            if (!isDrawing || !currentBox) return;

            const rect = minimapContainer.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;

            // Throttled update with requestAnimationFrame
            updateBoxPosition(currentX, currentY);
        });

        // 마우스 업 - 드래그 종료
        minimapContainer.addEventListener('mouseup', function(e) {
            if (!isDrawing || !currentBox) return;

            isDrawing = false;

            // 애니메이션 프레임 정리
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }

            // 너무 작은 박스는 제거
            if (parseInt(currentBox.style.width) < 10 || parseInt(currentBox.style.height) < 10) {
                overlaysContainer.removeChild(currentBox);
                AppConfig.log('너무 작은 박스 제거됨');
            } else {
                // will-change 속성 제거 (완성된 요소는 최적화 해제)
                currentBox.style.willChange = 'auto';

                // 박스에 삭제 버튼 추가
                addBoxDeleteButton(currentBox);
                AppConfig.log('빨간박스 생성 완료', {
                    left: currentBox.style.left,
                    top: currentBox.style.top,
                    width: currentBox.style.width,
                    height: currentBox.style.height
                });
            }

            currentBox = null;
        });

        // 터치 이벤트 지원 추가 (모바일 호환성)
        minimapContainer.addEventListener('touchstart', function(e) {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY,
                bubbles: true
            });
            minimapContainer.dispatchEvent(mouseEvent);
        }, { passive: false });

        minimapContainer.addEventListener('touchmove', function(e) {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY,
                bubbles: true
            });
            minimapContainer.dispatchEvent(mouseEvent);
        }, { passive: false });

        minimapContainer.addEventListener('touchend', function(e) {
            e.preventDefault();
            const mouseEvent = new MouseEvent('mouseup', {
                bubbles: true
            });
            minimapContainer.dispatchEvent(mouseEvent);
        });

        // 전체 제거 버튼 이벤트
        if (clearButton) {
            clearButton.addEventListener('click', function() {
                const boxes = overlaysContainer.querySelectorAll('.minimap-box');
                boxes.forEach(box => overlaysContainer.removeChild(box));
                AppConfig.log('모든 빨간박스 제거됨');
            });
        }

        AppConfig.log('미니맵 드래그 그리기 설정 완료 (성능 최적화 적용)');
    }

    /**
     * 박스에 삭제 버튼 추가
     */
    function addBoxDeleteButton(box) {
        const deleteBtn = document.createElement('div');
        deleteBtn.innerHTML = '×';
        deleteBtn.className = 'box-delete-btn';
        deleteBtn.style.cssText = `
            position: absolute;
            top: -10px;
            right: -10px;
            width: 20px;
            height: 20px;
            background: #ff4444;
            color: white;
            border-radius: 50%;
            text-align: center;
            line-height: 20px;
            cursor: pointer;
            font-weight: bold;
            font-size: 14px;
            pointer-events: auto;
            z-index: 10;
        `;

        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            box.parentNode.removeChild(box);
            AppConfig.log('빨간박스 개별 삭제됨');
        });

        box.appendChild(deleteBtn);
    }

    /**
     * 장면 작업공간 렌더링
     */
    function renderSceneWorkspace(process) {
        AppConfig.log(`장면 작업공간 렌더링 시작: ${process.name}`);

        try {
            const contentElement = document.getElementById('scene-workspace-content');
            if (!contentElement) {
                AppConfig.log('scene-workspace-content 엘리먼트를 찾을 수 없습니다', 'error');
                return;
            }

            // 현재 활성 장면만 가져오기
            const activeSceneIndex = getActiveSceneForProcess(process);
            if (activeSceneIndex === null) {
                contentElement.innerHTML = '<p class="empty-state">선택된 활성 장면이 없습니다.</p>';
                AppConfig.log('활성 장면이 없음');
                return;
            }

            const sceneImages = stateManager.getState('sceneImages') || [];
            const sceneData = sceneImages[activeSceneIndex];
            if (!sceneData) {
                contentElement.innerHTML = '<p class="empty-state">장면 데이터를 찾을 수 없습니다.</p>';
                AppConfig.log(`장면 데이터 없음: ${activeSceneIndex}`);
                return;
            }

            AppConfig.log(`활성 장면 표시: ${activeSceneIndex}, ${sceneData.name}`);

            // 실제 이미지 데이터 가져오기
            let actualImageData = sceneData.data;
            if (sceneData.data === 'current_session_stored' && sceneData.id && sessionImageCache[sceneData.id]) {
                actualImageData = sessionImageCache[sceneData.id];
                AppConfig.log(`3단계 메모리 캐시에서 이미지 복원: ${sceneData.name}`);
            }

            // 활성 장면 렌더링
            const html = `
                <div class="scene-workspace-single">
                    ${renderSceneWorkspaceItem({
                        id: activeSceneIndex,
                        name: sceneData.name,
                        url: actualImageData
                    })}
                </div>
            `;

            contentElement.innerHTML = html;

            AppConfig.log('장면 작업공간 HTML 설정 완료');

            // 드롭 타겟 설정 (DragDropManager 연동)
            setTimeout(() => {
                eventManager.emit('drag-drop:setup-scene-targets');
                AppConfig.log('드롭 타겟 설정 완료');
            }, 100);

        } catch (error) {
            AppConfig.log(`장면 작업공간 렌더링 오류: ${error.message}`, 'error');
            const contentElement = document.getElementById('scene-workspace-content');
            if (contentElement) {
                contentElement.innerHTML = '<p class="empty-state">장면을 표시하는 중 오류가 발생했습니다.</p>';
            }
        }
    }

    /**
     * 개별 장면 작업공간 아이템 렌더링
     */
    function renderSceneWorkspaceItem(sceneData) {
        return `
            <div class="scene-workspace-item" data-scene-id="${sceneData.id}">
                <h4>${sceneData.name}</h4>
                <img src="${sceneData.url}" alt="${sceneData.name}" class="scene-workspace-image">
                <div id="scene-${sceneData.id}-material-list" class="scene-material-list">
                    <p class="empty-state">배치된 자재가 없습니다.</p>
                </div>
            </div>
        `;
    }

    /**
     * 자재표 작업공간 렌더링
     */
    function renderMaterialWorkspace() {
        AppConfig.log('자재표 작업공간 렌더링 시작');

        try {
            const contentElement = document.getElementById('material-workspace-content');
            if (!contentElement) {
                AppConfig.log('material-workspace-content 요소를 찾을 수 없습니다', 'error');
                return;
            }

            const materials = stateManager.getState('materials') || [];
            if (materials.length === 0) {
                AppConfig.log('자재 데이터 없음', materials);
                contentElement.innerHTML = '<p class="empty-state">자재표를 먼저 업로드해주세요.</p>';
                return;
            }

            AppConfig.log(`자재 데이터 확인: ${materials.length}개 자재`);

            let html = '<div class="material-table-container">';
            html += `
                <p class="drag-instruction">
                    <strong>1단계:</strong> 현재 장면에 필요한 자재들을 체크박스로 선택하세요.<br>
                    <strong>2단계:</strong> 매칭된 자재들을 드래그하여 장면 이미지에 위치를 지정하세요.
                </p>
            `;

            // 자재 탭 생성
            const materialsBySheet = stateManager.getState('materialsBySheet');
            if (materialsBySheet && Object.keys(materialsBySheet).length > 0) {
                html += '<div class="material-tabs" id="material-tabs">';
                const sheetNames = Object.keys(materialsBySheet);

                // 전체 탭 추가
                html += `<button class="material-tab active" data-sheet="all">전체 (${materials.length}개)</button>`;

                // 각 시트별 탭 추가
                sheetNames.forEach(sheetName => {
                    const sheetMaterials = materialsBySheet[sheetName];
                    html += `<button class="material-tab" data-sheet="${sheetName}">`;
                    html += `${sheetName} (${sheetMaterials.length}개)</button>`;
                });
                html += '</div>';
            }

            html += `
                <div class="material-table-content" id="material-table-content">
                    <table class="material-table" id="material-table">
                        <thead>
                            <tr>
                                <th>선택</th><th>번호</th><th>분류</th><th>자재명</th><th>세부내용</th>
                            </tr>
                        </thead>
                        <tbody id="material-table-body"></tbody>
                    </table>
                </div>
            </div>`;

            contentElement.innerHTML = html;

            // 탭 클릭 이벤트 바인딩
            bindMaterialTabEvents();

            materialTableRendered = true;

            AppConfig.log(`자재표 렌더링 완료: ${materials.length}개 행`);

            // 드래그 소스 설정
            setTimeout(() => {
                eventManager.emit('drag-drop:setup-material-sources');
                AppConfig.log('드래그 소스 설정 완료');

                // 커스텀 이벤트 발생
                eventManager.emit('material-table:updated');
            }, 100);

        } catch (error) {
            AppConfig.log(`자재표 작업공간 렌더링 오류: ${error.message}`, 'error');
            const contentElement = document.getElementById('material-workspace-content');
            if (contentElement) {
                contentElement.innerHTML = '<p class="empty-state">자재표 표시 중 오류가 발생했습니다.</p>';
            }
        }
    }

    /**
     * 자재 탭 이벤트 바인딩
     */
    function bindMaterialTabEvents() {
        const tabButtons = document.querySelectorAll('.material-tab');

        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                // 모든 탭의 active 클래스 제거
                tabButtons.forEach(tab => tab.classList.remove('active'));

                // 클릭된 탭에 active 클래스 추가
                this.classList.add('active');

                const sheetName = this.getAttribute('data-sheet');
                displayMaterialsForSheet(sheetName);
            });
        });

        // 기본적으로 전체 자재 표시
        displayMaterialsForSheet('all');
    }

    /**
     * 특정 시트의 자재들을 표시
     */
    function displayMaterialsForSheet(sheetName) {
        const tableBody = document.getElementById('material-table-body');
        if (!tableBody) return;

        let materialsToShow = [];
        const materials = stateManager.getState('materials') || [];
        const materialsBySheet = stateManager.getState('materialsBySheet');

        if (sheetName === 'all') {
            materialsToShow = materials;
        } else if (materialsBySheet && materialsBySheet[sheetName]) {
            materialsToShow = materialsBySheet[sheetName];
        }

        // 현재 공정 및 활성 장면 정보 가져오기
        const currentProcess = getCurrentProcess();
        const activeSceneIndex = getActiveSceneIndex();

        let html = '';
        materialsToShow.forEach((material, i) => {
            const globalIndex = materials.indexOf(material);

            // 현재 장면에 이 자재가 매칭되었는지 확인
            const isAssigned = isMaterialAssignedToScene(globalIndex, activeSceneIndex, currentProcess?.id);
            const isAssignable = activeSceneIndex !== null;

            html += `<tr data-material-index="${globalIndex}" class="${
                isAssigned ? 'material-assigned' : ''
            }${!isAssignable ? ' material-disabled' : ''}">`;

            // 매칭 체크박스 추가
            html += '<td class="material-select-col">';
            if (isAssignable) {
                html += `<input type="checkbox" class="material-assign-checkbox"
                        data-material-index="${globalIndex}" ${isAssigned ? 'checked' : ''}>`;
            } else {
                html += '<span class="material-no-scene">-</span>';
            }
            html += '</td>';

            html += `<td>${material.id || i + 1}</td>`;
            html += `<td>${material.category || '일반'}</td>`;
            html += `<td>${material.material || material.displayId || '자재 ' + (i + 1)}</td>`;
            html += `<td>${material.item || material.area || ''}</td>`;
            html += '</tr>';
        });

        tableBody.innerHTML = html;

        // 자재 매칭 체크박스 이벤트 바인딩
        bindMaterialAssignEvents();

        // 드래그 소스 재설정
        setTimeout(() => {
            eventManager.emit('drag-drop:setup-material-sources');
        }, 100);
    }

    /**
     * 현재 공정 가져오기
     */
    function getCurrentProcess() {
        const currentProcessId = stateManager.getState('currentProcess') || 'process_1';
        const processes = stateManager.getState('processes') || [];
        return processes.find(p => p.id === currentProcessId) || null;
    }

    /**
     * 현재 활성 장면 인덱스 가져오기
     */
    function getActiveSceneIndex() {
        const currentProcess = getCurrentProcess();
        if (!currentProcess) return null;

        // 3단계에서 선택된 활성 장면이 있으면 그것 사용
        if (currentProcess.activeSceneStep3 !== undefined) {
            return currentProcess.activeSceneStep3;
        }
        if (currentProcess.selectedScenes && currentProcess.selectedScenes.length > 0) {
            return currentProcess.selectedScenes[0];
        }
        return null;
    }

    /**
     * 자재가 특정 장면에 할당되었는지 확인
     */
    function isMaterialAssignedToScene(materialIndex, sceneIndex, processId) {
        if (sceneIndex === null || !processId) return false;

        const assignments = stateManager.getState(`sceneMaterialAssignments.${processId}`) || {};
        const sceneAssignments = assignments[sceneIndex] || [];
        return sceneAssignments.indexOf(materialIndex) !== -1;
    }

    /**
     * 자재 매칭 체크박스 이벤트 바인딩
     */
    function bindMaterialAssignEvents() {
        const checkboxes = document.querySelectorAll('.material-assign-checkbox');

        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                const materialIndex = parseInt(this.getAttribute('data-material-index'));
                const isChecked = this.checked;

                toggleMaterialAssignment(materialIndex, isChecked);
            });
        });
    }

    /**
     * 자재 매칭 토글
     */
    function toggleMaterialAssignment(materialIndex, isAssigned) {
        const currentProcess = getCurrentProcess();
        const activeSceneIndex = getActiveSceneIndex();

        if (!currentProcess || activeSceneIndex === null) {
            AppConfig.log('현재 공정 또는 활성 장면을 찾을 수 없습니다', 'error');
            return;
        }

        const assignmentsKey = `sceneMaterialAssignments.${currentProcess.id}`;
        let assignments = stateManager.getState(assignmentsKey) || {};

        if (!assignments[activeSceneIndex]) {
            assignments[activeSceneIndex] = [];
        }

        const sceneAssignments = assignments[activeSceneIndex];
        const materialIndexInScene = sceneAssignments.indexOf(materialIndex);

        if (isAssigned && materialIndexInScene === -1) {
            // 자재 추가
            sceneAssignments.push(materialIndex);
            AppConfig.log(`자재 ${materialIndex} → 장면 ${activeSceneIndex} 매칭`);
        } else if (!isAssigned && materialIndexInScene !== -1) {
            // 자재 제거
            sceneAssignments.splice(materialIndexInScene, 1);
            AppConfig.log(`자재 ${materialIndex} → 장면 ${activeSceneIndex} 매칭 해제`);
        }

        assignments[activeSceneIndex] = sceneAssignments;
        stateManager.updateState(assignmentsKey, assignments);

        // UI 업데이트
        updateMaterialRowVisuals();

        // 드래그 소스 재설정
        setTimeout(() => {
            eventManager.emit('drag-drop:setup-material-sources');
        }, 100);

        // 이벤트 발생
        eventManager.emit('material:assignment-changed', {
            materialIndex,
            sceneIndex: activeSceneIndex,
            processId: currentProcess.id,
            isAssigned
        });
    }

    /**
     * 자재 행 시각적 업데이트
     */
    function updateMaterialRowVisuals() {
        const materialRows = document.querySelectorAll('#material-table tbody tr');

        materialRows.forEach(row => {
            const checkbox = row.querySelector('.material-assign-checkbox');
            if (checkbox && checkbox.checked) {
                row.classList.add('material-assigned');
            } else {
                row.classList.remove('material-assigned');
            }
        });
    }

    /**
     * 작업공간 초기화
     */
    function clearWorkspace() {
        currentProcessId = null;
        materialTableRendered = false;

        const sceneContent = document.getElementById('scene-workspace-content');
        if (sceneContent) {
            sceneContent.innerHTML = '<p class="empty-state">공정을 선택하세요.</p>';
        }

        const materialContent = document.getElementById('material-workspace-content');
        if (materialContent) {
            materialContent.innerHTML = '<p class="empty-state">공정을 선택하세요.</p>';
        }
    }

    /**
     * 반응형 좌표 시스템 설정
     */
    function setupCoordinateSystems() {
        AppConfig.log('좌표 시스템 설정 시작');

        // coordinateSystemManager 연동 (있는 경우)
        if (window.coordinateSystemManager) {
            // 미니맵 좌표 시스템 설정
            window.coordinateSystemManager.createSystem('minimap-workspace-content', {
                itemSelector: '.minimap-box',
                dataPrefix: 'normal'
            });

            // 장면 이미지 좌표 시스템 설정
            window.coordinateSystemManager.createSystem('scene-workspace-content', {
                itemSelector: '.material-badge',
                dataPrefix: 'normal'
            });

            AppConfig.log('좌표 시스템 설정 완료');
        }
    }

    /**
     * 좌표 시스템 정리
     */
    function cleanupCoordinateSystems() {
        if (window.coordinateSystemManager) {
            window.coordinateSystemManager.destroySystem('minimap-workspace-content');
            window.coordinateSystemManager.destroySystem('scene-workspace-content');
        }
    }

    /**
     * 모듈 초기화
     */
    function init() {
        if (isInitialized) {
            AppConfig.log('WorkspaceManager가 이미 초기화되었습니다', 'warn');
            return Promise.resolve(true);
        }

        return new Promise((resolve, reject) => {
            try {
                AppConfig.log('작업공간 관리자 초기화 시작');

                // 이벤트 리스너 등록
                eventManager.on('step:changed', handleStepChanged);
                eventManager.on('process:updated', handleProcessUpdated);
                eventManager.on('material-table:update-requested', handleMaterialTableUpdate);

                isInitialized = true;
                AppConfig.log('작업공간 관리자 초기화 완료');
                resolve(true);

            } catch (error) {
                AppConfig.log(`WorkspaceManager 초기화 실패: ${error.message}`, 'error');
                reject(error);
            }
        });
    }

    /**
     * 단계 변경 이벤트 핸들러
     */
    function handleStepChanged(data) {
        if (data.step === 3) {
            setupWorkspace();
        }
    }

    /**
     * 공정 업데이트 이벤트 핸들러
     */
    function handleProcessUpdated() {
        if (currentProcessId) {
            const processes = stateManager.getState('processes') || [];
            const process = processes.find(p => p.id === currentProcessId);
            if (process) {
                renderSceneWorkspace(process);
            }
        }
    }

    /**
     * 자재 테이블 업데이트 요청 핸들러
     */
    function handleMaterialTableUpdate() {
        if (materialTableRendered) {
            renderMaterialWorkspace();
        }
    }

    /**
     * 모듈 정리
     */
    function cleanup() {
        AppConfig.log('WorkspaceManager 정리 시작...');

        // 이벤트 리스너 정리
        eventManager.off('step:changed', handleStepChanged);
        eventManager.off('process:updated', handleProcessUpdated);
        eventManager.off('material-table:update-requested', handleMaterialTableUpdate);

        // 좌표 시스템 정리
        cleanupCoordinateSystems();

        // 상태 초기화
        currentProcessId = null;
        materialTableRendered = false;
        isInitialized = false;

        AppConfig.log('WorkspaceManager 정리 완료');
    }

    // Public API
    const publicAPI = {
        init: init,
        cleanup: cleanup,
        setupWorkspace: setupWorkspace,
        selectProcess: selectProcess,
        clearWorkspace: clearWorkspace,
        renderMaterialWorkspace: renderMaterialWorkspace,
        getCurrentProcess: getCurrentProcess,
        getActiveSceneIndex: getActiveSceneIndex,
        isMaterialAssignedToScene: isMaterialAssignedToScene,
        toggleMaterialAssignment: toggleMaterialAssignment,
        updateMaterialRowVisuals: updateMaterialRowVisuals,

        // 개발자 도구용
        debug: {
            getCurrentProcessId: () => currentProcessId,
            isMaterialTableRendered: () => materialTableRendered,
            isInitialized: () => isInitialized
        }
    };

    AppConfig.log('WorkspaceManager 모듈 생성 완료');
    return publicAPI;
};

// 전역 변수로도 접근 가능하게 (레거시 호환)
let workspaceManagerInstance = null;

// 모듈 등록
if (window.ModuleLoader) {
    ModuleLoader.define('WorkspaceManager', function(eventManager, stateManager) {
        workspaceManagerInstance = WorkspaceManager(eventManager, stateManager);
        return workspaceManagerInstance;
    }, ['EventManager', 'StateManager']);
}

console.log('✅ WorkspaceManager 모듈 등록 완료');