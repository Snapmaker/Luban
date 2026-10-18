// babel/preset-env, useBuiltIns: "entry"
// https://babeljs.io/docs/babel-preset-env#usebuiltins
import 'core-js';
// import 'core-js/stable';
// import 'regenerator-runtime/runtime';

import { enable as electronEnable, initialize as electronRemoteMainInitialize } from '@electron/remote/main';
import { app, BrowserWindow, dialog, ipcMain, Menu, powerSaveBlocker, protocol, screen, session, shell } from 'electron';
import Store from 'electron-store';
import fs from 'fs';
import { debounce, isNull, isUndefined } from 'lodash';
import log from 'loglevel';
import path from 'path';
import url from 'url';

import DataStorage from './DataStorage';
import MenuBuilder, { addRecentFile, cleanAllRecentFiles } from './electron-app/Menu';
import { configureWindow } from './electron-app/window';
import getWindowBounds from './electron-app/window-bounds';
import pkg from './package.json';
import { ENV_KEY as STARTUP_EPOCH_KEY, epoch as startupEpoch, formatTimeline as formatStartupTimeline, mark as startupMark } from './startup-timeline';

const CRASH_REPORTING_KEY = 'enableCrashReporting';

/*
 * Crash reporting is opt-in and off by default.
 *
 * Sentry used to init at module scope, before the window existed: 21
 * integrations, the Electron crashReporter, four OpenTelemetry globals and a
 * read of its offline envelope store, all on the path to first paint, and all
 * of it useless to someone offline or behind a VPN. It is now required only
 * when the user has asked for it.
 */
const initCrashReporting = (store) => {
    if (!store.get(CRASH_REPORTING_KEY, false)) {
        log.info('Crash reporting disabled');
        return;
    }

    try {
        // eslint-disable-next-line global-require
        const Sentry = require('@sentry/electron/main');

        Sentry.init({
            dsn: 'https://cd2af28a126afbc7a8257a75b3b5d0ab@o4508125599563776.ingest.us.sentry.io/4508125605068800',
            release: pkg.version,
            tracesSampleRate: 1.0,
            beforeSend(event) {
                if (event.exception) {
                    log.error('Captured exception:', event.exception.values[0]);
                }
                return event;
            }
        });
        log.info('Crash reporting enabled');
    } catch (err) {
        log.warn('Crash reporting failed to initialise', err);
    }
};

log.setLevel(log.levels.INFO);

// One clock for main, the forked server and the renderer.
process.env[STARTUP_EPOCH_KEY] = String(startupEpoch);

/*
 * A force-killed session can leave the userData PATH occupied by a small
 * Chromium HSTS/TransportSecurity state FILE (~200 bytes of {"sts":[...]})
 * instead of the directory - observed live 2026-08-31: the network service
 * flushes it to the userData root when it dies while the directory is gone.
 * electron-store then throws EEXIST on mkdir, crashing boot (and blocking
 * quit, whose winBounds save also mkdirs). Guard: rename the stray file
 * aside and log; callable again before any late store write.
 */
const ensureUserDataDir = (label) => {
    const dir = app.getPath('userData');
    try {
        const stat = fs.statSync(dir);
        if (stat.isDirectory()) {
            return;
        }
        const strayPath = `${dir}.stray-${Date.now()}`;
        fs.renameSync(dir, strayPath);
        log.warn(`[userData ${label}] path was a ${stat.size}-byte FILE, not a directory - moved to ${strayPath}`);
    } catch (err) {
        if (err.code !== 'ENOENT') {
            log.warn(`[userData ${label}] guard failed: ${err.message}`);
            return;
        }
        log.warn(`[userData ${label}] directory missing`);
    }
    try {
        fs.mkdirSync(dir, { recursive: true });
        log.warn(`[userData ${label}] directory (re)created`);
    } catch (err) {
        log.warn(`[userData ${label}] mkdir failed: ${err.message}`);
    }
};

ensureUserDataDir('boot');
const userDataDir = app.getPath('userData');

