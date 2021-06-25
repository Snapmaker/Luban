import isElectron from 'is-electron';
import UniApi from '../../lib/uni-api';

export default {
    id: 'help',
    label: 'Help',
    submenu: [
        {
            label: 'Guide',
            enabled: true,
            click: () => {}
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
            label: 'Tutorials',
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
            label: 'Official Site',
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
            label: 'Online Market',
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
