import React, { PureComponent } from 'react';
import { Group } from 'three';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import isElectron from 'is-electron';
import Mousetrap from 'mousetrap';
import i18next from 'i18next';
import classNames from 'classnames';
import { cloneDeep } from 'lodash';
import Checkbox from '../components/Checkbox';
import { Button } from '../components/Buttons';
import { renderModal } from '../utils';
import AppBar from '../views/AppBar';
import i18n from '../../lib/i18n';
import UniApi from '../../lib/uni-api';
import { checkIsSnapmakerProjectFile, checkIsGCodeFile } from '../../lib/check-name';
import Settings from '../pages/Settings/Settings';
import FirmwareTool from '../pages/Settings/FirmwareTool';
import SoftwareUpdate from '../pages/Settings/SoftwareUpdate';
import DownloadUpdate from '../pages/Settings/SoftwareUpdate/DownloadUpdate';

import {
    // HEAD_PRINTING,
    HEAD_LASER,
    HEAD_CNC,
    COORDINATE_MODE_CENTER,
    COORDINATE_MODE_BOTTOM_CENTER,
    getCurrentHeadType,
    HEAD_TYPE_ENV_NAME,
    SOFTWARE_MANUAL,
    FORUM_URL,
    SUPPORT_ZH_URL,
    SUPPORT_EN_URL,
    TUTORIAL_VIDEO_URL,
    OFFICIAL_SITE_ZH_URL,
    OFFICIAL_SITE_EN_URL,
    MARKET_ZH_URL,
    MARKET_EN_URL,
    MYMINIFACTORY_URL
} from '../../constants';
import { actions as menuActions } from '../../flux/appbar-menu';
import { actions as machineActions } from '../../flux/machine';
import { actions as editorActions } from '../../flux/editor';
import { actions as projectActions } from '../../flux/project';
import { actions as operationHistoryActions } from '../../flux/operation-history';
import { actions as settingsActions } from '../../flux/setting';
import { actions as appGlobalActions } from '../../flux/app-global';
import styles from './styles/appbar.styl';
// import HomePage from '../pages/HomePage';
// import Workspace from '../pages/Workspace';
import ModelExporter from '../widgets/PrintingVisualizer/ModelExporter';
import Anchor from '../components/Anchor';
import SvgIcon from '../components/SvgIcon';
import { logLubanQuit } from '../../lib/gaEvent';

class AppLayout extends PureComponent {
    static propTypes = {
        modelGroup: PropTypes.object.isRequired,
        store: PropTypes.object.isRequired,
        currentModalPath: PropTypes.string,
        updateCurrentModalPath: PropTypes.func.isRequired,
        startProject: PropTypes.func.isRequired,
        changeCoordinateMode: PropTypes.func.isRequired,
        updateMaterials: PropTypes.func.isRequired,
        initRecoverService: PropTypes.func.isRequired,
        save: PropTypes.func.isRequired,
        saveAndClose: PropTypes.func.isRequired,
        saveAsFile: PropTypes.func.isRequired,
        updateRecentProject: PropTypes.func.isRequired,
        openProject: PropTypes.func.isRequired,
        history: PropTypes.object.isRequired,
        initMenuLanguage: PropTypes.func.isRequired,
        disableMenu: PropTypes.func.isRequired,
        enableMenu: PropTypes.func.isRequired,
        updateMenu: PropTypes.func.isRequired,
        loadCase: PropTypes.func.isRequired,
        shouldCheckForUpdate: PropTypes.bool.isRequired,
        updateIsDownloading: PropTypes.func.isRequired,
        updateAutoupdateMessage: PropTypes.func.isRequired,
        updateShouldCheckForUpdate: PropTypes.func.isRequired,
        children: PropTypes.array.isRequired,
        restartGuideTours: PropTypes.func.isRequired,
        machineInfo: PropTypes.object.isRequired,
        updateMachineToolHead: PropTypes.func.isRequired,
        longTermBackupConfig: PropTypes.func.isRequired,
        showSavedModal: PropTypes.bool.isRequired,
        savedModalType: PropTypes.string.isRequired,
        savedModalFilePath: PropTypes.string.isRequired,
        savedModalZIndex: PropTypes.number.isRequired,
        updateSavedModal: PropTypes.func.isRequired,
        showArrangeModelsError: PropTypes.bool.isRequired,
        arrangeModelZIndex: PropTypes.number.isRequired,
        updateShowArrangeModelsError: PropTypes.func.isRequired
    };

