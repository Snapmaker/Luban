import { URL } from 'url';
import { app, shell, globalShortcut, Menu } from 'electron';
import { getMainWindow } from './window';


function onClickPreferences(menuItem, browserWindow) {
    const window = browserWindow || getMainWindow();

    const url = window.webContents.getURL();
    const urlInstance = new URL(url);

    window.webContents.loadURL(`${urlInstance.origin}/#/settings`);
}

function getMenuTemplate(options) {
    const { address, port } = { ...options };

    const template = [
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forcereload' },
                { type: 'separator' },
                {
                    label: 'View In Browser',
                    click: () => {
                        const url = `http://${address}:${port}`;
                        shell.openExternal(url);
                    }
                },
                { role: 'toggledevtools' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            role: 'window',
            submenu: [
                { role: 'minimize' },
                { role: 'close' }
            ]
        }
    ];

    if (process.platform === 'darwin') {
        // About
        template.unshift({
            label: app.getName(),
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                {
                    label: 'Preferences...',
                    accelerator: 'CommandOrControl+,',
                    click: onClickPreferences
                },
                { type: 'separator' },
                { role: 'services', submenu: [] },
                { type: 'separator' },
                {
                    role: 'hide',
                    label: 'Hide'
                },
                { role: 'hideothers' },
                { role: 'unhide' },
                { type: 'separator' },
                {
                    role: 'quit',
                    label: 'Quit'
                }
            ]
        });
    }

    return template;
}

export default function registerMenu(options) {
    const template = getMenuTemplate(options);
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    // Bind Menu defined shortcuts
    globalShortcut.register('CommandOrControl+,', onClickPreferences);
}
