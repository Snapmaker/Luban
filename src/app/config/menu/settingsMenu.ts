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
        },
        {
            id: 'port',
            label: 'key-App/Settings/MachineSettings-Port Settings',
            enabled: true,
            click: (menuItem, browserWindow) => {
                if (isElectron()) {
                    browserWindow.webContents.send('preferences.show', {
                        activeTab: 'port'
                    });
                } else {
                    UniApi.Event.emit('appbar-menu:preferences.show', {
                        activeTab: 'port'
                    });
                }
            }
        },
        {
            id: 'longterm-backup-config',
            label: 'key-App/Menu-Backup config',
            enabled: true,
            click: (menuItem, browserWindow) => {
                if (isElectron()) {
                    browserWindow.webContents.send('longterm-backup-config');
                } else {
                    UniApi.Event.emit('appbar-menu:longterm-backup-config');
                }
            }
        },
        { type: 'separator' },
        {
            id: 'crash-reporting',
            label: 'key-App/Menu-Crash Reporting',
            enabled: true,
            click: (menuItem, browserWindow) => {
                // Toggle in the main process store; it is read at startup, so
                // this applies on next start.
                if (isElectron()) {
                    const { ipcRenderer } = window.require('electron');
                    ipcRenderer.invoke('get-crash-reporting')
                        .then((enabled) => {
                            ipcRenderer.send('set-crash-reporting', !enabled);
                            browserWindow.webContents.send('preferences.show', {
                                activeTab: 'general'
                            });
                        });
                } else {
                    UniApi.Event.emit('appbar-menu:preferences.show', {
                        activeTab: 'general'
                    });
                }
            }
        },
        {
            id: 'open-config-folder',
            label: 'key-App/Menu-Open Config Folder',
            enabled: true,
            click: (menuItem, browserWindow) => {
                if (isElectron()) {
                    browserWindow.webContents.send('open-config-folder');
                } else {
                    UniApi.Event.emit('appbar-menu:open-config-folder');
                }
            },
        },
    ]
};
