import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Select from 'react-select';
import { includes, map, find, get } from 'lodash';
import pubsub from 'pubsub-js';

import { connect } from 'react-redux';
import log from '../../lib/log';
import i18n from '../../lib/i18n';
// import controller from '../../lib/controller';
import { MACHINE_PATTERN, MACHINE_SERIES } from '../../constants';
import { valueOf } from '../../lib/contants-utils';
import SerialClient from '../../lib/serialClient';
import api from '../../api';
import Space from '../../components/Space';
import MachineSelection from './MachineSelection';
import { actions as machineActions } from '../../flux/machine';
// import { PROTOCOL_TEXT } from '../../constants';


const STATUS_IDLE = 'idle';
const STATUS_CONNECTING = 'connecting';
const STATUS_CONNECTED = 'connected';


class SerialConnection extends PureComponent {
    static propTypes = {
        dataSource: PropTypes.string.isRequired,

        port: PropTypes.string.isRequired,
        updatePort: PropTypes.func.isRequired,
        updateMachineState: PropTypes.func.isRequired
    };

    controller = new SerialClient({ dataSource: this.props.dataSource });


    state = {
        // Available serial ports
        ports: [],
        // Selected port
        port: this.props.port,
        // connect status: 'idle', 'connecting', 'connected'
        status: STATUS_IDLE,

        err: null,

        // UI state
        loadingPorts: false,

        showMachineSelected: false

    };

    loadingTimer = null;

    controllerEvents = {
        'serialport:list': (options) => this.onListPorts(options),
        'serialport:open': (options) => this.onPortOpened(options),
        'serialport:ready': (options) => this.onPortReady(options),
        'serialport:close': (options) => this.onPortClosed(options)
    };

    actions = {
        onChangePortOption: (option) => {
            this.setState({
                port: option.value
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
        },
        openModal: () => {
            this.setState({
                showMachineSelected: true
            });
        },
        closeModal: () => {
            this.setState({
                showMachineSelected: false
            });
        }
    };

    componentDidMount() {
        this.addControllerEvents();

        // refresh ports on mount
        setTimeout(() => this.listPorts());
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.state.port !== prevState.port) {
            this.props.updatePort(this.state.port);
        }
    }

    componentWillUnmount() {
        this.removeControllerEvents();

        if (this.loadingTimer) {
            clearTimeout(this.loadingTimer);
            this.loadingTimer = null;
        }
    }

    onListPorts(options) {
        const { ports } = options;
        // Update loading state
        if (this.loadingTimer) {
            clearTimeout(this.loadingTimer);
            this.loadingTimer = null;
        }
        // Hold on spinning for 600ms so that user can recognize the refresh has done.
        this.loadingTimer = setTimeout(() => {
            if (this.loadingTimer) {
                this.setState({ loadingPorts: false });
                this.loadingTimer = null;
            }
        }, 600);

        log.debug('Received serial ports:', ports);

        const port = this.props.port || '';

        if (includes(map(ports, 'port'), port)) {
            this.setState({
                ports,
                port
            });
        } else {
            this.setState({
                ports
            });
        }
    }

    onPortOpened(options) {
        const { port, dataSource, err } = options;
        if (dataSource !== this.props.dataSource) {
            return;
        }
        if (err && err !== 'inuse') {
            this.setState({
                err: 'Can not open this port',
                status: STATUS_IDLE
            });
            log.error(`Error opening serial port '${port}'`, err);

            return;
        }

        this.setState({
            port,
            err: null
        });
    }

    onPortReady(data) {
        console.log('this is ready', data);
        const { state } = data;
        const port = this.state.port;
        this.setState({
            status: STATUS_CONNECTED
        });
        log.debug(`Connected to ${port}.`);

        // re-upload G-code
        let name = '';
        let gcode = '';
        api.controllers.get()
            .then((res) => {
                let next;
                const c = find(res.body, { port });
                if (c) {
                    next = api.fetchGCode({ port });
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
            .catch(() => {
                // Empty block
            });
        const { series, seriesSize, headType } = state;
        const machinePattern = valueOf(MACHINE_PATTERN, 'alias', headType);
        const machineSeries = valueOf(MACHINE_SERIES, 'alias', `${series}-${seriesSize}`);
        console.log('machineSeries', machineSeries);


        if (machinePattern && machineSeries) {
            this.props.updateMachineState({
                series: machineSeries.value,
                pattern: machinePattern.value
            });
        } else {
            machinePattern && this.props.updateMachineState({ pattern: machinePattern.value });
            machineSeries && this.props.updateMachineState({ series: machineSeries.value });
            this.actions.openModal();
        }
    }

    onPortClosed(options) {
        const { port, dataSource, err } = options;
        // if (dataSource !== PROTOCOL_TEXT) {
        if (dataSource !== this.props.dataSource) {
            return;
        }
        if (err) {
            this.setState({
                err: 'Can not close this port'
            });
            log.error(err);
            return;
        }

        log.debug(`Disconnected from '${port}'.`);

        this.setState({
            err: null,
            status: STATUS_IDLE
        });
        // Refresh ports
        this.listPorts();
    }

    listPorts() {
        // Update loading state
        this.setState({ loadingPorts: true });
        this.loadingTimer = setTimeout(() => {
            if (this.loadingTimer) {
                this.setState({ loadingPorts: false });
            }
        }, 5000);

        this.controller.listPorts();
    }

    openPort(port) {
        this.setState({
            status: STATUS_CONNECTING
        });

        this.controller.openPort(port);
    }

    closePort(port) {
        this.controller.closePort(port);
    }

    renderPortOption = (option) => {
        const { value, label, manufacturer } = option;
        const { port, status } = this.state;
        const style = {
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden'
        };

        const inuse = value === port && status === STATUS_CONNECTED;

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
                {manufacturer && (
                    <i>{i18n._('Manufacturer: {{manufacturer}}', { manufacturer })}</i>
                )}
            </div>
        );
    };

    renderPortValue = (option) => {
        const { value, label } = option;
        const { port, status } = this.state;
        const canChangePort = !(this.state.loading);
        const style = {
            color: canChangePort ? '#333' : '#ccc',
            textOverflow: 'ellipsis',
            overflow: 'hidden'
        };
        const inuse = value === port && status === STATUS_CONNECTED;

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

    addControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            this.controller.on(eventName, callback);
        });
    }

    removeControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            this.controller.off(eventName, callback);
        });
    }

    render() {
        const { err, ports, port, status, loadingPorts, showMachineSelected } = this.state;

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
                    {err && (
                        <span style={{ margin: '0 8px' }}>{err}</span>
                    )}
                </div>
                <MachineSelection
                    display={showMachineSelected}
                    closeModal={this.actions.closeModal}
                />
            </div>
        );
    }
}
const mapStateToProps = (state) => {
    const machine = state.machine;

    const { port } = machine;

    return {
        port
    };
};
const mapDispatchToProps = (dispatch) => {
    return {
        updateMachineState: (state) => dispatch(machineActions.updateMachineState(state)),
        updatePort: (port) => dispatch(machineActions.updatePort(port))
    };
};
export default connect(mapStateToProps, mapDispatchToProps)(SerialConnection);
