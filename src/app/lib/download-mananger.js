import isElectron from 'is-electron';

export default {
    emit: (type, data) => {
        if (isElectron()) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send(type, data);
        } else {
            // TODO: most of that can be move to server
            console.warn('browser no such function');
        }
    },
    on: (type, listener) => {
        if (!type || !listener) return;
        if (isElectron()) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.on(type, listener);
        } else {
            // TODO: most of that can be move to server
            console.warn('browser no such function');
        }
    },
    off: (type, listener) => {
        if (!type || !listener) return;
        if (isElectron()) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.removeListener(type, listener);
        }
    },
    openUrl: (url, target) => {
        if (isElectron()) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('open-browser', url);
        } else {
            const aEl = document.createElement('a');
            aEl.setAttribute('href', url);
            target && aEl.setAttribute('target', target);
            aEl.click();
        }
    },
    openFloder: (path) => {
        if (isElectron()) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('open-download-save-path', path);
        }
    },
    removeFile: (downloadItem) => {
        if (isElectron()) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('download-manager-remove-file', downloadItem);
        }
    },
};
