import {
    NOT_LOADED,
    notSkip,
    notLoadError,
    isntLoaded,
    shouldBeActivity,
    isActive,
    shouldntBeActivity,
    isLoaded,
    isntActive

} from './apps.helper'
import {invoke} from "../navigation/invoke";

const APPS = [];

/**
 * 注册application
 * @param {string} appName 要注册的app名称
 * @param {Object|Function<Promise>} loadFunction app内容或app异步加载函数
 * @param {Function<Boolean>} activityWhen 判断该app应该何时被启动
 * @param {Object} customProps 自定义配置
 * @return {Promise}
 */
export function registerApplication(appName, loadFunction, activityWhen, customProps = {}) {
    if(!appName || typeof appName !== 'string'){
        throw new Error('appName must be a non-empty string')
    }
    if(!loadFunction){
        throw new Error('loadFunction must be a function or object')
    }
    if(typeof loadFunction !== 'function'){
        loadFunction = () => Promise.resolve(loadFunction)
    }
    if(typeof activityWhen !== 'function'){
        throw new Error('activityWhen must be a function')
    }

    APPS.push({
        name: appName,
        loadFunction,
        activityWhen,
        customProps,
        status: NOT_LOADED
    });
    invoke()
}

/**
 * 获取满足加载条件的app
 * 1、没有加载中断
 * 2、没有加载错误
 * 3、没有被加载过
 * 4、满足app.activityWhen()
 * @return {*[]}
 */
export function getAppsToLoad() {
    return  APPS.filter(notSkip).filter(notLoadError).filter(isntLoaded).filter(shouldBeActivity)
}

/**
 * 需要被unmount的app
 * 1、没有加载中断
 * 2、正在挂载的
 * 3、需要卸载的
 */
export function getAppsToUnmount() {
    return APPS.filter(notSkip).filter(isActive).filter(shouldntBeActivity);
}

/**
 * 需要mount的app
 * 1、没有加载中断
 * 2、加载过的
 * 3、当前没有mounted的
 * 4、需要被mounted的
 */
export function getAppsToMount() {
    return APPS.filter(notSkip).filter(isLoaded).filter(isntActive).filter(shouldBeActivity);
}

export function getMountedApps() {
    return APPS.filter(isActive).map(item => item.name);
}
