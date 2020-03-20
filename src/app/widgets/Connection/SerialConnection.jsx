import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import Select from 'react-select';
import { includes, map } from 'lodash';

import log from '../../lib/log';
import i18n from '../../lib/i18n';
import { controller } from '../../lib/controller';
import {
    MACHINE_SERIES,
    MACHINE_HEAD_TYPE
} from '../../constants';
import { valueOf } from '../../lib/contants-utils';
import Space from '../../components/Space';
import { actions as machineActions } from '../../flux/machine';
import PrintingState from './PrintingState';
import LaserState from './LaserState';
import CNCState from './CNCState';
import MachineSelectModal from '../../modals/modal-machine-select';

class SerialConnection extends PureComponent {
    static propTypes = {
        isOpen: PropTypes.bool.isRequired,

        port: PropTypes.string.isRequired,
        headType: PropTypes.string,
        connectionTimeout: PropTypes.number,
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
        loadingPorts: false

    };

    loadingTimer = null;

    controllerEvents = {
        'serialport:list': (options) => this.onListPorts(options),
        'serialport:open': (options) => this.onPortOpened(options),
        'serialport:connected': (options) => this.onPortReady(options),
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
        const { port, err } = options;
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

        const { series, seriesSize, headType } = state;
        const machineSeries = valueOf(MACHINE_SERIES, 'alias', `${series}-${seriesSize}`)
            ? valueOf(MACHINE_SERIES, 'alias', `${series}-${seriesSize}`).value : null;
        const machineHeadType = valueOf(MACHINE_HEAD_TYPE, 'alias', headType)
            ? valueOf(MACHINE_HEAD_TYPE, 'alias', headType).value : null;

        if (machineSeries && machineHeadType) {
            this.props.updateMachineState({
                series: machineSeries,
                headType: machineHeadType,
                canReselectMachine: false
            });
            if (machineSeries.value !== MACHINE_SERIES.ORIGINAL.value) {
                this.props.executeGcode('G54');
            }
        } else {
            MachineSelectModal({
                series: machineSeries,
                headType: machineHeadType,

                onConfirm: (seriesT, headTypeT) => {
                    this.props.updateMachineState({
                        series: seriesT,
                        headType: headTypeT,
                        canReselectMachine: true
                    });
                    if (seriesT !== MACHINE_SERIES.ORIGINAL.value) {
                        this.props.executeGcode('G54');
                    }
                }

            });
        }
    }

    onPortClosed(options) {
        const { port, err } = options;
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

        controller.listPorts();
    }

    openPort(port) {
        controller.openPort(port, this.props.connectionTimeout);
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
        const { isOpen, isConnected, headType } = this.props;
        const { err, ports, port, loadingPorts } = this.state;

        const canRefresh = !loadingPorts && !isOpen;
        const canChangePort = canRefresh;
        const canOpenPort = port && !isOpen;

        return (
            <div>
                <div className="form-group" style={{ marginTop: '10px' }}>
                    <div className="input-group input-group-sm">
                        <Select
                            menuStyle={{
                                maxHeight: '100px'
                            }}
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
                {isConnected && (
                    <div style={{
                        marginBottom: '10px'
                    }}
                    >
                        {headType === MACHINE_HEAD_TYPE['3DP'].value && <PrintingState headType={headType} />}
                        {headType === MACHINE_HEAD_TYPE.LASER.value && <LaserState headType={headType} />}
                        {headType === MACHINE_HEAD_TYPE.CNC.value && <CNCState headType={headType} />}
                    </div>
                )}

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
            </div>
        );
    }
}
const mapStateToProps = (state) => {
    const machine = state.machine;

    const { port, isOpen, isConnected, headType, connectionTimeout } = machine;

    return {
        port,
        isOpen,
        headType,
        isConnected,
        connectionTimeout
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
