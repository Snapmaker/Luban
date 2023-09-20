import { enable as electronEnable, initialize as electronRemoteMainInitialize } from '@electron/remote/main';
import 'core-js/stable';
import { app, BrowserWindow, dialog, ipcMain, Menu, powerSaveBlocker, protocol, screen, session, shell } from 'electron';
import Store from 'electron-store';
import { autoUpdater } from 'electron-updater';
import fs from 'fs';
import { debounce, isNull, isUndefined } from 'lodash';
import log from 'loglevel';
import fetch from 'node-fetch';
import path from 'path';
import 'regenerator-runtime/runtime';
import url from 'url';

import DataStorage from './DataStorage';
import MenuBuilder, { addRecentFile, cleanAllRecentFiles } from './electron-app/Menu';
import { configureWindow } from './electron-app/window';
import pkg from './package.json';


log.setLevel(log.levels.INFO);

const config = new Store();
const userDataDir = app.getPath('userData');
global.luban = {
    userDataDir
};
let serverData = null;
let mainWindow = null;
let loadUrl = '';
let powerId = 0;
const loadingMenu = [{
    id: 'file',
    label: '',
}];

const childProcess = require('child_process');

const SERVER_DATA = 'serverData';
const UPLOAD_WINDOWS = 'uploadWindows';

const { CLIENT_PORT, SERVER_PORT } = pkg.config;


function getBrowserWindowOptions() {
    const defaultOptions = {
        width: 1440,
        height: 900,
        minHeight: 708,
        minWidth: 1024,
        show: false,
        useContentSize: true,
        title: `${pkg.name} ${pkg.version}`,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            // remote module is default false
            // https://www.electronjs.org/docs/latest/breaking-changes#default-changed-enableremotemodule-defaults-to-false
            enableRemoteModule: true,
            nodeIntegrationInWorker: true
        }
    };

    // { x, y, width, height }
    const lastOptions = config.get('winBounds');

    // Get display that most closely intersects the provided bounds.
    let windowOptions = {};
    if (lastOptions) {
        const display = screen.getDisplayMatching(lastOptions);

        if (display.id === lastOptions.id) {
            // use last time options when using the same display
            windowOptions = {
                ...windowOptions,
                ...lastOptions
            };
        } else {
            // or center the window when using other display
            const workArea = display.workArea;

            // calculate window size
            const width = Math.max(Math.min(lastOptions.width, workArea.width), 360);
            const height = Math.max(Math.min(lastOptions.height, workArea.height), 240);
            const x = workArea.x + (workArea.width - width) / 2;
            const y = workArea.y + (workArea.height - height) / 2;

            windowOptions = {
                id: display.id,
                x,
                y,
                width,
                height
            };
        }
    } else {
        const display = screen.getPrimaryDisplay();
        // const { x, y, width, height } = display.workArea;
        const { x, y, width } = display.workArea;
        const nx = x + (width - 1440) / 2;
        windowOptions = {
            id: display.id,
            // x,
            // y,
            x: nx,
            y,
            center: true
            // width,
            // height
        };
    }

    return Object.assign({}, defaultOptions, windowOptions);
}

function sendUpdateMessage(text) {
    mainWindow.webContents.send('message', text);
}

