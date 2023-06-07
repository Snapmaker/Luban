import isElectron from 'is-electron';
import { noop } from 'lodash';

import { HEAD_CNC, HEAD_LASER, HEAD_PRINTING } from '../../constants/machines';
import UniApi from '../../lib/uni-api';

export default {
    id: 'file',
    label: 'key-App/Menu-File',
    submenu: [
        {
            id: 'new',
            label: 'key-App/Menu-New Project',
            enabled: true,
            submenu: [
                {
                    id: '3dp',
                    label: 'key-App/Menu-3D Printing',
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
                    label: 'key-App/Menu-Laser',
                    enabled: true,
                    click: noop,
                    submenu: [
                        {
                            id: 'laser-axis3',
                            label: 'key-App/Menu-3-axis',
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
                            label: 'key-App/Menu-4-axis',
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
                    label: 'key-App/Menu-CNC',
                    enabled: true,
                    click: noop,
                    submenu: [
                        {
                            id: 'cnc-axis3',
                            label: 'key-App/Menu-3-axis',
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
                            label: 'key-App/Menu-4-axis',
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
            label: 'key-App/Menu-Open Project',
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
            label: 'key-App/Menu-Recent Project',
            enabled: true,
            submenu: [
                { id: 'line-0', type: 'separator' },
                {
                    id: 'remove-recent',
                    label: 'key-App/Menu-Clear All Recent Projects',
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
            label: 'key-App/Menu-Case Library',
            enabled: true,
            click: noop,
            submenu: []
        },
        { id: 'line-1', type: 'separator' },
        {
            id: 'save',
            label: 'key-App/Menu-Save Project',
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
            label: 'key-App/Menu-Save As',
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
            label: 'key-App/Menu-Import Object',
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
            label: 'key-App/Menu-Export Object',
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
            label: 'key-App/Menu-Export G-code',
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
            label: 'key-App/Menu-Exit',
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
