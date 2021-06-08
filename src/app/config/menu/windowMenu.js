import isElectron from 'is-electron';
import UniApi from '../../lib/uni-api';

export default {
    id: 'window',
    label: 'Window',
    submenu: [
        {
            id: 'reload',
            label: 'Reload',
            accelerator: 'CommandOrControl+R',
            enabled: true,
            click: (menuItem, browserWindow) => {
                if (isElectron()) {
                    browserWindow.webContents.send('window', 'reload');
                } else {
                    UniApi.Event.emit('appbar-menu:window', 'reload');
                }
            }
        },
        {
            id: 'forcereload',
            label: 'Force Reload',
            accelerator: 'CommandOrControl+Shift+R',
            enabled: true,
            click: (menuItem, browserWindow) => {
                if (isElectron()) {
                    browserWindow.webContents.send('window', 'forceReload');
                } else {
                    UniApi.Event.emit('appbar-menu:window', 'forceReload');
                }
            }
        },
        { id: 'line-1', type: 'separator' },
        {
            id: 'view-in-browser',
            label: 'View In Browser',
            enabled: true,
            click: (menuItem, browserWindow) => {
                if (isElectron()) {
                    browserWindow.webContents.send('window', 'viewInBrowser');
                } else {
                    UniApi.Event.emit('appbar-menu:window', 'viewInBrowser');
                }
            }
        },
        {
            id: 'toggle-developer-tools',
            label: 'Toggle Developer Tools',
            accelerator: 'CommandOrControl+Shift+I',
            enabled: true,
            click: (menuItem, browserWindow) => {
                if (isElectron()) {
                    browserWindow.webContents.send('toggle-developer-tools');
                }
            }
        },
        { id: 'line-2', type: 'separator' },
        {
            id: 'toggle-fullscreen',
            label: 'Toggle Fullscreen',
            accelerator: 'F11',
            enabled: true,
            click: (menuItem, browserWindow) => {
                if (isElectron()) {
                    browserWindow.webContents.send('window', 'toggleFullscreen');
                } else {
                    UniApi.Event.emit('appbar-menu:window', 'toggleFullscreen');
                }
            }
        }
    ]
};
