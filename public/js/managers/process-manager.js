/**
 * 착공도서 자동생성 시스템 - 공정 관리 매니저
 * Construction Document Auto Generator - Process Manager
 */

'use strict';

/**
 * ProcessManager 모듈 팩토리
 * 의존성: EventManager, StateManager
 */
window.ProcessManager = function(eventManager, stateManager) {

    // 의존성 검사
    if (!eventManager || !stateManager) {
        throw new Error('ProcessManager: 필수 의존성이 누락되었습니다');
    }

    AppConfig.log('ProcessManager 모듈 생성 시작');

    // 내부 상태
    let isInitialized = false;
    let sessionImageCache = window.sessionImageCache || {};

    // 설정값들
    const maxProcesses = AppConfig.get('EXCEL.MAX_SHEETS', 10);

    /**
     * 공정 데이터 유효성 검사 및 초기화
     */
    function validateProcessData() {
        AppConfig.log('공정 데이터 유효성 검사 시작');

        let processes = stateManager.getState('processes') || [];

        // 공정 데이터 초기화
        if (processes.length === 0) {
            AppConfig.log('공정 데이터 초기화');
            processes = [{
                id: 'process_1',
                name: '공정1',
                selectedScenes: [],
                isActive: true,
                createdAt: new Date().getTime()
            }];
            stateManager.updateState('processes', processes);
            stateManager.updateState('currentProcess', 'process_1');
        }

        // 활성 공정이 없으면 첫 번째 공정을 활성화
        const hasActiveProcess = processes.some(p => p.isActive);
        if (!hasActiveProcess && processes.length > 0) {
            processes[0].isActive = true;
            stateManager.updateState('currentProcess', processes[0].id);
            stateManager.updateState('processes', processes);
        }

        // 필요한 데이터 구조 초기화
        ensureProcessDataStructures();
        AppConfig.log('공정 데이터 유효성 검사 완료');
    }

    /**
     * 각 공정에 대한 데이터 구조 보장
     */
    function ensureProcessDataStructures() {
        const processes = stateManager.getState('processes') || [];

        processes.forEach(process => {
            const processId = process.id;

            // 각 공정별 데이터 구조 초기화
            if (!stateManager.getState(`sceneMaterialMapping.${processId}`)) {
                stateManager.updateState(`sceneMaterialMapping.${processId}`, {});
            }
            if (!stateManager.getState(`sceneMaterialPositions.${processId}`)) {
                stateManager.updateState(`sceneMaterialPositions.${processId}`, {});
            }
            if (!stateManager.getState(`sceneMaterialAssignments.${processId}`)) {
                stateManager.updateState(`sceneMaterialAssignments.${processId}`, {});
            }
            if (!stateManager.getState(`minimapBoxes.${processId}`)) {
                stateManager.updateState(`minimapBoxes.${processId}`, {});
            }
        });
    }

    /**
     * 공정 탭들 렌더링
     */
    function renderProcessTabs() {
        const tabsContainer = document.getElementById('process-tabs');
        if (!tabsContainer) {
            AppConfig.log('process-tabs 컨테이너를 찾을 수 없습니다', 'error');
            return;
        }

        tabsContainer.innerHTML = '';
        const processes = stateManager.getState('processes') || [];

        // 기존 공정 탭들
        processes.forEach(process => {
            const tab = createProcessTab(process);
            tabsContainer.appendChild(tab);
        });

        // 공정 추가 버튼
        if (processes.length < maxProcesses) {
            const addButton = document.createElement('button');
            addButton.className = 'add-process-btn';
            addButton.innerHTML = '<span class="add-icon">+</span> 공정 추가';
            addButton.title = `새 공정을 추가합니다 (최대 ${maxProcesses}개)`;

            addButton.addEventListener('click', addNewProcess);
            tabsContainer.appendChild(addButton);
        }

        // 공정 개수 정보 표시
        updateProcessInfo();
    }

    /**
     * 개별 공정 탭 생성
     */
    function createProcessTab(process) {
        const tab = document.createElement('div');
        tab.className = 'process-tab-wrapper';

        const isActive = process.isActive;
        const selectedCount = process.selectedScenes ? process.selectedScenes.length : 0;
        const processes = stateManager.getState('processes') || [];

        tab.innerHTML = `
            <button class="process-tab${isActive ? ' active' : ''}"
                    data-process-id="${process.id}"
                    title="${process.name} (${selectedCount}개 장면)">
                <span class="process-name">${process.name}</span>
                <span class="scene-count">${selectedCount}</span>
            </button>
            <button class="process-edit-btn" data-process-id="${process.id}"
                    title="${process.name} 이름 수정">✏️</button>
            ${processes.length > 1 ?
                `<button class="process-delete-btn" data-process-id="${process.id}"
                         title="${process.name} 삭제">&times;</button>` : ''
            }
        `;

        // 이벤트 바인딩
        const tabButton = tab.querySelector('.process-tab');
        tabButton.addEventListener('click', function() {
            switchProcess(this.getAttribute('data-process-id'));
        });

        const editButton = tab.querySelector('.process-edit-btn');
        if (editButton) {
            editButton.addEventListener('click', function(e) {
                e.stopPropagation();
                editProcessName(this.getAttribute('data-process-id'));
            });
        }

        const deleteButton = tab.querySelector('.process-delete-btn');
        if (deleteButton) {
            deleteButton.addEventListener('click', function(e) {
                e.stopPropagation();
                deleteProcess(this.getAttribute('data-process-id'));
            });
        }

        return tab;
    }

    /**
     * 공정 정보 업데이트
     */
    function updateProcessInfo() {
        const infoArea = document.getElementById('process-info');
        if (infoArea) {
            const processes = stateManager.getState('processes') || [];
            infoArea.textContent = `${processes.length}/${maxProcesses} 공정`;
        }
    }

    /**
     * 공정 컨텐츠 렌더링
     */
    function renderProcessContent() {
        AppConfig.log('공정 컨텐츠 렌더링 시작');

        const contentContainer = document.getElementById('process-content');
        if (!contentContainer) {
            AppConfig.log('process-content 요소를 찾을 수 없습니다', 'error');
            return;
        }

        const currentProcess = getCurrentProcess();
        if (!currentProcess) {
            AppConfig.log('현재 공정을 찾을 수 없습니다', 'error');
            return;
        }

        const sceneImages = stateManager.getState('sceneImages') || [];
        const totalScenes = sceneImages.length;
        const selectedCount = currentProcess.selectedScenes ? currentProcess.selectedScenes.length : 0;

        AppConfig.log(`장면 정보 - 전체: ${totalScenes}, 선택: ${selectedCount}`);

        contentContainer.innerHTML = `
            <div class="process-header">
                <h3>${currentProcess.name} - 장면 선택</h3>
                <p>이 공정에 포함할 장면들을 선택하세요. (${selectedCount}/${totalScenes} 선택됨)</p>
            </div>
            <div class="scene-lists-container">
                <div class="scene-list-section">
                    <h4>선택 가능한 장면</h4>
                    <div id="available-scenes-grid" class="scene-grid"></div>
                </div>
                <div class="scene-list-section">
                    <h4>전체 이미지 목록</h4>
                    <div id="all-scenes-grid" class="scene-grid readonly"></div>
                </div>
            </div>
        `;

        renderSceneSelection();
        AppConfig.log('공정 컨텐츠 렌더링 완료');
    }

    /**
     * 장면 선택 UI 렌더링
     */
    function renderSceneSelection() {
        AppConfig.log('장면 선택 UI 렌더링 시작');
        renderAvailableScenes();
        renderAllScenes();
        AppConfig.log('장면 선택 UI 렌더링 완료');
    }

    /**
     * 선택 가능한 장면들 렌더링
     */
    function renderAvailableScenes() {
        AppConfig.log('선택 가능한 장면들 렌더링 시작');

        const gridContainer = document.getElementById('available-scenes-grid');
        if (!gridContainer) return;

        gridContainer.innerHTML = '';

        const sceneImages = stateManager.getState('sceneImages') || [];
        if (sceneImages.length === 0) {
            gridContainer.innerHTML = '<p>업로드된 장면 이미지가 없습니다.</p>';
            return;
        }

        // 실제 이미지 데이터 검사
        const hasValidImages = sceneImages.some(scene =>
            scene.id && sessionImageCache[scene.id]
        );

        if (!hasValidImages) {
            AppConfig.log('이미지 메타데이터는 있지만 실제 데이터가 메모리에 없습니다', 'warn');
            gridContainer.innerHTML = `
                <div class="empty-state">
                    <p>이미지 데이터를 찾을 수 없습니다.</p>
                    <p>1단계에서 장면 이미지들을 다시 업로드해 주세요.</p>
                    <button class="btn btn-secondary" onclick="eventManager.emit('navigation:goToStep', {step: 1})">1단계로 이동</button>
                </div>
            `;
            return;
        }

        const currentProcess = getCurrentProcess();
        const currentProcessId = currentProcess.id;

        AppConfig.log('장면 루프 시작', {
            totalScenes: sceneImages.length,
            currentProcessId: currentProcessId,
            selectedScenes: currentProcess.selectedScenes
        });

        sceneImages.forEach((scene, i) => {
            const isSelected = currentProcess.selectedScenes.indexOf(i) !== -1;
            const isUsedInOtherProcess = isSceneUsedInOtherProcess(i, currentProcessId);

            AppConfig.log(`장면 ${i} 처리: ${scene.name}`, {
                isSelected,
                isUsedInOtherProcess
            });

            if (isUsedInOtherProcess && !isSelected) {
                AppConfig.log(`장면 ${i} 스킵: 다른 공정에서 사용 중`);
                return;
            }

            // 실제 이미지 데이터 가져오기
            let actualImageData = scene.data;
            if (scene.data === 'current_session_stored' && scene.id && sessionImageCache[scene.id]) {
                actualImageData = sessionImageCache[scene.id];
                AppConfig.log(`메모리 캐시에서 이미지 복원: ${scene.name}`);
            }

            const sceneItem = document.createElement('div');
            sceneItem.className = `scene-item${isSelected ? ' selected' : ''}${isUsedInOtherProcess ? ' disabled' : ''}`;
            sceneItem.setAttribute('data-scene-index', i);

            const usedInProcess = getProcessUsingScene(i);
            let statusText = isUsedInOtherProcess && !isSelected ? ` (사용 중: ${usedInProcess})` : '';

            // 선택된 장면은 드래그 가능하도록 설정
            if (isSelected) {
                sceneItem.setAttribute('draggable', 'true');
                sceneItem.classList.add('draggable');

                const orderIndex = currentProcess.selectedScenes.indexOf(i);
                statusText = ` (${orderIndex + 1}번째)${statusText}`;

                AppConfig.log(`장면 ${i} 드래그 가능 설정`, {
                    sceneName: scene.name,
                    orderIndex,
                    isDraggable: true
                });
            }

            sceneItem.innerHTML = `
                <img src="${actualImageData}" alt="${scene.name}" class="scene-thumbnail">
                <div class="scene-name">${scene.name}${statusText}</div>
                <input type="checkbox" ${isSelected ? 'checked' : ''}
                       data-scene-index="${i}" ${isUsedInOtherProcess && !isSelected ? 'disabled' : ''}>
                ${isSelected ? '<div class="drag-handle">⋮⋮</div>' : ''}
            `;

            // 이벤트 바인딩
            sceneItem.addEventListener('click', function(e) {
                if (e.target.type !== 'checkbox' && !e.target.classList.contains('drag-handle')) {
                    const checkbox = this.querySelector('input[type="checkbox"]');
                    if (!checkbox.disabled) {
                        checkbox.checked = !checkbox.checked;
                        checkbox.dispatchEvent(new Event('change'));
                    }
                }
            });

            sceneItem.querySelector('input').addEventListener('change', function() {
                if (!this.disabled) {
                    toggleSceneSelection(parseInt(this.getAttribute('data-scene-index')), this.checked);
                }
            });

            // 드래그 앤 드롭 이벤트 추가 (선택된 장면만)
            if (isSelected) {
                AppConfig.log(`장면 ${i} 드래그 이벤트 등록 시작: ${scene.name}`);
                addDragDropEvents(sceneItem);
            }

            gridContainer.appendChild(sceneItem);
        });

        AppConfig.log('장면 루프 완료');
    }

    /**
     * 드래그앤드롭 이벤트 추가
     */
    function addDragDropEvents(sceneItem) {
        sceneItem.addEventListener('dragstart', function(e) {
            e.dataTransfer.setData('text/plain', this.getAttribute('data-scene-index'));
            e.dataTransfer.effectAllowed = 'move';
            this.classList.add('dragging');
            AppConfig.log(`드래그 시작: ${this.getAttribute('data-scene-index')}`);
        });

        sceneItem.addEventListener('dragend', function(e) {
            this.classList.remove('dragging');
            // 모든 드롭 대상 스타일 제거
            document.querySelectorAll('.scene-item.selected').forEach(item => {
                item.classList.remove('drag-over');
            });
            AppConfig.log('드래그 종료');
        });

        sceneItem.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            AppConfig.log('드래그오버 상세', {
                targetIndex: this.getAttribute('data-scene-index'),
                isDragging: this.classList.contains('dragging')
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
            AppConfig.log('드롭 이벤트 발생');

            e.preventDefault();
            this.classList.remove('drag-over');

            const draggedSceneIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const dropTargetSceneIndex = parseInt(this.getAttribute('data-scene-index'));

            AppConfig.log('드롭 이벤트 상세', {
                draggedSceneIndex,
                dropTargetSceneIndex,
                isSameIndex: draggedSceneIndex === dropTargetSceneIndex
            });

            if (draggedSceneIndex !== dropTargetSceneIndex) {
                AppConfig.log(`장면 순서 변경 실행: ${draggedSceneIndex} → ${dropTargetSceneIndex}`);
                reorderScenes(draggedSceneIndex, dropTargetSceneIndex);
            } else {
                AppConfig.log('같은 장면으로 드롭 - 순서 변경 안함');
            }
        });

        AppConfig.log(`드래그앤드롭 이벤트 등록 완료: ${sceneItem.getAttribute('data-scene-index')}`);
    }

    /**
     * 장면 순서 변경
     */
    function reorderScenes(draggedIndex, dropTargetIndex) {
        const currentProcess = getCurrentProcess();
        if (!currentProcess || !currentProcess.selectedScenes) return;

        const selectedScenes = [...currentProcess.selectedScenes];
        const draggedPos = selectedScenes.indexOf(draggedIndex);
        const targetPos = selectedScenes.indexOf(dropTargetIndex);

        if (draggedPos === -1 || targetPos === -1) return;

        // 배열에서 드래그된 요소를 제거하고 새 위치에 삽입
        const draggedElement = selectedScenes.splice(draggedPos, 1)[0];
        selectedScenes.splice(targetPos, 0, draggedElement);

        AppConfig.log('새로운 순서:', selectedScenes);

        // 상태 업데이트
        const processes = stateManager.getState('processes') || [];
        const processIndex = processes.findIndex(p => p.id === currentProcess.id);
        if (processIndex !== -1) {
            processes[processIndex].selectedScenes = selectedScenes;
            stateManager.updateState('processes', processes);
        }

        // UI 다시 렌더링
        renderSceneSelection();

        // 이벤트 발생
        eventManager.emit('scenes:reordered', {
            processId: currentProcess.id,
            newOrder: selectedScenes
        });
    }

    /**
     * 모든 장면들 렌더링 (읽기 전용)
     */
    function renderAllScenes() {
        const gridContainer = document.getElementById('all-scenes-grid');
        if (!gridContainer) return;

        gridContainer.innerHTML = '';

        const sceneImages = stateManager.getState('sceneImages') || [];
        if (sceneImages.length === 0) {
            gridContainer.innerHTML = '<p>업로드된 장면 이미지가 없습니다.</p>';
            return;
        }

        const currentProcess = getCurrentProcess();
        const currentProcessId = currentProcess.id;

        sceneImages.forEach((scene, i) => {
            const isSelected = currentProcess.selectedScenes.indexOf(i) !== -1;
            const usedInProcess = getProcessUsingScene(i);

            // 실제 이미지 데이터 가져오기
            let actualImageData = scene.data;
            if (scene.data === 'current_session_stored' && scene.id && sessionImageCache[scene.id]) {
                actualImageData = sessionImageCache[scene.id];
            }

            const sceneItem = document.createElement('div');
            sceneItem.className = 'scene-item readonly';

            let statusClass = '';
            let statusText = '';

            if (isSelected) {
                statusClass = ' current-selected';
                statusText = ' (현재 공정에서 선택됨)';
            } else if (usedInProcess) {
                statusClass = ' other-used';
                statusText = ` (사용 중: ${usedInProcess})`;
            } else {
                statusClass = ' available';
                statusText = ' (사용 가능)';
            }

            sceneItem.className += statusClass;
            sceneItem.innerHTML = `
                <img src="${actualImageData}" alt="${scene.name}" class="scene-thumbnail">
                <div class="scene-name">${scene.name}${statusText}</div>
            `;

            gridContainer.appendChild(sceneItem);
        });
    }

    /**
     * 새 공정 추가
     */
    function addNewProcess() {
        const processes = stateManager.getState('processes') || [];

        if (processes.length >= maxProcesses) {
            eventManager.emit('error:show', {
                message: `최대 ${maxProcesses}개의 공정까지만 생성할 수 있습니다.`,
                title: '공정 개수 제한'
            });
            return;
        }

        const newProcessNumber = processes.length + 1;
        const defaultName = `공정${newProcessNumber}`;

        // 공정 이름 입력 받기
        const processName = prompt('새 공정의 이름을 입력해주세요:', defaultName);

        // 취소한 경우
        if (processName === null) return;

        // 빈 문자열인 경우 기본 이름 사용
        const finalName = processName.trim() || defaultName;

        // 이름 중복 체크
        const isDuplicate = processes.some(p => p.name === finalName);

        if (isDuplicate) {
            eventManager.emit('error:show', {
                message: '이미 같은 이름의 공정이 존재합니다.\n다른 이름을 사용해주세요.',
                title: '공정 이름 중복'
            });
            // 재시도
            setTimeout(addNewProcess, 100);
            return;
        }

        const newProcessId = `process_${Date.now()}`;
        const newProcess = {
            id: newProcessId,
            name: finalName,
            selectedScenes: [],
            isActive: false,
            createdAt: new Date().getTime()
        };

        // 새 공정 추가
        const updatedProcesses = [...processes, newProcess];
        stateManager.updateState('processes', updatedProcesses);

        // 새 공정을 위한 빈 데이터 구조 초기화
        stateManager.updateState(`sceneMaterialMapping.${newProcessId}`, {});
        stateManager.updateState(`sceneMaterialPositions.${newProcessId}`, {});
        stateManager.updateState(`sceneMaterialAssignments.${newProcessId}`, {});
        stateManager.updateState(`minimapBoxes.${newProcessId}`, {});

        AppConfig.log(`새 공정 추가됨: ${newProcess.name}`);

        // 이벤트 발생
        eventManager.emit('process:created', { process: newProcess });

        renderProcessTabs();

        // 새로 만든 공정으로 자동 전환
        switchProcess(newProcessId);
    }

    /**
     * 공정 이름 편집
     */
    function editProcessName(processId) {
        const processes = stateManager.getState('processes') || [];
        const process = processes.find(p => p.id === processId);

        if (!process) {
            AppConfig.log(`공정을 찾을 수 없습니다: ${processId}`, 'error');
            return;
        }

        const currentName = process.name;
        const newName = prompt('공정 이름을 수정해주세요:', currentName);

        // 취소한 경우
        if (newName === null) return;

        // 빈 문자열인 경우
        if (newName.trim() === '') {
            eventManager.emit('error:show', {
                message: '공정 이름은 비어있을 수 없습니다.',
                title: '잘못된 입력'
            });
            return;
        }

        // 같은 이름인 경우
        if (newName.trim() === currentName) return;

        // 이름 중복 체크 (다른 공정과)
        const isDuplicate = processes.some(p => p.id !== processId && p.name === newName.trim());

        if (isDuplicate) {
            eventManager.emit('error:show', {
                message: '이미 같은 이름의 공정이 존재합니다.\n다른 이름을 사용해주세요.',
                title: '공정 이름 중복'
            });
            // 재시도
            setTimeout(() => editProcessName(processId), 100);
            return;
        }

        // 공정 이름 변경
        const processIndex = processes.findIndex(p => p.id === processId);
        if (processIndex !== -1) {
            processes[processIndex].name = newName.trim();
            stateManager.updateState('processes', processes);
        }

        AppConfig.log(`공정 이름 변경됨: ${currentName} -> ${newName.trim()}`);

        // 이벤트 발생
        eventManager.emit('process:updated', {
            processId,
            oldName: currentName,
            newName: newName.trim()
        });

        // UI 업데이트
        renderProcessTabs();
    }

    /**
     * 공정 삭제
     */
    function deleteProcess(processId) {
        const processes = stateManager.getState('processes') || [];

        if (processes.length <= 1) {
            eventManager.emit('error:show', {
                message: '최소 하나의 공정은 유지되어야 합니다.',
                title: '공정 삭제 불가'
            });
            return;
        }

        const processIndex = processes.findIndex(p => p.id === processId);
        const processToDelete = processes[processIndex];

        if (!processToDelete) {
            eventManager.emit('error:show', { message: '삭제할 공정을 찾을 수 없습니다.' });
            return;
        }

        const confirmMessage = `공정 "${processToDelete.name}"을(를) 삭제하시겠습니까?\n\n` +
            `이 공정에 설정된 모든 데이터가 함께 삭제됩니다.\n` +
            `선택된 장면: ${processToDelete.selectedScenes?.length || 0}개`;

        if (confirm(confirmMessage)) {
            // 공정 배열에서 제거
            const updatedProcesses = processes.filter(p => p.id !== processId);
            stateManager.updateState('processes', updatedProcesses);

            // 관련 데이터 구조 정리
            stateManager.updateState(`sceneMaterialMapping.${processId}`, undefined);
            stateManager.updateState(`sceneMaterialPositions.${processId}`, undefined);
            stateManager.updateState(`sceneMaterialAssignments.${processId}`, undefined);
            stateManager.updateState(`minimapBoxes.${processId}`, undefined);

            AppConfig.log(`공정 삭제됨: ${processToDelete.name}`);

            // 현재 활성 공정이 삭제된 경우 다른 공정으로 전환
            const currentProcess = stateManager.getState('currentProcess');
            if (currentProcess === processId) {
                const newActiveProcess = updatedProcesses[0];
                newActiveProcess.isActive = true;
                stateManager.updateState('currentProcess', newActiveProcess.id);
                stateManager.updateState('processes', updatedProcesses);
            }

            // 이벤트 발생
            eventManager.emit('process:deleted', {
                processId,
                processName: processToDelete.name
            });

            renderProcessTabs();
            renderProcessContent();
        }
    }

    /**
     * 현재 공정 가져오기
     */
    function getCurrentProcess() {
        const processes = stateManager.getState('processes') || [];
        const currentProcessId = stateManager.getState('currentProcess');

        return processes.find(p => p.id === currentProcessId) || processes[0] || null;
    }

    /**
     * 공정 전환
     */
    function switchProcess(processId) {
        const currentProcessId = stateManager.getState('currentProcess');
        if (currentProcessId === processId) {
            return; // 이미 선택된 공정
        }

        AppConfig.log(`공정 전환: ${currentProcessId} -> ${processId}`);

        const processes = stateManager.getState('processes') || [];

        // 기존 활성 상태 제거
        processes.forEach(p => p.isActive = false);

        // 새 공정 활성화
        const targetProcess = processes.find(p => p.id === processId);
        if (!targetProcess) {
            AppConfig.log(`존재하지 않는 공정 ID: ${processId}`, 'error');
            return;
        }

        targetProcess.isActive = true;
        stateManager.updateState('currentProcess', processId);
        stateManager.updateState('processes', processes);

        // 이벤트 발생
        eventManager.emit('process:switched', {
            fromProcessId: currentProcessId,
            toProcessId: processId,
            processName: targetProcess.name
        });

        // UI 업데이트
        renderProcessTabs();
        renderProcessContent();

        AppConfig.log(`공정 전환 완료: ${targetProcess.name}`);
    }

    /**
     * 특정 장면이 다른 공정에서 사용 중인지 확인
     */
    function isSceneUsedInOtherProcess(sceneIndex, currentProcessId) {
        const processes = stateManager.getState('processes') || [];

        return processes.some(process =>
            process.id !== currentProcessId &&
            process.selectedScenes &&
            process.selectedScenes.indexOf(sceneIndex) !== -1
        );
    }

    /**
     * 특정 장면을 사용하고 있는 공정 이름 반환
     */
    function getProcessUsingScene(sceneIndex) {
        const processes = stateManager.getState('processes') || [];

        const process = processes.find(p =>
            p.selectedScenes && p.selectedScenes.indexOf(sceneIndex) !== -1
        );

        return process ? process.name : null;
    }

    /**
     * 장면 선택/해제 토글
     */
    function toggleSceneSelection(sceneIndex, isSelected) {
        const currentProcess = getCurrentProcess();
        if (!currentProcess) return;

        const processes = stateManager.getState('processes') || [];
        const processIndex = processes.findIndex(p => p.id === currentProcess.id);

        if (processIndex === -1) return;

        const selectedScenes = [...currentProcess.selectedScenes];
        const currentIndex = selectedScenes.indexOf(sceneIndex);

        if (isSelected && currentIndex === -1) {
            selectedScenes.push(sceneIndex);
            AppConfig.log(`장면 추가됨: ${sceneIndex}, 공정: ${currentProcess.name}`);
        } else if (!isSelected && currentIndex !== -1) {
            selectedScenes.splice(currentIndex, 1);
            AppConfig.log(`장면 제거됨: ${sceneIndex}, 공정: ${currentProcess.name}`);
        }

        // 상태 업데이트
        processes[processIndex].selectedScenes = selectedScenes;
        stateManager.updateState('processes', processes);

        // 이벤트 발생
        eventManager.emit('scene:toggled', {
            processId: currentProcess.id,
            sceneIndex,
            isSelected,
            totalSelected: selectedScenes.length
        });

        // UI 업데이트
        updateProcessTabs();
    }

    /**
     * 프로세스 탭 업데이트 (장면 개수 표시)
     */
    function updateProcessTabs() {
        const processes = stateManager.getState('processes') || [];

        processes.forEach(process => {
            const sceneCountElement = document.querySelector(
                `.process-tab[data-process-id="${process.id}"] .scene-count`
            );

            if (sceneCountElement) {
                sceneCountElement.textContent = process.selectedScenes.length;
            }
        });
    }

    /**
     * 2단계 완료 상태 체크
     */
    function checkStep2Completion() {
        const processes = stateManager.getState('processes') || [];
        const hasSelectedScenes = processes.some(p => p.selectedScenes.length > 0);

        // 이벤트 발생
        eventManager.emit('step:completion', {
            step: 2,
            completed: hasSelectedScenes,
            message: hasSelectedScenes ?
                '다음 단계로 진행합니다' :
                '최소 하나의 공정에서 장면을 선택해야 합니다'
        });
    }

    /**
     * 모듈 초기화
     */
    function init() {
        if (isInitialized) {
            AppConfig.log('ProcessManager가 이미 초기화되었습니다', 'warn');
            return Promise.resolve(true);
        }

        return new Promise((resolve, reject) => {
            try {
                AppConfig.log('공정 관리자 초기화 시작');

                validateProcessData();
                renderProcessTabs();
                renderProcessContent();

                // 이벤트 리스너 등록
                eventManager.on('scenes:loaded', handleScenesLoaded);
                eventManager.on('upload:reset', handleUploadReset);

                isInitialized = true;
                AppConfig.log('공정 관리자 초기화 완료');

                // 완료 상태 체크
                checkStep2Completion();

                resolve(true);

            } catch (error) {
                AppConfig.log(`ProcessManager 초기화 실패: ${error.message}`, 'error');
                reject(error);
            }
        });
    }

    /**
     * 장면 로드 완료 이벤트 핸들러
     */
    function handleScenesLoaded(data) {
        AppConfig.log('장면 로드 완료 이벤트 받음', data);

        // 현재 진행 중인 공정이 있으면 UI 업데이트
        if (document.getElementById('process-content')) {
            renderProcessContent();
        }
    }

    /**
     * 업로드 리셋 이벤트 핸들러
     */
    function handleUploadReset(data) {
        if (data.type === 'scenes') {
            AppConfig.log('장면 업로드 리셋됨 - 공정 데이터 정리');

            // 모든 공정의 선택된 장면 초기화
            const processes = stateManager.getState('processes') || [];
            processes.forEach(process => {
                process.selectedScenes = [];
            });
            stateManager.updateState('processes', processes);

            // UI 업데이트
            renderProcessTabs();
            renderProcessContent();
            checkStep2Completion();
        }
    }

    /**
     * 모듈 정리
     */
    function cleanup() {
        AppConfig.log('ProcessManager 정리 시작...');

        // 이벤트 리스너 정리
        eventManager.off('scenes:loaded', handleScenesLoaded);
        eventManager.off('upload:reset', handleUploadReset);

        isInitialized = false;
        AppConfig.log('ProcessManager 정리 완료');
    }

    // Public API
    const publicAPI = {
        init: init,
        cleanup: cleanup,
        getCurrentProcess: getCurrentProcess,
        switchProcess: switchProcess,
        renderProcessContent: renderProcessContent,
        toggleSceneSelection: toggleSceneSelection,

        // 개발자 도구용
        debug: {
            getProcesses: () => stateManager.getState('processes'),
            isInitialized: () => isInitialized,
            getMaxProcesses: () => maxProcesses
        }
    };

    AppConfig.log('ProcessManager 모듈 생성 완료');
    return publicAPI;
};

// 전역 변수로도 접근 가능하게 (레거시 호환)
let processManagerInstance = null;

// 모듈 등록
if (window.ModuleLoader) {
    ModuleLoader.define('ProcessManager', function(eventManager, stateManager) {
        processManagerInstance = ProcessManager(eventManager, stateManager);
        return processManagerInstance;
    }, ['EventManager', 'StateManager']);
}

console.log('✅ ProcessManager 모듈 등록 완료');