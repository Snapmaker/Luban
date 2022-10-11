import 'core-js/stable';
import 'regenerator-runtime/runtime';
import { app, powerSaveBlocker, BrowserWindow, protocol, screen, session, ipcMain, shell, Menu } from 'electron';
import { autoUpdater } from 'electron-updater';
import Store from 'electron-store';
import url from 'url';
import fs from 'fs';
import { isUndefined, isNull, debounce, findIndex, find } from 'lodash';
import path from 'path';
import isReachable from 'is-reachable';
import fetch from 'node-fetch';
import { configureWindow } from './electron-app/window';
import MenuBuilder, { addRecentFile, cleanAllRecentFiles } from './electron-app/Menu';
import DataStorage from './DataStorage';
import pkg from './package.json';
// const { crashReporter } = require('electron');
const DOWNLOAD_FILES = 'downloadFileLists';
const config = new Store({
    migrations: {
        '4.0.0': store => {
            store.set('debugPhase', true);
        }
    },
    schema: {
        downloadPath: {
            type: 'string'
        },
        downloadPathWithName: {
            type: 'string'
        },
        downloadFileLists: {
            type: 'array',
            maximum: 100,
            minimum: 0,
            default: []
        }
    }
});
const userDataDir = app.getPath('userData');
global.luban = {
    userDataDir
};
let serverData = null;
let mainWindow = null;
// https://www.electronjs.org/docs/latest/breaking-changes#planned-breaking-api-changes-100
// console.log('getCrashesDirectory', app.getPath('crashDumps'));
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

// crashReporter.start({
//     productName: 'Snapmaker',
//     globalExtra: { _companyName: 'Snapmaker' },
//     submitURL: 'https://api.snapmaker.com',
//     uploadToServer: true
// });