    state = {
        showSettingsModal: false,
        showDevelopToolsModal: false,
        showDownloadUpdateModal: false,
        showCheckForUpdatesModal: false,
        releaseNotes: '',
        prevVersion: '',
        version: ''
    }

    activeTab = ''

    actions = {
        renderSettingModal: () => {
            const onClose = () => {
                this.setState({
                    showSettingsModal: false
                });
            };
            return renderModal({
                title: i18n._('key-App/Settings/Preferences-Preferences'),
                renderBody: () => {
                    return (
                        <Settings
                            pathname={`/settings/${this.activeTab}`}
                        />
                    );
                },
                size: 'large',
                onClose,
                actions: [
                    {
                        name: i18n._('key-App/Settings/Preferences-Cancel'),
                        onClick: () => {
                            UniApi.Event.emit('appbar-menu:settings.cancel');
                            onClose();
                        }
                    },
                    {
                        name: i18n._('key-App/Settings/Preferences-Save'),
                        isPrimary: true,
                        onClick: () => {
                            UniApi.Event.emit('appbar-menu:settings.save');
                            onClose();
                        }
                    }
                ]
            });
        },
        longTermBackupConfig: () => {
            this.props.longTermBackupConfig();
        },
        showPreferences: ({ activeTab }) => {
            this.activeTab = activeTab;
            this.setState({
                showSettingsModal: true
            });
        },
        renderDevelopToolsModal: () => {
            const onClose = () => {
                this.setState({
                    showDevelopToolsModal: false
                });
            };
            return renderModal({
                title: i18n._('key-App/Settings/FirmwareTool-Firmware Tool'),
                renderBody: () => {
                    return (<FirmwareTool />);
                },
                onClose,
                actions: [
                    {
                        name: i18n._('key-App/Settings/Preferences-Cancel'),
                        onClick: () => {
                            onClose();
                        }
                    },
                    {
                        name: i18n._('key-App/Settings/FirmwareTool-Pack and Export'),
                        isPrimary: true,
                        isAutoWidth: true,
                        onClick: () => {
                            UniApi.Event.emit('appbar-menu:firmware-tools.export');
                            onClose();
                        }
                    }
                ]
            });
        },
        showDevelopTools: () => {
            this.setState({
                showDevelopToolsModal: true
            });
        },
        startingDownloadUpdate: () => {
            if (this.props.machineInfo.isDownloading) {
                UniApi.Update.downloadHasStarted();
            } else {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.send('startingDownloadUpdate');
            }
        },
        renderCheckForUpdatesModal: () => {
            const onClose = () => {
                this.setState({
                    showCheckForUpdatesModal: false
                });
            };
            return renderModal({
                title: i18n._('key-App/Settings/SoftwareUpdate-Software Update'),
                renderBody: () => {
                    return (<SoftwareUpdate />);
                },
                shouldRenderFooter: false,
                renderFooter() { return null; },
                onClose,
                actions: []
            });
        },
        renderDownloadUpdateModal: () => {
            const { releaseNotes, releaseChangeLog, prevVersion, version } = this.state;
            const { shouldCheckForUpdate } = this.props;
            const onClose = () => {
                this.setState({
                    showDownloadUpdateModal: false
                });
            };
            return renderModal({
                title: i18n._('key-App/Update-Update Snapmaker Luban'),
                renderBody: () => {
                    return (
                        <DownloadUpdate
                            releaseNotes={releaseNotes}
                            releaseChangeLog={releaseChangeLog}
                            prevVersion={prevVersion}
                            version={version}
                        />
                    );
                },
                renderFooter: () => {
                    return (
                        <div className="sm-flex justify-space-between">
                            <div className="display-inline height-32">
                                <Checkbox
                                    checked={shouldCheckForUpdate}
                                    onChange={(event) => { this.props.updateShouldCheckForUpdate(event.target.checked); }}

                                />
                                <span className="margin-left-4">
                                    {i18n._('key-App/Settings/SoftwareUpdate-Automatically check for updates')}
                                </span>
                            </div>
                            <div className="display-inline">
                                <Button
                                    priority="level-two"
                                    className="margin-left-8"
                                    width="96px"
                                    type="default"
                                    onClick={onClose}
                                >
                                    {i18n._('key-App/Update-Later')}
                                </Button>
                                <Button
                                    priority="level-two"
                                    className="margin-left-8"
                                    width="auto"
                                    type="primary"
                                    onClick={() => this.actions.startingDownloadUpdate()}
                                >
                                    {i18n._('key-App/Update-Update Now')}
                                </Button>
                            </div>
                        </div>
                    );
                },
                onClose,
                actions: []
            });
        },
        showCheckForUpdates: () => {
            this.setState({
                showCheckForUpdatesModal: true
            });
        },
        showDownloadUpdate: (downloadInfo) => {
            if (downloadInfo) {
                this.setState({
                    releaseNotes: downloadInfo.releaseNotes,
                    releaseChangeLog: downloadInfo.releaseChangeLog,
                    prevVersion: downloadInfo.prevVersion,
                    version: downloadInfo.version,
                    showDownloadUpdateModal: true
                });
            }
        },
        renderSavedModal: () => {
            // TODO, add a component
            const onClose = () => {
                this.props.updateSavedModal({ showSavedModal: false });
            };
            if (this.props.savedModalType === 'web') {
                return (
                    <div
                        className={classNames('border-default-black-5', 'border-radius-4', 'box-shadow-module', 'position-ab',
                            'background-color-white', 'padding-horizontal-10', 'padding-vertical-10', 'bottom-0', 'margin-bottom-16')}
                        style={{
                            zIndex: this.props.savedModalZIndex,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            maxWidth: '360px'
                        }}
                    >
                        <div className="sm-flex justify-space-between">
                            <div className="sm-flex-auto font-roboto font-weight-normal font-size-middle">
                                <SvgIcon
                                    name="WarningTipsSuccess"
                                    size="24"
                                    type={['static']}
                                    color="#4cb518"
                                />
                                <span>
                                    {i18n._('key-app_layout-File Saved')}
                                </span>
                            </div>
                            <div className="sm-flex-auto">
                                <SvgIcon
                                    name="Cancel"
                                    type={['static']}
                                    size="24"
                                    onClick={onClose}
                                />
                            </div>
                        </div>
                    </div>
                );
            }
            if (this.props.savedModalType === 'electron') {
                const path = window.require('path');
                const openFolder = () => {
                    const ipc = window.require('electron').ipcRenderer;
                    ipc.send('open-saved-path', path.dirname(this.props.savedModalFilePath));
                };
                return (
                    <div
                        className={classNames('border-default-black-5', 'border-radius-4', 'box-shadow-module', 'position-ab',
                            'background-color-white', 'padding-horizontal-16', 'padding-vertical-16', 'bottom-0', 'margin-bottom-16',
                            'left-50-percent', 'max-width-360')}
                        style={{
                            zIndex: this.props.savedModalZIndex
                        }}
                    >
                        <div className="sm-flex justify-space-between">
                            <div className="sm-flex-auto font-roboto font-weight-normal font-size-middle">
                                <SvgIcon
                                    name="WarningTipsSuccess"
                                    size="24"
                                    type={['static']}
                                    color="#4cb518"
                                />
                                <span>
                                    {i18n._('key-app_layout-File Saved')}
                                </span>
                                <Anchor
                                    onClick={openFolder}
                                >
                                    <span
                                        className="color-blue-2"
                                        style={{
                                            textDecoration: 'underline'
                                        }}
                                    >
                                        {i18n._('key-app_layout-Open Folder')}
                                    </span>
                                </Anchor>
                            </div>
                            <div className="sm-flex-auto">
                                <SvgIcon
                                    name="Cancel"
                                    type={['static']}
                                    size="24"
                                    onClick={onClose}
                                />
                            </div>
                        </div>
                        <div
                            className="sm-flex"
                            style={{
                                wordBreak: 'break-all',
                                color: '#545659'
                            }}
                        >
                            {i18n._('key-app_layout-Saved to : ')}{this.props.savedModalFilePath}
                        </div>
                    </div>
                );
            }
            return null;
        },
        renderArrangeModelsError: () => {
            const onClose = () => {
                this.props.updateShowArrangeModelsError({ showArrangeModelsError: false });
            };
            return (
                <div
                    className={classNames('border-default-black-5', 'border-radius-4', 'box-shadow-module', 'position-ab',
                        'background-color-white', 'padding-horizontal-16', 'padding-vertical-16', 'bottom-0', 'margin-bottom-16',
                        'left-50-percent', 'max-width-360')}
                    style={{
                        zIndex: this.props.arrangeModelZIndex
                    }}
                >
                    <div className="sm-flex justify-space-between">
                        <div className="sm-flex-auto font-roboto font-weight-normal font-size-middle">
                            <SvgIcon
                                name="WarningTipsError"
                                size="24"
                                type={['static']}
                                color="red" // TODO
                            />
                            <span>
                                {i18n._('key-app_layout-Print Area Exceeded')}
                            </span>
                        </div>
                        <div className="sm-flex-auto">
                            <SvgIcon
                                name="Cancel"
                                type={['static']}
                                size="24"
                                onClick={onClose}
                            />
                        </div>
                    </div>
                    <div
                        className="sm-flex"
                        style={{
                            wordBreak: 'break-all',
                            color: '#545659'
                        }}
                    >
                        {i18n._('key-app_layout-Unable to place all models inside the print area.')}
                    </div>
                </div>
            );
        },
        openProject: async (file) => {
            if (!file) {
                // this.fileInput.current.value = null;
                // this.fileInput.current.click();
                UniApi.Event.emit('appbar-menu:open-file-in-browser');
            } else {
                try {
                    await this.props.openProject(file, this.props.history);
                    if (isElectron()) {
                        if (checkIsSnapmakerProjectFile(file.name) || checkIsGCodeFile(file.name)) {
                            UniApi.File.addRecentFiles({ name: file.name, path: file.path });
                        }
                    }
                } catch (e) {
                    console.log(e);
                }
            }
        },
        updateRecentFile: (arr, type) => {
            this.props.updateRecentProject(arr, type);
        },
        saveAsFile: () => {
            const headType = getCurrentHeadType(this.props.history.location.pathname);
            if (!headType) {
                return;
            }
            this.props.saveAsFile(headType);
        },
        saveNew: async () => {
            const headType = getCurrentHeadType(window.location.hash);
            if (!headType) {
                return;
            }
            await this.props.save(headType);
        },
        save: async () => {
            const headType = getCurrentHeadType(this.props.history.location.pathname);
            if (!headType) {
                return;
            }
            await this.props.save(headType);
        },
        saveAll: async () => {
            await this.actions.closeFile();
        },
        closeFile: async () => {
            const currentHeadType = getCurrentHeadType(this.props.history.location.pathname);
            const message = i18n._('key-Project/Save-Save the changes you made in the {{headType}} G-code Generator? Your changes will be lost if you don’t save them.', { headType: i18n._(HEAD_TYPE_ENV_NAME[currentHeadType]) });
            if (currentHeadType) {
                await this.props.saveAndClose(currentHeadType, { message });
            }
        },
        initFileOpen: async () => {
            const file = await UniApi.File.popFile();
            if (file) {
                await this.actions.openProject(file);
            }
            // start recover service after file opened on startup
            // to ensure opened file set before service run
            this.props.initRecoverService();
        },
        exportModel: (filePath) => {
            const isBinary = true;
            let format;
            if (!filePath) {
                format = 'stl';
                filePath = 'export';
                if (format === 'stl') {
                    if (isBinary === true) {
                        filePath += '_binary';
                    } else {
                        filePath += '_ascii';
                    }
                }
                filePath += `.${format}`;
            } else {
                format = filePath.split('.').pop();
            }
            const outputObject = new Group();
            this.props.modelGroup.models.forEach(item => {
                if (item.visible) {
                    const tempMeshObject = cloneDeep(item.meshObject);
                    outputObject.add(tempMeshObject);
                }
            });
            const output = new ModelExporter().parse(outputObject, format, isBinary);
            if (!output) {
                // export error
                return;
            }
            const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
            UniApi.File.writeBlobToFile(blob, filePath, (type, savedFilePath = '') => {
                this.props.updateSavedModal({
                    showSavedModal: true,
                    savedModalType: type,
                    savedModalFilePath: savedFilePath
                });
            });
        },
        initUniEvent: () => {
            UniApi.Event.on('message', (event, message) => {
                this.props.updateAutoupdateMessage(message);
            });
            UniApi.Event.on('download-has-started', () => {
                this.props.updateIsDownloading(true);
            });
            UniApi.Event.on('update-should-check-for-update', (event, checkForUpdate) => {
                this.props.updateShouldCheckForUpdate(checkForUpdate);
            });
            UniApi.Event.on('update-available', (event, downloadInfo) => {
                UniApi.Event.emit('tile-modal:download-update.show', downloadInfo);
            });
            UniApi.Event.on('is-replacing-app-now', (event, downloadInfo) => {
                UniApi.Update.isReplacingAppNow(downloadInfo);
                this.props.updateIsDownloading(false);
            });
            UniApi.Event.on('open-file', (event, file, arr) => {
                this.actions.openProject(file);
                if (arr && arr.length) {
                    this.actions.updateRecentFile(arr, 'update');
                }
            });
            UniApi.Event.on('appbar-menu:save-as-file', (event, file) => {
                const pathname = this.props.currentModalPath || this.props.history.location.pathname;
                switch (pathname) {
                    case '/printing':
                    case '/laser':
                    case '/cnc': this.actions.saveAsFile(file); break;
                    default: break;
                }
            });
            UniApi.Event.on('appbar-menu:save', () => {
                const pathname = this.props.currentModalPath || this.props.history.location.pathname;
                switch (pathname) {
                    case '/printing':
                    case '/laser':
                    case '/cnc': this.actions.save(); break;
                    default: break;
                }
            });
            UniApi.Event.on('save-and-close', async () => {
                logLubanQuit();
                await this.actions.saveAll();
                UniApi.Window.call('destroy');
            });
            UniApi.Event.on('close-file', async () => {
                await this.actions.closeFile();
            });
            UniApi.Event.on('update-recent-file', (event, arr, type) => {
                this.actions.updateRecentFile(arr, type);
            });
            UniApi.Event.on('navigate-to-workspace', () => {
                UniApi.Connection.navigateToWorkspace();
            });
            UniApi.Event.on('app-quit', async () => {
                await this.actions.closeFile();
                UniApi.APP.quit();
            });
            UniApi.Event.on('open-file-in-app', async () => {
                // const pathname = this.props.currentModalPath || this.props.history?.location?.pathname;
                const file = await UniApi.Dialog.showOpenFileDialog();
                if (file && file.path) {
                    UniApi.Event.emit('appbar-menu:open-file', file, [file]);
                }
            });
            UniApi.Event.on('toggle-developer-tools', async () => {
                // only available in Electron
                UniApi.Window.toggleDeveloperTools();
            });

            UniApi.Event.on('clear-recent-files', () => {
                UniApi.Event.emit('appbar-menu:clear-recent-files');
            });
            UniApi.Event.on('import', () => {
                UniApi.Event.emit('appbar-menu:import');
            });
            UniApi.Event.on('new-file', (event, ...args) => {
                UniApi.Event.emit('appbar-menu:new-file', ...args);
            });
            UniApi.Event.on('save', (event, ...args) => {
                UniApi.Event.emit('appbar-menu:save', ...args);
            });
            UniApi.Event.on('save-as-file', (event, ...args) => {
                UniApi.Event.emit('appbar-menu:save-as-file', ...args);
            });
            UniApi.Event.on('export-model', (event, ...args) => {
                UniApi.Event.emit('appbar-menu:export-model', ...args);
            });
            UniApi.Event.on('export-gcode', (event, ...args) => {
                UniApi.Event.emit('appbar-menu:export-gcode', ...args);
            });
            UniApi.Event.on('shortcut', (event, ...args) => {
                UniApi.Event.emit('appbar-menu:shortcut', ...args);
            });
            UniApi.Event.on('developer-tools.show', (event, ...args) => {
                UniApi.Event.emit('appbar-menu:developer-tools.show', ...args);
            });
            UniApi.Event.on('check-for-updates.show', (event, ...args) => {
                UniApi.Event.emit('appbar-menu:check-for-updates.show', ...args);
            });
            UniApi.Event.on('help.link', (event, ...args) => {
                UniApi.Event.emit('appbar-menu:help.link', ...args);
            });
            UniApi.Event.on('guided-tours-begin', () => {
                UniApi.Event.emit('appbar-menu:guided-tours-begin');
            });
            UniApi.Event.on('window', (event, ...args) => {
                UniApi.Event.emit('appbar-menu:window', ...args);
            });
            UniApi.Event.on('preferences.show', (event, ...args) => {
                UniApi.Event.emit('appbar-menu:preferences.show', ...args);
            });
            UniApi.Event.on('longterm-backup-config', (event, ...args) => {
                UniApi.Event.emit('appbar-menu:longterm-backup-config', ...args);
            });

            UniApi.Event.on('appbar-menu:open-file', (file, arr) => {
                this.actions.openProject(file);
                if (arr && arr.length) {
                    this.actions.updateRecentFile(arr, 'update');
                }
            });
            UniApi.Event.on('appbar-menu:window', (type) => {
                switch (type) {
                    case 'reload': UniApi.Window.reload(); break;
                    case 'forceReload': UniApi.Window.forceReload(); break;
                    case 'viewInBrowser': UniApi.Window.viewInBrowser(); break;
                    case 'toggleFullscreen': UniApi.Window.toggleFullscreen(); break;
                    default: break;
                }
            });
            UniApi.Event.on('appbar-menu:help.link', (type) => {
                switch (type) {
                    case 'softwareManual':
                        UniApi.Window.openLink(SOFTWARE_MANUAL);
                        break;
                    case 'forum':
                        UniApi.Window.openLink(FORUM_URL);
                        break;
                    case 'supports':
                        if (i18next.language === 'zh-cn') {
                            UniApi.Window.openLink(SUPPORT_ZH_URL);
                        } else {
                            UniApi.Window.openLink(SUPPORT_EN_URL);
                        }
                        break;
                    case 'tutorials':
                        UniApi.Window.openLink(TUTORIAL_VIDEO_URL);
                        break;
                    case 'officialSite':
                        if (i18next.language === 'zh-cn') {
                            UniApi.Window.openLink(OFFICIAL_SITE_ZH_URL);
                        } else {
                            UniApi.Window.openLink(OFFICIAL_SITE_EN_URL);
                        }
                        break;
                    case 'market':
                        if (i18next.language === 'zh-cn') {
                            UniApi.Window.openLink(MARKET_ZH_URL);
                        } else {
                            UniApi.Window.openLink(MARKET_EN_URL);
                        }
                        break;
                    case 'myminifactory':
                        UniApi.Window.openLink(MYMINIFACTORY_URL);
                        break;
                    default: break;
                }
            });
            UniApi.Event.on('appbar-menu:shortcut', (...commands) => {
                if (commands && commands.length > 0) {
                    Mousetrap.trigger(commands[0]);
                }
            });
            UniApi.Event.on('appbar-menu:new-file', async ({ headType, isRotate }) => {
                const oldPathname = this.props.history.location.pathname;
                const history = this.props.history;
                const { toolHead, series } = this.props.machineInfo;
                await this.props.startProject(oldPathname, `/${headType}`, history, isRotate);
                await this.props.updateMachineToolHead(toolHead, series, headType);
                if (headType === HEAD_CNC || headType === HEAD_LASER) {
                    if (!isRotate) {
                        const { materials } = this.props.store?.[headType];
                        await this.props.changeCoordinateMode(headType, COORDINATE_MODE_CENTER);
                        if (materials.isRotate !== isRotate) {
                            await this.props.updateMaterials(headType, { isRotate });
                        }
                    } else {
                        const { SVGActions, materials } = this.props.store?.[headType];
                        if (materials.isRotate !== isRotate) {
                            await this.props.changeCoordinateMode(
                                headType,
                                COORDINATE_MODE_BOTTOM_CENTER,
                                {
                                    x: materials.diameter * Math.PI,
                                    y: materials.length
                                },
                                !SVGActions.svgContentGroup
                            );
                            await this.props.updateMaterials(headType, { isRotate });
                        }
                    }
                }
            });
            UniApi.Event.on('appbar-menu:clear-recent-files', () => {
                this.actions.updateRecentFile([], 'reset');
                UniApi.Menu.cleanAllRecentFiles();
            });
            UniApi.Event.on('appbar-menu:import', async () => {
                let fileObj;
                const pathname = this.props.currentModalPath || this.props.history.location.pathname;
                if (pathname === '/') {
                    return;
                }
                if (isElectron()) {
                    let type = pathname;
                    if (this.props.store?.[pathname.slice(1)]?.materials?.isRotate && pathname === '/laser') {
                        type = '/laser-rotate';
                    }
                    const isMultiSelect = pathname === '/printing';
                    const files = await UniApi.Dialog.showOpenFileDialog(type, isMultiSelect);
                    if (!files) {
                        return;
                    }
                    if (isMultiSelect) {
                        fileObj = files.map(file => UniApi.File.constructFileObj(file.path, file.name.split('\\').pop()));
                    } else {
                        fileObj = UniApi.File.constructFileObj(files.path, files.name.split('\\').pop());
                    }
                }
                switch (pathname) {
                    case '/printing': UniApi.Event.emit('appbar-menu:printing.import', fileObj); break;
                    case '/laser': UniApi.Event.emit('appbar-menu:laser.import', fileObj); break;
                    case '/cnc': UniApi.Event.emit('appbar-menu:cnc.import', fileObj); break;
                    case '/workspace': UniApi.Event.emit('appbar-menu:workspace.import', fileObj); break;
                    default: break;
                }
            });
            UniApi.Event.on('appbar-menu:export-model', () => {
                const pathname = this.props.currentModalPath || this.props.history.location.pathname;
                if (pathname === '/printing' && this.props.modelGroup.hasModel()) {
                    const defaultPath = UniApi.File.resolveDownloadsPath('_binary.stl');
                    const promise = UniApi.Dialog.showSaveDialog({
                        title: i18n._('key-App/Settings/FirmwareTool-Export Model'),
                        defaultPath: defaultPath,
                        filters: [
                            { name: 'STL Binary', extensions: ['stl'] },
                            { name: 'OBJ', extensions: ['obj'] }
                        ]
                    });
                    if (promise) {
                        // called from Electron
                        promise.then((result) => {
                            this.actions.exportModel(result?.filePath || defaultPath);
                        });
                    } else {
                        // called in browser
                        this.actions.exportModel();
                    }
                }
            });
            UniApi.Event.on('appbar-menu:get-started', (caseItem) => {
                this.props.loadCase(caseItem.pathConfig, this.props.history);
            });
            UniApi.Event.on('appbar-menu:export-gcode', () => {
                const pathname = this.props.currentModalPath || this.props.history.location.pathname;
                switch (pathname) {
                    case '/printing': UniApi.Event.emit('appbar-menu:printing.export-gcode'); break;
                    case '/laser': UniApi.Event.emit('appbar-menu:cnc-laser.export-gcode'); break;
                    case '/cnc': UniApi.Event.emit('appbar-menu:cnc-laser.export-gcode'); break;
                    case '/workspace': UniApi.Event.emit('appbar-menu:workspace.export-gcode'); break;
                    default: break;
                }
            });

            this.props.history.listen(() => {
                this.props.updateMenu();
            });
            UniApi.Event.on('tile-modal:show', ({ component }) => {
                if (component.key === 'homepage') {
                    this.props.updateCurrentModalPath('#/');
                } else if (component.key === 'workspace') {
                    this.props.updateCurrentModalPath('#/workspace');
                }
                this.props.enableMenu();
            });
            UniApi.Event.on('tile-modal:hide', () => {
                this.props.updateCurrentModalPath(null);
                this.props.enableMenu();
            });
            UniApi.Event.on('appbar-menu:disable', () => {
                this.props.disableMenu();
            });
            UniApi.Event.on('appbar-menu:enable', () => {
                this.props.enableMenu();
            });
            UniApi.Event.on('appbar-menu:should-update', () => {
                this.props.updateMenu();
            });
            UniApi.Event.on('appbar-menu:update-electron-menu', (action) => {
                UniApi.Menu.replaceMenu(action.state.menu);
            });
            UniApi.Event.on('appbar-menu:guided-tours-begin', () => {
                const pathname = this.props.history.location?.pathname;
                if (!(pathname === '/workspace' || pathname === '/' || pathname === 'undefined')) {
                    this.props.restartGuideTours(pathname, this.props.history);
                }
            });
        }
    }

