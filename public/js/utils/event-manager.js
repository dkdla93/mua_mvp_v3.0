/**
 * EventManager - 이벤트 리스너 메모리 누수 방지 유틸리티
 * 모든 이벤트 리스너를 추적하고 페이지 언로드 시 자동으로 정리합니다.
 */

'use strict';

(function(global) {
    // EventManager 클래스 정의
    function EventManager() {
        // 이벤트 리스너 추적을 위한 Map
        this.listeners = new Map();
        this.elementCounter = 0;
        this.initialized = false;

        // 페이지 언로드 시 자동 정리 설정
        this.init();
    }

    EventManager.prototype = {
        constructor: EventManager,

        /**
         * EventManager 초기화
         * 페이지 언로드 시 자동 정리 리스너 등록
         */
        init: function() {
            if (this.initialized) return;

            var self = this;

            // 페이지 언로드 시 모든 리스너 정리
            var cleanupEvents = ['beforeunload', 'pagehide', 'unload'];

            cleanupEvents.forEach(function(eventType) {
                window.addEventListener(eventType, function() {
                    self.removeAllListeners();
                });
            });

            this.initialized = true;
        },

        /**
         * 이벤트 리스너 추가 및 추적
         * @param {Element|string} element - DOM 요소 또는 선택자
         * @param {string} eventType - 이벤트 타입 (click, change 등)
         * @param {Function} handler - 이벤트 핸들러 함수
         * @param {Object|boolean} options - addEventListener 옵션
         * @returns {string} 리스너 ID (제거 시 사용)
         */
        addListener: function(element, eventType, handler, options) {
            options = options || false;

            // 문자열 선택자인 경우 요소 찾기
            if (typeof element === 'string') {
                element = document.querySelector(element);
            }

            if (!element) {
                console.warn('EventManager: 요소를 찾을 수 없습니다:', element);
                return null;
            }

            // 유니크한 키 생성
            var elementKey = this.getElementKey(element);
            var listenerId = elementKey + '_' + eventType + '_' + (++this.elementCounter);

            // 리스너 정보 저장
            var listenerInfo = {
                element: element,
                eventType: eventType,
                handler: handler,
                options: options,
                id: listenerId
            };

            this.listeners.set(listenerId, listenerInfo);

            // 실제 이벤트 리스너 등록
            element.addEventListener(eventType, handler, options);

            return listenerId;
        },

        /**
         * 특정 이벤트 리스너 제거
         * @param {string} listenerId - addListener에서 반환된 ID
         */
        removeListener: function(listenerId) {
            var listenerInfo = this.listeners.get(listenerId);

            if (listenerInfo) {
                // 실제 이벤트 리스너 제거
                listenerInfo.element.removeEventListener(
                    listenerInfo.eventType,
                    listenerInfo.handler,
                    listenerInfo.options
                );

                // 추적 목록에서 제거
                this.listeners.delete(listenerId);
                return true;
            }

            return false;
        },

        /**
         * 특정 요소의 모든 이벤트 리스너 제거
         * @param {Element|string} element - DOM 요소 또는 선택자
         */
        removeListenersForElement: function(element) {
            if (typeof element === 'string') {
                element = document.querySelector(element);
            }

            if (!element) return;

            var elementKey = this.getElementKey(element);
            var removedCount = 0;

            // 해당 요소의 모든 리스너 찾아서 제거
            this.listeners.forEach(function(listenerInfo, listenerId) {
                if (listenerInfo.element === element) {
                    this.removeListener(listenerId);
                    removedCount++;
                }
            }.bind(this));

            return removedCount;
        },

        /**
         * 특정 이벤트 타입의 모든 리스너 제거
         * @param {string} eventType - 이벤트 타입
         */
        removeListenersByType: function(eventType) {
            var removedCount = 0;

            this.listeners.forEach(function(listenerInfo, listenerId) {
                if (listenerInfo.eventType === eventType) {
                    this.removeListener(listenerId);
                    removedCount++;
                }
            }.bind(this));

            return removedCount;
        },

        /**
         * 모든 이벤트 리스너 제거
         */
        removeAllListeners: function() {
            var removedCount = 0;

            this.listeners.forEach(function(listenerInfo, listenerId) {
                // 실제 이벤트 리스너 제거
                try {
                    listenerInfo.element.removeEventListener(
                        listenerInfo.eventType,
                        listenerInfo.handler,
                        listenerInfo.options
                    );
                    removedCount++;
                } catch (e) {
                    console.warn('EventManager: 리스너 제거 실패', e);
                }
            });

            // 모든 추적 정보 정리
            this.listeners.clear();

            console.log('EventManager: ' + removedCount + '개의 이벤트 리스너가 정리되었습니다.');
            return removedCount;
        },

        /**
         * 현재 등록된 리스너 개수 반환
         */
        getListenerCount: function() {
            return this.listeners.size;
        },

        /**
         * 디버깅용 - 등록된 모든 리스너 정보 출력
         */
        debugListeners: function() {
            console.log('=== EventManager Debug Info ===');
            console.log('총 리스너 개수:', this.listeners.size);

            this.listeners.forEach(function(listenerInfo, listenerId) {
                console.log('ID:', listenerId);
                console.log('Element:', listenerInfo.element);
                console.log('Event Type:', listenerInfo.eventType);
                console.log('---');
            });
        },

        /**
         * 요소에 대한 고유 키 생성
         * @param {Element} element - DOM 요소
         * @returns {string} 고유 키
         */
        getElementKey: function(element) {
            // 이미 데이터 속성이 있는 경우
            if (element.dataset && element.dataset.eventManagerId) {
                return element.dataset.eventManagerId;
            }

            // ID가 있는 경우
            if (element.id) {
                return 'id_' + element.id;
            }

            // 클래스명 조합
            if (element.className && typeof element.className === 'string') {
                var classList = element.className.split(' ').filter(function(cls) {
                    return cls.length > 0;
                }).slice(0, 2); // 처음 2개 클래스만 사용

                if (classList.length > 0) {
                    return 'class_' + classList.join('_');
                }
            }

            // 태그명 + 인덱스
            var tagElements = document.getElementsByTagName(element.tagName);
            for (var i = 0; i < tagElements.length; i++) {
                if (tagElements[i] === element) {
                    return element.tagName.toLowerCase() + '_' + i;
                }
            }

            // 최후의 수단 - 랜덤 키
            return 'element_' + Math.random().toString(36).substr(2, 9);
        },

        /**
         * 간편한 이벤트 등록 메서드들
         */
        onClick: function(element, handler, options) {
            return this.addListener(element, 'click', handler, options);
        },

        onChange: function(element, handler, options) {
            return this.addListener(element, 'change', handler, options);
        },

        onDragOver: function(element, handler, options) {
            return this.addListener(element, 'dragover', handler, options);
        },

        onDrop: function(element, handler, options) {
            return this.addListener(element, 'drop', handler, options);
        },

        onResize: function(element, handler, options) {
            return this.addListener(element || window, 'resize', handler, options);
        }
    };

    // 전역 싱글톤 인스턴스 생성
    global.eventManager = global.eventManager || new EventManager();

    // 구형 브라우저 호환성을 위한 별칭
    global.EventManager = EventManager;

    // AMD/CommonJS 지원
    if (typeof define === 'function' && define.amd) {
        define(function() { return global.eventManager; });
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = global.eventManager;
    }

})(typeof window !== 'undefined' ? window : this);