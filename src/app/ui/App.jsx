import React, { PureComponent } from 'react';
// import includes from 'lodash/includes';
import PropTypes from 'prop-types';
import { HashRouter, Route, withRouter, Switch, Prompt } from 'react-router-dom';
import { connect } from 'react-redux';
import ReactGA from 'react-ga';
// import { Trans } from 'react-i18next';
import { /* shortcutActions, */ priorities, ShortcutManager } from '../lib/shortcut';
import { ToastContainer } from './components/Toast';

import { actions as machineActions } from '../flux/machine';
import { actions as developToolsActions } from '../flux/develop-tools';
import { actions as laserActions } from '../flux/laser';
import { actions as editorActions } from '../flux/editor';
import { actions as cncActions } from '../flux/cnc';
import { actions as printingActions } from '../flux/printing';
import { actions as workspaceActions } from '../flux/workspace';
import { actions as textActions } from '../flux/text';
import { actions as projectActions } from '../flux/project';
import { actions as settingActions } from '../flux/setting';


import i18n from '../lib/i18n';

import HomePage from './Pages/HomePage';
import Workspace from './Pages/Workspace';
import Printing from './Pages/Printing';
import Cnc from './Pages/Cnc';
import Laser from './Pages/Laser';

import Settings from './Pages/Settings';
// import CaseLibrary from './CaseLibrary';
// import styles from './App.styl';
// import Space from '../components/Space';

import { HEAD_3DP, HEAD_CNC, HEAD_LASER, HEAD_TYPE_ENV_NAME } from '../constants';

