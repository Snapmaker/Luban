import isElectron from 'is-electron';
import UniApi from '../../lib/uni-api';

export default {
    id: 'edit',
    label: 'key_menu_Edit',
    // active: true,
    submenu: [
        {
            id: 'undo',
            label: 'key_menu_Undo',
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
            label: 'key_menu_Redo',
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
            label: 'key_menu_Cut',
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
            label: 'key_menu_Copy',
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
            label: 'key_menu_Duplicate',
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
            label: 'key_menu_Paste',
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
            label: 'key_menu_Select All',
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
            label: 'key_menu_Unselect',
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
            label: 'key_menu_Delete',
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
            label: 'key_menu_Text-editor',
            submenu: [
                {
                    id: 'cut-original',
                    role: 'cut',
                    label: 'key_menu_Cut Original',
                    accelerator: 'CommandOrControl+X'
                },
                {
                    id: 'copy-original',
                    role: 'copy',
                    label: 'key_menu_Copy Original',
                    accelerator: 'CommandOrControl+C'
                },
                {
                    id: 'paste-original',
                    role: 'paste',
                    label: 'key_menu_Paste Original',
                    accelerator: 'CommandOrControl+V'
                }
            ]
        }
    ]
};
