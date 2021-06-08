import isElectron from 'is-electron';
import fileMenu from './fileMenu';
import editMenu from './editMenu';
import settingsMenu from './settingsMenu';
import windowMenu from './windowMenu';
import helpMenu from './helpMenu';
import connectionMenu from './connectionMenu';

const menuItems = [
    fileMenu,
    editMenu,
    windowMenu,
    settingsMenu,
    connectionMenu,
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
            label: window.require('electron').remote.app.getName(),
            submenu: [
                { role: 'about', label: 'About' },
                { type: 'separator' },
                {
                    label: 'Preferences',
                    accelerator: 'CommandOrControl+,',
                    click: onClickPreferences
                },
                { type: 'separator' },
                { role: 'services', label: 'Services', submenu: [] },
                { type: 'separator' },
                {
                    role: 'hide',
                    label: 'Hide'
                },
                { role: 'hideothers', label: 'Hide Others' },
                { role: 'unhide', label: 'Unhide' },
                { type: 'separator' },
                {
                    role: 'quit',
                    label: 'Quit'
                }
            ]
        });
    }
    return menuItems;
}

export {
    getMenuItems
};
