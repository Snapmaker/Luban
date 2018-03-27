import React, { Component } from 'react';
import shallowCompare from 'react-addons-shallow-compare';
import { Redirect, withRouter } from 'react-router-dom';
import modal from '../lib/modal';
import Header from './Header';
import Sidebar from './Sidebar';
import Workspace from './Workspace';
import Laser from './Laser';
import Cnc from './Cnc';
import Settings from './Settings';
import styles from './App.styl';


class App extends Component {
    static propTypes = {
        ...withRouter.propTypes
    };

    state = {
        showCncWarning: false
    };

    shouldComponentUpdate(nextProps, nextState) {
        return shallowCompare(this, nextProps, nextState);
    }

    componentDidMount() {
        const { history } = this.props;

        history.listen(location => {
            if (!this.state.showCncWarning && location.pathname === '/cnc') {
                this.setState({ showCncWarning: true });
                modal({
                    title: 'Warning',
                    body: (
                        <div>
                            <div>
                                This is an alpha feature that helps you get started with CNC Engraving. Make sure
                                you <a href="https://manual.snapmaker.com/cnc_carving/read_this_first_-_safety_information.html" target="_blank" rel="noopener noreferrer">
                                Read This First - Safety Information</a>
                                {' before any further instructions.'}
                            </div>
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
            '/laser',
            '/cnc',
            '/settings',
            '/settings/general',
            '/settings/workspace',
            '/settings/account',
            '/settings/commands',
            '/settings/events',
            '/settings/about'
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
                <aside className={styles.sidebar} id="sidebar">
                    <Sidebar {...this.props} />
                </aside>
                <div className={styles.main}>
                    <div className={styles.content}>
                        <Workspace
                            {...this.props}
                            style={{
                                display: (location.pathname !== '/workspace') ? 'none' : 'block'
                            }}
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
