import isElectron from 'is-electron';
import UniApi from '../../lib/uni-api';
import { HEAD_CNC, HEAD_LASER, HEAD_PRINTING } from '../../constants';

export default {
    id: 'file',
    label: 'key_menu_File',
    submenu: [
        {
            id: 'new',
            label: 'key_menu_New Project',
            enabled: true,
            submenu: [
                {
                    id: '3dp',
                    label: 'key_menu_3D Printing',
                    enabled: true,
                    click(menuItem, browserWindow) {
                        if (isElectron()) {
                            browserWindow.webContents.send('new-file', { headType: HEAD_PRINTING, isRotate: false });
                        } else {
                            UniApi.Event.emit('appbar-menu:new-file', { headType: HEAD_PRINTING, isRotate: false });
                        }
                    }
                },
                {
                    id: 'laser',
                    label: 'key_menu_Laser',
                    enabled: true,
                    click: () => {},
                    submenu: [
                        {
                            id: 'laser-axis3',
                            label: 'key_menu_3-axis',
                            enabled: true,
                            click(menuItem, browserWindow) {
                                if (isElectron()) {
                                    browserWindow.webContents.send('new-file', { headType: HEAD_LASER, isRotate: false });
                                } else {
                                    UniApi.Event.emit('appbar-menu:new-file', { headType: HEAD_LASER, isRotate: false });
                                }
                            }
                        },
                        {
                            id: 'laser-axis4',
                            label: 'key_menu_4-axis',
                            enabled: true,
                            click(menuItem, browserWindow) {
                                if (isElectron()) {
                                    browserWindow.webContents.send('new-file', { headType: HEAD_LASER, isRotate: true });
                                } else {
                                    UniApi.Event.emit('appbar-menu:new-file', { headType: HEAD_LASER, isRotate: true });
                                }
                            }
                        }
                    ]
                },
                {
                    id: 'cnc',
                    label: 'key_menu_CNC',
                    enabled: true,
                    click: () => {},
                    submenu: [
                        {
                            id: 'cnc-axis3',
                            label: 'key_menu_3-axis',
                            enabled: true,
                            click(menuItem, browserWindow) {
                                if (isElectron()) {
                                    browserWindow.webContents.send('new-file', { headType: HEAD_CNC, isRotate: false });
                                } else {
                                    UniApi.Event.emit('appbar-menu:new-file', { headType: HEAD_CNC, isRotate: false });
                                }
                            }
                        },
                        {
                            id: 'cnc-axis4',
                            label: 'key_menu_4-axis',
                            enabled: true,
                            click(menuItem, browserWindow) {
                                if (isElectron()) {
                                    browserWindow.webContents.send('new-file', { headType: HEAD_CNC, isRotate: true });
                                } else {
                                    UniApi.Event.emit('appbar-menu:new-file', { headType: HEAD_CNC, isRotate: true });
                                }
                            }
                        }
                    ]
                }
            ]
        },
        {
            id: 'open-file',
            label: 'key_menu_Open Project',
            enabled: true,
            accelerator: 'CmdOrCtrl+O',
            click: async (menuItem, browserWindow) => {
                if (isElectron()) {
                    browserWindow.webContents.send('open-file-in-app');
                } else {
                    UniApi.Event.emit('appbar-menu:open-file-in-browser');
                }
            }
        },
        {
            id: 'recent-files',
            label: 'key_menu_Recent Project',
            enabled: true,
            submenu: [
                { id: 'line-0', type: 'separator' },
                {
                    id: 'remove-recent',
                    label: 'key_menu_Clear All Recent Projects',
                    enabled: true,
                    click: (menuItem, browserWindow) => {
                        if (isElectron()) {
                            browserWindow.webContents.send('clear-recent-files');
                        } else {
                            UniApi.Event.emit('appbar-menu:clear-recent-files');
                        }
                    }
                }
            ]
        },
        {
            id: 'get-started',
            label: 'key_menu_Case Library',
            enabled: true,
            click: () => {},
            submenu: []
        },
        { id: 'line-1', type: 'separator' },
        {
            id: 'save',
            label: 'key_menu_Save Project',
            enabled: true,
            accelerator: 'CommandOrControl+S',
            click(menuItem, browserWindow) {
                if (isElectron()) {
                    browserWindow.webContents.send('save');
                } else {
                    UniApi.Event.emit('save');
                }
            }
        },
        {
            id: 'save-as',
            label: 'key_menu_Save As',
            enabled: true,
            accelerator: 'CommandOrControl+Shift+S',
            click(menuItem, browserWindow) {
                if (isElectron()) {
                    browserWindow.webContents.send('save-as-file');
                } else {
                    UniApi.Event.emit('save-as-file');
                }
            }
        },
        { id: 'line-2', type: 'separator' },
        {
            id: 'import',
            label: 'key_menu_Import Object',
            enabled: true,
            accelerator: 'CmdOrCtrl+I',
            click(menuItem, browserWindow) {
                if (isElectron()) {
                    browserWindow.webContents.send('import');
                } else {
                    UniApi.Event.emit('appbar-menu:import');
                }
            }
        },
        {
            id: 'export-models',
            label: 'key_menu_Export Object',
            enabled: true,
            accelerator: 'CmdOrCtrl+E',
            click(menuItem, browserWindow) {
                if (isElectron()) {
                    browserWindow.webContents.send('export-model');
                } else {
                    UniApi.Event.emit('appbar-menu:export-model');
                }
            }
        },
        {
            id: 'export-gcode',
            label: 'key_menu_Export G-code',
            enabled: true,
            accelerator: 'CmdOrCtrl+P',
            click(menuItem, browserWindow) {
                if (isElectron()) {
                    browserWindow.webContents.send('export-gcode');
                } else {
                    UniApi.Event.emit('appbar-menu:export-gcode');
                }
            }
        },
        { id: 'line-3', type: 'separator' },
        {
            id: 'exit',
            label: 'key_menu_Exit',
            enabled: true,
            click(menuItem, browserWindow) {
                if (isElectron()) {
                    browserWindow.webContents.send('app-quit');
                } else {
                    UniApi.Event.emit('app-quit');
                }
            }
        }
    ]
};
