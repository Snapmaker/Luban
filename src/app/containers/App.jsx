import React, { PureComponent } from 'react';
import includes from 'lodash/includes';
import PropTypes from 'prop-types';
import { Redirect, withRouter } from 'react-router-dom';
import { connect } from 'react-redux';
import ReactGA from 'react-ga';
import { actions as machineActions } from '../flux/machine';
import { actions as developToolsActions } from '../flux/develop-tools';
import { actions as keyboardShortcutActions } from '../flux/keyboardShortcut';
import { actions as laserActions } from '../flux/laser';
import { actions as editorActions } from '../flux/editor';
import { actions as cncActions } from '../flux/cnc';
import { actions as printingActions } from '../flux/printing';
import { actions as workspaceActions } from '../flux/workspace';
import { actions as textActions } from '../flux/text';
import { actions as projectActions } from '../flux/project';

import api from '../api';
import i18n from '../lib/i18n';
import modal from '../lib/modal';
import Space from '../components/Space';

import Header from './Header';
import Sidebar from './Sidebar';
import Workspace from './Workspace';
import Printing from './Printing';
import Laser from './Laser';
import Cnc from './Cnc';
import Settings from './Settings';
import CaseLibrary from './CaseLibrary';
import styles from './App.styl';
// import recoverEnvironmentModal from '../modals/modal-recover-environment';
import { HEAD_CNC, HEAD_LASER, HEAD_3DP, HEAD_TYPE_ENV_NAME } from '../constants';

import UniApi from '../lib/uni-api';

function getCurrentHeadType(pathname) {
    let headType = null;
    if (pathname.indexOf(HEAD_CNC) >= 0) headType = HEAD_CNC;
    if (pathname.indexOf(HEAD_LASER) >= 0) headType = HEAD_LASER;
    if (pathname.indexOf(HEAD_3DP) >= 0) headType = HEAD_3DP;
    return headType;
}

class App extends PureComponent {
    static propTypes = {
        ...withRouter.propTypes,

        machineInfo: PropTypes.object.isRequired,

        setShouldShowCncWarning: PropTypes.func.isRequired,
        machineInit: PropTypes.func.isRequired,
        developToolsInit: PropTypes.func.isRequired,
        keyboardShortcutInit: PropTypes.func.isRequired,
        functionsInit: PropTypes.func.isRequired,
        workspaceInit: PropTypes.func.isRequired,
        laserInit: PropTypes.func.isRequired,
        cncInit: PropTypes.func.isRequired,
        printingInit: PropTypes.func.isRequired,
        textInit: PropTypes.func.isRequired,
        initRecoverService: PropTypes.func.isRequired,
        projectState: PropTypes.object.isRequired,
        onRecovery: PropTypes.func.isRequired,
        quitRecovery: PropTypes.func.isRequired,
        saveAsFile: PropTypes.func.isRequired,
        openProject: PropTypes.func.isRequired,
        updateIsDownloading: PropTypes.func.isRequired,
        updateAutoupdateMessage: PropTypes.func.isRequired,
        shouldCheckForUpdate: PropTypes.bool.isRequired
    };

    fileInput = React.createRef();

    state = {
        platform: 'unknown',
        recoveringProject: false
    };

