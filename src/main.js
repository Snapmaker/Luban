import 'core-js/stable';
import 'regenerator-runtime/runtime';
import { app, BrowserWindow, screen, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import Store from 'electron-store';
import { isUndefined, isNull } from 'lodash';
import path from 'path';
import { configureWindow } from './electron-app/window';
import MenuBuilder, { addRecentFile, cleanAllRecentFiles } from './electron-app/Menu';
import launchServer from './server-cli';
import DataStorage from './DataStorage';
import pkg from './package.json';


const config = new Store();

let serverData = null;
let mainWindow = null;

function getBrowserWindowOptions() {
    const defaultOptions = {
        width: 1440,
        height: 900,
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
    const message = {
        error: 'An error occurred while checking for updates.',
        checking: 'Checking for updates.',
        updateAva: 'Updates are available.',
        updateNotAva: 'Snapmaker Luban is up to date.'
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
    autoUpdater.on('update-available', (downloadInfo) => {
        sendUpdateMessage(message.updateAva);
        mainWindow.webContents.send('update-available', downloadInfo, app.getVersion());
    });
    // Emitted when there is no available update.
    autoUpdater.on('update-not-available', () => {
        sendUpdateMessage(message.updateNotAva);
    });
    autoUpdater.on('download-progress', (progressObj) => {
        mainWindow.setProgressBar(progressObj.percent / 100);
    });
    // downloadInfo — for generic and github providers
    autoUpdater.on('update-downloaded', (downloadInfo) => {
        ipcMain.on('replaceAppNow', () => {
            // some code here to handle event
            autoUpdater.quitAndInstall();
        });
        mainWindow.webContents.send('is-replacing-app-now', downloadInfo);
    });
    // Emitted when the user agrees to download
    ipcMain.on('startingDownloadUpdate', () => {
        mainWindow.webContents.send('download-has-started');
        autoUpdater.downloadUpdate();
    });
    // Emitted when is ready to check for update
    ipcMain.on('checkForUpdate', () => {
        autoUpdater.checkForUpdates();
    });
    ipcMain.on('updateShouldCheckForUpdate', (event, shouldCheckForUpdate) => {
        mainWindow.webContents.send('update-should-check-for-update', shouldCheckForUpdate);
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
    // if (process.platform !== 'darwin') {
    // }

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

/**
 * when ready
 */
app.whenReady().then(createWindow);
