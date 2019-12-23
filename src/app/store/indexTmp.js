// import isElectron from 'is-electron';
// import path from 'path';
// import includes from 'lodash/includes';
// import merge from 'lodash/merge';
// import semver from 'semver';
// import settings from '../config/settings';
// import ImmutableStore from '../lib/immutable-store';
// import log from '../lib/log';
// import { PROTOCOL_TEXT } from '../constants';
//
// let userData = null;
//
// // Check if code is running in Electron renderer process
// if (isElectron()) {
//     const electron = window.require('electron');
//     const app = electron.remote.app;
//     userData = {
//         path: path.join(app.getPath('userData'), 'cnc.json')
//     };
// }
//
// // Also see "widget/Workspace/WidgetManager/index.jsx"
// export const defaultState = {
//     session: {
//         name: '',
//         token: ''
//     },
//     // recently used machine
//     machine: {
//         series: 'original',
//         size: {
//             x: 125,
//             y: 125,
//             z: 125
//         }
//     },
//     tab: {
//         workspace: {
//             container: {
//                 default: {
//                     widgets: ['visualizer']
//                 },
//                 primary: {
//                     show: true,
//                     widgets: [
//                         'connection', 'console', 'marlin', 'laser-test-focus'
//                     ]
//                 },
//                 secondary: {
//                     show: true,
//                     widgets: [
//                         'webcam', 'control', 'macro', 'gcode'
//                     ]
//                 }
//             }
//         },
//         '3dp': {
//             container: {
//                 default: {
//                     widgets: ['3dp-material', '3dp-configurations', '3dp-output']
//                 }
//             }
//         },
//         laser: {
//             container: {
//                 default: {
//                     widgets: ['laser-set-background', 'laser-params', 'laser-output']
//                 }
//             }
//         },
//         cnc: {
//             container: {
//                 default: {
//                     widgets: ['cnc-tool', 'cnc-path', 'cnc-output']
//                 }
//             }
//         }
//     },
//     widgets: {
//         axes: {
//             minimized: false,
//             axes: ['x', 'y', 'z'],
//             jog: {
//                 keypad: false,
//                 selectedDistance: '1',
//                 customDistance: 10
//             },
//             shuttle: {
//                 feedrateMin: 500,
//                 feedrateMax: 2000,
//                 hertz: 10,
//                 overshoot: 1
//             }
//         },
//         connection: {
//             minimized: true,
//             controller: {
//                 type: 'Marlin' // Grbl|Marlin|Smoothie|TinyG
//             },
//             port: '',
//             dataSource: PROTOCOL_TEXT,
//             baudrate: 115200,
//             autoReconnect: false
//         },
//         gcode: {
//             minimized: false
//         },
//         macro: {
//             minimized: false
//         },
//         marlin: {
//             minimized: false,
//             statusSection: {
//                 expanded: true
//             },
//             machineModalSection: {
//                 expanded: false
//             },
//             heaterControlSection: {
//                 expanded: true
//             },
//             powerSection: {
//                 expanded: true
//             },
//             overridesSection: {
//                 expanded: true
//             }
//         },
//         spindle: {
//             minimized: false,
//             speed: 1000
//         },
//         visualizer: {
//             minimized: false,
//
//             // 3D View
//             disabled: false,
//             projection: 'orthographic', // 'perspective' or 'orthographic'
//             cameraMode: 'pan', // 'pan' or 'rotate'
//             gcode: {
//                 displayName: true
//             },
//             objects: {
//                 coordinateSystem: {
//                     visible: true
//                 },
//                 toolhead: {
//                     visible: true
//                 }
//             }
//         },
//         webcam: {
//             disabled: true,
//             minimized: false,
//
//             // local - Use a built-in camera or a connected webcam
//             // mjpeg - M-JPEG stream over HTTP
//             mediaSource: 'local',
//
//             // The device id
//             deviceId: '',
//
//             // The URL field is required for the M-JPEG stream
//             url: '',
//
//             geometry: {
//                 scale: 1.0,
//                 rotation: 0, // 0: 0, 1: 90, 2: 180, 3: 270
//                 flipHorizontally: false,
//                 flipVertically: false
//             },
//             crosshair: false,
//             muted: false
//         }
//     },
//     developerPanel: {
//         widgets: [
//             'connectionPanel', 'axesPanel', 'macroPanel'
//         ],
//         defaultWidgets: []
//     }
// };
//
// const getUserConfig = () => {
//     const cnc = {
//         version: settings.version,
//         state: {}
//     };
//
//     try {
//         let data;
//
//         if (userData) {
//             const fs = window.require('fs'); // Use window.require to require fs module in Electron
//             if (fs.existsSync(userData.path)) {
//                 data = JSON.parse(fs.readFileSync(userData.path, 'utf8') || '{}');
//             }
//         } else {
//             data = JSON.parse(localStorage.getItem('Snapmaker') || '{}');
//         }
//
//         if (typeof data === 'object') {
//             cnc.version = data.version || cnc.version; // fallback to current version
//             cnc.state = merge(data.state) || cnc.state;
//         }
//     } catch (e) {
//         log.error(e);
//     }
//
//     return cnc;
// };
//
// const cnc = getUserConfig() || {};
// const state = merge({}, defaultState, cnc.state || {});
// const store = new ImmutableStore(state);
//
// store.on('change', (s) => {
//     try {
//         const value = JSON.stringify({
//             version: settings.version,
//             state: s
//         }, null, 4);
//
//         if (userData) {
//             const fs = window.require('fs'); // Use window.require to require fs module in Electron
//             fs.writeFileSync(userData.path, value);
//         }
//         localStorage.setItem('Snapmaker', value);
//     } catch (e) {
//         log.error(e);
//     }
// });
//
// //
// // Migration
// //
// // eslint-disable-next-line no-unused-vars
// const migrateStore = () => {
//     if (!cnc.version) {
//         return;
//     }
//
//     // 1.9.0
//     // * Renamed "widgets.probe.tlo" to "widgets.probe.touchPlateHeight"
//     // * Removed "widgets.webcam.scale"
//     if (semver.lt(cnc.version, '1.9.0')) {
//         // Probe widget
//         const tlo = store.get('widgets.probe.tlo');
//         if (tlo !== undefined) {
//             store.set('widgets.probe.touchPlateHeight', Number(tlo));
//             store.unset('widgets.probe.tlo');
//         }
//
//         // Webcam widget
//         store.unset('widgets.webcam.scale');
//     }
//
//     // 2.4.2
//     // add widget "laser-test-focus"
//     if (semver.lt(cnc.version, '2.4.2')) {
//         const primaryWidgets = store.get('tab.workspace.container.primary.widgets');
//
//         if (!includes(primaryWidgets, 'laser-test-focus')) {
//             primaryWidgets.push('laser-test-focus');
//             store.set('tab.workspace.container.primary.widgets', primaryWidgets);
//         }
//     }
//
//     // 2.4.4
//     // remove widget 'macro' (maybe add back later)
//     if (semver.lt(cnc.version, '2.4.4')) {
//         const widgets = store.get('tab.workspace.container.secondary.widgets');
//
//         let needUpdate = false;
//
//         if (includes(widgets, 'macro')) {
//             needUpdate = true;
//             widgets.splice(widgets.indexOf('macro'), 1);
//         }
//
//         if (includes(widgets, 'probe')) {
//             needUpdate = true;
//             widgets.splice(widgets.indexOf('probe'), 1);
//         }
//
//         needUpdate && store.set('tab.workspace.container.secondary.widgets', widgets);
//     }
//
//     // 2.5.3
//     // Add machine setting
//     if (semver.lt(cnc.version, '2.5.3')) {
//         const machineSetting = store.get('machine');
//
//         if (!machineSetting) {
//             store.set('machine', defaultState.machine);
//         }
//     }
//     // 3.0.0
//     // add widget 'macro'
//     if (semver.lt(cnc.version, '3.0.0')) {
//         const secondaryWidgets = store.get('workspace.container.secondary.widgets');
//         /*
//         if (includes(secondaryWidgets, 'macro')) {
//             secondaryWidgets.splice(secondaryWidgets.indexOf('macro'), 1);
//             store.set('tab.workspace.container.secondary.widgets', secondaryWidgets);
//         }
//         */
//         if (!includes(secondaryWidgets, 'macro')) {
//             secondaryWidgets.push('macro');
//             store.set('workspace.container.secondary.widgets', secondaryWidgets);
//         }
//     }
// };
//
// // try {
// //     migrateStore();
// // } catch (err) {
// //     log.error(err);
// // }
//
// export default store;
