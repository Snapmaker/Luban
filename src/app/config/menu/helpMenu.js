import isElectron from 'is-electron';
import UniApi from '../../lib/uni-api';

export default {
    id: 'help',
    label: 'Help',
    submenu: [
        {
            id: 'guided-tour',
            label: 'Beginner\'s Guide',
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
            label: 'Software Manual',
            id: 'software-manual',
            enabled: true,
            click: () => {}
        },
        {
            label: 'Video Tutorial',
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
            label: 'Snapmaker.com',
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
            label: 'MyMiniFactory',
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
            label: 'Support',
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
            label: 'Forum',
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
            label: 'Shopify',
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
            label: 'Software Update',
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
            label: 'Firmware Tool',
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