function getBrowserWindowOptions() {
    const defaultOptions = {
        width: 1440,
        height: 900,
        minHeight: 708,
        minWidth: 1024,
        show: false,
        useContentSize: true,
        title: `${pkg.name} ${pkg.version}`,
        // https://www.electronjs.org/docs/latest/breaking-changes#default-changed-enableremotemodule-defaults-to-false
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
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

function updateDownloadConfigByObj(uuid, obj) {
    const downloadFileArr = config.get(DOWNLOAD_FILES);
    const item = find(downloadFileArr, ['uuid', uuid]);
    Object.entries(obj).forEach(([attr, value]) => {
        if (attr) {
            item[attr] = value;
        }
    });
    config.set(DOWNLOAD_FILES, downloadFileArr);
}
function deleteDownloadConfigByKey(attr, value) {
    const downloadFileArr = config.get(DOWNLOAD_FILES);
    const index = findIndex(downloadFileArr, [attr, value]);
    downloadFileArr.splice(index, 1);
    config.set(DOWNLOAD_FILES, downloadFileArr);
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
        if (!downloadInfo.releaseNotes && process.platform !== 'linux') {
            // for aliyuncs
            const changelogUrl = `https://snapmaker.oss-cn-beijing.aliyuncs.com/snapmaker.com/download/luban/Snapmaker-Luban-${downloadInfo.version}.changelog.md`;
            const result = await fetch(changelogUrl, {
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
    ipcMain.on('checkForUpdate', async () => {
        try {
            await autoUpdater.checkForUpdates();
        } catch (e) {
            console.log('Check for update failed', e);
        }
    });
    ipcMain.on('updateShouldCheckForUpdate', (event, shouldCheckForUpdate) => {
        mainWindow.webContents.send('update-should-check-for-update', shouldCheckForUpdate);
    });
    ipcMain.on('open-saved-path', (event, savedPath) => {
        shell.openPath(savedPath);
    });
}

function getMapItemByAttribute(map, attr, attrValue) {
    const res = {};
    map.forEach((value, key) => {
        if (value[attr] && value[attr] === attrValue) {
            res.key = key;
            res.currentParam = value;
        }
    });
    return res;
}

class DownloadManager {
    paramList = new Map();
    /*
      state: downloaded, pause,
      progress: downloaded progress,
      savedPath: file saved path,
      uuid: uuid,

      name: file name,
      description: description of download item
      url: url,
      thumbnailUrl: thumbnail url,
      type?: file type
    */
    constructor() {
        let historyDownloads = [];
        if (config.get(DOWNLOAD_FILES)) {
            historyDownloads = config.get(DOWNLOAD_FILES).map((item) => {
                if (item.state === 'paused' || item.state === 'progressing') {
                    item.state = 'failed';
                }
                return item;
            });
            config.set(DOWNLOAD_FILES, historyDownloads);
        }
        historyDownloads.forEach((item) => {
            this.paramList.set(item.savedPath, item);
        });
        ipcMain.handle('cancelDownload', async (e, paramArr) => {
            paramArr.forEach((param) => {
                let result = {};
                if (param.savedPath) {
                    result = getMapItemByAttribute(this.paramList, 'savedPath', param.savedPath);
                    deleteDownloadConfigByKey('savedPath', param.savedPath);
                } else {
                    result = getMapItemByAttribute(this.paramList, 'uuid', param.uuid);
                    deleteDownloadConfigByKey('uuid', param.uuid);
                }
                const { currentParam, key } = result;
                if (currentParam && currentParam.item) {
                    currentParam.item.cancel();
                }
                this.paramList.delete(key);
            });
            // mainWindow.webContents.send('download-file-completed');
        });
        ipcMain.handle('pauseDownload', async (e, paramArr) => {
            paramArr.forEach((param) => {
                const { currentParam } = getMapItemByAttribute(this.paramList, 'uuid', param.uuid);
                currentParam.item && currentParam.item.pause();
                updateDownloadConfigByObj(param.uuid, {
                    ...param,
                    state: 'paused'
                });
            });
        });
        ipcMain.handle('resumeDownload', async (e, paramArr) => {
            paramArr.forEach((param) => {
                const { currentParam } = getMapItemByAttribute(this.paramList, 'uuid', param.uuid);
                currentParam.item && currentParam.item.resume();
            });
        });

        ipcMain.handle('updateDownloadPath', (e, downloadPath) => {
            config.set('downloadPath', downloadPath);
        });

        ipcMain.handle('startDownload', async (e, param) => {
            if (typeof param.url === 'string') {
                const defaultPath = config.get('downloadPath') ? config.get('downloadPath') : path.resolve(app.getPath('downloads'), 'luban/');
                let name = '3dp_a350_single.snap3dp';
                const savedPath = path.resolve(defaultPath, name);
                param.savedPath = savedPath;
                config.set('downloadPath', defaultPath);
                // make sure name is not repeated
                if (!(param.progress)) {
                    while (
                        this.paramList.has(param.savedPath)
                    ) {
                        const extname = path.extname(name);
                        const basename = `${path.basename(name, extname)}(1)`;
                        name = `${basename}${extname}`;
                        param.savedPath = path.resolve(defaultPath, name);
                    }
                }
                this.paramList.set(param.savedPath, param);
                config.set('downloadPathWithName', param.savedPath);
                const downloadFileArr = config.get(DOWNLOAD_FILES);
                if (!downloadFileArr.find((item) => item.savedPath === param.savedPath)) {
                    downloadFileArr.unshift(param);
                    config.set(DOWNLOAD_FILES, downloadFileArr);
                }
                mainWindow.webContents.send('download-file-started', param.savedPath);
                e.sender.downloadURL(param.url);
            }
        });
    }

    listenDownloadUpdateEvent(param) {
        const item = param.item;
        const allBytes = item.getTotalBytes();
        const savedPath = param.savedPath;
        item.on('updated', (event, state) => {
            if (state === 'interrupted') {
                mainWindow.webContents.send('download-file-progress', {
                    state,
                    savedPath,
                    allBytes,
                    receivedBytes: item.getReceivedBytes()
                });
            } else if (state === 'progressing') {
                if (item.isPaused()) {
                    mainWindow.webContents.send('download-file-progress', {
                        state: 'paused',
                        savedPath,
                        allBytes,
                        receivedBytes: item.getReceivedBytes()
                    });
                } else {
                    mainWindow.webContents.send('download-file-progress', {
                        state,
                        savedPath,
                        allBytes,
                        receivedBytes: item.getReceivedBytes()
                    });
                }
            }
        });
    }

    listenDownloadDoneEvent(param) {
        const item = param.item;
        const savedPath = param.savedPath;
        item.on('done', () => {
            mainWindow.webContents.send('download-file-completed', {
                savedPath
            });
            // updateDownloadConfigByObj(param.uuid, {
            //     ...paramArr,
            //     state: 'completed'
            // });
        });
    }
}

function registerDownloadItemEvent() {
    ipcMain.handle('getStoreValue', (event, key) => {
        return config.get(key);
    });
    const downloadManager = new DownloadManager();
    mainWindow.webContents.session.on('will-download', async (e, item) => {
        const actualPath = config.get('downloadPathWithName');
        if (actualPath) {
            item.setSavePath(actualPath);
        }
        const param = downloadManager.paramList.get(actualPath);
        if (param) {
            param.item = item;
            downloadManager.listenDownloadUpdateEvent(param);
            downloadManager.listenDownloadDoneEvent(param);
        }
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

const checkUpdateServer = () => {
    if (process.platform === 'linux') {
        return Promise.resolve('github');
    }
    const hosts = [
        ['snapmaker.oss-cn-beijing.aliyuncs.com', 'aliyuncs'],
        ['github.com', 'github']
    ];
    const promises = hosts.map(([host, flag]) => {
        return new Promise((resolve) => {
            isReachable(host).then(() => {
                resolve(flag);
            });
        });
    });
    return Promise.race(promises);
};

const startToBegin = (data) => {
    serverData = data;
    const { address, port } = { ...serverData };
    configureWindow(mainWindow);

    checkUpdateServer().then((host) => {
        if (host === 'aliyuncs') {
            autoUpdater.setFeedURL({
                provider: 'generic',
                url: 'https://snapmaker.oss-cn-beijing.aliyuncs.com/snapmaker.com/download/luban'
            });
        }
        updateHandle();
    });

    registerDownloadItemEvent();

    loadUrl = `http://${address}:${port}`;
    const filter = {
        urls: [
            // 'http://*/',
            'http://*/resources/images/*',
            'http://*/app.css',
            'http://*/polyfill.*.*',
            'http://*/vendor.*.*',
            'http://*/app.*.*',
            'http://*/*/*.worker.js',
        ]
    };
    protocol.registerFileProtocol(
        'luban',
        (request, callback) => {
            const { pathname } = url.parse(request.url);
            const p = pathname === '/' ? 'index.html' : pathname.substr(1);
            callback(fs.createReadStream(path.normalize(`${__dirname}/app/${p}`)));
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

    session.defaultSession.webRequest.onBeforeRequest(
        filter,
        (request, callback) => {
            const redirectURL = request.url.replace(/^http/, 'luban');
            callback({ redirectURL });
        }
    );

    // Ignore proxy settings
    // https://electronjs.org/docs/api/session#sessetproxyconfig-callback

    const webContentsSession = mainWindow.webContents.session;
    webContentsSession.setProxy({ proxyRules: 'direct://' })
        .then(() => mainWindow.loadURL(loadUrl).catch(err => {
            console.log('err', err.message);
        }));

    webContentsSession.webRequest.onHeadersReceived({ urls: ['*://*/*'] },
        (d, c) => {
            if (d.responseHeaders['X-Frame-Options']) {
                delete d.responseHeaders['X-Frame-Options'];
            } else if (d.responseHeaders['x-frame-options']) {
                delete d.responseHeaders['x-frame-options'];
            }

            c({ cancel: false, responseHeaders: d.responseHeaders });
        });

    try {
        // TODO: move to server
        DataStorage.init();
    } catch (err) {
        console.error('Error: ', err);
    }
};

const showMainWindow = async () => {
    const windowOptions = getBrowserWindowOptions();
    const window = new BrowserWindow(windowOptions);
    mainWindow = window;
    powerId = powerSaveBlocker.start('prevent-display-sleep');

    if (process.platform === 'win32') {
        const menu = Menu.buildFromTemplate(loadingMenu);
        Menu.setApplicationMenu(menu);
    }

    if (!serverData) {
        // only start server once
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
            const child = childProcess.fork(
                path.resolve(__dirname, 'server-cli.js'),
                [],
                {
                    env: {
                        ...process.env,
                        USER_DATA_DIR: userDataDir
                    }
                }
            );
            child.on('message', (data) => {
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
};

// Allow max 4G memory usage
if (process.arch === 'x64') {
    app.commandLine.appendSwitch('--js-flags', '--max-old-space-size=6144');
}

app.commandLine.appendSwitch('ignore-gpu-blacklist');


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
