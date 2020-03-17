import {MOUNTED, NOT_MOUNTED, SKIP_BECAUSE_BROKEN, UNMOUNTING} from "../applications/apps.helper";
import {reasonableTime} from "../applications/timeouts";
import {getProps} from "./helper";

export function toUnmountPromise(app) {
    if(app.status !== MOUNTED){
        return Promise.resolve(app);
    }
    app.status = UNMOUNTING;

    return reasonableTime(app.unmount(getProps(app)), `app: ${app.name} unmounting`, app.timeouts.unmount).then(() => {
        app.status = NOT_MOUNTED;
        return app
    }).catch(e => {
        app.status = SKIP_BECAUSE_BROKEN;
        console.log(e);
        return app;
    })
}
