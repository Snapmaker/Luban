/* eslint-disable */
import React, { PureComponent, memo } from 'react';
import { Nav, Navbar, NavDropdown, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { withRouter } from 'react-router-dom';
import semver from 'semver';
import api from '../../api';
import Anchor from '../../components/Anchor';
import settings from '../../config/settings';
import combokeys from '../../lib/combokeys';
import { controller } from '../../lib/controller';
import i18n from '../../lib/i18n';
import QuickAccessToolbar from './QuickAccessToolbar';
import MachineSelection from './MachineSelection';
import styles from './styles.styl';
import PageControl from './PageControl';

const Logo = memo(() => (
    <Anchor
        className="navbar-brand"
        // href="/#/workspace"
        href="/#/homepage"
        title={`${settings.name} ${settings.version}`}
        style={{ position: 'relative' }}
    >
        <img
            src="images/snapmaker-logo.png"
            role="presentation"
            draggable='false'
            alt="snapmaker logo"
            style={{ margin: '-5px auto auto 3px' }}
        />
    </Anchor>
));

const UpdateTooltip = memo(() => (
    <Tooltip
        id="navbarBrandTooltip"
        style={{ color: '#fff' }}
    >
        <div>{i18n._('New Update Available')}</div>
    </Tooltip>
));


class Header extends PureComponent {
    static propTypes = {
        ...withRouter.propTypes
    };

    state = this.getInitialState();

    actions = {
        checkForUpdates: async () => {
            try {
                const res = await api.getLatestVersion();
                const versions = res.body;

                this._isMounted && this.setState({
                    latestVersion: versions.snapjs
                });
            } catch (res) {
                // Ignore error
            }
        }
    };

    actionHandlers = {
        CONTROLLER_COMMAND: (event, { command }) => {
            // feedhold, cyclestart, homing, unlock, reset
            controller.command(command);
        }
    };

    _isMounted = false;

    getInitialState() {
        return {
            workflowState: controller.workflowState,
            currentVersion: settings.version,
            latestVersion: settings.version
        };
    }

    componentDidMount() {
        this._isMounted = true;

        this.addActionHandlers();

        // Initial actions
        this.actions.checkForUpdates();
    }

    componentWillUnmount() {
        this._isMounted = false;

        this.removeActionHandlers();
    }

    addActionHandlers() {
        Object.keys(this.actionHandlers)
            .forEach(eventName => {
                const callback = this.actionHandlers[eventName];
                combokeys.on(eventName, callback);
            });
    }

    removeActionHandlers() {
        Object.keys(this.actionHandlers)
            .forEach(eventName => {
                const callback = this.actionHandlers[eventName];
                combokeys.removeListener(eventName, callback);
            });
    }

    render() {
        const { currentVersion, latestVersion } = this.state;
        const newUpdateAvailable = semver.lt(currentVersion, latestVersion);

        return (
            <Navbar bg="light" expand="lg" fixed="top" className={styles['lu-navbar']}>
                <Navbar.Brand>
                    {newUpdateAvailable && (
                        <OverlayTrigger placement="right" defaultShow overlay={<UpdateTooltip />}>
                            <Logo />
                        </OverlayTrigger>
                    )}
                    {!newUpdateAvailable && <Logo />}
                </Navbar.Brand>
                <Navbar.Toggle aria-controls="lu-header" />
                <Navbar.Collapse id="lu-header" className={styles['lu-nav']}>
                    <PageControl {...this.props} />
                    <Nav className="mr-auto">
                        <MachineSelection />
                    </Nav>
                    <Nav className="justify-content-end">
                        <QuickAccessToolbar state={this.state} actions={this.actions} />
                        <NavDropdown title={i18n._('More')} alignRight draggable="false">
                            <NavDropdown.Item
                                href="https://store.snapmaker.com"
                                target="_blank"
                                draggable="false"
                            >
                                {i18n._('Store')}
                            </NavDropdown.Item>
                            <NavDropdown.Item
                                href="https://snapmaker.com/download"
                                target="_blank"
                                draggable="false"
                            >
                                {i18n._('Downloads')}
                            </NavDropdown.Item>
                        </NavDropdown>
                        <Nav.Item>
                            <Nav.Link href="https://www.myminifactory.com"
                                draggable="false"
                                target="_blank" rel="noopener noreferrer">
                                <img
                                    width="20"
                                    height="20"
                                    draggable="false"
                                    src="/images/myminifactory-logo-64x64.png"
                                    alt="Go to MyMiniFactory to find printable objects."
                                />
                            </Nav.Link>
                        </Nav.Item>
                    </Nav>
                </Navbar.Collapse>
            </Navbar>
        );
    }
}

export default withRouter(Header);
