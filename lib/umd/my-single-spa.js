(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = global || self, factory(global.mySingleSpa = {}));
}(this, (function (exports) { 'use strict';

    // 未加载
    const NOT_LOADED = 'NOT_LOADED'; // 加载app代码中

    const LOAD_RESOURCE_CODE = 'LOAD_RESOURCE_CODE'; // 加载成功，但未启动

    const NOT_BOOTSTRAPPED = 'NOT_BOOTSTRAPPED'; // 启动中

    const BOOTSTRAPPING = 'BOOTSTRAPPING'; // 启动成功，未挂载

    const NOT_MOUNTED = 'NOT_MOUNTED'; // 挂载中

    const MOUNTING = 'MOUNTING'; // 挂载成功

    const MOUNTED = 'MOUNTED'; // 卸载中

    const UNMOUNTING = 'UNMOUNTING'; // 加载时参数校验未通过，或非致命错误

    const SKIP_BECAUSE_BROKEN = 'SKIP_BECAUSE_BROKEN'; // 加载时遇到致命错误

    const LOAD_ERROR = 'LOAD_ERROR'; // 更新service中
    function notSkip(app) {
      return app.status !== SKIP_BECAUSE_BROKEN;
    }
    function notLoadError(app) {
      return app.status !== LOAD_ERROR;
    }
    function isntLoaded(app) {
      return app.status === NOT_LOADED;
    }
    function shouldBeActivity(app) {
      try {
        return app.activityWhen(window.location);
      } catch (e) {
        app.status = SKIP_BECAUSE_BROKEN;
        console.log(e);
      }
    }
    function isLoaded(app) {
      return app.status !== NOT_LOADED && app.status !== LOAD_ERROR && app.status !== LOAD_RESOURCE_CODE;
    }
    function isActive(app) {
      return app.status === MOUNTED;
    }
    function isntActive(app) {
      return !isActive(app);
    }
    function shouldntBeActivity(app) {
      try {
        return !app.activityWhen(window.location);
      } catch (e) {
        app.status = SKIP_BECAUSE_BROKEN;
        throw e;
      }
    }

    let started = false;
    function start() {
      if (started) {
        return Promise.resolve();
      }

      started = true;
      return invoke();
    }
    function isStarted() {
      return started;
    }

    function smellLikeAPromise(promise) {
      if (promise instanceof Promise) {
        return true;
      }

      return typeof promise === 'object' && typeof promise.then === 'function' && typeof promise.catch === 'function';
    }
    function flattenLifecycleArray(lifecycle, description) {
      if (!Array.isArray(lifecycle)) {
        lifecycle = [lifecycle];
      }

      if (!lifecycle.length) {
        lifecycle = [() => Promise.resolve()];
      }

      return props => new Promise((resolve, reject) => {
        waitForPromises(0);

        function waitForPromises(index) {
          let fn = lifecycle[index]();

          if (!smellLikeAPromise(fn)) {
            reject(new Error(`${description}`));
          } else {
            fn.then(() => {
              if (index >= lifecycle.length - 1) {
                resolve();
              } else {
                waitForPromises(++index);
              }
            }).catch(reject);
          }
        }
      });
    }
    function getProps(app) {
      return {
        name: app.name,
        ...app.customProps
      };
    }

    const TIMEOUTS = {
      bootstrap: {
        milliseconds: 3000,
        rejectWhenTimeout: false
      },
      mount: {
        milliseconds: 3000,
        rejectWhenTimeout: false
      },
      unmount: {
        milliseconds: 3000,
        rejectWhenTimeout: false
      }
    };
    function reasonableTime(lifecyclePromise, description, timeout) {
      return new Promise((resolve, reject) => {
        let finished = false;
        lifecyclePromise.then(data => {
          finished = true;
          resolve(data);
        }).catch(e => {
          finished = true;
          reject(e);
        });
        setTimeout(() => {
          if (finished) {
            return;
          }

          if (timeout.rejectWhenTimeout) {
            reject(`${description}`);
          } else {
            console.log('timeout but waiting');
          }
        }, timeout.microseconds);
      });
    }
    function ensureTimeout(timeouts = {}) {
      return { ...TIMEOUTS,
        ...timeouts
      };
    }

    function toLoadPromise(app) {
      if (app.status !== NOT_LOADED) {
        return Promise.resolve(app);
      } // 状态设置为加载代码中


      app.status = LOAD_RESOURCE_CODE;
      let loadPromise = app.loadFunction(getProps(app));

      if (!smellLikeAPromise(loadPromise)) {
        app.status = SKIP_BECAUSE_BROKEN;
        return Promise.reject(new Error('loadPromise must return a promise or thenable object'));
      }

      return loadPromise.then(appConfig => {
        if (typeof appConfig !== 'object') {
          throw new Error('');
        }

        let errors = []; // 生命周期 bootstrap mount unmount

        ['bootstrap', 'mount', 'unmount'].forEach(lifecycle => {
          if (!appConfig[lifecycle]) {
            errors.push('lifecycle:' + lifecycle + 'must be exists');
          }
        });

        if (errors.length) {
          app.status = SKIP_BECAUSE_BROKEN;
          return app;
        }

        app.status = NOT_BOOTSTRAPPED;
        app.bootstrap = flattenLifecycleArray(appConfig.bootstrap, `app: ${app.name} bootstrapping`);
        app.mount = flattenLifecycleArray(appConfig.mount, `app: ${app.name} mounting`);
        app.unmount = flattenLifecycleArray(appConfig.unmount, `app: ${app.name} unmounting`);
        app.timeouts = ensureTimeout(appConfig.timeouts);
        console.log(app);
        return app;
      }).catch(e => {
        app.status = LOAD_ERROR;
        console.log(e);
      });
    }

    function toBootstrapPromise(app) {
      if (app.status !== NOT_BOOTSTRAPPED) {
        return Promise.resolve(app);
      }

      app.status = BOOTSTRAPPING;
      console.log(app);
      return reasonableTime(app.bootstrap(getProps(app)), `app: ${app.name} bootstripting`, app.timeouts.bootstrap).then(() => {
        app.status = NOT_MOUNTED;
        return app;
      }).catch(e => {
        console.log(e);
        app.status = SKIP_BECAUSE_BROKEN;
        return app;
      });
    }

    function toUnmountPromise(app) {
      if (app.status !== MOUNTED) {
        return Promise.resolve(app);
      }

      app.status = UNMOUNTING;
      return reasonableTime(app.unmount(getProps(app)), `app: ${app.name} unmounting`, app.timeouts.unmount).then(() => {
        app.status = NOT_MOUNTED;
        return app;
      }).catch(e => {
        app.status = SKIP_BECAUSE_BROKEN;
        console.log(e);
        return app;
      });
    }

    function toMountPromise(app) {
      if (app.status !== NOT_MOUNTED) {
        return Promise.resolve(app);
      }

      app.status = MOUNTING;
      return reasonableTime(app.mount(getProps(app)), `app: ${app.name} mounting`, app.timeouts.mount).then(() => {
        app.status = MOUNTED;
        return app;
      }).catch(e => {
        // 如果app挂载失败， 那么立即执行unmount操作
        app.status = MOUNTED;
        console.log(e);
        return toUnmountPromise(app);
      });
    }

    const HIJACK_EVENTS_NAME = /^(hashchange|popstate)$/i;
    const EVENTS_POOL = {
      hashchange: [],
      popstate: []
    };

    function reroute() {
      invoke([], arguments);
    }

    window.addEventListener('hashchange', reroute);
    window.addEventListener('popstate', reroute); // 拦截所有注册的事件，以便确保这里的事件总是第一个执行

    const originalAddEventListener = window.addEventListener;
    const originalRemoveEventListener = window.removeEventListener;

    window.addEventListener = function (eventName, handler, args) {
      if (eventName && HIJACK_EVENTS_NAME.test(eventName) && typeof handler === 'function') {
        EVENTS_POOL[eventName].indexOf(handler) === -1 && EVENTS_POOL[eventName].push(handler);
      }

      return originalAddEventListener.apply(this, arguments);
    };

    window.removeEventListener = function (eventName, handler) {
      if (eventName && HIJACK_EVENTS_NAME.test(eventName) && typeof handler === 'function') {
        let eventList = EVENTS_POOL[eventName];
        eventList.indexOf(handler) > -1 && (EVENTS_POOL[eventName] = eventList.filter(fn => fn !== handler));
      }

      return originalRemoveEventListener.apply(this, arguments);
    }; // 拦截history的方法，因为pushState和replaceState方法并不会触发onpopstate事件，所以我们即便在onpopstate时执行了reroute方法，也要在这里执行下reroute方法。


    const originalHistoryPushState = window.history.pushState;
    const originalHistoryReplaceState = window.history.replaceState;

    window.history.pushState = function (state, title, url) {
      let result = originalHistoryPushState.apply(this, arguments);
      reroute(mockPopStateEvent(state));
      return result;
    };

    window.history.replaceState = function (state, title, url) {
      let result = originalHistoryReplaceState.apply(this, arguments);
      reroute(mockPopStateEvent(state));
      return result;
    };

    function mockPopStateEvent(state) {
      return new PopStateEvent('popstate', {
        state
      });
    }

    function callCapturedEvents(eventArgs) {
      if (!eventArgs) {
        return;
      }

      if (!Array.isArray(eventArgs)) {
        eventArgs = [eventArgs];
      }

      let name = eventArgs[0].type;

      if (!EVENTS_POOL[name] || EVENTS_POOL[name].length === 0) {
        return;
      }

      EVENTS_POOL[name].forEach(handler => handler.apply(window, eventArgs));
    }

    let appChangesUnderway = false; //

    let changesQueue = [];
    function invoke(pendings = [], eventArgs) {
      if (appChangesUnderway) {
        return new Promise((resolve, reject) => {
          changesQueue.push({
            success: resolve,
            failure: reject,
            eventArgs
          });
        });
      }

      appChangesUnderway = true; // 判断系统是否启动

      if (isStarted()) {
        return performAppChanges();
      } else {
        // 按需预加载
        return loadApps();
      }

      function loadApps() {
        // 获取满足加载条件的app并加载
        let loadPromises = getAppsToLoad().map(toLoadPromise);
        return Promise.all(loadPromises).then(() => {
          callAllCapturedEvents();
          return finish();
        }).catch(e => {
          callAllCapturedEvents();
          console.log(e);
        });
      } // 已经启动，先卸载再加载


      function performAppChanges() {
        // unmount不需要的app
        let unmountPromise = getAppsToUnmount().map(toUnmountPromise);
        unmountPromise = Promise.all(unmountPromise); // load app

        let loadApps = getAppsToLoad();
        loadApps.map(app => {
          return toLoadPromise(app).then(app => {
            return toBootstrapPromise(app).then(() => unmountPromise).then(() => toMountPromise(app));
          });
        }); // mount app

        let mountApps = getAppsToMount(); // NOT_MOUNTED
        // 去重

        mountApps.filter(app => loadApps.indexOf(app) === -1);
        mountApps = mountApps.map(app => {
          return toBootstrapPromise(app).then(() => unmountPromise).then(() => toMountPromise(app));
        });
        return unmountPromise.then(() => {
          let allPromises = loadApps.concat(mountApps);
          return Promise.all(allPromises).then(() => {
            callAllCapturedEvents();
            return finish();
          }, e => {
            pendings.forEach(item => item.failure(e));
            throw e;
          });
        }, e => {
          callAllCapturedEvents();
          console.log(e);
        });
      }

      function finish() {
        let returnValue = getMountedApps();

        if (pendings.length) {
          // 当前被挂载的app
          pendings.forEach(item => item.success(returnValue));
        }

        appChangesUnderway = false;

        if (changesQueue.length) {
          let backup = changesQueue;
          changesQueue = [];
          invoke(backup);
        }

        return returnValue;
      }

      function callAllCapturedEvents() {
        // eventsQueue.length>0 说明路由发生了变化
        let eventsQueue = pendings && pendings.length && pendings.filter(item => {
          return !!item.eventArgs;
        }).forEach(event => {
          callCapturedEvents(event);
        });
        eventArgs && callCapturedEvents();
      }
    }

    const APPS = [];
    /**
     * 注册application
     * @param {string} appName 要注册的app名称
     * @param {Object|Function<Promise>} loadFunction app内容或app异步加载函数
     * @param {Function<Boolean>} activityWhen 判断该app应该何时被启动
     * @param {Object} customProps 自定义配置
     * @return {Promise}
     */

    function registerApplication(appName, loadFunction, activityWhen, customProps = {}) {
      if (!appName || typeof appName !== 'string') {
        throw new Error('appName must be a non-empty string');
      }

      if (!loadFunction) {
        throw new Error('loadFunction must be a function or object');
      }

      if (typeof loadFunction !== 'function') {
        loadFunction = () => Promise.resolve(loadFunction);
      }

      if (typeof activityWhen !== 'function') {
        throw new Error('activityWhen must be a function');
      }

      APPS.push({
        name: appName,
        loadFunction,
        activityWhen,
        customProps,
        status: NOT_LOADED
      });
      invoke();
    }
    /**
     * 获取满足加载条件的app
     * 1、没有加载中断
     * 2、没有加载错误
     * 3、没有被加载过
     * 4、满足app.activityWhen()
     * @return {*[]}
     */

    function getAppsToLoad() {
      return APPS.filter(notSkip).filter(notLoadError).filter(isntLoaded).filter(shouldBeActivity);
    }
    /**
     * 需要被unmount的app
     * 1、没有加载中断
     * 2、正在挂载的
     * 3、需要卸载的
     */

    function getAppsToUnmount() {
      return APPS.filter(notSkip).filter(isActive).filter(shouldntBeActivity);
    }
    /**
     * 需要mount的app
     * 1、没有加载中断
     * 2、加载过的
     * 3、当前没有mounted的
     * 4、需要被mounted的
     */

    function getAppsToMount() {
      return APPS.filter(notSkip).filter(isLoaded).filter(isntActive).filter(shouldBeActivity);
    }
    function getMountedApps() {
      return APPS.filter(isActive).map(item => item.name);
    }

    exports.registerApplication = registerApplication;
    exports.start = start;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=my-single-spa.js.map