    actions = {
        onChangeShouldShowWarning: (event) => {
            this.props.setShouldShowCncWarning(!event.target.checked);
            // this.setState({ shouldShowCncWarning: !event.target.checked });
        },
        saveAsFile: () => {
            const headType = getCurrentHeadType(this.props.location.pathname);
            if (!headType) {
                return;
            }
            this.props.saveAsFile(headType);
        },
        save: async () => {
            const headType = getCurrentHeadType(this.props.location.pathname);
            if (!headType) {
                return;
            }
            await this.props.save(headType);
        },
        saveAll: async () => {
            const currentHeadType = getCurrentHeadType(this.props.location.pathname);
            let message = i18n._('Do you want to save the changes in the {{headType}} editor?', { headType: HEAD_TYPE_ENV_NAME[currentHeadType] });
            if (currentHeadType) {
                await this.props.save(currentHeadType, { message });
            }
            const AllType = [HEAD_3DP, HEAD_CNC, HEAD_LASER];
            const index = AllType.indexOf(currentHeadType);
            if (index !== -1) {
                AllType.splice(index, 1);
            }
            for (const headType of AllType) {
                if (!this.props.projectState[headType].unSaved) continue;
                message = i18n._('Do you want to save the changes in the {{headType}} editor?', { headType: HEAD_TYPE_ENV_NAME[headType] });
                this.props.history.push(`/${headType}`);
                await new Promise((resolve) => {
                    setTimeout(() => {
                        resolve(this.props.save(headType, { message }));
                    }, 100);
                });
            }
        },
        closeFile: async () => {
            const currentHeadType = getCurrentHeadType(this.props.location.pathname);
            const message = i18n._('Do you want to save the changes in the {{headType}} editor?', { headType: HEAD_TYPE_ENV_NAME[currentHeadType] });
            if (currentHeadType) {
                await this.props.saveAndClose(currentHeadType, { message });
            }
        },
        openProject: (file) => {
            if (!file) {
                this.fileInput.current.value = null;
                this.fileInput.current.click();
            } else {
                try {
                    this.props.openProject(file, this.props.history);
                } catch (e) {
                    console.log(e.message);
                }
            }
        },
        initFileOpen: () => {
            UniApi.File.openProjectFile();
        },
        initUniEvent: () => {
            UniApi.Event.on('message', (event, message) => {
                this.props.updateAutoupdateMessage(message);
            });
            UniApi.Event.on('download-has-started', () => {
                this.props.updateIsDownloading(true);
            });
            UniApi.Event.on('update-available', (event, downloadInfo, oldVersionn) => {
                UniApi.Update.downloadUpdate(downloadInfo, oldVersionn);
            });
            UniApi.Event.on('is-replacing-app-now', (event, downloadInfo) => {
                UniApi.Update.isReplacingAppNow(downloadInfo);
                this.props.updateIsDownloading(false);
            });
            UniApi.Event.on('open-file', (event, file) => {
                this.actions.openProject(file);
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
        }

    };

    componentDidMount() {
        // disable select text on document
        document.onselectstart = () => {
            return false;
        };

        const { history } = this.props;
        const actions = this.actions;

        history.listen(location => {
            this.logPageView();

            // show warning when open CNC tab for the first time
            if (this.props.machineInfo.shouldShowCncWarning && location.pathname === '/cnc') {
                modal({
                    title: i18n._('Warning'),
                    body: (
                        <div>
                            {i18n._('This is an alpha feature that helps you get started with CNC Carving. Make sure you')}
                            <Space width={4} />
                            <a
                                style={{ color: '#28a7e1' }}
                                href="https://manual.snapmaker.com/cnc_carving/read_this_first_-_safety_information.html"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {i18n._('Read This First - Safety Information')}
                            </a>
                            <Space width={4} />
                            {i18n._('before any further instructions.')}

                        </div>
                    ),
                    footer: (
                        <div style={{ display: 'inline-block', marginRight: '8px' }}>
                            <input
                                id="footer-input"
                                type="checkbox"
                                defaultChecked={false}
                                onChange={actions.onChangeShouldShowWarning}
                            />
                            {/* eslint-disable-next-line jsx-a11y/label-has-for */}
                            <label id="footer-input-label" htmlFor="footer-input" style={{ paddingLeft: '4px' }}>{i18n._('Don\'t show again')}</label>

                        </div>
                    )
                });
            }
        });

        // get platform
        api.utils.getPlatform().then(res => {
            const { platform } = res.body;
            this.setState({ platform: platform });
        });

        // init machine module
        this.props.machineInit();
        this.props.developToolsInit();
        // init keyboard shortcut
        this.props.keyboardShortcutInit();

        this.props.functionsInit();
        this.props.workspaceInit();
        this.props.laserInit();
        this.props.cncInit();
        this.props.printingInit();
        this.props.textInit();
        this.props.initRecoverService();

        UniApi.Window.initWindow();
        this.actions.initUniEvent();
        this.actions.initFileOpen();
        // auto update
        setTimeout(() => {
            if (this.props.shouldCheckForUpdate) {
                UniApi.Update.checkForUpdate();
            }
        }, 200);
    }

    componentWillReceiveProps(nextProps) {
        const headType = getCurrentHeadType(nextProps.location.pathname);

        if (nextProps.location.pathname !== this.props.location.pathname) {
            UniApi.Menu.setItemEnabled('save-as', !!headType);
            UniApi.Menu.setItemEnabled('save', !!headType);
        }

        if (includes([HEAD_3DP, HEAD_LASER, HEAD_CNC], headType)) {
            const { findLastEnvironment, openedFile } = nextProps.projectState[headType];
            UniApi.Window.setOpenedFile(openedFile ? openedFile.name : undefined);

            if (findLastEnvironment) {
                if (!this.state.recoveringProject) {
                    this.setState({ recoveringProject: true });
                    this.props.onRecovery(headType);
                }
            } else if (this.state.recoveringProject) {
                this.setState({ recoveringProject: false });
            }
        }
    }

    logPageView() {
        const path = window.location.pathname + window.location.search + window.location.hash;
        ReactGA.set({ page: path });
        ReactGA.pageview(path);
    }

    render() {
        const { location } = this.props;
        const accepted = ([
            '/workspace',
            '/3dp',
            '/laser',
            '/cnc',
            '/settings',
            '/developTools',
            '/caselibrary',
            '/settings/general',
            '/settings/machine',
            '/settings/config',
            '/settings/firmware'
        ].indexOf(location.pathname) >= 0);

        if (!accepted) {
            return (
                <Redirect
                    to={{
                        pathname: '/3dp',
                        state: {
                            from: location
                        }
                    }}
                />
            );
        }

        return (
            <div>
                <Header {...this.props} />
                <Sidebar {...this.props} platform={this.state.platform} />
                <div className={styles.main}>
                    <div className={styles.content}>
                        <Workspace
                            {...this.props}
                            style={{
                                display: (location.pathname !== '/workspace') ? 'none' : 'block'
                            }}
                        />

                        {(this.state.platform !== 'unknown' && this.state.platform !== 'win32') && (
                            <Printing
                                {...this.props}
                                hidden={location.pathname !== '/3dp'}
                            />
                        )}

                        <Laser
                            {...this.props}
                            style={{
                                display: (location.pathname !== '/laser') ? 'none' : 'block'
                            }}
                        />

                        <Cnc
                            {...this.props}
                            style={{
                                display: (location.pathname !== '/cnc') ? 'none' : 'block'
                            }}
                        />

                        {location.pathname.indexOf('/settings') === 0 && (
                            <Settings {...this.props} />
                        )}

                        {location.pathname.indexOf('/caselibrary') === 0 && (
                            <CaseLibrary {...this.props} />
                        )}
                    </div>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machineInfo = state.machine;
    const { shouldCheckForUpdate } = machineInfo;

    const projectState = state.project;
    return {
        machineInfo,
        shouldCheckForUpdate,
        projectState
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        machineInit: () => dispatch(machineActions.init()),
        updateAutoupdateMessage: (message) => dispatch(machineActions.updateAutoupdateMessage(message)),
        updateIsDownloading: (isDownloading) => dispatch(machineActions.updateIsDownloading(isDownloading)),
        developToolsInit: () => dispatch(developToolsActions.init()),
        keyboardShortcutInit: () => dispatch(keyboardShortcutActions.init()),
        workspaceInit: () => dispatch(workspaceActions.init()),
        laserInit: () => dispatch(laserActions.init()),
        cncInit: () => dispatch(cncActions.init()),
        printingInit: () => dispatch(printingActions.init()),
        textInit: () => dispatch(textActions.init()),
        initRecoverService: () => dispatch(projectActions.initRecoverService()),
        setShouldShowCncWarning: (value) => {
            dispatch(machineActions.setShouldShowCncWarning(value));
        },
        functionsInit: () => {
            dispatch(editorActions.initSelectedModelListener('laser'));
            dispatch(editorActions.initSelectedModelListener('cnc'));
        },
        onRecovery: (headType) => dispatch(projectActions.onRecovery(headType)),
        quitRecovery: (headType) => dispatch(projectActions.quitRecovery(headType)),
        saveAsFile: (headType) => dispatch(projectActions.saveAsFile(headType)),
        save: (headType, dialogOptions) => dispatch(projectActions.save(headType, dialogOptions)),
        saveAndClose: (headType, opts) => dispatch(projectActions.saveAndClose(headType, opts)),
        openProject: (headType, history) => dispatch(projectActions.open(headType, history))
    };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(App));
