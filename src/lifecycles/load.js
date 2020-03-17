import {
    NOT_LOADED,
    LOAD_RESOURCE_CODE,
    SKIP_BECAUSE_BROKEN, NOT_BOOTSTRAPPED, LOAD_ERROR,
} from "../applications/apps.helper";
import {
    smellLikeAPromise,
    flattenLifecycleArray,
    getProps
} from "./helper";
import {ensureTimeout} from "../applications/timeouts";

// 加载
export function toLoadPromise(app) {
    if(app.status !== NOT_LOADED){
        return Promise.resolve(app);
    }
    // 状态设置为加载代码中
    app.status = LOAD_RESOURCE_CODE;

    let loadPromise = app.loadFunction(getProps(app));

    if(!smellLikeAPromise(loadPromise)){
        app.status = SKIP_BECAUSE_BROKEN;
        return Promise.reject(new Error('loadPromise must return a promise or thenable object'));
    }

    return loadPromise.then(appConfig => {
        if(typeof appConfig !== 'object'){
            throw new Error('')
        }
        let errors = [];
        // 生命周期 bootstrap mount unmount
        ['bootstrap', 'mount', 'unmount'].forEach(lifecycle => {
            if(!appConfig[lifecycle]){
                errors.push('lifecycle:' + lifecycle + 'must be exists')
            }
        });

        if(errors.length){
            app.status = SKIP_BECAUSE_BROKEN;
            return app
        }

        app.status = NOT_BOOTSTRAPPED;
        app.bootstrap = flattenLifecycleArray(appConfig.bootstrap, `app: ${app.name} bootstrapping`);
        app.mount = flattenLifecycleArray(appConfig.mount, `app: ${app.name} mounting`);
        app.unmount = flattenLifecycleArray(appConfig.unmount, `app: ${app.name} unmounting`);

        app.timeouts = ensureTimeout(appConfig.timeouts);
        console.log(app);
        return app
    }).catch(e => {
        app.status = LOAD_ERROR;
        console.log(e);
    })
}


