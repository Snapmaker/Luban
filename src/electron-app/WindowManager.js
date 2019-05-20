/* eslint import/no-unresolved: 0 */
import { app, BrowserWindow, shell } from 'electron';
import fs from 'fs';
// import AutoUpdater from './AutoUpdater';

const rmDir = (dirPath, removeSelf) => {
    console.log(`del folder ${dirPath}`);
    if (removeSelf === undefined) {
        removeSelf = true;
    }

    let files;
    try {
        files = fs.readdirSync(dirPath);
        console.log(files);
    } catch (e) {
        return;
    }

    if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
            const filePath = dirPath + '/' + files[i];
            if (fs.statSync(filePath).isFile()) {
                fs.unlinkSync(filePath);
            } else {
                rmDir(filePath);
            }
        }
    }
    if (removeSelf) {
        fs.rmdirSync(dirPath);
    }
};

class WindowManager {
    windows = [];

    title = '';

    url = '';

    constructor() {
        // https://github.com/electron/electron/blob/master/docs/api/app.md#event-activate-os-x
        // Emitted when the application is activated, which usually happens
        // when the user clicks on the application's dock icon.
        app.on('activate', (e) => {
            const window = this.getWindow();
            if (!window) {
                this.openWindow({
                    title: this.title,
                    url: this.url
                });
            }
        });

        // https://github.com/electron/electron/blob/master/docs/api/app.md#event-window-all-closed
        // Emitted when all windows have been closed.
        // This event is only emitted when the application is not going to quit.
        // If the user pressed Cmd + Q, or the developer called app.quit(), Electron
        // will first try to close all the windows and then emit the will-quit event,
        // and in this case the window-all-closed event would not be emitted.
        app.on('window-all-closed', () => {
            // On OS X it is common for applications and their menu bar
            // to stay active until the user quits explicitly with Cmd + Q
            if (process.platform === 'darwin') {
                const window = this.getWindow();
                if (window) {
                    // Remember current window attributes that will be used for the next 'activate' event
                    this.title = window.webContents.getTitle();
                    this.url = window.webContents.getURL();
                }
                return;
            }
            app.quit();
        });
    }

    openWindow(url, options) {
        const window = new BrowserWindow({
            ...options,
            show: false
        });

        window.on('closed', (event) => {
            const index = this.windows.indexOf(event.sender);
            console.assert(index >= 0);
            this.windows.splice(index, 1);
            if (process.platform === 'win32') {
                rmDir('C:/ProgramData/Snapmakerjs/data/_cache', false);
                rmDir('C:/ProgramData/Snapmakerjs/sessions', false);
            } else if (process.platform === 'linux') {
                rmDir('/tmp/Snapmakerjs/data/_cache', false);
                rmDir('/tmp/Snapmakerjs/sessions', false);
            }
        });

        // Open every external link in a new window
        // https://github.com/electron/electron/blob/master/docs/api/web-contents.md
        window.webContents.on('new-window', (event, url) => {
            event.preventDefault();
            shell.openExternal(url);
        });

        // Ignore proxy settings
        // https://electronjs.org/docs/api/session#sessetproxyconfig-callback
        const session = window.webContents.session;
        session.setProxy({ proxyRules: 'direct://' }, () => {
            window.loadURL(url);
            window.show();
        });

        this.windows.push(window);

        return window;
    }

    getWindow(index = 0) {
        if (this.windows.length === 0) {
            return null;
        }
        return this.windows[index] || null;
    }
}

export default WindowManager;