    // componentWillMount() {
    // }

    componentDidMount() {
        this.props.initMenuLanguage();
        this.actions.initUniEvent();
        this.actions.initFileOpen();
        UniApi.Event.on('appbar-menu:preferences.show', this.actions.showPreferences);
        UniApi.Event.on('appbar-menu:developer-tools.show', this.actions.showDevelopTools);
        UniApi.Event.on('appbar-menu:check-for-updates.show', this.actions.showCheckForUpdates);
        UniApi.Event.on('appbar-menu:longterm-backup-config', this.actions.longTermBackupConfig);
        UniApi.Event.on('tile-modal:download-update.show', this.actions.showDownloadUpdate);
    }

    componentWillUnmount() {
        UniApi.Event.off('appbar-menu:preferences.show', this.actions.showPreferences);
        UniApi.Event.off('appbar-menu:developer-tools.show', this.actions.showDevelopTools);
        UniApi.Event.off('appbar-menu:check-for-updates.show', this.actions.showCheckForUpdates);
        UniApi.Event.off('appbar-menu:longterm-backup-config', this.actions.longTermBackupConfig);
        UniApi.Event.off('tile-modal:download-update.show', this.actions.showDownloadUpdate);
    }

    render() {
        const { showSettingsModal, showDevelopToolsModal, showCheckForUpdatesModal, showDownloadUpdateModal } = this.state;
        const { showSavedModal, showArrangeModelsError } = this.props;
        return (
            <div className={isElectron() ? null : 'appbar'}>
                <AppBar />
                {showSettingsModal ? this.actions.renderSettingModal() : null}
                {showDevelopToolsModal ? this.actions.renderDevelopToolsModal() : null}
                {showCheckForUpdatesModal ? this.actions.renderCheckForUpdatesModal() : null}
                {showDownloadUpdateModal ? this.actions.renderDownloadUpdateModal() : null}
                {showSavedModal ? this.actions.renderSavedModal() : null}
                {showArrangeModelsError ? this.actions.renderArrangeModelsError() : null}
                <div className={isElectron() ? null : classNames(styles['app-content'])}>
                    {this.props.children}
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machineInfo = state.machine;
    const { currentModalPath } = state.appbarMenu;
    const { shouldCheckForUpdate } = machineInfo;
    const { modelGroup } = state.printing;
    const { showSavedModal, savedModalType, savedModalFilePath, savedModalZIndex,
        showArrangeModelsError, arrangeModelZIndex
    } = state.appGlobal;
    // const projectState = state.project;
    return {
        currentModalPath: currentModalPath ? currentModalPath.slice(1) : currentModalPath, // exclude hash character `#`
        machineInfo,
        shouldCheckForUpdate,
        store: state,
        modelGroup,
        showSavedModal,
        savedModalType,
        savedModalFilePath,
        savedModalZIndex,
        showArrangeModelsError,
        arrangeModelZIndex
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        clearOperationHistory: (headType) => dispatch(operationHistoryActions.clear(headType)),
        initRecoverService: () => dispatch(projectActions.initRecoverService()),
        saveAsFile: (headType) => dispatch(projectActions.saveAsFile(headType)),
        save: (headType, dialogOptions) => dispatch(projectActions.save(headType, dialogOptions)),
        saveAndClose: (headType, opts) => dispatch(projectActions.saveAndClose(headType, opts)),
        openProject: (file, history) => dispatch(projectActions.openProject(file, history)),
        startProject: (from, to, history, isRotate) => dispatch(projectActions.startProject(from, to, history, false, isRotate)),
        updateRecentProject: (arr, type) => dispatch(projectActions.updateRecentFile(arr, type)),
        changeCoordinateMode: (headType, coordinateMode, coordinateSize) => dispatch(editorActions.changeCoordinateMode(headType, coordinateMode, coordinateSize)),
        updateMaterials: (headType, newMaterials) => dispatch(editorActions.updateMaterials(headType, newMaterials)),
        loadCase: (pathConfig, history) => dispatch(projectActions.openProject(pathConfig, history)),
        updateCurrentModalPath: (pathName) => dispatch(menuActions.updateCurrentModalPath(pathName)),
        updateMenu: () => dispatch(menuActions.updateMenu()),
        initMenuLanguage: () => dispatch(menuActions.initMenuLanguage()),
        enableMenu: () => dispatch(menuActions.enableMenu()),
        disableMenu: () => dispatch(menuActions.disableMenu()),
        updateShouldCheckForUpdate: (shouldAutoUpdate) => dispatch(machineActions.updateShouldCheckForUpdate(shouldAutoUpdate)),
        updateAutoupdateMessage: (message) => dispatch(machineActions.updateAutoupdateMessage(message)),
        updateIsDownloading: (isDownloading) => dispatch(machineActions.updateIsDownloading(isDownloading)),
        restartGuideTours: (pathname, history) => dispatch(projectActions.startProject(pathname, pathname, history, true)),
        updateMachineToolHead: (toolHead, series, headType) => dispatch(machineActions.updateMachineToolHead(toolHead, series, headType)),
        longTermBackupConfig: () => dispatch(settingsActions.longTermBackupConfig()),
        updateSavedModal: (options) => dispatch(appGlobalActions.updateSavedModal(options)),
        updateShowArrangeModelsError: (options) => dispatch(appGlobalActions.updateShowArrangeModelsError(options))
    };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(AppLayout));
