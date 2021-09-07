import isElectron from 'is-electron';
import UniApi from '../../lib/uni-api';

export default {
    id: 'edit',
    label: 'Edit',
    // active: true,
    submenu: [
        {
            id: 'undo',
            label: 'Undo',
            accelerator: 'CommandOrControl+Z',
            enabled: true,
            click(menuItem, browserWindow) {
                if (isElectron()) {
                    browserWindow.webContents.send('shortcut', 'mod+z', 'undo');
                } else {
                    UniApi.Event.emit('appbar-menu:shortcut', 'mod+z', 'undo');
                }
            }
        },
        {
            id: 'redo',
            label: 'Redo',
            accelerator: 'CommandOrControl+Shift+Z',
            enabled: true,
            click(menuItem, browserWindow) {
                if (isElectron()) {
                    browserWindow.webContents.send('shortcut', 'mod+shift+z', 'redo');
                } else {
                    UniApi.Event.emit('appbar-menu:shortcut', 'mod+shift+z', 'redo');
                }
            }
        },
        { id: 'line-1', type: 'separator' },
        {
            id: 'cut',
            label: 'Cut',
            enabled: true,
            click(menuItem, browserWindow) {
                if (isElectron()) {
                    browserWindow.webContents.send('shortcut', 'mod+x');
                } else {
                    UniApi.Event.emit('appbar-menu:shortcut', 'mod+x');
                }
            }
        },
        {
            id: 'copy',
            label: 'Copy',
            enabled: true,
            click(menuItem, browserWindow) {
                if (isElectron()) {
                    browserWindow.webContents.send('shortcut', 'mod+c');
                } else {
                    UniApi.Event.emit('appbar-menu:shortcut', 'mod+c');
                }
            }
        },
        {
            id: 'duplicate',
            label: 'Duplicate',
            accelerator: 'CommandOrControl+D',
            enabled: true,
            click(menuItem, browserWindow) {
                if (isElectron()) {
                    browserWindow.webContents.send('shortcut', 'mod+d');
                } else {
                    UniApi.Event.emit('appbar-menu:shortcut', 'mod+d');
                }
            }
        },
        {
            id: 'paste',
            label: 'Paste',
            enabled: true,
            click(menuItem, browserWindow) {
                if (isElectron()) {
                    browserWindow.webContents.send('shortcut', 'mod+v');
                } else {
                    UniApi.Event.emit('appbar-menu:shortcut', 'mod+v');
                }
            }
        },
        { id: 'line-2', type: 'separator' },
        {
            id: 'select-all',
            label: 'Select All',
            accelerator: 'CommandOrControl+A',
            enabled: true,
            click(menuItem, browserWindow) {
                if (isElectron()) {
                    browserWindow.webContents.send('shortcut', 'mod+a');
                } else {
                    UniApi.Event.emit('appbar-menu:shortcut', 'mod+a');
                }
            }
        },
        {
            id: 'unselect',
            label: 'Unselect',
            // accelerator: 'CommandOrControl',
            enabled: true,
            click(menuItem, browserWindow) {
                if (isElectron()) {
                    browserWindow.webContents.send('shortcut', 'esc');
                } else {
                    UniApi.Event.emit('appbar-menu:shortcut', 'esc');
                }
            }
        },
        { id: 'line-3', type: 'separator' },
        {
            id: 'delete',
            label: 'Delete',
            accelerator: 'Delete',
            enabled: true,
            click(menuItem, browserWindow) {
                if (isElectron()) {
                    browserWindow.webContents.send('shortcut', 'del');
                } else {
                    UniApi.Event.emit('appbar-menu:shortcut', 'del');
                }
            }
        },
        { id: 'line-4', type: 'separator' },
        {
            id: 'text-editor',
            label: 'Text-editor',
            submenu: [
                {
                    id: 'cut original',
                    role: 'cut',
                    label: 'Cut Original',
                    accelerator: 'CommandOrControl+X'
                },
                {
                    id: 'copy original',
                    role: 'copy',
                    label: 'Copy Original',
                    accelerator: 'CommandOrControl+C'
                },
                {
                    id: 'paste original',
                    role: 'paste',
                    label: 'Paste Original',
                    accelerator: 'CommandOrControl+V'
                }
            ]
        }
    ]
};