// handle update issue
function updateHandle() {
    const message = {
        error: 'key-settings_message-error',
        checking: 'key-settings_message-checking',
        updateAva: 'key-settings_message-updateAva',
        updateNotAva: 'key-settings_message-update_not_ava'
    };
    // Official document: https://www.electron.build/auto-update.html
    autoUpdater.autoDownload = false;
    // Whether to automatically install a downloaded update on app quit. Applicable only on Windows and Linux.
    autoUpdater.autoInstallOnAppQuit = false;

    autoUpdater.on('error', (err) => {
        sendUpdateMessage(message.error, err);
    });
    // Emitted when checking if an update has started.
    autoUpdater.on('checking-for-update', () => {
        sendUpdateMessage(message.checking);
    });

    // Emitted when there is an available update. The update is downloaded automatically if autoDownload is true.
    autoUpdater.on('update-available', async (downloadInfo) => {
        sendUpdateMessage(message.updateAva);

        // Get chinese version of release note for zh-CN locale
        if (app.getLocale() === 'zh-CN') {
            if (!downloadInfo.releaseNotes && process.platform !== 'linux') {
                // for aliyuncs
                const changelogUrl = `https://snapmaker.oss-cn-beijing.aliyuncs.com/snapmaker.com/download/luban/Snapmaker-Luban-${downloadInfo.version}.changelog.md`;
                const result = await fetch(changelogUrl,
                    {
                        mode: 'cors',
                        method: 'GET',
                        headers: {
                            'Content-Type': 'text/markdown'
                        }
                    })
                    .then((response) => {
                        response.headers['access-control-allow-origin'] = { value: '*' };
                        return response.text();
                    });

                downloadInfo.releaseChangeLog = result;
                downloadInfo.releaseName = `v${downloadInfo.version}`;
            }
        }

        mainWindow.webContents.send('update-available', { ...downloadInfo, prevVersion: app.getVersion() });
    });
    // Emitted when there is no available update.
    autoUpdater.on('update-not-available', () => {
        sendUpdateMessage(message.updateNotAva);
    });
    autoUpdater.on('download-progress', (progressObj) => {
        mainWindow.setProgressBar(progressObj.percent / 100);
    });
    // downloadInfo — for generic and github providers
    autoUpdater.on('update-downloaded', debounce((downloadInfo) => {
        ipcMain.on('replaceAppNow', () => {
            // some code here to handle event
            autoUpdater.quitAndInstall();
        });
        mainWindow.webContents.send('is-replacing-app-now', downloadInfo);
    }), 300);
    // Emitted when the user agrees to download
    ipcMain.on('startingDownloadUpdate', () => {
        mainWindow.webContents.send('download-has-started');
        autoUpdater.downloadUpdate();
    });
    // Emitted when is ready to check for update
    ipcMain.on('checkForUpdate', async (event, autoUpdateProviderOptions) => {
        log.info(`checkForUpdates, feed URL: ${autoUpdateProviderOptions.url} (${autoUpdateProviderOptions.provider})`);

        autoUpdater.setFeedURL(autoUpdateProviderOptions);

        try {
            await autoUpdater.checkForUpdates();
        } catch (e) {
            log.warn('Check for update failed', e);
        }
    });
    ipcMain.on('updateShouldCheckForUpdate', (event, shouldCheckForUpdate) => {
        mainWindow.webContents.send('update-should-check-for-update', shouldCheckForUpdate);
    });
    ipcMain.on('open-saved-path', (event, savedPath) => {
        shell.openPath(savedPath);
    });
    ipcMain.on('open-engine-test-path', (event, enginePath) => {
        shell.openPath(enginePath);
    });
}

// https://github.com/electron/electron/blob/v8.5.1/docs/api/app.md#apprequestsingleinstancelock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
    process.exit(0);
}

// Open the project file when the app is not started on the windows platform
if (process.platform === 'win32') {
    // 'projectFileOnWindow' represents the directory of project files
    const projectFileOnWindow = String(process.argv[process.argv.length - 1]);
    const newProjectFile = {
        path: projectFileOnWindow,
        name: path.basename(projectFileOnWindow)
    };
    if (mainWindow) {
        mainWindow.webContents.send('open-file', newProjectFile);
    } else {
        config.set('projectFile', newProjectFile);
    }
}

