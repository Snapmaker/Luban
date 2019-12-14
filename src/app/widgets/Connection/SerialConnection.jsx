import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import Select from 'react-select';
import { includes, map, find, get } from 'lodash';
import pubsub from 'pubsub-js';

import log from '../../lib/log';
import i18n from '../../lib/i18n';
import { controller } from '../../lib/controller';
import { MACHINE_SERIES, MACHINE_HEAD_TYPE } from '../../constants';
import { valueOf } from '../../lib/contants-utils';
import api from '../../api';
import Space from '../../components/Space';
import MachineSelection from './MachineSelection';
import { actions as machineActions } from '../../flux/machine';


class SerialConnection extends PureComponent {
    static propTypes = {
        dataSource: PropTypes.string.isRequired,

        isOpen: PropTypes.bool.isRequired,

        port: PropTypes.string.isRequired,
        isConnected: PropTypes.bool,
        updatePort: PropTypes.func.isRequired,
        executeGcode: PropTypes.func.isRequired,
        updateMachineState: PropTypes.func.isRequired
    };

    state = {
        // Available serial ports
        ports: [],
        // Selected port
        port: this.props.port,
        // connect status: 'idle', 'connecting', 'connected'
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
                err: 'Can not open this port'
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
        const { state, err } = data;
        if (err) {
            this.setState({
                err: 'The machine is not ready'
            });
            return;
        }
        const port = this.state.port;
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
        const machineHeadType = valueOf(MACHINE_HEAD_TYPE, 'alias', headType);
        const machineSeries = valueOf(MACHINE_SERIES, 'alias', `${series}-${seriesSize}`);


        if (machineHeadType && machineSeries) {
            this.props.updateMachineState({
                series: machineSeries.value,
                headType: machineHeadType.value
            });
            if (machineSeries.value !== MACHINE_SERIES.ORIGINAL.value) {
                this.props.executeGcode('G54');
            }
        } else {
            machineHeadType && this.props.updateMachineState({ headType: machineHeadType.value });
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

        console.log('listPorts');
        controller.listPorts();
    }

    openPort(port) {
        controller.openPort(port);
    }

    closePort(port) {
        controller.closePort(port);
    }

    renderPortOption = (option) => {
        const { value, label, manufacturer } = option;
        const { port } = this.state;
        const { isConnected } = this.props;
        const style = {
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden'
        };

        const inuse = value === port && isConnected;

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
        const { port } = this.state;
        const { isConnected } = this.props;
        const canChangePort = !(this.state.loading);
        const style = {
            color: canChangePort ? '#333' : '#ccc',
            textOverflow: 'ellipsis',
            overflow: 'hidden'
        };
        const inuse = value === port && isConnected;

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
            controller.on(eventName, callback);
        });
    }

    removeControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.off(eventName, callback);
        });
    }

    render() {
        const { isOpen, isConnected } = this.props;
        const { err, ports, port, loadingPorts,
            showMachineSelected } = this.state;

        const canRefresh = !loadingPorts && !isOpen;
        const canChangePort = canRefresh;
        const canOpenPort = port && !isOpen;

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
                    {!isConnected && (
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
                    {isConnected && (
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

    const { port, isOpen, isConnected } = machine;

    return {
        port,
        isOpen,
        isConnected
    };
};
const mapDispatchToProps = (dispatch) => {
    return {
        updateMachineState: (state) => dispatch(machineActions.updateMachineState(state)),
        executeGcode: (gcode, context) => dispatch(machineActions.executeGcode(gcode, context)),
        updatePort: (port) => dispatch(machineActions.updatePort(port))
    };
};
export default connect(mapStateToProps, mapDispatchToProps)(SerialConnection);
