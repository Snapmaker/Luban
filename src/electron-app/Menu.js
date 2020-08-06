import { URL } from 'url';
import path from 'path';
import fs from 'fs';
import { app, shell, globalShortcut, Menu, dialog, MenuItem } from 'electron';
import { getMainWindow } from './window';
import DataStorage from '../DataStorage';


function getSavedRecentFile() {
    const recentFileName = `${DataStorage.userDataDir}/recent-opened-files.json`;
    let content;
    try {
        content = fs.readFileSync(recentFileName, 'utf-8');
    } catch (e) {
        return [];
    }

    try {
        const arr = JSON.parse(content);
        if (!(arr instanceof Array)) return [];
        return arr;
    } catch (e) { return []; }
}

function saveRecentFile(file) {
    const recentFileName = `${DataStorage.userDataDir}/recent-opened-files.json`;
    const arr = getSavedRecentFile();
    arr.push(file);
    fs.writeFileSync(recentFileName, JSON.stringify(arr), 'utf-8');
}


export function addRecentFile(file, isSave = true) {
    const menu = Menu.getApplicationMenu();
    const itemRecentFiles = menu.getMenuItemById('recent-files');

    const item = new MenuItem({
        label: file.name,
        click: (menuItem, browserWindow) => {
            // eslint-disable-next-line no-use-before-define
            openFile(browserWindow, file);
        } });

    itemRecentFiles.submenu.insert(0, item);
    Menu.setApplicationMenu(menu);
    if (isSave) saveRecentFile(file);
}
function recoverRecentFiles() {
    const arr = getSavedRecentFile();
    for (const file of arr) {
        addRecentFile(file, false);
    }
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
                title: 'Snapmaker Luban',
                filters: [{ name: 'files', extensions: ['snap3dp', 'snaplzr', 'snapcnc', 'gcode', 'cnc', 'nc'] }]
            }
        );
        if (!filePaths) return;
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
                            label: 'Clean All Recent Files',

                            click: (menuItem) => {
                                for (const item of menuItem.menu.items) {
                                    if (item !== menuItem) item.visible = false;
                                }
                                const recentFileName = `${DataStorage.userDataDir}/recent-opened-files.json`;
                                fs.writeFileSync(recentFileName, JSON.stringify([]), 'utf-8');
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
    recoverRecentFiles();
    // Bind Menu defined shortcuts
    globalShortcut.register('CommandOrControl+,', onClickPreferences);
}
