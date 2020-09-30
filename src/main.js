import 'core-js/stable';
import 'regenerator-runtime/runtime';
import { app, BrowserWindow, screen, ipcMain } from 'electron';
import Store from 'electron-store';
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
    const display = screen.getDisplayMatching(lastOptions);

    let windowOptions = {};
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
        const width = Math.min(lastOptions.width, workArea.width);
        const height = Math.min(lastOptions.height, workArea.height);
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

    return Object.assign({}, defaultOptions, windowOptions);
}


const createWindow = async () => {
    console.log('before createWindow');
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

    const url = `http://${address}:${port}`;

    // Ignore proxy settings
    // https://electronjs.org/docs/api/session#sessetproxyconfig-callback
    const session = window.webContents.session;
    session.setProxy({ proxyRules: 'direct://' })
        .then(() => window.loadURL(url))
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
        mainWindowOptions = null;
    });


    // Setup menu
    const menuBuilder = new MenuBuilder(window, { url });
    menuBuilder.buildMenu();

    // the "open file or folder" dialog can also be triggered from the React app
    ipcMain.on('openFile', () => {
        console.log('inside ipcMain');
        const newProjectFile = config.get('projectFile');
        mainWindow.webContents.send('open-file', newProjectFile);
        config.set('projectFile', null);
    });

    // TODO: Setup AppUpdater
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
 * Listening to the open file event (when the user open a file through the menu bar,
 *
 * or through the OS by double click or similar)
 */
app.on('open-file', (event, projectFile) => {
    let newProjectFile;
    if (typeof projectFile === 'string') {
        newProjectFile = {
            path: projectFile,
            name: path.basename(projectFile)
        };
    }
    console.log('window', projectFile, process.argv, String(process.argv[0]));
    event.preventDefault();
    // if the app is ready and initialized, we open this file
    if (mainWindow && newProjectFile) {
        mainWindow.webContents.send('open-file', newProjectFile);
    } else {
        console.log('inside else', mainWindow, newProjectFile);
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

/**
 * when ready
 */
app.whenReady().then(createWindow);
