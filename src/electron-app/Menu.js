import fs from 'fs';
import { Menu } from 'electron';
// import { Menu, dialog, MenuItem } from 'electron';
// import { URL } from 'url';
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
    } catch (e) {
        return [];
    }
}

function saveRecentFile(file) {
    const recentFileName = `${DataStorage.userDataDir}/recent-opened-files.json`;
    const arr = getSavedRecentFile();

    const index = arr.findIndex(f => {
        if (f.path && file.path) {
            return f.path === file.path;
        } else {
            return f.name === file.name;
        }
    });
    if (index !== -1) {
        arr.splice(index, 1);
    }
    arr.push(file);

    if (arr.length > 12) {
        arr.splice(0, arr.length - 12);
    }
    fs.writeFileSync(recentFileName, JSON.stringify(arr), 'utf-8');
}

export function addRecentFile(file, isSave = true) {
    // const menu = Menu.getApplicationMenu();
    // const itemRecentFiles = menu.getMenuItemById('recent-files');
    // const item = new MenuItem({
    //     label: file.name,
    //     path: file.path || '',
    //     click: (menuItem, browserWindow) => {
    //         // eslint-disable-next-line no-use-before-define
    //         openFile(browserWindow, file);
    //     }
    // });
    // itemRecentFiles.submenu.insert(0, item);
    // Menu.setApplicationMenu(menu);
    if (isSave) saveRecentFile(file);
}

function recoverRecentFiles(mainWindow) {
    const arr = getSavedRecentFile();
    for (const file of arr) {
        addRecentFile(file, false, mainWindow);
    }
}

export function cleanAllRecentFiles() {
    // const menu = Menu.getApplicationMenu();
    // const itemRecentFiles = menu.getMenuItemById('recent-files');

    // for (const item of itemRecentFiles.submenu.items) {
    //     if (item.label !== 'Clean All Recent Files') item.visible = false;
    // }
    const recentFileName = `${DataStorage.userDataDir}/recent-opened-files.json`;
    fs.writeFileSync(recentFileName, JSON.stringify([]), 'utf-8');
}

// eslint-disable-next-line no-unused-vars
function getMenuTemplate(options) {
    // const { url } = options;

    // const template = [
    //     {
    //         label: 'File',
    //         submenu: [
    //             {
    //                 id: 'new',
    //                 label: 'New File',
    //                 accelerator: 'CmdOrCtrl+N',
    //                 click: (menuItem, browserWindow) => {
    //                     closeFile(browserWindow);
    //                 }
    //             },
    //             { type: 'separator' },
    //             {
    //                 label: 'Open File...',
    //                 accelerator: 'CmdOrCtrl+O',
    //                 click: (menuItem, browserWindow) => {
    //                     openFile(browserWindow);
    //                 }
    //             },
    //             {
    //                 id: 'recent-files',
    //                 label: 'Recent Files',
    //                 submenu: [
    //                     {
    //                         id: 'remove-recent',
    //                         label: 'Clean All Recent Files',

    //                         click: (menuItem, browserWindow) => {
    //                             for (const item of menuItem.menu.items) {
    //                                 if (item !== menuItem) item.visible = false;
    //                             }
    //                             const recentFileName = `${DataStorage.userDataDir}/recent-opened-files.json`;
    //                             const type = 'reset';
    //                             fs.writeFileSync(recentFileName, JSON.stringify([]), 'utf-8');
    //                             browserWindow.webContents.send('update-recent-file', [], type);
    //                         }
    //                     }
    //                 ]
    //             },
    //             { type: 'separator' },
    //             {
    //                 id: 'save',
    //                 label: 'Save',
    //                 accelerator: 'CommandOrControl+S',
    //                 click: (menuItem, browserWindow) => {
    //                     save(browserWindow);
    //                 }
    //             },
    //             {
    //                 id: 'save-as',
    //                 label: 'Save As...',
    //                 click: (menuItem, browserWindow) => {
    //                     saveAsFile(browserWindow);
    //                 }
    //             }
    //         ]
    //     },
    //     {
    //         label: 'View',
    //         submenu: [
    //             { role: 'reload' },
    //             { role: 'forcereload' },
    //             { type: 'separator' },
    //             {
    //                 label: 'View In Browser',
    //                 click: () => {
    //                     shell.openExternal(url);
    //                 }
    //             },
    //             { role: 'toggledevtools' },
    //             { type: 'separator' },
    //             { role: 'togglefullscreen' }
    //         ]
    //     },
    //     {
    //         role: 'window',
    //         submenu: [
    //             { role: 'minimize' },
    //             { role: 'close' }
    //         ]
    //     }
    // ];

    // if (process.platform === 'darwin') {
    //     // About
    //     template.unshift({
    //         label: app.getName(),
    //         submenu: [
    //             { role: 'about' },
    //             { type: 'separator' },
    //             {
    //                 label: 'Preferences...',
    //                 accelerator: 'CommandOrControl+,',
    //                 click: onClickPreferences
    //             },
    //             { type: 'separator' },
    //             { role: 'services', submenu: [] },
    //             { type: 'separator' },
    //             {
    //                 role: 'hide',
    //                 label: 'Hide'
    //             },
    //             { role: 'hideothers' },
    //             { role: 'unhide' },
    //             { type: 'separator' },
    //             {
    //                 role: 'quit',
    //                 label: 'Quit'
    //             }
    //         ]
    //     });
    // }

    // return template;
    return [];
}

/**
 * MenuBuilder
 *
 * Build application menu.
 */
export default class MenuBuilder {
    mainWindow = null;

    options = Object.create(null);

    constructor(mainWindow, options) {
        this.mainWindow = mainWindow;
        this.options = options;
    }

    static hideMenu() {
        const menu = Menu.buildFromTemplate([]);
        Menu.setApplicationMenu(menu);
    }

    buildMenu() {
        const template = getMenuTemplate(this.options);

        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);

        recoverRecentFiles(this.mainWindow);
    }

    getInitRecentFile() {
        // const menu = Menu.getApplicationMenu();
        // const itemRecentFiles = menu.getMenuItemById('recent-files').submenu.items;
        // const arr = [];
        // itemRecentFiles.forEach(item => {
        //     if (!!item.path && !!item.visible) {
        //         arr.push({
        //             name: item.label,
        //             path: item.path
        //         });
        //     }
        // });
        const arr = getSavedRecentFile();
        return arr;
    }
}