const startToBegin = (data) => {
    serverData = data;
    const { address, port } = data;
    configureWindow(mainWindow);

    updateHandle();

    loadUrl = `http://${address}:${port}`;

    // register file protocol
    protocol.registerFileProtocol(
        'luban',
        (request, callback) => {
            console.log('file protocol URL:', request.url);
            const { pathname } = url.parse(request.url);
            const p = pathname === '/' ? 'index.html' : pathname.substr(1);
            const filePath = path.normalize(`${__dirname}/app/${p}`);
            callback(fs.createReadStream(filePath));
        },
        (error) => {
            if (error) {
                console.error('error', error);
            }
        }
    );

    // https://github.com/electron/electron/issues/23393
    protocol.registerFileProtocol('atom', (request, cb) => {
        const pathname = decodeURI(request.url.replace('atom://', ''));
        cb(pathname);
    });
    // https://github.com/electron/electron/issues/21675
    // If needed, resolve CORS. https://stackoverflow.com/questions/51254618/how-do-you-handle-cors-in-an-electron-app

    const filter = {
        urls: [
            'http://*/resources/images/*',
            'http://*/app.css',
            'http://*/polyfill.*.*',
            'http://*/vendor.*.*',
            'http://*/app.*.*',
        ]
    };
    session.defaultSession.webRequest.onBeforeRequest(
        filter,
        (request, callback) => {
            const redirectURL = request.url.replace(/^http/, 'luban');
            callback({ redirectURL });
        }
    );

    // Ignore proxy settings
    // https://electronjs.org/docs/api/session#sessetproxyconfig-callback

    electronRemoteMainInitialize();

    const webContentsSession = mainWindow.webContents.session;
    electronEnable(mainWindow.webContents);

    webContentsSession.setProxy({ proxyRules: 'direct://' })
        .then(() => mainWindow.loadURL(loadUrl).catch(err => {
            console.log('err', err.message);
        }));

    try {
        // TODO: move to server
        DataStorage.init();
    } catch (err) {
        console.error(`Initialize data storage error: ${err}`);
    }
};

