import isElectron from 'is-electron';
import request from 'superagent';
import FileSaver from 'file-saver';
import { isNil } from 'lodash';
import events from 'events';
import path from 'path';
import i18n from './i18n';

class AppbarMenuEvent extends events.EventEmitter {}

const menuEvent = new AppbarMenuEvent();
/**
 * Event Listener in electron
 */
const Event = {
    _isAvailInBrowser: (eventName) => {
        return eventName.startsWith('appbar-menu:') || eventName.startsWith('tile-modal:');
    },
    on: (eventName, callback) => {
        if (isElectron()) {
            if (Event._isAvailInBrowser(eventName)) {
                menuEvent.on(eventName, callback);
            } else {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.on(eventName, callback);
            }
        } else {
            menuEvent.on(eventName, callback);
        }
    },
    emit: (eventName, ...args) => {
        if (isElectron()) {
            if (Event._isAvailInBrowser(eventName)) {
                menuEvent.emit(eventName, ...args);
            } else {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.send(eventName, ...args);
            }
        } else {
            menuEvent.emit(eventName, ...args);
        }
    },
    off: (eventName, callback) => {
        if (isElectron()) {
            if (Event._isAvailInBrowser(eventName)) {
                menuEvent.off(eventName, callback);
            } else {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.off(eventName, callback);
            }
        } else {
            menuEvent.off(eventName, callback);
        }
    },
    once: (eventName, callback) => {
        menuEvent.once(eventName, callback);
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
                buttons: [i18n._('key-App/Update-Later'), i18n._('key-App/Update-Update Now')],
                defaultId: 1,
                checkboxLabel: i18n._('key-App/Update-Automatically check for updates'),
                checkboxChecked: shouldCheckForUpdate,
                title: i18n._('key-App/Update-Update Snapmaker Luban'),
                message: `Snapmaker Luban ${releaseName} ${i18n._('key-App/Update-Update')}`,
                detail: `${i18n._('key-App/Update-Current version')} : ${oldVersion}`
                // detail: 'A new version has been detected. Should i download it now?'
            };
            dialog.showMessageBox(remote.getCurrentWindow(), dialogOpts).then((returnValue) => {
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
                title: i18n._('key-App/Update-Update Snapmaker Luban'),
                buttons: [i18n._('key-App/Update-OK')],
                detail: i18n._('key-App/Update-The latest version is currently being downloaded.')
            };
            dialog.showMessageBox(remote.getCurrentWindow(), dialogOpts);
        }
    },
    isReplacingAppNow(downloadInfo) {
        if (isElectron()) {
            const { remote, ipcRenderer } = window.require('electron');
            const { dialog } = remote;
            const { releaseName } = downloadInfo;

            const dialogOpts = {
                type: 'info',
                buttons: [i18n._('key-App/Update-Later'), i18n._('key-App/Update-Install Now')],
                defaultId: 1,
                title: i18n._(`Luban ${releaseName} has been downloaded.`),
                detail: i18n._('key-App/Update-A new version has been downloaded. Install now?')
            };

            dialog.showMessageBox(remote.getCurrentWindow(), dialogOpts).then((returnValue) => {
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
    },
    replaceMenu(newMenuTemplate) {
        if (isElectron()) {
            const appMenu = window.require('electron').remote.Menu;
            const menu = appMenu.buildFromTemplate(newMenuTemplate);
            appMenu.setApplicationMenu(menu);
        }
    }
};

/**
 * File control in electron
 */
const File = {
    writeBlobToFile(blob, newPath) {
        if (isElectron()) {
            const fileReader = new FileReader();
            fileReader.onload = () => {
                window.require('fs').writeFileSync(newPath, Buffer.from(new Uint8Array(fileReader.result)));
            };
            fileReader.readAsArrayBuffer(blob);
        } else {
            FileSaver.saveAs(blob, newPath, true);
        }
    },
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
            const defaultPath = path.resolve(app.getPath('downloads'), path.basename(tmpFile));
            tmpFile = app.getPath('userData') + tmpFile;
            // eslint-disable-next-line no-use-before-define
            const saveDialogReturnValue = await Dialog.showSaveDialog({
                title: targetFile,
                defaultPath,
                filters: [{ name: 'files', extensions: [targetFile.split('.')[1]] }]
            });
            targetFile = saveDialogReturnValue.filePath;
            if (!targetFile) throw new Error('select file canceled');

            const file = { path: targetFile, name: window.require('path').basename(targetFile) };

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
    async exportAs(targetFile, tmpFile, renderGcodeFileName, updateSurveyCondition, dispatch) {
        if (isNil(renderGcodeFileName)) {
            renderGcodeFileName = targetFile;
        } else {
            if (renderGcodeFileName.slice(renderGcodeFileName.length - 9) === '.def.json') {
                renderGcodeFileName = renderGcodeFileName.slice(renderGcodeFileName.length - 9);
            } else {
                renderGcodeFileName = path.basename(renderGcodeFileName);
            }
        }
        if (isElectron()) {
            const fs = window.require('fs');
            const { app } = window.require('electron').remote;
            const defaultPath = path.resolve(app.getPath('downloads'), renderGcodeFileName);
            tmpFile = app.getPath('userData') + tmpFile;
            // eslint-disable-next-line no-use-before-define
            const saveDialogReturnValue = await Dialog.showSaveDialog({
                // title: targetFile,
                title: renderGcodeFileName,
                defaultPath,
                filters: [{ name: 'files', extensions: [targetFile.split('.').pop()] }]
            });
            targetFile = saveDialogReturnValue.filePath;
            if (!targetFile) throw new Error('export file canceled');

            const file = { path: targetFile, name: renderGcodeFileName };
            fs.copyFileSync(tmpFile, targetFile);
            updateSurveyCondition && updateSurveyCondition(renderGcodeFileName, dispatch);
            return file;
        } else {
            request
                .get(`/data${tmpFile}`)
                .responseType('blob')
                .end((err, res) => {
                    // FileSaver.saveAs(res.body, targetFile, true);
                    FileSaver.saveAs(res.body, renderGcodeFileName, true);
                });
            updateSurveyCondition && updateSurveyCondition(renderGcodeFileName, dispatch);
            return null;
        }
    },
    constructFileObj(absolutePath, name) {
        if (isElectron()) {
            const fs = window.require('fs');
            const buffer = fs.readFileSync(absolutePath);
            const file = new window.File([new Uint8Array(buffer).buffer], name);
            return file;
        }
        return null;
    },
    addRecentFiles(recentFile) {
        if (isElectron()) {
            const ipc = window.require('electron').ipcRenderer;
            ipc.send('add-recent-file', recentFile);
        }
    },
    resolveDownloadsPath(tmpFile) {
        if (isElectron()) {
            const { app } = window.require('electron').remote;
            const defaultPath = path.resolve(app.getPath('downloads'), path.basename(tmpFile));
            return defaultPath;
        } else {
            return tmpFile;
        }
    }
};

/**
 * Dialogs control in electron
 */
const Dialog = {
    async showOpenFileDialog(type) {
        type = typeof type === 'string' ? type.slice(1) : '';
        let extensions = ['snap3dp', 'snaplzr', 'snapcnc'];
        switch (type) { // substring '/3dp' to '3dp'
            case 'printing':
                extensions = ['stl', 'obj'];
                break;
            case 'laser-rotate':
                extensions = ['svg', 'png', 'jpg', 'jpeg', 'bmp', 'dxf'];
                break;
            case 'laser':
                extensions = ['svg', 'png', 'jpg', 'jpeg', 'bmp', 'dxf', 'stl'];
                break;
            case 'cnc':
                extensions = ['svg', 'png', 'jpg', 'jpeg', 'bmp', 'dxf', 'stl'];
                break;
            case 'workspace':
                extensions = ['gcode', 'nc', 'cnc'];
                break;
            default: break;
        }

        if (isElectron()) {
            const { remote } = window.require('electron');
            const currentWindow = remote.getCurrentWindow();
            const openDialogReturnValue = await remote.dialog.showOpenDialog(
                currentWindow,
                {
                    title: 'Snapmaker Luban',
                    filters: [{ name: 'files', extensions }]
                }
            );
            const filePaths = openDialogReturnValue.filePaths;
            if (!filePaths || !filePaths[0]) return null;
            const file = { path: filePaths[0], name: window.require('path').basename(filePaths[0]) };
            return file;
        }
        return null;
    },
    showMessageBox(options, modal = true) {
        if (isElectron()) {
            const remote = window.require('electron').remote;
            const { dialog } = remote;
            options.title = 'Snapmaker Luban';
            if (modal) {
                const currentWindow = remote.getCurrentWindow();
                return dialog.showMessageBox(currentWindow, options);
            }
            return dialog.showMessageBox(options);
        } else {
            return window.confirm(options.message);
        }
    },
    showSaveDialog(options, modal = true) {
        console.log({ options, modal });
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

    setOpenedFile(filename = 'New') {
        if (!this.window) {
            this.initWindow();
        }
        let title = this.initTitle;
        if (filename) {
            title = `${this.initTitle} / ${filename}`;
        }
        this.window.setTitle(title);
    },

    copySelection(text) {
        if (isElectron()) {
            const clipboard = window.require('electron').clipboard;
            clipboard.writeText(text);
        } else {
            navigator.clipboard.writeText(text);
            // execCommand is unstable
            // document.execCommand('copy', true, text);
        }
    },
    reload() {
        window.location.href = '/';
    },
    forceReload() {
        window.location.href = '/';
    },
    viewInBrowser() {
        if (isElectron()) {
            const electron = window.require('electron');
            electron.shell.openExternal(window.location.origin);
        } else {
            window.open(window.location.origin);
        }
    },
    toggleFullscreen() {
        if (isElectron()) {
            const browserWindow = window.require('electron').remote.BrowserWindow.getFocusedWindow();
            if (browserWindow.isFullScreen()) {
                browserWindow.setFullScreen(false);
            } else {
                browserWindow.setFullScreen(true);
            }
        } else {
            if (!window.document.fullscreenElement) {
                window.document.documentElement.requestFullscreen();
            } else {
                if (window.document.exitFullscreen) {
                    window.document.exitFullscreen();
                }
            }
        }
    },
    toggleDeveloperTools() {
        if (isElectron()) {
            window.require('electron').remote.getCurrentWebContents().toggleDevTools();
        }
    },
    openLink(url) {
        if (isElectron()) {
            window.require('electron').remote.shell.openExternal(url);
        } else {
            window.open(url);
        }
    },
    showMainWindow() {
        if (isElectron()) {
            window.require('electron').ipcRenderer.send('show-main-window');
        }
    }
};

const Connection = {
    navigateToWorkspace() {
        window.location.href = `${window.location.origin}/#/workspace`;
    }
};

const APP = {
    quit() {
        if (isElectron()) {
            window.require('electron').remote.app.quit();
        } else {
            window.top.close();
        }
    }
};

export default {
    Update,
    Event,
    Menu,
    File,
    Dialog,
    Window,
    Connection,
    APP
};
