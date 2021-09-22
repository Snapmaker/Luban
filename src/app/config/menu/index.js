import isElectron from 'is-electron';
import fileMenu from './fileMenu';
import editMenu from './editMenu';
import settingsMenu from './settingsMenu';
import windowMenu from './windowMenu';
import helpMenu from './helpMenu';

const menuItems = [
    fileMenu,
    editMenu,
    windowMenu,
    settingsMenu,
    helpMenu
];

function onClickPreferences(menuItem, browserWindow) {
    browserWindow.send('preferences.show', { activeTab: 'general' });
}

function getMenuItems() {
    // this menu is only shown in MacOS
    if (isElectron() && window.require('electron').remote.process.platform === 'darwin') {
        // About
        menuItems.unshift({
            label: window.require('electron').remote.app.getName(), // 'Snapmaker Luban'
            submenu: [
                { role: 'about', label: 'key_menu_About' },
                { type: 'separator' },
                {
                    label: 'key_menu_Preferences',
                    accelerator: 'CommandOrControl+,',
                    click: onClickPreferences
                },
                { type: 'separator' },
                { role: 'services', label: 'key_menu_Services', submenu: [] },
                { type: 'separator' },
                {
                    role: 'hide',
                    label: 'key_menu_Hide'
                },
                { role: 'hideothers', label: 'key_menu_Hide Others' },
                { role: 'unhide', label: 'key_menu_Unhide' },
                { type: 'separator' },
                {
                    role: 'quit',
                    label: 'key_menu_Quit'
                }
            ]
        });
    }
    return menuItems;
}

export {
    getMenuItems
};
