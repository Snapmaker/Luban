import isElectron from 'is-electron';
import { cloneDeep, reverse, includes } from 'lodash';
import { getMenuItems } from '../../config/menu';
import UniApi from '../../lib/uni-api';
import { getCaseList } from '../../lib/caseLibrary';
import i18n from '../../lib/i18n';
import { CONNECTION_WIFI_STATUS_TEST } from '../../constants';
import { controller } from '../../communication/socket-communication';

export const ACTION_UPDATE_STATE = 'appbar-menu/ACTION_UPDATE_STATE';
const DEFAULT_IDS = [
    'edit',
    'copy',
    'cut',
    'paste',
    'text-editor',
    'copy-original',
    'cut-original',
    'paste-original'
];
const INITIAL_STATE = {
    menuDisabledCount: 0,
    currentModalPath: null, // used for HomePage and Workspace modal
    menu: [
        ...getMenuItems()
    ]
};

const hashStateMap = {
    '#/printing': 'printing',
    '#/laser': 'laser',
    '#/cnc': 'cnc'
};

function caseConfigToMenuItems(caseConfig) {
    return caseConfig.map(item => {
        item.label = i18n._(item.title);
        item.enabled = true;
        item.click = () => {
            UniApi.Event.emit('appbar-menu:get-started', item);
        };
        return item;
    });
}

function traverseMenu(menu, callback) {
    for (const item of menu) {
        if ('label' in item || 'role' in item) {
            callback && callback(item);
            if (item.submenu) {
                traverseMenu(item.submenu, callback);
            }
        }
    }
}

