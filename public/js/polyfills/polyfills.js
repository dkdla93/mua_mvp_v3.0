/**
 * Polyfills - 구형 브라우저 호환성 지원
 * IE11+, 구버전 Safari, Firefox 지원을 위한 polyfill 모음
 */

'use strict';

(function(global) {
    console.log('Polyfills 로딩 시작...');

    // =======================================================================
    // Object.assign polyfill (IE 지원)
    // =======================================================================
    if (typeof Object.assign !== 'function') {
        Object.defineProperty(Object, 'assign', {
            value: function assign(target) {
                'use strict';
                if (target == null) {
                    throw new TypeError('Cannot convert undefined or null to object');
                }

                var to = Object(target);

                for (var index = 1; index < arguments.length; index++) {
                    var nextSource = arguments[index];

                    if (nextSource != null) {
                        for (var key in nextSource) {
                            if (Object.prototype.hasOwnProperty.call(nextSource, key)) {
                                to[key] = nextSource[key];
                            }
                        }
                    }
                }
                return to;
            },
            writable: true,
            configurable: true
        });
        console.log('Object.assign polyfill 적용');
    }

    // =======================================================================
    // Array.from polyfill (IE 지원)
    // =======================================================================
    if (!Array.from) {
        Array.from = function(object, mapFn, thisArg) {
            'use strict';
            var C = this;
            var items = Object(object);

            if (object == null) {
                throw new TypeError('Array.from requires an array-like object - not null or undefined');
            }

            var mapFunction = mapFn === undefined ? undefined : mapFn;
            var T;
            if (typeof mapFunction !== 'undefined') {
                if (typeof mapFunction !== 'function') {
                    throw new TypeError('Array.from: when provided, the second argument must be a function');
                }
                if (arguments.length > 2) {
                    T = thisArg;
                }
            }

            var len = parseInt(items.length);
            var A = typeof C === 'function' ? Object(new C(len)) : new Array(len);
            var k = 0;
            var kValue;

            while (k < len) {
                kValue = items[k];
                if (mapFunction) {
                    A[k] = typeof T === 'undefined' ? mapFunction(kValue, k) : mapFunction.call(T, kValue, k);
                } else {
                    A[k] = kValue;
                }
                k += 1;
            }

            A.length = len;
            return A;
        };
        console.log('Array.from polyfill 적용');
    }

    // =======================================================================
    // Array.prototype.includes polyfill (IE 지원)
    // =======================================================================
    if (!Array.prototype.includes) {
        Array.prototype.includes = function(valueToFind, fromIndex) {
            'use strict';
            if (this == null) {
                throw new TypeError('"this" is null or not defined');
            }

            var O = Object(this);
            var len = parseInt(O.length) || 0;

            if (len === 0) {
                return false;
            }

            var n = fromIndex | 0;
            var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);

            function sameValueZero(x, y) {
                return x === y || (typeof x === 'number' && typeof y === 'number' && isNaN(x) && isNaN(y));
            }

            while (k < len) {
                if (sameValueZero(O[k], valueToFind)) {
                    return true;
                }
                k++;
            }

            return false;
        };
        console.log('Array.prototype.includes polyfill 적용');
    }

    // =======================================================================
    // String.prototype.includes polyfill (IE 지원)
    // =======================================================================
    if (!String.prototype.includes) {
        String.prototype.includes = function(search, start) {
            'use strict';
            if (typeof start !== 'number') {
                start = 0;
            }

            if (start + search.length > this.length) {
                return false;
            } else {
                return this.indexOf(search, start) !== -1;
            }
        };
        console.log('String.prototype.includes polyfill 적용');
    }

    // =======================================================================
    // String.prototype.startsWith polyfill (IE 지원)
    // =======================================================================
    if (!String.prototype.startsWith) {
        String.prototype.startsWith = function(searchString, position) {
            position = position || 0;
            return this.substr(position, searchString.length) === searchString;
        };
        console.log('String.prototype.startsWith polyfill 적용');
    }

    // =======================================================================
    // String.prototype.endsWith polyfill (IE 지원)
    // =======================================================================
    if (!String.prototype.endsWith) {
        String.prototype.endsWith = function(searchString, length) {
            if (typeof length === 'undefined' || length > this.length) {
                length = this.length;
            }
            return this.substring(length - searchString.length, length) === searchString;
        };
        console.log('String.prototype.endsWith polyfill 적용');
    }

    // =======================================================================
    // Promise polyfill (IE 지원) - 간단한 구현
    // =======================================================================
    if (typeof Promise === 'undefined') {
        console.log('Promise polyfill 로딩 중...');

        // CDN에서 Promise polyfill 동적 로딩
        var script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/promise-polyfill@8/dist/polyfill.min.js';
        script.async = true;
        script.onload = function() {
            console.log('Promise polyfill 로드 완료');
        };
        script.onerror = function() {
            console.warn('Promise polyfill 로드 실패 - 기본 구현 사용');

            // 매우 간단한 Promise 구현 (최소 기능만)
            global.Promise = function(executor) {
                var self = this;
                this.state = 'pending';
                this.value = undefined;
                this.handlers = [];

                function resolve(result) {
                    if (self.state === 'pending') {
                        self.state = 'resolved';
                        self.value = result;
                        self.handlers.forEach(handle);
                        self.handlers = null;
                    }
                }

                function reject(error) {
                    if (self.state === 'pending') {
                        self.state = 'rejected';
                        self.value = error;
                        self.handlers.forEach(handle);
                        self.handlers = null;
                    }
                }

                function handle(handler) {
                    if (self.state === 'pending') {
                        self.handlers.push(handler);
                    } else {
                        if (self.state === 'resolved' && typeof handler.onResolved === 'function') {
                            handler.onResolved(self.value);
                        }
                        if (self.state === 'rejected' && typeof handler.onRejected === 'function') {
                            handler.onRejected(self.value);
                        }
                    }
                }

                this.then = function(onResolved, onRejected) {
                    return new Promise(function(resolve, reject) {
                        return handle({
                            onResolved: function(result) {
                                if (!onResolved) {
                                    return resolve(result);
                                }
                                try {
                                    return resolve(onResolved(result));
                                } catch (ex) {
                                    return reject(ex);
                                }
                            },
                            onRejected: function(error) {
                                if (!onRejected) {
                                    return reject(error);
                                }
                                try {
                                    return resolve(onRejected(error));
                                } catch (ex) {
                                    return reject(ex);
                                }
                            }
                        });
                    });
                };

                this.catch = function(onError) {
                    return this.then(null, onError);
                };

                try {
                    executor(resolve, reject);
                } catch (error) {
                    reject(error);
                }
            };

            // Promise.resolve, Promise.reject 정적 메서드
            Promise.resolve = function(value) {
                return new Promise(function(resolve) {
                    resolve(value);
                });
            };

            Promise.reject = function(reason) {
                return new Promise(function(resolve, reject) {
                    reject(reason);
                });
            };
        };

        document.head.appendChild(script);
    }

    // =======================================================================
    // ResizeObserver polyfill (구형 브라우저 지원)
    // =======================================================================
    if (typeof ResizeObserver === 'undefined') {
        console.log('ResizeObserver polyfill 로딩 중...');

        var script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/resize-observer-polyfill@1.5.1/dist/ResizeObserver.min.js';
        script.async = true;
        script.onload = function() {
            console.log('ResizeObserver polyfill 로드 완료');
        };
        script.onerror = function() {
            console.warn('ResizeObserver polyfill 로드 실패 - window.resize 이벤트로 폴백');
        };

        document.head.appendChild(script);
    }

    // =======================================================================
    // Map polyfill (IE10 지원)
    // =======================================================================
    if (typeof Map === 'undefined') {
        global.Map = function() {
            this._keys = [];
            this._values = [];
            this.size = 0;
        };

        Map.prototype.set = function(key, value) {
            var index = this._keys.indexOf(key);
            if (index === -1) {
                this._keys.push(key);
                this._values.push(value);
                this.size++;
            } else {
                this._values[index] = value;
            }
            return this;
        };

        Map.prototype.get = function(key) {
            var index = this._keys.indexOf(key);
            return index === -1 ? undefined : this._values[index];
        };

        Map.prototype.has = function(key) {
            return this._keys.indexOf(key) !== -1;
        };

        Map.prototype.delete = function(key) {
            var index = this._keys.indexOf(key);
            if (index !== -1) {
                this._keys.splice(index, 1);
                this._values.splice(index, 1);
                this.size--;
                return true;
            }
            return false;
        };

        Map.prototype.clear = function() {
            this._keys = [];
            this._values = [];
            this.size = 0;
        };

        Map.prototype.forEach = function(callback, thisArg) {
            for (var i = 0; i < this._keys.length; i++) {
                callback.call(thisArg, this._values[i], this._keys[i], this);
            }
        };

        console.log('Map polyfill 적용');
    }

    // =======================================================================
    // Set polyfill (IE10 지원)
    // =======================================================================
    if (typeof Set === 'undefined') {
        global.Set = function() {
            this._values = [];
            this.size = 0;
        };

        Set.prototype.add = function(value) {
            if (this._values.indexOf(value) === -1) {
                this._values.push(value);
                this.size++;
            }
            return this;
        };

        Set.prototype.has = function(value) {
            return this._values.indexOf(value) !== -1;
        };

        Set.prototype.delete = function(value) {
            var index = this._values.indexOf(value);
            if (index !== -1) {
                this._values.splice(index, 1);
                this.size--;
                return true;
            }
            return false;
        };

        Set.prototype.clear = function() {
            this._values = [];
            this.size = 0;
        };

        Set.prototype.forEach = function(callback, thisArg) {
            for (var i = 0; i < this._values.length; i++) {
                callback.call(thisArg, this._values[i], this._values[i], this);
            }
        };

        console.log('Set polyfill 적용');
    }

    // =======================================================================
    // 브라우저 지원 현황 체크
    // =======================================================================
    function checkFeatureSupport() {
        var features = {
            'Object.assign': typeof Object.assign === 'function',
            'Array.from': typeof Array.from === 'function',
            'Array.includes': typeof Array.prototype.includes === 'function',
            'String.includes': typeof String.prototype.includes === 'function',
            'Promise': typeof Promise === 'function',
            'Map': typeof Map === 'function',
            'Set': typeof Set === 'function',
            'ResizeObserver': typeof ResizeObserver === 'function'
        };

        var unsupportedFeatures = [];
        for (var feature in features) {
            if (!features[feature]) {
                unsupportedFeatures.push(feature);
            }
        }

        if (unsupportedFeatures.length > 0) {
            console.warn('지원되지 않는 기능들:', unsupportedFeatures);
        } else {
            console.log('모든 필수 기능이 지원됩니다.');
        }

        // 전역에 지원 현황 정보 저장
        global.__BROWSER_FEATURE_SUPPORT__ = features;

        return features;
    }

    // =======================================================================
    // CSS Grid/Flexbox 지원 확인 및 폴백
    // =======================================================================
    function checkCSSSupport() {
        var testElement = document.createElement('div');
        var cssSupport = {
            flexbox: false,
            grid: false
        };

        // Flexbox 지원 확인
        try {
            testElement.style.display = 'flex';
            cssSupport.flexbox = testElement.style.display === 'flex';
        } catch (e) {
            cssSupport.flexbox = false;
        }

        // CSS Grid 지원 확인
        try {
            testElement.style.display = 'grid';
            cssSupport.grid = testElement.style.display === 'grid';
        } catch (e) {
            cssSupport.grid = false;
        }

        // 지원하지 않는 기능에 대한 클래스 추가
        if (!cssSupport.flexbox) {
            document.documentElement.className += ' no-flexbox';
        }
        if (!cssSupport.grid) {
            document.documentElement.className += ' no-grid';
        }

        console.log('CSS 지원 현황:', cssSupport);
        return cssSupport;
    }

    // =======================================================================
    // 초기화 및 완료 알림
    // =======================================================================
    function initPolyfills() {
        checkFeatureSupport();
        checkCSSSupport();

        // DOM이 로드된 후 실행
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                console.log('Polyfills 초기화 완료 - DOM 로드됨');
            });
        } else {
            console.log('Polyfills 초기화 완료 - DOM 이미 로드됨');
        }
    }

    // 즉시 초기화 실행
    initPolyfills();

    // 전역에 폴리필 정보 노출
    global.__POLYFILLS_LOADED__ = true;

})(typeof window !== 'undefined' ? window : this);