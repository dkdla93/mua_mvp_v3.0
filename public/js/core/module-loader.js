/**
 * 착공도서 자동생성 시스템 - 모듈 로더 및 의존성 관리
 * Construction Document Auto Generator - Module Loader & Dependency Management
 */

'use strict';

// 전역 모듈 로더 클래스
window.ModuleLoader = (function() {

    const modules = new Map(); // 등록된 모듈들
    const loadedModules = new Map(); // 로드된 모듈들
    const dependencies = new Map(); // 의존성 맵
    const loadingPromises = new Map(); // 로딩 중인 프로미스들
    const initializeOrder = []; // 초기화 순서

    /**
     * 의존성 그래프에서 순환 참조를 확인
     */
    function checkCircularDependencies(moduleName, visited = new Set(), path = []) {
        if (path.includes(moduleName)) {
            throw new Error(`순환 의존성 감지: ${path.join(' -> ')} -> ${moduleName}`);
        }

        if (visited.has(moduleName)) {
            return;
        }

        visited.add(moduleName);
        const moduleDeps = dependencies.get(moduleName) || [];

        for (const dep of moduleDeps) {
            checkCircularDependencies(dep, visited, [...path, moduleName]);
        }
    }

    /**
     * 위상 정렬을 통한 모듈 로딩 순서 결정
     */
    function topologicalSort() {
        const visited = new Set();
        const result = [];

        function dfs(moduleName) {
            if (visited.has(moduleName)) return;
            visited.add(moduleName);

            const deps = dependencies.get(moduleName) || [];
            for (const dep of deps) {
                dfs(dep);
            }

            result.push(moduleName);
        }

        // 모든 모듈에 대해 DFS 수행
        for (const moduleName of modules.keys()) {
            dfs(moduleName);
        }

        return result;
    }

    /**
     * 스크립트 동적 로딩
     */
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            // 이미 로드된 스크립트인지 확인
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.type = 'text/javascript';
            script.async = false; // 순서 보장

            script.onload = () => {
                AppConfig.log(`스크립트 로드 완료: ${src}`);
                resolve();
            };

            script.onerror = () => {
                AppConfig.log(`스크립트 로드 실패: ${src}`, 'error');
                reject(new Error(`스크립트 로드 실패: ${src}`));
            };

            document.head.appendChild(script);
        });
    }

    /**
     * 모듈 정의 및 등록
     */
    function defineModule(name, factory, deps = []) {
        AppConfig.log(`모듈 정의: ${name}, 의존성: [${deps.join(', ')}]`);

        // 순환 의존성 확인
        dependencies.set(name, deps);
        try {
            checkCircularDependencies(name);
        } catch (error) {
            console.error(error.message);
            throw error;
        }

        // 모듈 등록
        modules.set(name, {
            factory,
            dependencies: deps,
            instance: null,
            initialized: false
        });

        return name;
    }

    /**
     * 모듈 로드 및 인스턴스 생성
     */
    async function loadModule(name) {
        AppConfig.startPerformance(`load-module-${name}`);

        // 이미 로드된 모듈인지 확인
        if (loadedModules.has(name)) {
            AppConfig.endPerformance(`load-module-${name}`);
            return loadedModules.get(name);
        }

        // 이미 로딩 중인 모듈인지 확인
        if (loadingPromises.has(name)) {
            return loadingPromises.get(name);
        }

        const loadPromise = (async () => {
            const moduleDefinition = modules.get(name);
            if (!moduleDefinition) {
                throw new Error(`모듈을 찾을 수 없습니다: ${name}`);
            }

            AppConfig.log(`모듈 로딩 시작: ${name}`);

            // 의존성 모듈들을 먼저 로드
            const dependencies = moduleDefinition.dependencies;
            const resolvedDependencies = [];

            for (const dep of dependencies) {
                try {
                    const depInstance = await loadModule(dep);
                    resolvedDependencies.push(depInstance);
                } catch (error) {
                    throw new Error(`의존성 로드 실패 (${name} -> ${dep}): ${error.message}`);
                }
            }

            // 모듈 팩토리 실행
            try {
                const moduleInstance = await moduleDefinition.factory(...resolvedDependencies);
                moduleDefinition.instance = moduleInstance;
                loadedModules.set(name, moduleInstance);

                AppConfig.log(`모듈 로딩 완료: ${name}`);
                AppConfig.endPerformance(`load-module-${name}`);

                return moduleInstance;
            } catch (error) {
                throw new Error(`모듈 생성 실패 (${name}): ${error.message}`);
            }
        })();

        loadingPromises.set(name, loadPromise);
        return loadPromise;
    }

    /**
     * 여러 모듈 동시 로드
     */
    async function loadModules(moduleNames) {
        AppConfig.log(`다중 모듈 로딩 시작: [${moduleNames.join(', ')}]`);

        try {
            const promises = moduleNames.map(name => loadModule(name));
            const results = await Promise.all(promises);

            AppConfig.log(`다중 모듈 로딩 완료: [${moduleNames.join(', ')}]`);
            return results;
        } catch (error) {
            console.error('다중 모듈 로딩 실패:', error);
            throw error;
        }
    }

    /**
     * 모듈 초기화 (생성된 후 초기화 메서드 호출)
     */
    async function initializeModule(name) {
        const moduleInstance = loadedModules.get(name);
        const moduleDefinition = modules.get(name);

        if (!moduleInstance || !moduleDefinition) {
            throw new Error(`초기화할 모듈을 찾을 수 없습니다: ${name}`);
        }

        if (moduleDefinition.initialized) {
            return moduleInstance;
        }

        AppConfig.log(`모듈 초기화 시작: ${name}`);

        // init 메서드가 있으면 호출
        if (moduleInstance && typeof moduleInstance.init === 'function') {
            try {
                await moduleInstance.init();
                AppConfig.log(`모듈 초기화 완료: ${name}`);
            } catch (error) {
                throw new Error(`모듈 초기화 실패 (${name}): ${error.message}`);
            }
        }

        moduleDefinition.initialized = true;
        return moduleInstance;
    }

    /**
     * 모든 모듈 로드 및 초기화 (위상 정렬 순서)
     */
    async function loadAllModules() {
        AppConfig.startPerformance('load-all-modules');

        try {
            // 위상 정렬로 로딩 순서 결정
            const loadingOrder = topologicalSort();
            AppConfig.log(`모듈 로딩 순서: [${loadingOrder.join(' -> ')}]`);

            // 순서대로 모듈 로드
            for (const moduleName of loadingOrder) {
                await loadModule(moduleName);
            }

            // 순서대로 모듈 초기화
            for (const moduleName of loadingOrder) {
                await initializeModule(moduleName);
            }

            AppConfig.log('모든 모듈 로드 및 초기화 완료');
            AppConfig.endPerformance('load-all-modules');

            return true;
        } catch (error) {
            console.error('모듈 로딩/초기화 실패:', error);
            throw error;
        }
    }

    /**
     * 외부 스크립트 파일에서 모듈 로드
     */
    async function loadModuleFromFile(name, filePath, deps = []) {
        AppConfig.log(`파일에서 모듈 로딩: ${name} (${filePath})`);

        try {
            await loadScript(filePath);

            // 글로벌 스코프에서 모듈을 찾아 등록
            const moduleFactory = window[name];
            if (typeof moduleFactory === 'function') {
                defineModule(name, moduleFactory, deps);
                return await loadModule(name);
            } else {
                throw new Error(`모듈 팩토리를 찾을 수 없습니다: ${name}`);
            }
        } catch (error) {
            throw new Error(`파일에서 모듈 로딩 실패 (${name}): ${error.message}`);
        }
    }

    /**
     * 모듈 상태 정보 조회
     */
    function getModuleInfo() {
        const info = {
            registered: modules.size,
            loaded: loadedModules.size,
            loading: loadingPromises.size,
            modules: []
        };

        modules.forEach((def, name) => {
            info.modules.push({
                name,
                dependencies: def.dependencies,
                loaded: loadedModules.has(name),
                initialized: def.initialized
            });
        });

        return info;
    }

    /**
     * 모듈 언로드 (개발용)
     */
    function unloadModule(name) {
        if (loadedModules.has(name)) {
            const instance = loadedModules.get(name);

            // cleanup 메서드가 있으면 호출
            if (instance && typeof instance.cleanup === 'function') {
                instance.cleanup();
            }

            loadedModules.delete(name);
            loadingPromises.delete(name);

            const moduleDefinition = modules.get(name);
            if (moduleDefinition) {
                moduleDefinition.instance = null;
                moduleDefinition.initialized = false;
            }

            AppConfig.log(`모듈 언로드: ${name}`);
        }
    }

    // Public API
    return {
        define: defineModule,
        load: loadModule,
        loadMany: loadModules,
        loadFromFile: loadModuleFromFile,
        loadAll: loadAllModules,
        initialize: initializeModule,
        getInfo: getModuleInfo,
        unload: unloadModule,

        // 개발자 도구용 디버그 함수들
        debug: {
            getModules: () => modules,
            getLoaded: () => loadedModules,
            getDependencies: () => dependencies,
            checkCircular: checkCircularDependencies,
            getLoadOrder: topologicalSort
        }
    };
})();

console.log('✅ ModuleLoader 초기화 완료');