// electron-store is compiled into this bundle (webpack.config.main.production.js),
// so hand conf everything it would otherwise infer from the calling file: given
// no `cwd` it names the project by walking up from `module.parent` with pkg-up,
// and a bundle has no parent file to walk from. Both options equal what
// electron-store derives on its own (cwd = app.getPath('userData'), name from
// the app's package.json), so the file stays `<userData>/config.json` and the
// settings already there (winBounds, enableCrashReporting, projectFile...) are
// still found.
const config = new Store({
    cwd: userDataDir,
    projectName: pkg.name,
});

initCrashReporting(config);
global.luban = {
    userDataDir
};

const childProcess = require('child_process');

// Diagnostic watch (pre-fix forensics, cheap enough to keep): log STATE
// TRANSITIONS of the userData entry itself (directory <-> file <-> missing;
// writes inside the directory fire 'change' events on the entry, so raw
// events are too noisy to log). On a flip to FILE - the stray-HSTS
// signature - also capture the content head and which electron processes
// exist at that instant, to attribute the writer. Race unreproduced as of
// 2026-08-31 despite bare/populated/fresh-profile speed-run attempts; the
// two live-caught occurrences were ~10s after the GitHub update-check
// response (Chromium's delayed HSTS persist window).
try {
    let watchedState = 'directory';
    fs.watch(path.dirname(userDataDir), (eventType, filename) => {
        if (filename !== path.basename(userDataDir)) {
            return;
        }
        let state = 'MISSING';
        let isFile = false;
        try {
            const stat = fs.statSync(userDataDir);
            isFile = !stat.isDirectory();
            state = isFile ? `FILE (${stat.size} bytes)` : 'directory';
        } catch (err) {
            // keep MISSING
        }
        if (state === watchedState) {
            return;
        }
        watchedState = state;
        log.warn(`[userData watch] ${new Date().toISOString()} ${eventType}: path is now ${state}`);
        if (isFile) {
            try {
                const head = fs.readFileSync(userDataDir, 'utf8').slice(0, 120);
                log.warn(`[userData watch] stray content head: ${head}`);
            } catch (err) {
                log.warn(`[userData watch] could not read stray file: ${err.message}`);
            }
            childProcess.exec('tasklist /FI "IMAGENAME eq electron.exe" /FO CSV', (err, stdout) => {
                log.warn(`[userData watch] electron processes at flip:\n${err ? err.message : stdout}`);
            });
        }
    });
} catch (err) {
    log.warn(`[userData watch] could not watch: ${err.message}`);
}
let serverData = null;
let mainWindow = null;
let loadUrl = '';
let powerId = 0;
const loadingMenu = [{
    id: 'file',
    label: '',
}];

const SERVER_DATA = 'serverData';
const UPLOAD_WINDOWS = 'uploadWindows';

const { CLIENT_PORT, SERVER_PORT } = pkg.config;

// The app is served off disk through the luban:// handler, so the window no
// longer has to wait for the server to be listening before it can load.
const APP_URL = 'luban://127.0.0.1/';

// The renderer asks for this as soon as it boots, which can be before the server
// is listening. Answering null is fine - 'server-origin' follows when it is up.
ipcMain.handle('get-server-origin', () => loadUrl || null);

// Crash reporting is read once at startup, so a change applies on next start.
ipcMain.handle('get-crash-reporting', () => config.get(CRASH_REPORTING_KEY, false));
ipcMain.on('set-crash-reporting', (event, enabled) => {
    config.set(CRASH_REPORTING_KEY, !!enabled);
    log.info(`Crash reporting ${enabled ? 'enabled' : 'disabled'}, applies on next start`);
});


function getBrowserWindowOptions() {
    const defaultOptions = {
        show: false,
        title: `${pkg.name} ${pkg.version}`,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            // remote module is default false
            // https://www.electronjs.org/docs/latest/breaking-changes#default-changed-enableremotemodule-defaults-to-false
            enableRemoteModule: true,
            nodeIntegrationInWorker: true,
            webviewTag: true,
        }
    };

    // { x, y, width, height }
    const lastOptions = config.get('winBounds');

    const display = lastOptions ? screen.getDisplayMatching(lastOptions) : screen.getPrimaryDisplay();
    const windowOptions = getWindowBounds(display, lastOptions);

    return Object.assign({}, defaultOptions, windowOptions);
}

