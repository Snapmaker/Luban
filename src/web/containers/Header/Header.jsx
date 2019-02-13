import classNames from 'classnames';
import React, { PureComponent, memo } from 'react';
import { Nav, Navbar, NavDropdown, MenuItem, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { withRouter } from 'react-router-dom';
import semver from 'semver';
import without from 'lodash/without';
import Push from 'push.js';
import api from '../../api';
import Anchor from '../../components/Anchor';
import settings from '../../config/settings';
import combokeys from '../../lib/combokeys';
import controller from '../../lib/controller';
import i18n from '../../lib/i18n';
import QuickAccessToolbar from './QuickAccessToolbar';
import styles from './styles.styl';

const Logo = memo(() => (
    <Anchor
        className="navbar-brand"
        href="/#/workspace"
        title={`${settings.name} ${settings.version}`}
        style={{ position: 'relative' }}
    >
        <img
            src="images/snapmaker-logo.png"
            role="presentation"
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
        requestPushPermission: () => {
            const onGranted = () => {
                this.setState({ pushPermission: Push.Permission.GRANTED });
            };
            const onDenied = () => {
                this.setState({ pushPermission: Push.Permission.DENIED });
            };
            // Note that if "Permission.DEFAULT" is returned, no callback is executed
            const permission = Push.Permission.request(onGranted, onDenied);
            if (permission === Push.Permission.DEFAULT) {
                this.setState({ pushPermission: Push.Permission.DEFAULT });
            }
        },
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
        },
        fetchCommands: async () => {
            try {
                const res = await api.commands.fetch({ paging: false });
                const { records: commands } = res.body;

                this._isMounted && this.setState({
                    commands: commands.filter(command => command.enabled)
                });
            } catch (res) {
                // Ignore error
            }
        },
        runCommand: async (cmd) => {
            try {
                const res = await api.commands.run(cmd.id);
                const { taskId } = res.body;

                this.setState({
                    commands: this.state.commands.map(c => {
                        return (c.id === cmd.id) ? { ...c, taskId: taskId, err: null } : c;
                    })
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
    controllerEvents = {
        'config:change': () => {
            this.actions.fetchCommands();
        },
        'task:start': (taskId) => {
            this.setState({
                runningTasks: this.state.runningTasks.concat(taskId)
            });
        },
        'task:finish': (taskId, code) => {
            const err = (code !== 0) ? new Error(`errno=${code}`) : null;
            let cmd = null;

            this.setState({
                commands: this.state.commands.map(c => {
                    if (c.taskId !== taskId) {
                        return c;
                    }
                    cmd = c;
                    return {
                        ...c,
                        taskId: null,
                        err: err
                    };
                }),
                runningTasks: without(this.state.runningTasks, taskId)
            });

            if (cmd && this.state.pushPermission === Push.Permission.GRANTED) {
                Push.create(cmd.title, {
                    body: code === 0
                        ? i18n._('Command succeeded')
                        : i18n._('Command failed ({{err}})', { err: err }),
                    icon: 'images/snap-logo-badge-32x32.png',
                    timeout: 10 * 1000,
                    onClick: function () {
                        window.focus();
                        this.close();
                    }
                });
            }
        },
        'task:error': (taskId, err) => {
            let cmd = null;

            this.setState({
                commands: this.state.commands.map(c => {
                    if (c.taskId !== taskId) {
                        return c;
                    }
                    cmd = c;
                    return {
                        ...c,
                        taskId: null,
                        err: err
                    };
                }),
                runningTasks: without(this.state.runningTasks, taskId)
            });

            if (cmd && this.state.pushPermission === Push.Permission.GRANTED) {
                Push.create(cmd.title, {
                    body: i18n._('Command failed ({{err}})', { err: err }),
                    icon: 'images/snap-logo-badge-32x32.png',
                    timeout: 10 * 1000,
                    onClick: function () {
                        window.focus();
                        this.close();
                    }
                });
            }
        },
        'workflow:state': (workflowState) => {
            this.setState({ workflowState: workflowState });
        }
    };
    _isMounted = false;

    getInitialState() {
        let pushPermission = '';
        try {
            // Push.Permission.get() will throw an error if Push is not supported on this device
            pushPermission = Push.Permission.get();
        } catch (e) {
            // Ignore
        }

        return {
            workflowState: controller.workflowState,
            pushPermission: pushPermission,
            commands: [],
            runningTasks: [],
            currentVersion: settings.version,
            latestVersion: settings.version
        };
    }

    componentDidMount() {
        this._isMounted = true;

        this.addActionHandlers();
        this.addControllerEvents();

        // Initial actions
        this.actions.checkForUpdates();
        this.actions.fetchCommands();
    }

    componentWillUnmount() {
        this._isMounted = false;

        this.removeActionHandlers();
        this.removeControllerEvents();

        this.runningTasks = [];
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

    addControllerEvents() {
        Object.keys(this.controllerEvents)
            .forEach(eventName => {
                const callback = this.controllerEvents[eventName];
                controller.on(eventName, callback);
            });
    }

    removeControllerEvents() {
        Object.keys(this.controllerEvents)
            .forEach(eventName => {
                const callback = this.controllerEvents[eventName];
                controller.off(eventName, callback);
            });
    }

    render() {
        const { pushPermission, commands, runningTasks, currentVersion, latestVersion } = this.state;
        const newUpdateAvailable = semver.lt(currentVersion, latestVersion);


        const showCommands = commands.length > 0;

        return (
            <Navbar
                fixedTop
                fluid
                className={styles.navbar}
            >
                <Navbar.Header>
                    {newUpdateAvailable &&
                    <OverlayTrigger placement="right" defaultShow={true} overlay={<UpdateTooltip />}>
                        <Logo />
                    </OverlayTrigger>
                    }
                    {!newUpdateAvailable && <Logo />}
                    <Navbar.Toggle />
                </Navbar.Header>
                <Navbar.Collapse>
                    <Nav pullRight>
                        <NavDropdown
                            id="nav-dropdown-menu"
                            title={
                                <div title={i18n._('Options')}>
                                    <i className="fa fa-fw fa-ellipsis-v" />
                                    {this.state.runningTasks.length > 0 &&
                                    <span
                                        className="label label-primary"
                                        style={{
                                            position: 'absolute',
                                            top: 4,
                                            right: 4
                                        }}
                                    >
                                        N
                                    </span>
                                    }
                                </div>
                            }
                            noCaret
                        >
                            {showCommands &&
                            <MenuItem header>
                                {i18n._('Command')}
                                {pushPermission === Push.Permission.GRANTED &&
                                <span className="pull-right">
                                    <i className="fa fa-fw fa-bell-o" />
                                </span>
                                }
                                {pushPermission === Push.Permission.DENIED &&
                                <span className="pull-right">
                                    <i className="fa fa-fw fa-bell-slash-o" />
                                </span>
                                }
                                {pushPermission === Push.Permission.DEFAULT &&
                                <span className="pull-right">
                                    <Anchor
                                        className={styles.btnIcon}
                                        onClick={this.actions.requestPushPermission}
                                        title={i18n._('Show notifications')}
                                    >
                                        <i className="fa fa-fw fa-bell" />
                                    </Anchor>
                                </span>
                                }
                            </MenuItem>
                            }
                            {showCommands && commands.map((cmd) => {
                                const isTaskRunning = runningTasks.indexOf(cmd.taskId) >= 0;

                                return (
                                    <MenuItem
                                        key={cmd.id}
                                        disabled={cmd.disabled}
                                        onSelect={() => {
                                            this.actions.runCommand(cmd);
                                        }}
                                    >
                                        <span title={cmd.command}>{cmd.title || cmd.command}</span>
                                        <span className="pull-right">
                                            <i
                                                className={classNames(
                                                    'fa',
                                                    'fa-fw',
                                                    { 'fa-circle-o-notch': isTaskRunning },
                                                    { 'fa-spin': isTaskRunning },
                                                    { 'fa-exclamation-circle': cmd.err },
                                                    { 'text-error': cmd.err }
                                                )}
                                                title={cmd.err}
                                            />
                                        </span>
                                    </MenuItem>
                                );
                            })}
                            {showCommands &&
                            <MenuItem divider />
                            }
                            <MenuItem
                                href="https://store.snapmaker.com"
                                target="_blank"
                            >
                                {i18n._('Store')}
                            </MenuItem>
                            <MenuItem
                                href="https://snapmaker.com/download"
                                target="_blank"
                            >
                                {i18n._('Downloads')}
                            </MenuItem>
                        </NavDropdown>
                    </Nav>
                    <QuickAccessToolbar state={this.state} actions={this.actions} />
                </Navbar.Collapse>
            </Navbar>
        );
    }
}

export default withRouter(Header);
