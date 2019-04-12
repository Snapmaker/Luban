import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Redirect, withRouter } from 'react-router-dom';
import { connect } from 'react-redux';
import ReactGA from 'react-ga';
import { actions as machineActions } from '../reducers/machine';
import { actions as keyboardShortcutActions } from '../reducers/keyboardShortcut';
import { actions as cncLaserSharedActions } from '../reducers/cncLaserShared';
import { actions as laserActions } from '../reducers/laser';
import { actions as cncActions } from '../reducers/cnc';
import { actions as printingActions } from '../reducers/printing';
import { actions as textActions } from '../reducers/text';
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
import styles from './App.styl';


class App extends PureComponent {
    static propTypes = {
        ...withRouter.propTypes,
        machineInit: PropTypes.func.isRequired,
        keyboardShortcutInit: PropTypes.func.isRequired,
        functionsInit: PropTypes.func.isRequired,
        initModelsPreviewChecker: PropTypes.func.isRequired,
        laserInit: PropTypes.func.isRequired,
        cncInit: PropTypes.func.isRequired,
        printingInit: PropTypes.func.isRequired,
        textInit: PropTypes.func.isRequired
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

    logPageView() {
        const path = window.location.pathname + window.location.search + window.location.hash;
        ReactGA.set({ page: path });
        ReactGA.pageview(path);
    }

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
        // init keyboard shortcut
        this.props.keyboardShortcutInit();

        this.props.functionsInit();
        this.props.initModelsPreviewChecker();
        this.props.laserInit();
        this.props.cncInit();
        this.props.printingInit();
        this.props.textInit();
    }

    render() {
        const { location } = this.props;
        const accepted = ([
            '/workspace',
            '/3dp',
            '/laser',
            '/cnc',
            '/settings',
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

                        {this.state.platform !== 'unknown' && (
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

                        {location.pathname.indexOf('/settings') === 0 &&
                            <Settings {...this.props} />
                        }
                    </div>
                </div>
            </div>
        );
    }
}

const mapDispatchToProps = (dispatch) => {
    return {
        machineInit: () => dispatch(machineActions.init()),
        keyboardShortcutInit: () => dispatch(keyboardShortcutActions.init()),
        laserInit: () => dispatch(laserActions.init()),
        cncInit: () => dispatch(cncActions.init()),
        printingInit: () => dispatch(printingActions.init()),
        textInit: () => dispatch(textActions.init()),
        functionsInit: () => {
            dispatch(cncLaserSharedActions.initSelectedModelListener('laser'));
            dispatch(cncLaserSharedActions.initSelectedModelListener('cnc'));
        },
        initModelsPreviewChecker: () => {
            dispatch(cncLaserSharedActions.initModelsPreviewChecker('laser'));
            dispatch(cncLaserSharedActions.initModelsPreviewChecker('cnc'));
        }
    };
};

export default withRouter(connect(null, mapDispatchToProps)(App));
