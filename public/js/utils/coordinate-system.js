/**
 * ResponsiveCoordinateSystem - 반응형 좌표 시스템 유틸리티
 * 드래그앤드롭 좌표를 정규화하여 반응형 환경에서 일관성 유지
 */

'use strict';

(function(global) {
    // ResponsiveCoordinateSystem 클래스 정의
    function ResponsiveCoordinateSystem(container, options) {
        this.container = container;
        this.options = Object.assign({
            enableResizeObserver: true,     // ResizeObserver 사용 여부
            throttleDelay: 100,             // 리사이즈 이벤트 쓰로틀링 지연 시간
            itemSelector: '.placed-item',   // 배치된 아이템 선택자
            dataPrefix: 'normal',           // 데이터 속성 접두사
            minDimensions: { width: 100, height: 100 } // 최소 컨테이너 크기
        }, options || {});

        // 상태 초기화
        this.width = 0;
        this.height = 0;
        this.isDestroyed = false;
        this.resizeObserver = null;

        // 초기화
        this.init();
    }

    ResponsiveCoordinateSystem.prototype = {
        constructor: ResponsiveCoordinateSystem,

        /**
         * 좌표 시스템 초기화
         */
        init: function() {
            if (!this.container) {
                console.error('ResponsiveCoordinateSystem: 컨테이너가 제공되지 않았습니다.');
                return;
            }

            // 초기 크기 설정
            this.updateDimensions();

            // 리사이즈 관찰자 설정
            if (this.options.enableResizeObserver) {
                this.setupResizeObserver();
            } else {
                // 폴백으로 window resize 이벤트 사용
                this.setupWindowResizeHandler();
            }

            console.log('ResponsiveCoordinateSystem 초기화 완료:', {
                width: this.width,
                height: this.height,
                container: this.container
            });
        },

        /**
         * ResizeObserver 설정
         */
        setupResizeObserver: function() {
            if (typeof ResizeObserver === 'undefined') {
                console.warn('ResponsiveCoordinateSystem: ResizeObserver 지원되지 않음, window resize 이벤트로 폴백');
                this.setupWindowResizeHandler();
                return;
            }

            var self = this;

            this.resizeObserver = new ResizeObserver(this.throttle(function(entries) {
                if (self.isDestroyed) return;

                // 컨테이너 크기 변경 감지
                entries.forEach(function(entry) {
                    if (entry.target === self.container) {
                        self.updateDimensions();
                        self.recalculateAllPositions();
                    }
                });
            }, this.options.throttleDelay));

            this.resizeObserver.observe(this.container);
        },

        /**
         * Window resize 이벤트 핸들러 설정 (폴백)
         */
        setupWindowResizeHandler: function() {
            var self = this;

            this.windowResizeHandler = this.throttle(function() {
                if (!self.isDestroyed) {
                    self.updateDimensions();
                    self.recalculateAllPositions();
                }
            }, this.options.throttleDelay);

            // EventManager가 있으면 사용, 없으면 직접 등록
            if (typeof eventManager !== 'undefined') {
                eventManager.onResize(window, this.windowResizeHandler);
            } else {
                window.addEventListener('resize', this.windowResizeHandler);
            }
        },

        /**
         * 컨테이너 크기 업데이트
         */
        updateDimensions: function() {
            if (!this.container) return;

            var rect = this.container.getBoundingClientRect();
            var computedStyle = window.getComputedStyle(this.container);

            // 패딩을 제외한 실제 콘텐츠 영역 계산
            var paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
            var paddingRight = parseFloat(computedStyle.paddingRight) || 0;
            var paddingTop = parseFloat(computedStyle.paddingTop) || 0;
            var paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;

            this.width = Math.max(
                rect.width - paddingLeft - paddingRight,
                this.options.minDimensions.width
            );

            this.height = Math.max(
                rect.height - paddingTop - paddingBottom,
                this.options.minDimensions.height
            );

            // 오프셋 정보 저장 (절대 위치 계산용)
            this.offsetX = rect.left + paddingLeft;
            this.offsetY = rect.top + paddingTop;
        },

        /**
         * 픽셀 좌표를 0-1 범위로 정규화
         * @param {number} x - X 픽셀 좌표
         * @param {number} y - Y 픽셀 좌표
         * @returns {Object} 정규화된 좌표 {normalX, normalY}
         */
        normalizeCoordinates: function(x, y) {
            if (this.width === 0 || this.height === 0) {
                console.warn('ResponsiveCoordinateSystem: 컨테이너 크기가 0입니다.');
                return { normalX: 0, normalY: 0 };
            }

            return {
                normalX: Math.max(0, Math.min(1, x / this.width)),
                normalY: Math.max(0, Math.min(1, y / this.height))
            };
        },

        /**
         * 정규화된 좌표를 픽셀로 변환
         * @param {number} normalX - 정규화된 X 좌표 (0-1)
         * @param {number} normalY - 정규화된 Y 좌표 (0-1)
         * @returns {Object} 픽셀 좌표 {x, y}
         */
        denormalizeCoordinates: function(normalX, normalY) {
            return {
                x: normalX * this.width,
                y: normalY * this.height
            };
        },

        /**
         * 절대 픽셀 좌표를 컨테이너 상대 좌표로 변환
         * @param {number} clientX - 절대 X 좌표 (예: event.clientX)
         * @param {number} clientY - 절대 Y 좌표 (예: event.clientY)
         * @returns {Object} 상대 좌표 {x, y}
         */
        getRelativeCoordinates: function(clientX, clientY) {
            this.updateDimensions(); // 최신 위치 정보 업데이트

            return {
                x: clientX - this.offsetX,
                y: clientY - this.offsetY
            };
        },

        /**
         * 모든 배치된 요소의 위치 재계산
         */
        recalculateAllPositions: function() {
            var self = this;
            var items = this.container.querySelectorAll(this.options.itemSelector);

            items.forEach(function(item) {
                var normalX = parseFloat(item.dataset[self.options.dataPrefix + 'X']);
                var normalY = parseFloat(item.dataset[self.options.dataPrefix + 'Y']);

                // 유효한 정규화된 좌표인지 확인
                if (isNaN(normalX) || isNaN(normalY)) {
                    console.warn('ResponsiveCoordinateSystem: 유효하지 않은 정규화 좌표:', item);
                    return;
                }

                // 새로운 픽셀 좌표 계산
                var coords = self.denormalizeCoordinates(normalX, normalY);

                // 스타일 업데이트
                item.style.left = coords.x + 'px';
                item.style.top = coords.y + 'px';
            });

            console.log('ResponsiveCoordinateSystem: ' + items.length + '개 아이템 위치 재계산 완료');
        },

        /**
         * 아이템에 정규화된 좌표 설정
         * @param {Element} item - 대상 요소
         * @param {number} x - X 픽셀 좌표
         * @param {number} y - Y 픽셀 좌표
         */
        setItemPosition: function(item, x, y) {
            var normalized = this.normalizeCoordinates(x, y);

            // 데이터 속성에 정규화된 좌표 저장
            item.dataset[this.options.dataPrefix + 'X'] = normalized.normalX.toString();
            item.dataset[this.options.dataPrefix + 'Y'] = normalized.normalY.toString();

            // 실제 위치 적용
            item.style.left = x + 'px';
            item.style.top = y + 'px';
            item.style.position = 'absolute';
        },

        /**
         * 아이템의 현재 위치 가져오기
         * @param {Element} item - 대상 요소
         * @returns {Object} 좌표 정보 {x, y, normalX, normalY}
         */
        getItemPosition: function(item) {
            var normalX = parseFloat(item.dataset[this.options.dataPrefix + 'X']) || 0;
            var normalY = parseFloat(item.dataset[this.options.dataPrefix + 'Y']) || 0;
            var coords = this.denormalizeCoordinates(normalX, normalY);

            return {
                x: coords.x,
                y: coords.y,
                normalX: normalX,
                normalY: normalY
            };
        },

        /**
         * 컨테이너 크기 정보 반환
         * @returns {Object} 크기 정보
         */
        getDimensions: function() {
            return {
                width: this.width,
                height: this.height,
                offsetX: this.offsetX,
                offsetY: this.offsetY
            };
        },

        /**
         * 좌표 시스템 일시 정지
         */
        pause: function() {
            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
            }
        },

        /**
         * 좌표 시스템 재시작
         */
        resume: function() {
            if (this.options.enableResizeObserver && this.resizeObserver) {
                this.resizeObserver.observe(this.container);
            }
        },

        /**
         * 디버깅용 - 현재 상태 출력
         */
        debugInfo: function() {
            console.log('=== ResponsiveCoordinateSystem Debug Info ===');
            console.log('Container:', this.container);
            console.log('Dimensions:', { width: this.width, height: this.height });
            console.log('Offset:', { x: this.offsetX, y: this.offsetY });
            console.log('Items:', this.container.querySelectorAll(this.options.itemSelector).length);
        },

        /**
         * 쓰로틀링 유틸리티
         * @param {Function} func - 실행할 함수
         * @param {number} delay - 지연 시간
         */
        throttle: function(func, delay) {
            var lastCall = 0;
            return function() {
                var now = Date.now();
                if (now - lastCall >= delay) {
                    lastCall = now;
                    return func.apply(this, arguments);
                }
            };
        },

        /**
         * 좌표 시스템 정리
         */
        destroy: function() {
            this.isDestroyed = true;

            // ResizeObserver 정리
            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
                this.resizeObserver = null;
            }

            // Window resize 핸들러 정리
            if (this.windowResizeHandler) {
                if (typeof eventManager !== 'undefined') {
                    // EventManager를 통해 등록된 경우는 자동 정리됨
                } else {
                    window.removeEventListener('resize', this.windowResizeHandler);
                }
                this.windowResizeHandler = null;
            }

            // 참조 정리
            this.container = null;

            console.log('ResponsiveCoordinateSystem 정리 완료');
        }
    };

    // 전역에 노출
    global.ResponsiveCoordinateSystem = ResponsiveCoordinateSystem;

    // AMD/CommonJS 지원
    if (typeof define === 'function' && define.amd) {
        define(function() { return ResponsiveCoordinateSystem; });
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = ResponsiveCoordinateSystem;
    }

})(typeof window !== 'undefined' ? window : this);