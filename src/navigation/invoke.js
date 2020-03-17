import {isStarted} from "../start";
import {getAppsToLoad, getAppsToUnmount, getAppsToMount, getMountedApps} from "../applications/apps";
import {toLoadPromise} from "../lifecycles/load"
import {toBootstrapPromise} from "../lifecycles/bootstrap";
import {toUnmountPromise} from "../lifecycles/unmount";
import {toMountPromise} from "../lifecycles/mount";
import {callCapturedEvents} from "./hijackLocations";

let appChangesUnderway = false; //
let changesQueue = [];

export function invoke(pendings = [], eventArgs) {
    if(appChangesUnderway){
        return new Promise(((resolve, reject) => {
            changesQueue.push({
                success: resolve,
                failure: reject,
                eventArgs
            })
        }))
    }
    appChangesUnderway = true;
    // 判断系统是否启动
    if(isStarted()){
        return performAppChanges()
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
        })
    }

    // 已经启动，先卸载再加载
    function performAppChanges() {
        // unmount不需要的app
        let unmountPromise = getAppsToUnmount().map(toUnmountPromise);
        unmountPromise = Promise.all(unmountPromise);
        // load app
        let loadApps = getAppsToLoad();
        loadApps.map(app => {
            return toLoadPromise(app).then(app => {
                return toBootstrapPromise(app).then(() => unmountPromise).then(() => toMountPromise(app))
            })
        });

        // mount app
        let mountApps = getAppsToMount(); // NOT_MOUNTED
        // 去重
        mountApps.filter(app => loadApps.indexOf(app) === -1);

        mountApps = mountApps.map(app => {
            return toBootstrapPromise(app).then(() => unmountPromise).then(() => toMountPromise(app))
        });

        return unmountPromise.then(() => {
            let allPromises = loadApps.concat(mountApps);
            return Promise.all(allPromises).then(() => {
                    callAllCapturedEvents();
                    return finish();
                }, e => {
                    pendings.forEach(item => item.failure(e));
                    throw e;
                })
            }, e => {
                callAllCapturedEvents();
                console.log(e);
            })
    }

    function finish() {
        let returnValue = getMountedApps();
        if(pendings.length){
            // 当前被挂载的app
            pendings.forEach(item => item.success(returnValue));
        }
        appChangesUnderway = false;
        if(changesQueue.length){
            let backup = changesQueue;
            changesQueue = [];
            invoke(backup)
        }
        return returnValue
    }

    function callAllCapturedEvents() {
        // eventsQueue.length>0 说明路由发生了变化
        let eventsQueue = pendings && pendings.length && pendings.filter(item => {
            return !!item.eventArgs
        }).forEach(event => {
            callCapturedEvents(event)
        });
        eventArgs && callCapturedEvents()
    }
}
