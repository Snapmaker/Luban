import isElectron from 'is-electron';
import UniApi from '../../lib/uni-api';

export default {
    id: 'settings',
    label: 'key_menu_Settings',
    submenu: [
        {
            id: 'machine-settings',
            label: 'key_menu_Machine Settings',
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
            label: 'key_menu_Language',
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
            label: 'key_menu_Preferences',
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
