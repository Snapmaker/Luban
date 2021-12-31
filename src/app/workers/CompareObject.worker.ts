// import { throttle } from 'lodash';
import { checkObjectIsEqual } from '../lib/check-name';
import api from '../api';

let tokenSet = false;
let timer;
const saveEnv = (token, envObj) => {
    clearTimeout(timer);
    if (!tokenSet) {
        api.setToken(token);
        tokenSet = true;
    }
    timer = setTimeout(() => {
        api.saveEnv({ content: JSON.stringify(envObj) });
    }, 1000);
};

onmessage = function (e) {
    const { lastEnvObj, envObj, token, force } = e.data;
    try {
        const isEqual = checkObjectIsEqual(lastEnvObj, envObj);

        this.postMessage({ isEqual });
        if (force || !isEqual) {
            saveEnv(token, envObj);
        }
    } catch {
        this.postMessage({ isEqual: false });
    }
};
