import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Select from 'react-select';
import { includes, map, find, get } from 'lodash';
import pubsub from 'pubsub-js';

import log from '../../lib/log';
import i18n from '../../lib/i18n';
import controller from '../../lib/controller';
import api from '../../api';
import Space from '../../components/Space';


const STATUS_IDLE = 'idle';
const STATUS_CONNECTING = 'connecting';
const STATUS_CONNECTED = 'connected';


class SerialConnection extends PureComponent {
    static propTypes = {
        config: PropTypes.object.isRequired
    };

    state = {
        // Available serial ports
        ports: [],
        // Selected port
        port: '',
        // connect status: 'idle', 'connecting', 'connected'
        status: STATUS_IDLE,

        // UI state
        alert: '',
        loadingPorts: false
    };

    loadingTimer = null;

    controllerEvents = {
        'serialport:list': (ports) => this.onListPorts(ports),
        'serialport:open': (options) => this.onPortOpened(options),
        'serialport:close': (options) => this.onPortClosed(options)
    };

    actions = {
        onChangePortOption: (option) => {
            this.setState({
                port: option.value,
                alert: ''
            });
        },
        onRefreshPorts: () => {
            this.listPorts();
        },
        onOpenPort: () => {
            const { port } = this.state;
            this.openPort(port);
        },
        onClosePort: () => {
            const { port } = this.state;
            this.closePort(port);
        }
    };

    componentDidMount() {
        this.addControllerEvents();

        // refresh ports on mount
        setTimeout(() => this.listPorts());
    }

    componentWillUnmount() {
        this.removeControllerEvents();

        if (this.loadingTimer) {
            clearTimeout(this.loadingTimer);
            this.loadingTimer = null;
        }
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.state.port !== prevState.port) {
            const { config } = this.props;
            config.set('port', this.state.port);
        }
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

    listPorts() {
        // Update loading state
        this.setState({ loadingPorts: true });
        this.loadingTimer = setTimeout(() => {
            this.setState({ loadingPorts: false });
        }, 5000);

        controller.listPorts();
    }

    onListPorts(ports) {
        // Update loading state
        if (this.loadingTimer) {
            clearTimeout(this.loadingTimer);
            this.loadingTimer = null;
        }
        // Hold on spinning for 600ms so that user can recognize the refresh has done.
        setTimeout(() => this.setState({ loadingPorts: false }), 600);

        log.debug('Received serial ports:', ports);

        const { config } = this.props;
        const port = config.get('port') || '';

        if (includes(map(ports, 'port'), port)) {
            this.setState({
                ports: ports,
                port: port,
                alert: ''
            });
        } else {
            this.setState({
                ports: ports,
                alert: ''
            });
        }
    }

    openPort(port) {
        this.setState({
            status: STATUS_CONNECTING
        });

        controller.openPort(port);
    }

    onPortOpened(options) {
        const { port, err } = options;

        if (err) {
            this.setState({
                status: STATUS_IDLE,
                alert: i18n._('Error opening serial port \'{{- port}}\'', { port: port }),
            });
            log.error(`Error opening serial port '${port}'`, err);

            return;
        }

        this.setState({
            port: port,
            status: STATUS_CONNECTED,
            alert: ''
        });

        log.debug(`Connected to ${port}.`);

        // re-upload G-code
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
                if (gcode) {
                    pubsub.publish('gcode:render', { name, gcode });
                }
            })
            .catch((res) => {
                // Empty block
            });
    }

    closePort(port) {
        this.setState({
            connecting: false,
            connected: false
        });
        controller.closePort(port);
    }

    onPortClosed(options) {
        const { port, err } = options;

        if (err) {
            log.error(err);
            return;
        }

        log.debug('Disconnected from \'' + port + '\'.');

        this.setState({
            status: STATUS_IDLE,
            alert: '',
        });

        // Refresh ports
        this.listPorts();
    }

    renderPortOption = (option) => {
        const { value, label, manufacturer } = option;
        const style = {
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden'
        };

        const inuse = value === this.state.port && this.state.status === STATUS_CONNECTED;

        return (
            <div style={style} title={label}>
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
        const { value, label } = option;
        const canChangePort = !(this.state.loading);
        const style = {
            color: canChangePort ? '#333' : '#ccc',
            textOverflow: 'ellipsis',
            overflow: 'hidden'
        };
        const inuse = value === this.state.port && this.state.status === STATUS_CONNECTED;

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

    render() {
        const { ports, port, status, loadingPorts } = this.state;

        const canRefresh = !loadingPorts && status !== STATUS_CONNECTED;
        const canChangePort = canRefresh;
        const canOpenPort = port && status === STATUS_IDLE;

        return (
            <div>
                <div className="form-group" style={{ marginTop: '10px' }}>
                    <div className="input-group input-group-sm">
                        <Select
                            backspaceRemoves={false}
                            clearable={false}
                            searchable={false}
                            disabled={!canChangePort}
                            name="port"
                            noResultsText={i18n._('No ports available')}
                            onChange={this.actions.onChangePortOption}
                            optionRenderer={this.renderPortOption}
                            options={map(ports, (o) => ({
                                value: o.port,
                                label: o.port,
                                manufacturer: o.manufacturer
                            }))}
                            placeholder={i18n._('Choose a port')}
                            value={port}
                            valueRenderer={this.renderPortValue}
                        />
                        <div className="input-group-btn">
                            <button
                                type="button"
                                className="btn btn-default"
                                name="btn-refresh"
                                title={i18n._('Refresh')}
                                onClick={this.actions.onRefreshPorts}
                                disabled={!canRefresh}
                            >
                                <i
                                    className={classNames(
                                        'fa',
                                        'fa-refresh',
                                        { 'fa-spin': loadingPorts }
                                    )}
                                />
                            </button>
                        </div>
                    </div>
                </div>
                <div className="btn-group btn-group-sm">
                    {status !== 'connected' && (
                        <button
                            type="button"
                            className="sm-btn-small sm-btn-primary"
                            disabled={!canOpenPort}
                            onClick={this.actions.onOpenPort}
                        >
                            <i className="fa fa-toggle-off" />
                            <span className="space" />
                            {i18n._('Open')}
                        </button>
                    )}
                    {status === 'connected' && (
                        <button
                            type="button"
                            className="sm-btn-small sm-btn-danger"
                            onClick={this.actions.onClosePort}
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

export default SerialConnection;
