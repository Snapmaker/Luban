import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import Select from 'react-select';
import { Button, InputGroup } from 'react-bootstrap';
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
import EnclosureState from './EnclosureState';
import MachineSelectModal from '../../modals/modal-machine-select';

class SerialConnection extends PureComponent {
    static propTypes = {
        isOpen: PropTypes.bool.isRequired,
        enclosureOnline: PropTypes.bool.isRequired,

        port: PropTypes.string.isRequired,
        headType: PropTypes.string,
        connectionTimeout: PropTypes.number,
        isConnected: PropTypes.bool,
        setMachineSerialPort: PropTypes.func.isRequired,
        executeGcodeG54: PropTypes.func.isRequired,
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

        // save serial port on connection succeeded
        this.props.setMachineSerialPort(this.state.port);

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
            this.props.executeGcodeG54(machineSeries, machineHeadType);
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
                    this.props.executeGcodeG54(seriesT, headTypeT);
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
                <InputGroup className="mb-3">
                    <div
                        style={{
                            flex: '1 1 0%',
                            width: '100%',
                            marginRight: '5px'
                        }}
                    >
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
                    </div>
                    <InputGroup.Append>
                        <Button
                            variant="outline-secondary"
                            style={{ borderColor: '#c8c8c8' }}
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
                        </Button>
                    </InputGroup.Append>
                </InputGroup>

                {isConnected && (
                    <div className="mb-3">
                        {headType === MACHINE_HEAD_TYPE['3DP'].value && <PrintingState headType={headType} />}
                        {headType === MACHINE_HEAD_TYPE.LASER.value && <LaserState headType={headType} />}
                        {headType === MACHINE_HEAD_TYPE.CNC.value && <CNCState headType={headType} />}
                    </div>
                )}
                {isConnected && this.props.enclosureOnline && (
                    <div className="mb-3">
                        <EnclosureState />
                    </div>
                )}

                <div className="btn-group">
                    {!isConnected && (
                        <button
                            type="button"
                            className="sm-btn-small sm-btn-primary"
                            disabled={!canOpenPort}
                            onClick={this.actions.onOpenPort}
                        >
                            <i className="fa fa-toggle-off" />
                            <span className="space" />
                            {i18n._('Connect')}
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
                            {i18n._('Disconnect')}
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

    const { port, isOpen, enclosureOnline, isConnected, headType, connectionTimeout } = machine;

    return {
        port,
        isOpen,
        enclosureOnline,
        headType,
        isConnected,
        connectionTimeout
    };
};
const mapDispatchToProps = (dispatch) => {
    return {
        updateMachineState: (state) => dispatch(machineActions.updateMachineState(state)),
        executeGcodeG54: (series, headType) => dispatch(machineActions.executeGcodeG54(series, headType)),
        setMachineSerialPort: (port) => dispatch(machineActions.connect.setMachineSerialPort(port))
    };
};
export default connect(mapStateToProps, mapDispatchToProps)(SerialConnection);
