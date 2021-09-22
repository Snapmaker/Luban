import isElectron from 'is-electron';
import UniApi from '../../lib/uni-api';

export default {
    id: 'help',
    label: 'key_menu_Help',
    submenu: [
        {
            id: 'guided-tour',
            label: 'key_menu_Beginner\'s Guide',
            enabled: true,
            click: (menuItem, browserWindow) => {
                if (isElectron()) {
                    browserWindow.webContents.send('guided-tours-begin');
                } else {
                    UniApi.Event.emit('appbar-menu:guided-tours-begin');
                }
            }
        },
        {
            label: 'key_menu_Software Manual',
            id: 'software-manual',
            enabled: true,
            click: (menuItem, browserWindow) => {
                if (isElectron()) {
                    browserWindow.webContents.send('help.link', 'softwareManual');
                } else {
                    UniApi.Event.emit('appbar-menu:help.link', 'softwareManual');
                }
            }
        },
        {
            label: 'key_menu_Video Tutorial',
            id: 'video-tutorials',
            enabled: true,
            click: (menuItem, browserWindow) => {
                if (isElectron()) {
                    browserWindow.webContents.send('help.link', 'tutorials');
                } else {
                    UniApi.Event.emit('appbar-menu:help.link', 'tutorials');
                }
            }
        },
        {
            label: 'key_menu_Snapmaker.com',
            id: 'official-website',
            enabled: true,
            click: (menuItem, browserWindow) => {
                if (isElectron()) {
                    browserWindow.webContents.send('help.link', 'officialSite');
                } else {
                    UniApi.Event.emit('appbar-menu:help.link', 'officialSite');
                }
            }
        },
        {
            label: 'key_menu_MyMiniFactory',
            id: 'my-minifactory',
            enabled: true,
            click: (menuItem, browserWindow) => {
                if (isElectron()) {
                    browserWindow.webContents.send('help.link', 'myminifactory');
                } else {
                    UniApi.Event.emit('appbar-menu:help.link', 'myminifactory');
                }
            }
        },
        {
            label: 'key_menu_Software Support',
            id: 'supports',
            enabled: true,
            click: (menuItem, browserWindow) => {
                if (isElectron()) {
                    browserWindow.webContents.send('help.link', 'supports');
                } else {
                    UniApi.Event.emit('appbar-menu:help.link', 'supports');
                }
            }
        },
        {
            label: 'key_menu_Forum',
            id: 'forum',
            enabled: true,
            click: (menuItem, browserWindow) => {
                if (isElectron()) {
                    browserWindow.webContents.send('help.link', 'forum');
                } else {
                    UniApi.Event.emit('appbar-menu:help.link', 'forum');
                }
            }
        },
        {
            label: 'key_menu_Shopify',
            id: 'shopify',
            enabled: true,
            click: (menuItem, browserWindow) => {
                if (isElectron()) {
                    browserWindow.webContents.send('help.link', 'market');
                } else {
                    UniApi.Event.emit('appbar-menu:help.link', 'market');
                }
            }
        },
        {
            label: 'key_menu_Software Update',
            id: 'software-update',
            enabled: true,
            click: (menuItem, browserWindow) => {
                if (isElectron()) {
                    browserWindow.webContents.send('check-for-updates.show');
                } else {
                    UniApi.Event.emit('appbar-menu:check-for-updates.show');
                }
            }
        },
        {
            label: 'key_menu_Firmware Tool',
            id: 'firmware-tool',
            enabled: true,
            click: (menuItem, browserWindow) => {
                if (isElectron()) {
                    browserWindow.webContents.send('developer-tools.show');
                } else {
                    UniApi.Event.emit('appbar-menu:developer-tools.show');
                }
            }
        }
    ]
};
