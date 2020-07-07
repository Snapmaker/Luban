import React, { PureComponent } from 'react';
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

import api from '../api';
import i18n from '../lib/i18n';
import modal from '../lib/modal';
import Space from '../components/Space';
import Header from './Header';
import Sidebar from './Sidebar';
import styles from './App.styl';
import loadable from '../lib/loadable';
// const Printing = loadable(() => import('./Printing'));
// const Laser = loadable(() => import('./Laser'));
// const Cnc = loadable(() => import('./Cnc'));
import Printing from './Printing';
import Laser from './Laser';
import Cnc from './Cnc';

import recoverEnvironmentModal from '../modals/modal-recover-environment';
import { HEAD_CNC, HEAD_LASER, HEAD_3DP } from '../constants';

const Workspace = loadable(() => import('./Workspace'));
const Settings = loadable(() => import('./Settings'));
const CaseLibrary = loadable(() => import('./CaseLibrary'));

class App extends PureComponent {
    static propTypes = {
        ...withRouter.propTypes,

        machineInfo: PropTypes.object.isRequired,

        machineInit: PropTypes.func.isRequired,
        developToolsInit: PropTypes.func.isRequired,
        keyboardShortcutInit: PropTypes.func.isRequired,
        functionsInit: PropTypes.func.isRequired,
        initModelsPreviewChecker: PropTypes.func.isRequired,
        workspaceInit: PropTypes.func.isRequired,
        laserInit: PropTypes.func.isRequired,
        cncInit: PropTypes.func.isRequired,
        printingInit: PropTypes.func.isRequired,
        textInit: PropTypes.func.isRequired,
        initRecoverService: PropTypes.func.isRequired,
        editorState: PropTypes.object.isRequired,
        onRecovery: PropTypes.func.isRequired,
        quitRecovery: PropTypes.func.isRequired
    };

    state = {
        platform: 'unknown',
        shouldShowCncWarning: true
    };

    actions = {
        onChangeShouldShowWarning: (event) => {
            this.setState({ shouldShowCncWarning: !event.target.checked });
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
            if (this.state.shouldShowCncWarning && location.pathname === '/cnc') {
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
                                type="checkbox"
                                defaultChecked={false}
                                onChange={actions.onChangeShouldShowWarning}
                            />
                            <span style={{ paddingLeft: '4px' }}>{i18n._('Don\'t show again in current session')}</span>
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
        this.props.initModelsPreviewChecker();
        this.props.workspaceInit();
        this.props.laserInit();
        this.props.cncInit();
        this.props.printingInit();
        this.props.textInit();
        this.props.initRecoverService();
    }

    componentWillReceiveProps(nextProps) {
        let headType = null;

        if (nextProps.location.pathname !== this.props.location.pathname) {
            if (nextProps.location.pathname.indexOf(HEAD_CNC) > 0) headType = HEAD_CNC;
            if (nextProps.location.pathname.indexOf(HEAD_LASER) > 0) headType = HEAD_LASER;
            if (nextProps.location.pathname.indexOf(HEAD_3DP) > 0) headType = HEAD_3DP;
            if (!headType) return;

            const { findLastEnviroment, recovered } = nextProps.editorState[headType];
            if (findLastEnviroment && !recovered) {
                recoverEnvironmentModal({ onRecovery: () => this.props.onRecovery(headType), quitRecovery: () => this.props.quitRecovery(headType) });
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
            '/settings/config'
        ].indexOf(location.pathname) >= 0);

        if (!accepted) {
            return (
                <Redirect
                    to={{
                        pathname: '/workspace',
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
    const editorState = state.editor;
    return {
        machineInfo,
        editorState
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        machineInit: () => dispatch(machineActions.init()),
        developToolsInit: () => dispatch(developToolsActions.init()),
        keyboardShortcutInit: () => dispatch(keyboardShortcutActions.init()),
        workspaceInit: () => dispatch(workspaceActions.init()),
        laserInit: () => dispatch(laserActions.init()),
        cncInit: () => dispatch(cncActions.init()),
        printingInit: () => dispatch(printingActions.init()),
        textInit: () => dispatch(textActions.init()),
        initRecoverService: () => dispatch(editorActions.initRecoverService()),
        functionsInit: () => {
            dispatch(editorActions.initSelectedModelListener('laser'));
            dispatch(editorActions.initSelectedModelListener('cnc'));
        },
        initModelsPreviewChecker: () => {
            dispatch(editorActions.initModelsPreviewChecker('laser'));
            dispatch(editorActions.initModelsPreviewChecker('cnc'));
        },
        onRecovery: (headType) => dispatch(editorActions.onRecovery(headType)),
        quitRecovery: (headType) => dispatch(editorActions.quitRecovery(headType))
    };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(App));
