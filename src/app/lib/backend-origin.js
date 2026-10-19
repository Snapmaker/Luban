import isElectron from 'is-electron';

/*
 * Where the Luban backend lives.
 *
 * The renderer is served from the backend's own origin today, so relative URLs
 * resolve on their own. That stops being true once the window loads the app off
 * disk over luban:// before the server exists, so the API and socket layers ask
 * here instead of relying on the page origin.
 */

// Same-origin when the page came from the server, which is the current case and
// keeps behaviour identical. Empty under luban://, until main hands us the URL.
const originFromLocation = () => {
    if (typeof window === 'undefined' || !window.location) {
        return '';
    }
    return /^https?:$/.test(window.location.protocol) ? window.location.origin : '';
};

let origin = originFromLocation();
let waiters = [];

const getBackendOrigin = () => origin;

const setBackendOrigin = (value) => {
    if (!value || value === origin) {
        return;
    }
    origin = value;

    const pending = waiters;
    waiters = [];
    for (const resolve of pending) {
        resolve(origin);
    }
};

// Long enough to cover a cold server start, short enough that a backend which
// is never coming fails the call instead of queueing it for ever.
const ORIGIN_TIMEOUT = 30000;

/**
 * Resolves once the backend origin is known.
 *
 * Rejects if it never arrives, so callers fail rather than hang.
 */
const whenBackendOrigin = () => {
    if (origin) {
        return Promise.resolve(origin);
    }
    return new Promise((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error(`Backend origin unknown after ${ORIGIN_TIMEOUT}ms`)),
            ORIGIN_TIMEOUT
        );

        waiters.push((value) => {
            clearTimeout(timer);
            resolve(value);
        });
    });
};

/** Ask main for the server URL, and listen for it in case it is not up yet. */
const listenForBackendOrigin = () => {
    if (!isElectron() || origin) {
        return;
    }

    const { ipcRenderer } = window.require('electron');

    ipcRenderer.on('server-origin', (event, url) => setBackendOrigin(url));
    ipcRenderer.invoke('get-server-origin')
        .then(url => setBackendOrigin(url))
        .catch(() => {
            // Server not up yet; the 'server-origin' event will arrive later.
        });
};

export {
    getBackendOrigin,
    setBackendOrigin,
    whenBackendOrigin,
    listenForBackendOrigin,
};
