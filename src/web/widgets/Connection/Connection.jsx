import includes from 'lodash/includes';
import find from 'lodash/find';
import get from 'lodash/get';
import map from 'lodash/map';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Select from 'react-select';
import pubsub from 'pubsub-js';
import Space from '../../components/Space';
import Notifications from '../../components/Notifications';
import log from '../../lib/log';
import i18n from '../../lib/i18n';
import controller from '../../lib/controller';
import api from '../../api';


class Connection extends PureComponent {
    static propTypes = {
        config: PropTypes.object.isRequired
    };

    state = this.getInitialState();

    actions = {
        clearAlert: () => {
            this.setState({
                alertMessage: ''
            });
        },
        onChangePortOption: (option) => {
            this.setState(state => ({
                alertMessage: '',
                port: option.value
            }));
        },
        handleRefreshPorts: (event) => {
            this.refreshPorts();
        },
        handleOpenPort: (event) => {
            const { port, baudrate } = this.state;
            this.openPort(port, { baudrate: baudrate });
        },
        handleClosePort: (event) => {
            const { port } = this.state;
            this.closePort(port);
        }
    };

    getInitialState() {
        const { config } = this.props;

        return {
            // loading available ports
            loading: false,
            // connect to port
            connecting: false,
            connected: false,
            autoReconnect: config.get('autoReconnect'),
            hasReconnected: false,
            alertMessage: '',
            ports: [],
            port: controller.port,
            baudrate: config.get('baudrate')
        };
    }

    renderPortOption = (option) => {
        const { label, inuse, manufacturer } = option;
        const styles = {
            option: {
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden'
            }
        };

        return (
            <div style={styles.option} title={label}>
                <div>
                    {inuse && (
                        <span>
                            <i className="fa fa-lock" />
                            <span className="space" />
                        </span>
                    )}
                    {label}
                </div>
                {manufacturer &&
                <i>{i18n._('Manufacturer: {{manufacturer}}', { manufacturer })}</i>
                }
            </div>
        );
    };

    renderPortValue = (option) => {
        const { label, inuse } = option;
        const canChangePort = !(this.state.loading);
        const style = {
            color: canChangePort ? '#333' : '#ccc',
            textOverflow: 'ellipsis',
            overflow: 'hidden'
        };
        return (
            <div style={style} title={label}>
                {inuse && (
                    <span>
                        <i className="fa fa-lock" />
                        <span className="space" />
                    </span>
                )}
                {label}
            </div>
        );
    };

    controllerEvents = {
        'serialport:list': (ports) => {
            log.debug('Received a list of serial ports:', ports);

            const { config } = this.props;

            this.stopLoadingPorts();

            const port = config.get('port') || '';

            if (includes(map(ports, 'port'), port)) {
                this.setState({
                    alertMessage: '',
                    port: port,
                    ports: ports
                });

                const { autoReconnect, hasReconnected } = this.state;

                if (autoReconnect && !hasReconnected) {
                    const { baudrate } = this.state;

                    this.setState({
                        hasReconnected: true
                    });
                    this.openPort(port, {
                        baudrate: baudrate
                    });
                }
            } else {
                this.setState(state => ({
                    alertMessage: '',
                    ports: ports
                }));
            }
        },
        'serialport:open': (options) => {
            const { port, baudrate, inuse } = options;
            const ports = map(this.state.ports, (o) => {
                if (o.port !== port) {
                    return o;
                }

                o = { ...o, inuse };

                return o;
            });

            this.setState({
                alertMessage: '',
                connecting: false,
                connected: true,
                port: port,
                baudrate: baudrate,
                ports: ports
            });

            log.debug('Connected to \'' + port + '\' at ' + baudrate + '.');
        },
        'serialport:close': (options) => {
            const { port } = options;

            log.debug('Disconnected from \'' + port + '\'.');

            this.setState({
                alertMessage: '',
                connecting: false,
                connected: false
            });

            this.refreshPorts();
        },
        'serialport:error': (options) => {
            const { port } = options;

            this.setState(state => ({
                alertMessage: i18n._('Error opening serial port \'{{- port}}\'', { port: port }),
                connecting: false,
                connected: false
            }));

            log.error('Error opening serial port \'' + port + '\'');
        }
    };

    componentDidMount() {
        this.addControllerEvents();
        this.refreshPorts();
    }

    componentWillUnmount() {
        this.removeControllerEvents();
    }

