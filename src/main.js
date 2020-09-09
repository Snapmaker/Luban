import 'core-js/stable';
import 'regenerator-runtime/runtime';
import { app, BrowserWindow, screen } from 'electron';
import Store from 'electron-store';
import { configureWindow } from './electron-app/window';
import MenuBuilder from './electron-app/Menu';
import launchServer from './server-cli';
import DataStorage from './DataStorage';
import pkg from './package.json';


const config = new Store();
let mainWindow = null;

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
    const lastBounds = config.get('winBounds');
    const displayBounds = screen.getDisplayMatching(lastBounds).bounds;

    const windowBounds = {
        width: Math.min(lastBounds.width, displayBounds.width),
        height: Math.min(lastBounds.height, displayBounds.height)
    };
    windowBounds.x = displayBounds.x + (displayBounds.width - windowBounds.width) / 2;
    windowBounds.y = displayBounds.y + (displayBounds.height - windowBounds.height) / 2;

    return Object.assign({}, defaultOptions, windowBounds);
}


const createWindow = async () => {
    try {
        // TODO: move to server
        DataStorage.init();
    } catch (err) {
        console.error('Error: ', err);
    }

    const data = await launchServer();

    const { address, port } = { ...data };
    const combinedOptions = getBrowserWindowOptions();
    const window = new BrowserWindow(combinedOptions);
    mainWindow = window;

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
        config.set('winBounds', window.getBounds());
        window.webContents.send('save-and-close');
    });


    // Setup menu
    const menuBuilder = new MenuBuilder(window, { url });
    menuBuilder.buildMenu();

    // TODO: Setup AppUpdater
};

// Allow max 4G memory usage
if (process.arch === 'x64') {
    app.commandLine.appendSwitch('--js-flags', '--max-old-space-size=4096');
}

app.commandLine.appendSwitch('ignore-gpu-blacklist');

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
 * On macOS, re-create a window when dock icon clicked.
 */
app.on('activate', async () => {
    if (mainWindow === null) {
        await createWindow();
    }
});

/**
 *
 */
app.whenReady().then(createWindow);
