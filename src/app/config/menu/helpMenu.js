import isElectron from 'is-electron';
import UniApi from '../../lib/uni-api';

export default {
    id: 'help',
    label: 'Help',
    submenu: [
        {
            label: 'Guided Tour',
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
            enabled: true,
            click: () => {}
        },
        {
            label: 'Video Tutorials',
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
            label: 'Myminifactory',
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
            label: 'Supports',
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