    componentDidUpdate() {
        const {
            minimized,
            port,
            baudrate,
            autoReconnect
        } = this.state;
        const { config } = this.props;

        config.set('minimized', minimized);
        if (port) {
            config.set('port', port);
        }
        if (baudrate) {
            config.set('baudrate', baudrate);
        }
        config.set('autoReconnect', autoReconnect);
    }

    addControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.on(eventName, callback);
        });
    }

    removeControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.off(eventName, callback);
        });
    }

    startLoadingPorts() {
        this.setState({ loading: true });
        this._loadingTimer = setTimeout(() => {
            this.setState({ loading: false });
        }, 5000);
    }

    stopLoadingPorts() {
        if (this._loadingTimer) {
            clearTimeout(this._loadingTimer);
            this._loadingTimer = null;
        }
        this.setState({ loading: false });
    }

    refreshPorts() {
        this.startLoadingPorts();
        controller.listPorts();
    }

    openPort(port, options) {
        const { baudrate } = options;

        this.setState({
            connecting: true
        });

        controller.openPort(port, { baudrate: baudrate }, (err) => {
            if (err) {
                this.setState({
                    alertMessage: i18n._('Error opening serial port \'{{- port}}\'', { port: port }),
                    connecting: false,
                    connected: false
                });

                log.error(err);
                return;
            }

            let name = '';
            let gcode = '';

            api.controllers.get()
                .then((res) => {
                    let next;
                    const c = find(res.body, { port: port });
                    if (c) {
                        next = api.fetchGCode({ port: port });
                    }
                    return next;
                })
                .then((res) => {
                    name = get(res, 'body.name', '');
                    gcode = get(res, 'body.data', '');
                })
                .catch((res) => {
                    // Empty block
                })
                .then(() => {
                    if (gcode) {
                        pubsub.publish('gcode:render', { name, gcode });
                    }
                });
        });
    }

    closePort(port = this.state.port) {
        this.setState({
            connecting: false,
            connected: false
        });
        controller.closePort(port, (err) => {
            if (err) {
                log.error(err);
                return;
            }

            // Refresh ports
            controller.listPorts();
        });
    }

    render() {
        const {
            loading, connecting, connected,
            ports,
            port,
            alertMessage
        } = this.state;
        const notLoading = !loading;
        const notConnecting = !connecting;
        const canRefresh = notLoading && !connected;
        const canChangePort = notLoading && !connected;
        const canOpenPort = port && notConnecting && !connected;
        const canClosePort = connected;

        return (
            <div>
                {alertMessage && (
                    <Notifications bsStyle="danger" onDismiss={this.actions.clearAlert}>
                        {alertMessage}
                    </Notifications>
                )}
                <div className="form-group">
                    <label className="control-label">{i18n._('Port')}</label>
                    <div className="input-group input-group-sm">
                        <Select
                            backspaceRemoves={false}
                            clearable={false}
                            disabled={!canChangePort}
                            name="port"
                            noResultsText={i18n._('No ports available')}
                            onChange={this.actions.onChangePortOption}
                            optionRenderer={this.renderPortOption}
                            options={map(ports, (o) => ({
                                value: o.port,
                                label: o.port,
                                manufacturer: o.manufacturer,
                                inuse: o.inuse
                            }))}
                            placeholder={i18n._('Choose a port')}
                            searchable={false}
                            value={port}
                            valueRenderer={this.renderPortValue}
                        />
                        <div className="input-group-btn">
                            <button
                                type="button"
                                className="btn btn-default"
                                name="btn-refresh"
                                title={i18n._('Refresh')}
                                onClick={this.actions.handleRefreshPorts}
                                disabled={!canRefresh}
                            >
                                <i
                                    className={classNames(
                                        'fa',
                                        'fa-refresh',
                                        { 'fa-spin': loading }
                                    )}
                                />
                            </button>
                        </div>
                    </div>
                </div>
                <div className="btn-group btn-group-sm">
                    {!connected && (
                        <button
                            type="button"
                            className="sm-btn-small sm-btn-primary"
                            disabled={!canOpenPort}
                            onClick={this.actions.handleOpenPort}
                        >
                            <i className="fa fa-toggle-off" />
                            <span className="space" />
                            {i18n._('Open')}
                        </button>
                    )}
                    {connected && (
                        <button
                            type="button"
                            className="sm-btn-small sm-btn-danger"
                            disabled={!canClosePort}
                            onClick={this.actions.handleClosePort}
                        >
                            <i className="fa fa-toggle-on" />
                            <Space width={4} />
                            {i18n._('Close')}
                        </button>
                    )}
                </div>
            </div>
        );
    }
}

export default Connection;
