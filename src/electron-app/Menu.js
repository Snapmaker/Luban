import { URL } from 'url';
import path from 'path';
import { app, shell, globalShortcut, Menu, dialog, MenuItem } from 'electron';
import { getMainWindow } from './window';

function addRecentFile(file) {
    const menu = Menu.getApplicationMenu();
    const itemRecentFiles = menu.getMenuItemById('recent-files');

    const item = new MenuItem({
        label: file.name,
        click: (menuItem, browserWindow) => {
            // eslint-disable-next-line no-use-before-define
            openFile(browserWindow, file);
        } });

    itemRecentFiles.submenu.insert(0, item);
}

function onClickPreferences(browserWindow) {
    const window = browserWindow || getMainWindow();

    const url = window.webContents.getURL();
    const urlInstance = new URL(url);

    window.webContents.loadURL(`${urlInstance.origin}/#/settings`);
}

function openFile(browserWindow, file) {
    if (!file) {
        const filePaths = dialog.showOpenDialog(
            {
                filters: [{ name: 'files', extensions: ['snap3dp', 'snaplzr', 'snapcnc', 'gcode', 'cnc', 'nc'] }]
            }
        );
        if (!filePaths) return;
        console.log(browserWindow.id);
        browserWindow.webContents.focus();
        file = { path: filePaths[0], name: path.basename(filePaths[0]) };
        addRecentFile(file);
    }
    browserWindow.webContents.send('open-file', file);
}

function saveAsFile(browserWindow) {
    browserWindow.webContents.send('save-as-file');
}

function save(browserWindow) {
    browserWindow.webContents.send('save');
}

function getMenuTemplate(options) {
    const { address, port } = { ...options };

    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Open File...',
                    click: (menuItem, browserWindow, event) => {
                        openFile(browserWindow);
                        console.log(event);
                    }
                },
                {
                    id: 'recent-files',
                    label: 'Recent Files',
                    submenu: [
                        {
                            id: 'remove-recent',
                            label: 'Clean All Recent File',

                            click: (menuItem) => {
                                for (const item of menuItem.menu.items) {
                                    if (item !== menuItem) item.visible = false;
                                }
                            }
                        }
                    ]
                },
                { type: 'separator' },
                {
                    id: 'save',
                    label: 'Save',
                    accelerator: 'CommandOrControl+S',
                    click: (menuItem, browserWindow) => {
                        save(browserWindow);
                    }
                },
                {
                    id: 'save-as',
                    label: 'Save As...',
                    click: (menuItem, browserWindow) => {
                        saveAsFile(browserWindow);
                    }
                }
            ]
        },
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
