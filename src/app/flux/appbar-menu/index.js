import isElectron from 'is-electron';
import { cloneDeep, reverse } from 'lodash';
import { getMenuItems } from '../../config/menu';
import { MACHINE_SERIES } from '../../constants';
import {
    CaseConfigOriginal, CaseConfig150,
    CaseConfig250, CaseConfig350,
    CaseConfigA350FourAxis, CaseConfigA250FourAxis
} from '../../ui/Pages/HomePage/CaseConfig';
import UniApi from '../../lib/uni-api';
import i18n from '../../lib/i18n';

export const ACTION_UPDATE_STATE = 'appbar-menu/ACTION_UPDATE_STATE';

const INITIAL_STATE = {
    menuDisabledCount: 0,
    menu: [
        ...getMenuItems()
    ]
};

const hashStateMap = {
    '#/3dp': 'printing',
    '#/laser': 'laser',
    '#/cnc': 'cnc'
};

function caseConfigToMenuItems(caseConfig) {
    return caseConfig.map(item => {
        item.label = item.title;
        item.enabled = true;
        item.click = function () {
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
            item.enabled = false;
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
        const recentFiles = getState().project.general.recentFiles;

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

        if (toggleDeveloperToolsSubmenu) {
            toggleDeveloperToolsSubmenu.enabled = isElectron();
        }

        if (recentFilesSubmenu) {
            recentFilesSubmenu.submenu = [
                ...(reverse(cloneDeep(recentFiles)).map(item => {
                    item.label = item.name;
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
            switch (series) {
                case MACHINE_SERIES.ORIGINAL.value:
                case MACHINE_SERIES.CUSTOM.value:
                    getStartedSubmenu.submenu = caseConfigToMenuItems(CaseConfigOriginal);
                    break;
                case MACHINE_SERIES.A150.value:
                    getStartedSubmenu.submenu = caseConfigToMenuItems(CaseConfig150);
                    break;
                case MACHINE_SERIES.A250.value:
                    getStartedSubmenu.submenu = [
                        ...caseConfigToMenuItems(CaseConfig250),
                        ...caseConfigToMenuItems(CaseConfigA250FourAxis)
                    ];
                    break;
                case MACHINE_SERIES.A350.value:
                    getStartedSubmenu.submenu = [
                        ...caseConfigToMenuItems(CaseConfig350),
                        ...caseConfigToMenuItems(CaseConfigA350FourAxis)
                    ];
                    break;
                default:
                    getStartedSubmenu.submenu = caseConfigToMenuItems(CaseConfig150);
                    break;
            }
        }

        const stateName = hashStateMap[window.location.hash]; // acquire corresponding state according to location hash
        if (stateName) {
            const {
                canUndo,
                canRedo,
                gcodeFile,
                hasModel,
                modelGroup: {
                    selectedModelArray,
                    clipboard
                }
            } = getState()[stateName];

            fileMenu.submenu.forEach(item => {
                switch (item.id) {
                    case 'export-models':
                        if (window.location.hash === '#/3dp' && hasModel) {
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

            // update Edit menu status
            for (const item of editMenu.submenu) {
                switch (item.id) {
                    case 'select-all': item.enabled = true; break;
                    case 'undo': item.enabled = canUndo; break;
                    case 'redo': item.enabled = canRedo; break;
                    case 'paste':
                        if (clipboard.length > 0) {
                            item.enabled = true;
                        } else {
                            item.enabled = false;
                        }
                        break;
                    case 'cut':
                    case 'copy':
                    case 'duplicate':
                    case 'unselect':
                    case 'delete':
                        if (selectedModelArray.length > 0) {
                            item.enabled = true;
                        } else {
                            item.enabled = false;
                        }
                        break;
                    default: break;
                }
            }
        }
        if (window.location.hash === '#/') {
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
            editMenu.submenu.forEach(item => { item.enabled = false; });
        }
        if (window.location.hash === '#/workspace') {
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
            editMenu.submenu.forEach(item => {
                item.enabled = false;
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
