import isElectron from 'is-electron';
import UniApi from '../../lib/uni-api';

export default {
    id: 'window',
    label: 'key_menu_Window',
    submenu: [
        {
            id: 'reload',
            label: 'key_menu_Reload',
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
            label: 'key_menu_Force Reload',
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
            label: 'key_menu_View In Browser',
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
            label: 'key_menu_Toggle Developer Tools',
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
            label: 'key_menu_Toggle Fullscreen',
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
