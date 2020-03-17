import {invoke} from "./navigation/invoke";

let started = false;

export function start() {
    if(started){
        return Promise.resolve()
    }
    started = true;
    return invoke();
}

export function isStarted() {
    return started;
}
