import React, { PureComponent } from 'react';
import { Redirect, withRouter } from 'react-router-dom';
import modal from '../lib/modal';
import Header from './Header';
import Sidebar from './Sidebar';
import Workspace from './Workspace';
import ThreeDPrinting from './ThreeDPrinting';
import Laser from './Laser';
import Cnc from './Cnc';
import Settings from './Settings';
/* eslint-disable no-unused-vars */
import Print3D from './Print3D';
/* eslint-enable */
import styles from './App.styl';


class App extends PureComponent {
    static propTypes = {
        ...withRouter.propTypes
    };

    state = {
        shouldShowCncWarning: true
    };

    actions = {
        onChangeShouldShowWarning: (event) => {
            this.setState({ shouldShowCncWarning: !event.target.checked });
        }
    };

    componentDidMount() {
        const { history } = this.props;
        const actions = this.actions;

        history.listen(location => {
            // show warning when open CNC tab for the first time
            if (this.state.shouldShowCncWarning && location.pathname === '/cnc') {
                modal({
                    title: 'Warning',
                    body: (
                        <div>
                            This is an alpha feature that helps you get started with CNC Carving. Make sure
                            you
                            <a
                                href="https://manual.snapmaker.com/cnc_carving/read_this_first_-_safety_information.html"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                            Read This First - Safety Information
                            </a>
                            {' before any further instructions.'}
                        </div>
                    ),
                    footer: (
                        <div style={{ display: 'inline-block', marginRight: '8px' }}>
                            <input
                                type="checkbox"
                                defaultChecked={false}
                                onChange={actions.onChangeShouldShowWarning}
                            />
                            <span>{' Don\'t show again in current session'}</span>
                        </div>
                    )
                });
            }
        });
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
            '/settings/workspace',
            '/settings/account',
            '/settings/commands',
            '/settings/events',
            '/settings/about',
            '/print3D'
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
                <Sidebar {...this.props} />
                <div className={styles.main}>
                    <div className={styles.content}>
                        <Workspace
                            {...this.props}
                            style={{
                                display: (location.pathname !== '/workspace') ? 'none' : 'block'
                            }}
                        />

                        <ThreeDPrinting
                            {...this.props}
                            hidden={location.pathname !== '/3dp'}
                        />

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

export default withRouter(App);
