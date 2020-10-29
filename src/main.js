import 'core-js/stable';
import 'regenerator-runtime/runtime';
import { app, BrowserWindow, screen, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import Store from 'electron-store';
// import fs from 'fs';
import { isNull } from 'lodash';
import path from 'path';
import { configureWindow } from './electron-app/window';
import MenuBuilder from './electron-app/Menu';
import launchServer from './server-cli';
import DataStorage from './DataStorage';
import pkg from './package.json';


const config = new Store();

let serverData = null;
let mainWindow = null;
let mainWindowOptions = null;

function getBrowserWindowOptions() {
    const defaultOptions = {
        width: 1280,
        height: 768,
        show: false,
        title: `${pkg.name} ${pkg.version}`,
        webPreferences: {
            nodeIntegration: true
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
        const { x, y, width, height } = display.workArea;

        windowOptions = {
            id: display.id,
            x,
            y,
            width,
            height
        };
    }

    return Object.assign({}, defaultOptions, windowOptions);
}

function sendUpdateMessage(text) {
    mainWindow.webContents.send('message', text);
}

// handle update issue
function updateHandle() {
    // before update , delete file last download
    // /Users/jiantao/Library/Application\ Support/Caches/snapmaker-luban-updater/pending
    // const updaterCacheDirName = 'snapmaker-luban-updater';
    // const updatePendingPath = path.join(autoUpdater.app.baseCachePath, updaterCacheDirName, 'pending');
    // fs.emptyDir(updatePendingPath);
    const message = {
        error: 'update error',
        checking: 'updating...',
        updateAva: 'fetch new version and downloading...',
        updateNotAva: 'do not to update'
    };
    // autoDownload
    autoUpdater.autoDownload = false;

    ipcMain.on('isDownloadNow', () => {
        mainWindow.webContents.send('isStartDownload');
        autoUpdater.downloadUpdate().then((res) => {
            console.log('downloadUpdate', res);
        });
    });

    autoUpdater.on('error', (err) => {
        sendUpdateMessage(message.error, err);
    });
    autoUpdater.on('checking-for-update', () => {
        sendUpdateMessage(message.checking);
    });
    autoUpdater.on('update-available', (downloadInfo) => {
        console.log('update-available', downloadInfo);
        sendUpdateMessage(message.updateAva);
        mainWindow.webContents.send('updateAvailable', downloadInfo);
    });
    autoUpdater.on('update-not-available', () => {
        sendUpdateMessage(message.updateNotAva);
    });

    autoUpdater.on('download-progress', (progressObj) => {
        mainWindow.setProgressBar(progressObj.percent / 100);
    });
    autoUpdater.on('update-downloaded', (downloadInfo) => {
        ipcMain.on('isUpdateNow', () => {
            // some code here to handle event
            autoUpdater.quitAndInstall();
        });
        mainWindow.webContents.send('isUpdateNow', downloadInfo);
    });


    ipcMain.on('checkForUpdate', () => {
        autoUpdater.checkForUpdates();
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

const createWindow = async () => {
    try {
        // TODO: move to server
        DataStorage.init();
    } catch (err) {
        console.error('Error: ', err);
    }

    if (!serverData) {
        // only start server once
        // TODO: start server on the outermost
        serverData = await launchServer();
    }

    const { address, port } = { ...serverData };
    const windowOptions = getBrowserWindowOptions();
    const window = new BrowserWindow(windowOptions);

    mainWindow = window;
    mainWindowOptions = windowOptions;
    configureWindow(window);

    const loadUrl = `http://${address}:${port}`;

    // Ignore proxy settings
    // https://electronjs.org/docs/api/session#sessetproxyconfig-callback

    const session = window.webContents.session;
    session.setProxy({ proxyRules: 'direct://' })
        .then(() => window.loadURL(loadUrl))
        .then(() => {
            window.show();
            window.focus();
        });

    window.on('close', (e) => {
        e.preventDefault();
        const options = {
            id: mainWindowOptions.id,
            ...window.getBounds()
        };

        config.set('winBounds', options);
        window.webContents.send('save-and-close');

        mainWindow = null;
    });


    // Setup menu
    const menuBuilder = new MenuBuilder(window, { url: loadUrl });
    menuBuilder.buildMenu();

    // the "open file or folder" dialog can also be triggered from the React app
    ipcMain.on('openFile', () => {
        const newProjectFile = config.get('projectFile');
        if (!isNull(newProjectFile)) {
            mainWindow.webContents.send('open-file', newProjectFile);
            config.set('projectFile', null);
        }
    });

    // https://s3-us-west-2.amazonaws.com/snapmaker.com/download/luban/snapmaker-luban-3.9.0-mac-x64.dmg
    // https://github.com/Snapmaker/Luban/releases/download/v3.9.0/snapmaker-luban-3.9.0-mac-x64.dmg

    // TODO: Setup AppUpdater
    updateHandle();
};

// Allow max 4G memory usage
if (process.arch === 'x64') {
    app.commandLine.appendSwitch('--js-flags', '--max-old-space-size=4096');
}

app.commandLine.appendSwitch('ignore-gpu-blacklist');


/**
 * On macOS, re-create a window when dock icon clicked.
 */
app.on('activate', async () => {
    if (mainWindow === null) {
        await createWindow();
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
    if (process.platform !== 'darwin') {
        app.quit();
    }
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

/**
 * when ready
 */
app.whenReady().then(createWindow);
