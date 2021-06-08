import isElectron from 'is-electron';
import UniApi from '../../lib/uni-api';

export default {
    id: 'file',
    label: 'File',
    submenu: [
        {
            id: 'new',
            label: 'New File',
            enabled: true,
            accelerator: 'CmdOrCtrl+N',
            submenu: [
                {
                    id: '3dp',
                    label: '3D Printing',
                    enabled: true,
                    click(menuItem, browserWindow) {
                        if (isElectron()) {
                            browserWindow.webContents.send('new-file', { headType: '3dp', isRotate: false });
                        } else {
                            UniApi.Event.emit('appbar-menu:new-file', { headType: '3dp', isRotate: false });
                        }
                    }
                },
                {
                    id: 'laser',
                    label: 'Laser',
                    enabled: true,
                    click: () => {},
                    submenu: [
                        {
                            id: 'laser-axis3',
                            label: '3-Axis',
                            enabled: true,
                            click(menuItem, browserWindow) {
                                if (isElectron()) {
                                    browserWindow.webContents.send('new-file', { headType: 'laser', isRotate: false });
                                } else {
                                    UniApi.Event.emit('appbar-menu:new-file', { headType: 'laser', isRotate: false });
                                }
                            }
                        },
                        {
                            id: 'laser-axis4',
                            label: '4-Axis',
                            enabled: true,
                            click(menuItem, browserWindow) {
                                if (isElectron()) {
                                    browserWindow.webContents.send('new-file', { headType: 'laser', isRotate: true });
                                } else {
                                    UniApi.Event.emit('appbar-menu:new-file', { headType: 'laser', isRotate: true });
                                }
                            }
                        }
                    ]
                },
                {
                    id: 'cnc',
                    label: 'CNC',
                    enabled: true,
                    click: () => {},
                    submenu: [
                        {
                            id: 'cnc-axis3',
                            label: '3-Axis',
                            enabled: true,
                            click(menuItem, browserWindow) {
                                if (isElectron()) {
                                    browserWindow.webContents.send('new-file', { headType: 'cnc', isRotate: false });
                                } else {
                                    UniApi.Event.emit('appbar-menu:new-file', { headType: 'cnc', isRotate: false });
                                }
                            }
                        },
                        {
                            id: 'cnc-axis4',
                            label: '4-Axis',
                            enabled: true,
                            click(menuItem, browserWindow) {
                                if (isElectron()) {
                                    browserWindow.webContents.send('new-file', { headType: 'cnc', isRotate: true });
                                } else {
                                    UniApi.Event.emit('appbar-menu:new-file', { headType: 'cnc', isRotate: true });
                                }
                            }
                        }
                    ]
                }
            ]
        },
        {
            id: 'open-file',
            label: 'Open File',
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
            label: 'Recent Files',
            enabled: true,
            submenu: [
                { id: 'line-0', type: 'separator' },
                {
                    id: 'remove-recent',
                    label: 'Clean All Recent Files',
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
            label: 'Get Started',
            enabled: true,
            click: () => {},
            submenu: []
        },
        { id: 'line-1', type: 'separator' },
        {
            id: 'save',
            label: 'Save File',
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
            label: 'Save As',
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
            label: 'Import',
            enabled: true,
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
            label: 'Export Models',
            enabled: true,
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
            label: 'Export G-code',
            enabled: true,
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
            label: 'Exit',
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