export const actions = {
    updateCurrentModalPath: (path) => (dispatch) => {
        dispatch({
            type: ACTION_UPDATE_STATE,
            state: {
                currentModalPath: path
            }
        });
    },
    initMenuLanguage: () => (dispatch, getState) => {
        const appbarMenu = getState().appbarMenu.menu;
        traverseMenu(appbarMenu, (item) => {
            item.label = i18n._(item.label);
        });
        dispatch({
            type: ACTION_UPDATE_STATE,
            state: {
                menu: [...appbarMenu]
            }
        });
    },
    disableMenu: () => (dispatch, getState) => {
        const menu = getState().appbarMenu.menu;
        let menuDisabledCount = getState().appbarMenu.menuDisabledCount;
        menuDisabledCount++;
        traverseMenu(menu, (item) => {
            if (!includes(DEFAULT_IDS, item.id)) {
                item.enabled = false;
            } else {
                item.enabled = true;
            }
        });
        dispatch({
            type: ACTION_UPDATE_STATE,
            state: {
                menu: [...menu],
                menuDisabledCount
            }
        });
    },
    enableMenu: () => (dispatch, getState) => {
        const menu = getState().appbarMenu.menu;
        let menuDisabledCount = getState().appbarMenu.menuDisabledCount;
        menuDisabledCount--;
        if (menuDisabledCount < 0) {
            menuDisabledCount = 0;
        }
        traverseMenu(menu, (item) => {
            item.enabled = true;
        });
        dispatch({
            type: ACTION_UPDATE_STATE,
            state: {
                menuDisabledCount
            }
        });
        dispatch(actions.updateMenu());
    },
    updateMenu: () => (dispatch) => {
        dispatch(actions.activateMenu(-1));
    },
    activateMenu: (menuIndex) => (dispatch, getState) => {
        const menuDisabledCount = getState().appbarMenu.menuDisabledCount;
        if (menuDisabledCount > 0) return;

        const menu = getState().appbarMenu.menu;
        const series = getState()?.machine?.series;
        const toolHead = getState()?.machine?.toolHead;
        const recentFiles = getState().project.general.recentFiles;
        const currentPath = getState().appbarMenu.currentModalPath || window.location.hash;

        // menu clicked
        menu.forEach((item, i) => {
            item.active = !!item.active; // undefined to bool
            if (i === menuIndex) {
                item.active = !item.active;
            } else {
                item.active = false;
            }
        });
        const fileMenu = menu.find(item => item.id === 'file');
        const editMenu = menu.find(item => item.id === 'edit');
        const windowMenu = menu.find(item => item.id === 'window');
        const getStartedSubmenu = fileMenu.submenu.find(item => item.id === 'get-started');
        const recentFilesSubmenu = fileMenu.submenu.find(item => item.id === 'recent-files');
        const toggleDeveloperToolsSubmenu = windowMenu.submenu.find(item => item.id === 'toggle-developer-tools');
        const helpMenu = menu.find(item => item.id === 'help');
        if (toggleDeveloperToolsSubmenu) {
            toggleDeveloperToolsSubmenu.enabled = isElectron();
        }

        if (recentFilesSubmenu) {
            recentFilesSubmenu.submenu = [
                ...(reverse(cloneDeep(recentFiles)).map(item => {
                    item.label = item.path || item.name; // item.name;
                    item.enabled = true;
                    item.click = function () {
                        UniApi.Event.emit('appbar-menu:open-file', { path: item.path, name: item.name }, []);
                    };
                    return item;
                })),
                ...recentFilesSubmenu.submenu.slice(-2)
            ];
        }

        if (getStartedSubmenu) {
            const { caseList, caseListFourAxis } = getCaseList(series, toolHead);
            getStartedSubmenu.submenu = [
                ...caseConfigToMenuItems(caseList),
                ...caseConfigToMenuItems(caseListFourAxis)
            ];
        }

        const stateName = hashStateMap[currentPath]; // acquire corresponding state according to location hash
        if (stateName) {
            const {
                gcodeFile,
                hasModel,
                modelGroup: {
                    selectedModelArray
                    // clipboard
                }
            } = getState()[stateName];
            const { unSaved } = getState().project[stateName];
            const {
                canUndo,
                canRedo
            } = getState()[stateName].history;

            fileMenu.submenu.forEach(item => {
                switch (item.id) {
                    case 'save':
                        if (unSaved) {
                            item.enabled = true;
                        } else {
                            item.enabled = false;
                        }
                        break;
                    case 'export-models':
                        if (currentPath === '#/printing' && hasModel) {
                            item.enabled = true;
                        } else {
                            item.enabled = false;
                        }
                        break;
                    case 'export-gcode':
                        item.enabled = !!gcodeFile;
                        break;
                    default: item.enabled = true; break;
                }
            });

            helpMenu.submenu.forEach(item => {
                item.enabled = true;
            });

            // update Edit menu status
            for (const item of editMenu.submenu) {
                switch (item.id) {
                    case 'select-all': item.enabled = true; break;
                    case 'undo': item.enabled = canUndo; break;
                    case 'redo': item.enabled = canRedo; break;
                    // case 'paste':
                    //     if (clipboard.length > 0) {
                    //         item.enabled = true;
                    //     } else {
                    //         item.enabled = false;
                    //     }
                    //     break;
                    // case 'cut':
                    // case 'copy':
                    case 'duplicate':
                    case 'unselect':
                    case 'delete':
                        if (selectedModelArray.length > 0) {
                            item.enabled = true;
                        } else {
                            item.enabled = false;
                        }
                        break;
                    default:
                        item.enabled = true;
                        break;
                }
            }
        }
        if (currentPath === '#/') {
            fileMenu.submenu.forEach(item => {
                switch (item.id) {
                    case 'save':
                    case 'save-as':
                    case 'import':
                    case 'export-models':
                    case 'export-gcode': item.enabled = false; break;
                    default: item.enabled = true; break;
                }
            });
            // editMenu.submenu.forEach(item => { item.enabled = false; });
            helpMenu.submenu.forEach(item => {
                switch (item.id) {
                    case 'guided-tour':
                        item.enabled = false;
                        break;
                    default:
                        item.enabled = true;
                        break;
                }
            });
        }
        if (currentPath === '#/workspace') {
            const { gcodeFile } = getState().workspace;
            fileMenu.submenu.forEach(item => {
                switch (item.id) {
                    case 'export-gcode': item.enabled = !!gcodeFile; break;
                    case 'save':
                    case 'save-as':
                    case 'export-models': item.enabled = false; break;
                    default: item.enabled = true; break;
                }
            });
            helpMenu.submenu.forEach(item => {
                switch (item.id) {
                    case 'guided-tour':
                        item.enabled = false;
                        break;
                    default:
                        item.enabled = true;
                        break;
                }
            });
        }

        dispatch({
            type: ACTION_UPDATE_STATE,
            state: {
                menu: [...menu]
            }
        });
    },
    hideMenu: () => (dispatch, getState) => {
        const menu = getState().appbarMenu.menu;
        menu.forEach((item) => {
            item.active = false;
        });
        dispatch({
            type: ACTION_UPDATE_STATE,
            state: {
                menu: [...menu]
            }
        });
    },
    wifiStatusTest: () => (dispatch, getState) => {
        const { server } = getState().workspace;
        if (!server) {
            return;
        }
        const host = `http://${server.address}:8080`;
        controller.emitEvent(CONNECTION_WIFI_STATUS_TEST, {
            host
        });
    }
};

export default function reducer(state = INITIAL_STATE, action) {
    switch (action.type) {
        case ACTION_UPDATE_STATE: {
            return Object.assign({}, state, action.state);
        }
        default: return state;
    }
}
