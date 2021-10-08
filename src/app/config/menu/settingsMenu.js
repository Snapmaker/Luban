import isElectron from 'is-electron';
import UniApi from '../../lib/uni-api';

export default {
    id: 'settings',
    label: 'key-App/Menu-Settings',
    submenu: [
        {
            id: 'machine-settings',
            label: 'key-App/Menu-Machine Settings',
            enabled: true,
            click: (menuItem, browserWindow) => {
                if (isElectron()) {
                    browserWindow.webContents.send('preferences.show', {
                        activeTab: 'machine'
                    });
                } else {
                    UniApi.Event.emit('appbar-menu:preferences.show', {
                        activeTab: 'machine'
                    });
                }
            }
        },
        {
            id: 'language',
            label: 'key-App/Menu-Language',
            enabled: true,
            click: (menuItem, browserWindow) => {
                if (isElectron()) {
                    browserWindow.webContents.send('preferences.show', {
                        activeTab: 'general'
                    });
                } else {
                    UniApi.Event.emit('appbar-menu:preferences.show', {
                        activeTab: 'general'
                    });
                }
            }
        },
        { id: 'line-1', type: 'separator' },
        {
            id: 'preferences',
            label: 'key-App/Menu-Preferences',
            enabled: true,
            click: (menuItem, browserWindow) => {
                if (isElectron()) {
                    browserWindow.webContents.send('preferences.show', {
                        activeTab: 'general'
                    });
                } else {
                    UniApi.Event.emit('appbar-menu:preferences.show', {
                        activeTab: 'general'
                    });
                }
            }
        }
    ]
};
