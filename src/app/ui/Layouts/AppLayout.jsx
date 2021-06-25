import React, { PureComponent } from 'react';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import isElectron from 'is-electron';
import Mousetrap from 'mousetrap';
import i18next from 'i18next';
import { renderModal } from '../utils';
import AppBar from '../views/AppBar';
import i18n from '../../lib/i18n';
import UniApi from '../../lib/uni-api';
import Settings from '../Pages/Settings/Settings';
import FirmwareTool from '../Pages/Settings/FirmwareTool';
import SoftwareUpdate from '../Pages/Settings/SoftwareUpdate';
import {
    PAGE_EDITOR,
    getCurrentHeadType,
    HEAD_TYPE_ENV_NAME,
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

class AppLayout extends PureComponent {
    static propTypes = {
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
        switchToPage: PropTypes.func.isRequired,
        shouldCheckForUpdate: PropTypes.bool.isRequired,
        updateIsDownloading: PropTypes.func.isRequired,
        updateAutoupdateMessage: PropTypes.func.isRequired,
        updateShouldCheckForUpdate: PropTypes.func.isRequired,
        children: PropTypes.array.isRequired
    };

    state = {
        showSettingsModal: false,
        showDevelopToolsModal: false,
        showCheckForUpdatesModal: false
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
                title: i18n._('Preferences'),
                renderBody: () => {
                    return (
                        <Settings
                            location={{ pathname: `/settings/${this.activeTab}` }}
                        />
                    );
                },
                size: 'large',
                onClose,
                actions: [
                    {
                        name: i18n._('Save'),
                        isPrimary: true,
                        onClick: () => {
                            UniApi.Event.emit('appbar-menu:settings.save');
                            onClose();
                        }
                    },
                    {
                        name: i18n._('Cancel'),
                        onClick: () => {
                            UniApi.Event.emit('appbar-menu:settings.cancel');
                            onClose();
                        }
                    }
                ]
            });
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
                title: i18n._('Firmware Tool'),
                renderBody: () => {
                    return (<FirmwareTool />);
                },
                onClose,
                actions: [
                    {
                        name: i18n._('Compile and Export'),
                        isPrimary: true,
                        onClick: () => {
                            UniApi.Event.emit('appbar-menu:firmware-tools.export');
                            onClose();
                        }
                    },
                    {
                        name: i18n._('Cancel'),
                        onClick: () => {
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
        renderCheckForUpdatesModal: () => {
            const onClose = () => {
                this.setState({
                    showCheckForUpdatesModal: false
                });
            };
            return renderModal({
                title: i18n._('Software Update'),
                renderBody: () => {
                    return (<SoftwareUpdate />);
                },
                renderFooter() { return null; },
                onClose,
                actions: []
            });
        },
        showCheckForUpdates: () => {
            this.setState({
                showCheckForUpdatesModal: true
            });
        },
        openProject: async (file) => {
            if (!file) {
                this.fileInput.current.value = null;
                this.fileInput.current.click();
            } else {
                try {
                    await this.props.openProject(file, this.props.history);
                    if (isElectron()) {
                        const [, tail] = file.name.split('.');
                        if (!tail) return;
                        if (tail.substring(0, 4) === 'snap' || tail === 'gcode' || tail === 'cnc' || tail === 'nc') {
                            UniApi.File.addRecentFiles({ name: file.name, path: file.path });
                        }
                    }
                } catch (e) {
                    console.log(e.message);
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
            const message = i18n._('Do you want to save the changes in the {{headType}} editor?', { headType: HEAD_TYPE_ENV_NAME[currentHeadType] });
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
            UniApi.Event.on('update-available', (event, downloadInfo, oldVersion) => {
                UniApi.Update.downloadUpdate(downloadInfo, oldVersion, this.props.shouldCheckForUpdate);
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
            UniApi.Event.on('save-as-file', (event, file) => {
                this.actions.saveAsFile(file);
            });
            UniApi.Event.on('save', () => {
                this.actions.save();
            });
            UniApi.Event.on('save-and-close', async () => {
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
            UniApi.Event.on('window', (event, ...args) => {
                UniApi.Event.emit('appbar-menu:window', ...args);
            });
            UniApi.Event.on('preferences.show', (event, ...args) => {
                UniApi.Event.emit('appbar-menu:preferences.show', ...args);
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
                await this.actions.closeFile();
                this.props.history.push(`/${headType}`);
                if (headType === 'cnc' || headType === 'laser') {
                    UniApi.Event.emit('appbar-menu:cnc-laser.new-file', isRotate);
                    this.props.switchToPage(headType, PAGE_EDITOR);
                }
            });
            UniApi.Event.on('appbar-menu:clear-recent-files', () => {
                this.actions.updateRecentFile([], 'reset');
                UniApi.Menu.cleanAllRecentFiles();
            });
            UniApi.Event.on('appbar-menu:import', async () => {
                let fileObj;
                if (isElectron()) {
                    const file = await UniApi.Dialog.showOpenFileDialog(this.props.history.location.pathname.slice(1));
                    fileObj = UniApi.File.constructFileObj(file.path, file.name.split('\\').pop());
                }
                switch (this.props.history.location.pathname) {
                    case '/3dp': UniApi.Event.emit('appbar-menu:printing.import', fileObj); break;
                    case '/laser': UniApi.Event.emit('appbar-menu:laser.import', fileObj); break;
                    case '/cnc': UniApi.Event.emit('appbar-menu:cnc.import', fileObj); break;
                    case '/workspace': UniApi.Event.emit('appbar-menu:workspace.import', fileObj); break;
                    default: break;
                }
            });
            UniApi.Event.on('appbar-menu:export-model', () => {
                if (this.props.history.location.pathname === '/3dp') {
                    UniApi.Event.emit('appbar-menu:printing.export-model');
                }
            });
            UniApi.Event.on('appbar-menu:get-started', (caseItem) => {
                this.props.loadCase(caseItem.pathConfig, this.props.history);
            });
            UniApi.Event.on('appbar-menu:export-gcode', () => {
                switch (this.props.history.location.pathname) {
                    case '/3dp': UniApi.Event.emit('appbar-menu:printing.export-gcode'); break;
                    case '/laser': UniApi.Event.emit('appbar-menu:cnc-laser.export-gcode'); break;
                    case '/cnc': UniApi.Event.emit('appbar-menu:cnc-laser.export-gcode'); break;
                    case '/workspace': UniApi.Event.emit('appbar-menu:workspace.export-gcode'); break;
                    default: break;
                }
            });

            this.props.history.listen(() => {
                this.props.updateMenu();
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
        }
    }

    componentDidMount() {
        this.props.initMenuLanguage();
        this.actions.initUniEvent();
        this.actions.initFileOpen();

        UniApi.Event.on('appbar-menu:preferences.show', this.actions.showPreferences);
        UniApi.Event.on('appbar-menu:developer-tools.show', this.actions.showDevelopTools);
        UniApi.Event.on('appbar-menu:check-for-updates.show', this.actions.showCheckForUpdates);
    }

    componentWillUnmount() {
        UniApi.Event.off('appbar-menu:preferences.show', this.actions.showPreferences);
        UniApi.Event.off('appbar-menu:developer-tools.show', this.actions.showDevelopTools);
        UniApi.Event.off('appbar-menu:check-for-updates.show', this.actions.showCheckForUpdates);
    }

    render() {
        const { showSettingsModal, showDevelopToolsModal, showCheckForUpdatesModal } = this.state;
        return (
            <div className={isElectron() ? null : 'appbar'}>
                <AppBar />
                { showSettingsModal ? this.actions.renderSettingModal() : null }
                { showDevelopToolsModal ? this.actions.renderDevelopToolsModal() : null }
                { showCheckForUpdatesModal ? this.actions.renderCheckForUpdatesModal() : null }
                {this.props.children}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machineInfo = state.machine;
    const { shouldCheckForUpdate } = machineInfo;
    // const projectState = state.project;
    return {
        machineInfo,
        shouldCheckForUpdate
        // projectState
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        initRecoverService: () => dispatch(projectActions.initRecoverService()),
        saveAsFile: (headType) => dispatch(projectActions.saveAsFile(headType)),
        save: (headType, dialogOptions) => dispatch(projectActions.save(headType, dialogOptions)),
        saveAndClose: (headType, opts) => dispatch(projectActions.saveAndClose(headType, opts)),
        openProject: (file, history) => dispatch(projectActions.openProject(file, history)),
        updateRecentProject: (arr, type) => dispatch(projectActions.updateRecentFile(arr, type)),
        // openProject: (file, history) => dispatch(projectActions.open(file, history)),
        loadCase: (pathConfig, history) => dispatch(projectActions.openProject(pathConfig, history)),
        updateMenu: () => dispatch(menuActions.updateMenu()),
        initMenuLanguage: () => dispatch(menuActions.initMenuLanguage()),
        enableMenu: () => dispatch(menuActions.enableMenu()),
        disableMenu: () => dispatch(menuActions.disableMenu()),
        switchToPage: (from, page) => dispatch(editorActions.switchToPage(from, page)),
        updateShouldCheckForUpdate: (shouldAutoUpdate) => dispatch(machineActions.updateShouldCheckForUpdate(shouldAutoUpdate)),
        updateAutoupdateMessage: (message) => dispatch(machineActions.updateAutoupdateMessage(message)),
        updateIsDownloading: (isDownloading) => dispatch(machineActions.updateIsDownloading(isDownloading))
    };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(AppLayout));
