import isElectron from 'is-electron';
import request from 'superagent';
import FileSaver from 'file-saver';
import path from 'path';

/**
 * Event Listener in electron
 */
const Event = {
    on: (eventName, callback) => {
        console.log('uni-api.event.on', eventName);
        if (isElectron()) {
            console.log('is electron environment!');
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.on(eventName, callback);
        } else {
            console.log('not electron environment, nothing to do.');
        }
    }
};

/**
 * Menu Control in electron
 */
const Menu = {
    setItemEnabled(id, enabled) {
        console.log('uni-api.menu.setItem.Enabled', id, enabled);
        if (isElectron()) {
            const { remote } = window.require('electron');
            const appMenu = remote.Menu.getApplicationMenu();
            const item = appMenu.getMenuItemById(id);
            item.enabled = enabled;
        }
    }
};

/**
 * File control in electron
 */
const File = {
    save(targetFile, tmpFile) {
        if (isElectron()) {
            const fs = window.require('fs');
            const app = window.require('electron').remote.app;
            tmpFile = app.getPath('userData') + tmpFile;
            console.log(tmpFile, targetFile);

            fs.copyFileSync(tmpFile, targetFile);
        }
    },
    saveAs(targetFile, tmpFile) {
        if (isElectron()) {
            const fs = window.require('fs');
            const { app, dialog } = window.require('electron').remote;
            tmpFile = app.getPath('userData') + tmpFile;
            targetFile = dialog.showSaveDialog({ title: targetFile, filters: [{ name: 'files', extensions: [targetFile.split('.')[1]] }] });
            if (!targetFile) throw new Error('select file canceled');

            fs.copyFileSync(tmpFile, targetFile);
            return { path: targetFile, name: path.basename(targetFile) };
        } else {
            request
                .get(`/data${tmpFile}`)
                .responseType('blob')
                .end((err, res) => {
                    FileSaver.saveAs(res.body, targetFile, true);
                });
            return null;
        }
    }

};

/**
 * Dialogs control in electron
 */
const Dialog = {
    showMessageBox(options) {
        console.log('uni-api.dialog.showMessageBox', options);
        if (isElectron()) {
            const { dialog } = window.require('electron').remote;
            return dialog.showMessageBox(options);
        } else {
            return window.confirm(options.message);
        }
    }
};


/**
 * Window control in electron
 */
const Window = {
    call(func) {
        if (isElectron()) {
            window.require('electron').remote.getCurrentWindow()[func]();
        }
    },

    setOpenedFile: (() => {
        let win, initTitle;
        if (isElectron()) {
            win = window.require('electron').remote.getCurrentWindow();
            initTitle = win.getTitle();
        } else {
            win = {
                setTitle(title) {
                    document.title = title;
                }
            };
            initTitle = document.title;
        }
        return (filename) => {
            let title = initTitle;
            if (filename) title = `${initTitle} / ${filename}`;
            win.setTitle(title);
        };
    })()

};

export default {
    Event,
    Menu,
    File,
    Dialog,
    Window
};
