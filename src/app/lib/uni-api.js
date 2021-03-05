import isElectron from 'is-electron';
import request from 'superagent';
import FileSaver from 'file-saver';
import path from 'path';
import i18n from './i18n';
/**
 * Event Listener in electron
 */
const Event = {
    on: (eventName, callback) => {
        if (isElectron()) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.on(eventName, callback);
        }
    }
};

/**
 *  Update control in electron
 */
const Update = {
    checkForUpdate() {
        if (isElectron()) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('checkForUpdate');
        }
    },
    downloadUpdate(downloadInfo, oldVersion, shouldCheckForUpdate) {
        if (isElectron()) {
            const { remote, ipcRenderer } = window.require('electron');
            const { dialog } = remote;
            const { releaseName } = downloadInfo;

            const dialogOpts = {
                type: 'info',
                buttons: [i18n._('Later'), i18n._('Download now')],
                defaultId: 1,
                checkboxLabel: i18n._('Automatically check for updates'),
                checkboxChecked: shouldCheckForUpdate,
                title: i18n._('Update Snapmaker Luban'),
                message: i18n._(`Snapmaker Luban ${releaseName} Update`),
                detail: i18n._(`Current version : ${oldVersion}`)
                // detail: 'A new version has been detected. Should i download it now?'
            };
            dialog.showMessageBox(dialogOpts).then((returnValue) => {
                if (returnValue.response === 1) {
                    ipcRenderer.send('startingDownloadUpdate');
                }
                ipcRenderer.send('updateShouldCheckForUpdate', returnValue.checkboxChecked);
            });
        }
    },
    downloadHasStarted() {
        if (isElectron()) {
            const { remote } = window.require('electron');
            const { dialog } = remote;

            const dialogOpts = {
                type: 'info',
                title: i18n._('Update Snapmaker Luban'),
                buttons: [i18n._('OK')],
                detail: i18n._('The latest version is currently being downloaded.')
            };
            dialog.showMessageBox(dialogOpts);
        }
    },
    isReplacingAppNow(downloadInfo) {
        if (isElectron()) {
            const { remote, ipcRenderer } = window.require('electron');
            const { dialog } = remote;
            const { releaseName } = downloadInfo;

            const dialogOpts = {
                type: 'info',
                buttons: [i18n._('No'), i18n._('Yes')],
                defaultId: 1,
                title: i18n._(`Luban ${releaseName} has been downloaded.`),
                detail: i18n._('Do you want to exit the program to install now?')
            };

            dialog.showMessageBox(dialogOpts).then((returnValue) => {
                if (returnValue.response === 1) {
                    ipcRenderer.send('replaceAppNow');
                }
            });
        }
    }
};

/**
 * Menu Control in electron
 */
const Menu = {
    setItemEnabled(id, enabled) {
        if (isElectron()) {
            const { remote } = window.require('electron');
            const appMenu = remote.Menu.getApplicationMenu();
            const item = appMenu.getMenuItemById(id);
            item.enabled = enabled;
        }
    },
    cleanAllRecentFiles() {
        if (isElectron()) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('clean-all-recent-files');
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

            fs.copyFileSync(tmpFile, targetFile);
        }
    },
    popFile() {
        if (isElectron()) {
            const { ipcRenderer } = window.require('electron');
            // use invoke and handle method to get file saved in main process
            return ipcRenderer.invoke('popFile');
        }
        return null;
    },
    /**
     * Export file to local directory.
     * TODO: Change `tmpFile` definition.
     *
     * @param tmpFile - temporary file path, e.g. "/Tmp/xxx.stl"
     */
    // export file for project file
    async saveAs(targetFile, tmpFile) {
        if (isElectron()) {
            const fs = window.require('fs');
            const { app } = window.require('electron').remote;
            tmpFile = app.getPath('userData') + tmpFile;
            // eslint-disable-next-line no-use-before-define
            const saveDialogReturnValue = await Dialog.showSaveDialog({
                title: targetFile,
                filters: [{ name: 'files', extensions: [targetFile.split('.')[1]] }]
            });
            targetFile = saveDialogReturnValue.filePath;
            if (!targetFile) throw new Error('select file canceled');

            const file = { path: targetFile, name: path.basename(targetFile) };

            fs.copyFileSync(tmpFile, targetFile);
            // const menu = window.require('electron').remote.require('./electron-app/Menu');
            // menu.addRecentFile(file);
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('add-recent-file', file);

            return file;
        } else {
            request
                .get(`/data${tmpFile}`)
                .responseType('blob')
                .end((err, res) => {
                    FileSaver.saveAs(res.body, targetFile, true);
                });
            return null;
        }
    },

    // export file for 3dp/laser/cnc
    async exportAs(targetFile, tmpFile) {
        if (isElectron()) {
            const fs = window.require('fs');
            const { app } = window.require('electron').remote;
            tmpFile = app.getPath('userData') + tmpFile;
            // eslint-disable-next-line no-use-before-define
            const saveDialogReturnValue = await Dialog.showSaveDialog({
                title: targetFile,
                defaultPath: targetFile,
                filters: [{ name: 'files', extensions: [targetFile.split('.').pop()] }]
            });
            targetFile = saveDialogReturnValue.filePath;
            if (!targetFile) throw new Error('export file canceled');

            const file = { path: targetFile, name: path.basename(targetFile) };

            fs.copyFileSync(tmpFile, targetFile);

            return file;
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
        if (isElectron()) {
            const { dialog } = window.require('electron').remote;
            options.title = 'Snapmaker Luban';
            return dialog.showMessageBox(options);
        } else {
            return window.confirm(options.message);
        }
    },
    showSaveDialog(options, modal = true) {
        if (isElectron()) {
            const remote = window.require('electron').remote;
            const { dialog } = remote;
            options.title = 'Snapmaker Luban';
            if (modal) {
                const currentWindow = remote.getCurrentWindow();
                return dialog.showSaveDialog(currentWindow, options);
            }
            return dialog.showSaveDialog(options);
        }
        return null;
    }
};


/**
 * Window control in electron
 */
const Window = {
    // TODO window have to be refactor
    window: null,
    initTitle: '',

    call(func) {
        if (isElectron()) {
            window.require('electron').remote.getCurrentWindow()[func]();
        }
    },

    initWindow() {
        if (isElectron()) {
            this.window = window.require('electron').remote.getCurrentWindow();
            this.initTitle = this.window.getTitle();
        } else {
            this.window = {
                setTitle(title) {
                    document.title = title;
                }
            };
            this.initTitle = document.title;
        }
    },

    setOpenedFile(filename = 'new') {
        let title = this.initTitle;
        if (filename) {
            title = `${this.initTitle} / ${filename}`;
        }
        this.window.setTitle(title);
    },

    copySelection(text) {
        if (isElectron()) {
            const clipboard = window.require('electron').clipboard;
            clipboard.writeText(text, 'selection');
        } else {
            navigator.clipboard.writeText(text);
            // execCommand is unstable
            // document.execCommand('copy', true, text);
        }
    }
};

export default {
    Update,
    Event,
    Menu,
    File,
    Dialog,
    Window
};