function sendUpdateMessage(text) {
    mainWindow.webContents.send('message', text);
}

// handle update issue
// Required on first use. Nothing checks for updates until the renderer asks,
// and offline it is dead weight loaded before the window.
let autoUpdaterInstance = null;
const getAutoUpdater = () => {
    if (!autoUpdaterInstance) {
        // eslint-disable-next-line global-require
        autoUpdaterInstance = require('electron-updater').autoUpdater;
    }
    return autoUpdaterInstance;
};

let autoUpdaterWired = false;

function updateHandle() {
    const message = {
        error: 'key-settings_message-error',
        checking: 'key-settings_message-checking',
        updateAva: 'key-settings_message-updateAva',
        updateNotAva: 'key-settings_message-update_not_ava'
    };
    // Wired on first use so requiring electron-updater stays off the startup path.
    const wireAutoUpdater = () => {
        const updater = getAutoUpdater();
        if (autoUpdaterWired) {
            return updater;
        }
        autoUpdaterWired = true;

        // Official document: https://www.electron.build/auto-update.html
        updater.autoDownload = false;
        // Whether to automatically install a downloaded update on app quit. Applicable only on Windows and Linux.
        updater.autoInstallOnAppQuit = false;

        updater.on('error', (err) => {
            sendUpdateMessage(message.error, err);
        });
        // Emitted when checking if an update has started.
        updater.on('checking-for-update', () => {
            sendUpdateMessage(message.checking);
        });

        // Emitted when there is an available update. The update is downloaded automatically if autoDownload is true.
        updater.on('update-available', async (downloadInfo) => {
            // {
            //   version: string;
            //   files: Array<{ url: string; sha512: string; size: number; }>;
            //   path: string;
            //   sha512: string;
            //   releaseDate: string;
            //   releaseNotes: string;
            // }
            log.debug('event: update-available');

            sendUpdateMessage(message.updateAva);

            // Get chinese version of release note for zh-CN locale
            if (app.getLocale() === 'zh-CN') {
                if (!downloadInfo.releaseNotes && process.platform !== 'linux') {
                    // for aliyuncs
                    const changelogUrl = `https://snapmaker.oss-cn-beijing.aliyuncs.com/snapmaker.com/download/luban/Snapmaker-Luban-${downloadInfo.version}.changelog.md`;
                    // eslint-disable-next-line global-require
                    const fetch = require('node-fetch');
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
        updater.on('update-not-available', () => {
            sendUpdateMessage(message.updateNotAva);
        });
        updater.on('download-progress', (progressObj) => {
            mainWindow.setProgressBar(progressObj.percent / 100);
        });
        // downloadInfo — for generic and github providers
        updater.on('update-downloaded', debounce((downloadInfo) => {
            ipcMain.on('replaceAppNow', () => {
                // some code here to handle event
                try {
                    updater.quitAndInstall();
                } catch (err) {
                    log.error('quitAndInstall get err', err);
                }
            });
            mainWindow.webContents.send('is-replacing-app-now', downloadInfo);
        }), 300);

        return updater;
    };

    // Emitted when the user agrees to download
    ipcMain.on('startingDownloadUpdate', () => {
        mainWindow.webContents.send('download-has-started');
        wireAutoUpdater().downloadUpdate();
    });
    // Emitted when is ready to check for update
    ipcMain.on('checkForUpdate', async (event, autoUpdateProviderOptions) => {
        const updater = wireAutoUpdater();

        // Set feed URL
        if (autoUpdateProviderOptions.provider === 'generic') {
            log.info(`Check for updates, feed URL: ${autoUpdateProviderOptions.url}`);
        } else {
            log.info(`Check for updates, provider: ${autoUpdateProviderOptions.provider}`);
        }
        updater.setFeedURL(autoUpdateProviderOptions);

        try {
            await updater.checkForUpdates();
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
        // The renderer derives this from app.getAppPath(), which is the asar
        // archive in a packaged build; the folder itself is unpacked beside it.
        shell.openPath(enginePath.replace(/\.asar([\\/])/, '.asar.unpacked$1'));
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

// Everything the window needs before it can load the app off disk. Runs once,
// before the first navigation, and no longer waits on the server.
let appEnvironmentReady = false;
const prepareAppEnvironment = (window) => {
    electronEnable(window.webContents);

    if (appEnvironmentReady) {
        return Promise.resolve();
    }
    appEnvironmentReady = true;

    // register file protocol
    protocol.registerFileProtocol(
        'luban',
        (request, callback) => {
            const { pathname } = url.parse(request.url);
            let p = pathname === '/' ? 'index.html' : pathname.substr(1);

            // The server mounts the app directory at both / and /worker, so a
            // worker URL carries a prefix that is not part of the path on disk.
            if (p.indexOf('worker/') === 0) {
                p = p.substr('worker/'.length);
            }

            const filePath = path.normalize(`${__dirname}/app/${p}`);

            if (!fs.existsSync(filePath)) {
                console.error('luban protocol: not found', filePath);
                callback({ error: -6 }); // net::ERR_FILE_NOT_FOUND
                return;
            }

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

    // Ignore proxy settings
    // https://electronjs.org/docs/api/session#sessetproxyconfig-callback
    return window.webContents.session.setProxy({ proxyRules: 'direct://' });
};

const startToBegin = (data) => {
    serverData = data;
    const { address, port } = data;
    configureWindow(mainWindow);

    updateHandle();

    loadUrl = `http://${address}:${port}`;

    // Tell the renderer where the backend is. Sent now for a page that is already
    // up, and again on load for one that is not.
    mainWindow.webContents.send('server-origin', loadUrl);
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('server-origin', loadUrl);
    });


    try {
        // TODO: move to server
        DataStorage.init();
    } catch (err) {
        console.error(`Initialize data storage error: ${err}`);
    }
};

let serverProcess;
const showMainWindow = async () => {
    startupMark('main: app ready');
    const windowOptions = getBrowserWindowOptions();
    const window = new BrowserWindow(windowOptions);
    startupMark('main: window created');
    mainWindow = window;
    // Monitor policy links, do not allow redirection
    window.webContents.on('did-attach-webview', (_attachEvent, webContent) => {
        webContent.on('will-navigate', (navigateEvent, navigateUrl) => {
            if (navigateUrl.includes('policy')) {
                navigateEvent.preventDefault();
            }
        });
    });
    powerId = powerSaveBlocker.start('prevent-display-sleep');

    if (process.platform === 'win32') {
        const menu = Menu.buildFromTemplate(loadingMenu);
        Menu.setApplicationMenu(menu);
    }

    // only start server once
    if (!serverData) {
        if (process.env.NODE_ENV === 'development') {
            process.env.LUBAN_SERVER_DIR = path.resolve(__dirname, 'server');
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
            startupMark('main: server fork requested');
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
                    startupMark('main: server ready');
                    startToBegin(data);
                } else if (data.type === UPLOAD_WINDOWS) {
                    window.loadURL(APP_URL).catch(err => {
                        console.log('err', err.message);
                    });
                }
            });
        }
        // window.webContents.openDevTools();
        startupMark('main: app load requested');
        prepareAppEnvironment(window)
            .then(() => window.loadURL(APP_URL))
            .then(() => {
                window.setTitle(`Snapmaker Luban ${pkg.version}`);
                startupMark('main: app page loaded');
                log.info(`\n${formatStartupTimeline('Luban startup - main process')}`);
            })
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

        // A failed save must never block quit (EEXIST here when the stray
        // HSTS file has reoccupied the userData path mid-session).
        try {
            ensureUserDataDir('quit');
            config.set('winBounds', options);
        } catch (err) {
            log.warn(`Skipping winBounds save on close: ${err.message}`);
        }
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
protocol.registerSchemesAsPrivileged([{
    scheme: 'luban',
    privileges: {
        standard: true,
        corsEnabled: true,
        // i18next and the worker pool fetch over this scheme now that the app is
        // loaded from it. Not marked secure: the API still lives on plain http.
        supportFetchAPI: true,
        stream: true,
    }
}]);

/**
 * when ready
 */
app.whenReady().then(showMainWindow);