let serverProcess;
const showMainWindow = async () => {
    const windowOptions = getBrowserWindowOptions();
    const window = new BrowserWindow(windowOptions);
    mainWindow = window;
    powerId = powerSaveBlocker.start('prevent-display-sleep');

    if (process.platform === 'win32') {
        const menu = Menu.buildFromTemplate(loadingMenu);
        Menu.setApplicationMenu(menu);
    }

    // only start server once
    if (!serverData) {
        if (process.env.NODE_ENV === 'development') {
            process.chdir(path.resolve(__dirname, 'server'));
            // Use require instead of import to avoid being precompiled in production mode
            const { createServer } = require('./server');
            createServer({
                port: SERVER_PORT,
                host: '127.0.0.1'
            }, (err, data) => {
                startToBegin({ ...data, port: CLIENT_PORT });
            });
        } else {
            serverProcess = childProcess.fork(
                path.resolve(__dirname, 'server-cli.js'),
                [],
                {
                    env: {
                        ...process.env,
                        // USER_DATA_DIR: userDataDir,
                        USER_DATA_DIR: app.getPath('userData')
                    }
                }
            );
            serverProcess.on('message', (data) => {
                if (data.type === SERVER_DATA) {
                    startToBegin(data);
                } else if (data.type === UPLOAD_WINDOWS) {
                    window.loadURL(loadUrl).catch(err => {
                        console.log('err', err.message);
                    });
                }
            });
        }
        // window.webContents.openDevTools();
        window.loadURL(path.resolve(__dirname, 'app', 'loading.html'))
            .then(() => window.setTitle(`Snapmaker Luban ${pkg.version}`))
            .catch(err => {
                console.log('err', err.message);
            });
        window.setBackgroundColor('#f5f5f7');
        if (process.platform === 'win32') {
            window.show();
        } else {
            window.on('ready-to-show', () => {
                window.show();
            });
        }
        // serverData = await launchServer();
    } else {
        if (process.platform === 'win32') {
            window.show();
        } else {
            window.on('ready-to-show', () => {
                window.show();
            });
        }
    }

    window.on('close', (e) => {
        e.preventDefault();
        const bounds = window.getBounds();
        const display = screen.getDisplayMatching(bounds);
        const options = {
            id: display.id,
            ...bounds
        };

        config.set('winBounds', options);
        window.webContents.send('save-and-close');

        mainWindow = null;
    });


    // Setup menu
    const menuBuilder = new MenuBuilder(window, { url: loadUrl });
    // menuBuilder.buildMenu();
    // Init homepage recent files
    ipcMain.on('get-recent-file', () => {
        const fileArr = menuBuilder.getInitRecentFile();
        window.webContents.send('update-recent-file', fileArr, 'update');
    });
    // the "open file or folder" dialog can also be triggered from the React app
    ipcMain.handle('popFile', () => {
        const newProjectFile = config.get('projectFile');
        if (!isUndefined(newProjectFile) && !isNull(newProjectFile)) {
            config.set('projectFile', null);
            return newProjectFile;
        }
        return null;
    });

    ipcMain.on('clean-all-recent-files', () => {
        cleanAllRecentFiles();
    });

    ipcMain.on('add-recent-file', (event, file) => {
        addRecentFile(file);
    });

    ipcMain.on('open-recover-folder', () => {
        shell.openPath(`${userDataDir}/snapmaker-recover`);
    });


    // update download manager save path
    ipcMain.on('update-download-manager-save-path', (_, data) => {
        if (!data) return;
        config.set('downloadSavePath', JSON.parse(data).path);
    });

    // download mananger
    const downloadingArr = [];
    mainWindow.webContents.session.on('will-download', (event, downloadItem) => {
        const fileName = downloadItem.getFilename();
        const downloadUrl = downloadItem.getURL();
        const startTime = downloadItem.getStartTime();
        const initialState = downloadItem.getState();

        let savePath = path.join(config.get('downloadSavePath'), fileName);

        // avoid duplicate file name
        let fileNum = 0;
        const ext = path.extname(savePath);
        const name = path.basename(savePath, ext);
        const dir = path.dirname(savePath);
        while (fs.existsSync(savePath)) {
            fileNum += 1;
            savePath = path.format({
                dir,
                ext,
                name: `${name}${fileNum > 0 ? `(${fileNum})` : ''}`,
            });
        }
        savePath && downloadItem.setSavePath(savePath);

        // record current download【for now, this just for stop/delete】
        downloadingArr.push({
            savePath,
            ext,
            name,
            fileNum,
            downloadUrl,
            startTime,
            state: initialState,
            paused: downloadItem.isPaused(),
            ref: downloadItem
        });

        // send msg to renderer process, a new download start
        mainWindow.webContents.send('new-download-item', {
            savePath,
            ext,
            name,
            fileNum,
            downloadUrl,
            startTime,
            state: initialState,
            paused: downloadItem.isPaused(),
            totalBytes: downloadItem.getTotalBytes(),
            receivedBytes: downloadItem.getReceivedBytes(),
        });

        // update download item status
        downloadItem.on('updated', (e, state) => {
            mainWindow.webContents.send('download-item-updated', {
                savePath,
                ext,
                name,
                fileNum,
                downloadUrl,
                startTime,
                state,
                paused: downloadItem.isPaused(),
                totalBytes: downloadItem.getTotalBytes(),
                receivedBytes: downloadItem.getReceivedBytes(),
            });
        });

        // download done
        downloadItem.on('done', (e, state) => {
            mainWindow.webContents.send('download-item-done', {
                savePath,
                ext,
                name,
                fileNum,
                downloadUrl,
                startTime,
                state,
                paused: downloadItem.isPaused(),
                totalBytes: downloadItem.getTotalBytes(),
                receivedBytes: downloadItem.getReceivedBytes(),
            });

            // remove finish downloadItem in downloading arr
            const finishIndex = downloadingArr.findIndex(item => item.savePath === savePath && item.startTime === startTime);
            downloadingArr.splice(finishIndex, 1);
        });
    });

    // open dialog for setting Download Manager default download path(save path)
    ipcMain.on('select-directory', () => {
        dialog
            .showOpenDialog({
                title: 'Select a location to save',
                properties: ['openDirectory', 'createDirectory'],
            })
            .then(res => {
                mainWindow.webContents.send('selected-directory', JSON.stringify(res));
            })
            .catch(e => console.error(e));
    });

    ipcMain.on('select-file', async () => {
        const res = await dialog.showOpenDialog({
            title: 'Select file',
            properties: ['openFile'],
        });

        mainWindow.webContents.send('select-file-success', res);
    });

    // open download manager save path floder by sys file Explorer
    ipcMain.on('open-download-save-path', (_, savePath) => {
        shell.openPath(savePath);
    });

    // open browser
    ipcMain.on('open-browser', (_, browserUrl) => {
        shell.openExternal(browserUrl);
    });

    // remove download manager file/files/folder
    const rmDir = (dirPath, removeSelf = true) => {
        let files;
        try {
            files = fs.readdirSync(dirPath);
        } catch (e) {
            console.error(`Read directory fail ${dirPath}`);
            return;
        }

        if (files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                const filePath = `${dirPath}/${files[i]}`;
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
    const clearPath = removePath => {
        if (fs.existsSync(removePath)) {
            if (fs.statSync(removePath).isFile()) {
                fs.unlink(removePath, err => err && console.error(err));
            } else {
                rmDir(removePath, true);
            }
        }
    };
    ipcMain.on('download-manager-remove-file', (_, downloadItem) => {
        const { savePath, startTime } = downloadItem;
        const finishIndex = downloadingArr.findIndex(item => item.savePath === savePath && item.startTime === startTime);
        // if is finished download item,
        if (finishIndex === -1) {
            // remove local file(for now no need to delete local file)
            // clearPath(downloadItem.savePath);
            return;
        }

        // if is downloading, cancel it
        try {
            const target = downloadingArr[finishIndex];
            target.ref.cancel();
        } catch (err) {
            console.error(err);
        }

        // remove curr downloadItem
        downloadingArr.splice(finishIndex, 1);
    });
    ipcMain.on('clear-files', (_, removePaths) => {
        removePaths.forEach(removePath => clearPath(removePath));
    });
};

// Allow max 4G memory usage
if (process.arch === 'x64') {
    app.commandLine.appendSwitch('--js-flags', '--max-old-space-size=6144');
}

app.commandLine.appendSwitch('ignore-gpu-blacklist');

if (process.platform === 'linux') {
    // https://github.com/electron/electron/issues/18265
    // TODO: Maybe we can only disable --disable-setuid-sandbox
    //   reference changes: https://github.com/microsoft/vscode/pull/122909/files
    app.commandLine.appendSwitch('--no-sandbox');
}

/**
 * On macOS, re-create a window when dock icon clicked.
 */
app.on('activate', async () => {
    if (mainWindow === null) {
        await showMainWindow();
    }
});

/**
 * Only for MacOS
 *
 * Listening to the open file event (when through the OS by double click or similar)
 */
app.on('open-file', (event, projectFile) => {
    let newProjectFile;
    if (typeof projectFile === 'string') {
        newProjectFile = {
            path: projectFile,
            name: path.basename(projectFile)
        };
    }
    event.preventDefault();
    // if the app is ready and initialized, we open this file
    if (mainWindow && newProjectFile) {
        mainWindow.webContents.send('open-file', newProjectFile);
    } else {
        config.set('projectFile', newProjectFile);
    }
});

/**
 * Emitted when all windows have been closed.
 *
 * Not emitted when user pressed Cmd + Q.
 */
app.on('window-all-closed', () => {
    // Follow macOS convention of having the application in memory event
    // after all windows have been closed.
    // if (process.platform !== 'darwin') {
    // }
    powerSaveBlocker.stop(powerId);

    app.quit();
});

/**
 * Final chance to cleanup before app quit.
 */
app.on('will-quit', () => {
    serverProcess?.kill();

    DataStorage.clear();
});

// Open the project file when the app is started on the windows platform
app.on('second-instance', (event, commandLine) => {
    // Someone tried to run a second instance, we should focus our window.
    if (event && process.platform === 'win32') {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            const projectFilePath = commandLine[commandLine.length - 1];
            const newProjectFile = {
                path: projectFilePath,
                name: path.basename(projectFilePath)
            };
            mainWindow.webContents.send('open-file', newProjectFile);
        }
    }
});
protocol.registerSchemesAsPrivileged([{ scheme: 'luban', privileges: { standard: true, corsEnabled: true } }]);

/**
 * when ready
 */
app.whenReady().then(showMainWindow);