import UniApi from '../lib/uni-api';
import AppLayout from './Layouts/AppLayout';


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

        // machineInfo: PropTypes.object.isRequired,

        setShouldShowCncWarning: PropTypes.func.isRequired,
        machineInit: PropTypes.func.isRequired,
        developToolsInit: PropTypes.func.isRequired,
        functionsInit: PropTypes.func.isRequired,
        workspaceInit: PropTypes.func.isRequired,
        // laserInit: PropTypes.func.isRequired,
        // cncInit: PropTypes.func.isRequired,
        // printingInit: PropTypes.func.isRequired,
        textInit: PropTypes.func.isRequired,
        initRecoverService: PropTypes.func.isRequired,
        // projectState: PropTypes.object.isRequired,
        // onRecovery: PropTypes.func.isRequired,
        // quitRecovery: PropTypes.func.isRequired,
        saveAsFile: PropTypes.func.isRequired,
        saveAndClose: PropTypes.func.isRequired,
        openProject: PropTypes.func.isRequired,
        updateIsDownloading: PropTypes.func.isRequired,
        updateAutoupdateMessage: PropTypes.func.isRequired,
        updateShouldCheckForUpdate: PropTypes.func.isRequired,
        shouldCheckForUpdate: PropTypes.bool.isRequired
        // resetAllUserSettings: PropTypes.func.isRequired
    };

    fileInput = React.createRef();

    router = React.createRef();

    // state = {
    //     platform: 'unknown',
    //     recoveringProject: false
    // };

    shortcutHandler = {
        title: this.constructor.name,
        isActive: () => true,
        // active: false,
        priority: priorities.APP,
        shortcuts: {
            // TODO: implement file menu actions
            // [shortcutActions.OPEN]: () => { console.log('app.open'); },
            'LISTALLSHORTCUTS': {
                keys: ['mod+alt+k l'],
                callback: () => {
                    ShortcutManager.printList();
                }
            }
        }
    };


    actions = {
        handleBlockedNavigation: async (nextLocation) => {
            console.log('location', nextLocation, window.location);
            // if (!confirmedNavigation && shouldBlockNavigation(nextLocation)) {
            await this.actions.saveNew();
            console.log('after location');
            return false;
            // }
        },
        onChangeShouldShowWarning: (event) => {
            this.props.setShouldShowCncWarning(!event.target.checked);
            // this.setState({ shouldShowCncWarning: !event.target.checked });
        },
        saveAsFile: () => {
            const headType = getCurrentHeadType(this.router.current.history.location.pathname);
            if (!headType) {
                return;
            }
            this.props.saveAsFile(headType);
        },
        saveNew: async () => {
            const headType = getCurrentHeadType(window.location.hash);
            console.log('save', headType, window.location,);
            if (!headType) {
                return;
            }
            await this.props.save(headType);
        },
        save: async () => {
            const headType = getCurrentHeadType(this.router.current.history.location.pathname);
            if (!headType) {
                return;
            }
            await this.props.save(headType);
        },
        saveAll: async () => {
            // TODO: dont need to save all!
            // const currentHeadType = getCurrentHeadType(this.router.current.history.location.pathname);
            // let message = i18n._('Do you want to save the changes in the {{headType}} editor?', { headType: HEAD_TYPE_ENV_NAME[currentHeadType] });
            // if (currentHeadType) {
            //     await this.props.save(currentHeadType, { message });
            // }
            // const AllType = [HEAD_3DP, HEAD_CNC, HEAD_LASER];
            // const index = AllType.indexOf(currentHeadType);
            // if (index !== -1) {
            //     AllType.splice(index, 1);
            // }
            // for (const headType of AllType) {
            //     if (!this.props.projectState[headType].unSaved) continue;
            //     message = i18n._('Do you want to save the changes in the {{headType}} editor?', { headType: HEAD_TYPE_ENV_NAME[headType] });
            //     this.router.current.history.push(`/${headType}`);
            //     await new Promise((resolve) => {
            //         setTimeout(() => {
            //             resolve(this.props.save(headType, { message }));
            //         }, 100);
            //     });
            // }
        },
        closeFile: async () => {
            const currentHeadType = getCurrentHeadType(this.router.current.history.location.pathname);
            const message = i18n._('Do you want to save the changes in the {{headType}} editor?', { headType: HEAD_TYPE_ENV_NAME[currentHeadType] });
            if (currentHeadType) {
                await this.props.saveAndClose(currentHeadType, { message });
            }
        },
        openProject: async (file) => {
            if (!file) {
                this.fileInput.current.value = null;
                this.fileInput.current.click();
            } else {
                try {
                    await this.props.openProject(file, this.router.current.history);
                } catch (e) {
                    console.log(e.message);
                }
            }
        },
        updateRecentFile: (arr, type) => {
            this.props.updateRecentProject(arr, type);
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
                if (arr.length) {
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
        }
    };

    componentDidMount() {
        // disable select text on document
        document.onselectstart = () => {
            return false;
        };

        // TODO: check these fix code
        // Make fit-addon loading when loading from the workspace for the first time (console widget)
        // if (history.location && history.location.pathname === '/workspace') {
        //     history.push('/workspace');
        // }

        // // get platform
        // api.utils.getPlatform().then(res => {
        //     const { platform } = res.body;
        //     this.setState({ platform: platform });
        // });

        // init machine module
        // TODO: move init to proper page
        this.props.machineInit();
        this.props.developToolsInit();

        this.props.functionsInit();
        this.props.workspaceInit();
        // this.props.laserInit();
        // this.props.cncInit();
        // this.props.printingInit();
        this.props.textInit();

        UniApi.Window.initWindow();
        this.actions.initUniEvent();
        this.actions.initFileOpen();
        // auto update
        setTimeout(() => {
            if (this.props.shouldCheckForUpdate) {
                UniApi.Update.checkForUpdate();
            }
        }, 200);

        ShortcutManager.register(this.shortcutHandler);
    }

    // componentWillReceiveProps(nextProps) {
    // const headType = getCurrentHeadType(nextProps.location.pathname);

    // if (nextProps.location.pathname !== this.router.current.history.location.pathname) {
    //     UniApi.Menu.setItemEnabled('save-as', !!headType);
    //     UniApi.Menu.setItemEnabled('save', !!headType);
    // }

    // if (includes([HEAD_3DP, HEAD_LASER, HEAD_CNC], headType)) {
    //     const { findLastEnvironment, openedFile } = nextProps.projectState[headType];
    //     UniApi.Window.setOpenedFile(openedFile ? openedFile.name : undefined);
    //     const keyRecoveringProject = `recoveringProject-${headType}`;

    //     if (findLastEnvironment) {
    //         if (!this.state[keyRecoveringProject]) {
    //             this.setState({ [keyRecoveringProject]: true });
    //             const popupActions = modal({
    //                 title: i18n._('Resume Job'),
    //                 body: (
    //                     <React.Fragment>
    //                         <p>{i18n._('Do you want to resume previous job?')}</p>
    //                     </React.Fragment>
    //                 ),
    //                 footer: (
    //                     <button
    //                         type="button"
    //                         className="btn sm-btn-default sm-btn-large sm-btn-primary"
    //                         onClick={async () => {
    //                             await this.props.onRecovery(headType);
    //                             popupActions.close();
    //                             this.setState({ [keyRecoveringProject]: false });
    //                         }}
    //                     >
    //                         {i18n._('Yes')}
    //                     </button>
    //                 ),
    //                 onClose: () => {
    //                     this.setState({ [keyRecoveringProject]: false });
    //                     this.props.clearSavedEnvironment(headType);
    //                 }
    //             });
    //         }
    //     } else if (this.state[keyRecoveringProject]) {
    //         this.setState({ [keyRecoveringProject]: false });
    //     }
    // }
    // }

    // componentWillUnmount() {
    //     this.unlisten();
    // }

    logPageView() {
        const path = window.location.pathname + window.location.search + window.location.hash;
        ReactGA.set({ page: path });
        ReactGA.pageview(path);
    }


    render() {
        // const { location } = this.props;
        // const accepted = ([
        //     '/workspace',
        //     '/3dp',
        //     '/laser',
        //     '/cnc',
        //     '/settings',
        //     '/layout',
        //     '/caselibrary',
        //     '/settings/general',
        //     '/settings/machine',
        //     '/settings/config',
        //     '/settings/firmware',
        //     '/'
        // ].indexOf(location.pathname) >= 0);

        // if (!accepted) {
        //     return (
        //         <Redirect
        //             to={{
        //                 pathname: '/',
        //                 state: {
        //                     from: location
        //                 }
        //             }}
        //         />
        //     );
        // }


        return (
            <HashRouter ref={this.router}>
                <AppLayout>
                    <Switch>
                        <Route path="/" exact component={HomePage} />
                        <Route path="/workspace" component={Workspace} />
                        <Route path="/3dp" component={Printing} />
                        <Route path="/laser" component={Laser} />
                        <Route path="/cnc" component={Cnc} />
                        <Route path="/settings" component={Settings} />
                        <Route component={HomePage} />
                    </Switch>
                    <ToastContainer
                        position="top-center"
                        autoClose={5000}
                        hideProgressBar
                        newestOnTop
                        closeOnClick
                        rtl={false}
                        pauseOnFocusLoss
                        draggable
                        pauseOnHover
                    />

                    <Prompt when message={() => 'dddd'} />
                    {/* Your own alert/dialog/modal component */}
                </AppLayout>
            </HashRouter>
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
        updateShouldCheckForUpdate: (shouldAutoUpdate) => dispatch(machineActions.updateShouldCheckForUpdate(shouldAutoUpdate)),
        updateAutoupdateMessage: (message) => dispatch(machineActions.updateAutoupdateMessage(message)),
        updateIsDownloading: (isDownloading) => dispatch(machineActions.updateIsDownloading(isDownloading)),
        developToolsInit: () => dispatch(developToolsActions.init()),
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
        openProject: (file, history) => dispatch(projectActions.open(file, history)),
        updateRecentProject: (arr, type) => dispatch(projectActions.updateRecentFile(arr, type)),
        clearSavedEnvironment: (headType) => dispatch(projectActions.clearSavedEnvironment(headType)),
        resetAllUserSettings: () => dispatch(settingActions.resetAllUserSettings())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(App);
