import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import classNames from 'classnames';
// import { InputGroup } from 'react-bootstrap';
import { includes, map } from 'lodash';
import Select from '../../components/Select';
import SvgIcon from '../../components/SvgIcon';
import { Button } from '../../components/Buttons';

import log from '../../../lib/log';
import i18n from '../../../lib/i18n';
import { controller } from '../../../lib/controller';
import {
    MACHINE_SERIES,
    MACHINE_HEAD_TYPE, HEAD_PRINTING, HEAD_LASER, HEAD_CNC
} from '../../../constants';
import { valueOf } from '../../../lib/contants-utils';
import { actions as machineActions } from '../../../flux/machine';
import PrintingState from './PrintingState';
import LaserState from './LaserState';
import CNCState from './CNCState';
import EnclosureState from './EnclosureState';
import MachineSelectModal from '../../modals/modal-machine-select';

let loadingTimer = null;
function SerialConnection() {
    const { port, isOpen, enclosureOnline, isConnected, headType, connectionTimeout } = useSelector(state => state.machine);
    // Available serial ports
    const [ports, setPorts] = useState([]);
    // Selected port
    const [portState, setPortState] = useState(port);
    // connect status: 'idle', 'connecting', 'connected'
    const [err, setErr] = useState(null);
    // UI state
    const [loadingPorts, setLoadingPorts] = useState(false);
    const dispatch = useDispatch();

    function onListPorts(options) {
        const { ports: _ports } = options;
        // Update loading state
        if (loadingTimer) {
            clearTimeout(loadingTimer);
            loadingTimer = null;
        }
        // Hold on spinning for 600ms so that user can recognize the refresh has done.
        loadingTimer = setTimeout(() => {
            if (loadingTimer) {
                setLoadingPorts(false);
                loadingTimer = null;
            }
        }, 600);

        log.debug('Received serial ports:', _ports);

        const _port = port || '';

        if (includes(map(_ports, 'port'), _port)) {
            setPorts(_ports);
            setPortState(_port);
        } else {
            setPorts(_ports);
        }
    }

    function onPortOpened(options) {
        const { port: _port, err: _err } = options;
        if (err && err !== 'inuse') {
            setErr('Can not open this port');
            log.error(`Error opening serial port '${_port}'`, _err);

            return;
        }

        setPortState(_port);
        setErr(null);
    }

    function onPortReady(data) {
        const { state, err: _err } = data;
        if (_err) {
            setErr('The machine is not ready');
            return;
        }

        log.debug(`Connected to ${portState}.`);

        // save serial port on connection succeeded
        dispatch(machineActions.connect.setMachineSerialPort(portState));

        const { series, seriesSize, headType: _headType } = state;
        const machineSeries = valueOf(MACHINE_SERIES, 'alias', `${series}-${seriesSize}`)
            ? valueOf(MACHINE_SERIES, 'alias', `${series}-${seriesSize}`).value : null;
        const machineHeadType = valueOf(MACHINE_HEAD_TYPE, 'alias', _headType)
            ? valueOf(MACHINE_HEAD_TYPE, 'alias', _headType).value : null;

        if (machineSeries && machineHeadType) {
            dispatch(machineActions.updateMachineState({
                series: machineSeries,
                headType: machineHeadType,
                canReselectMachine: false
            }));
            dispatch(machineActions.executeGcodeG54(machineSeries, machineHeadType));
        } else {
            MachineSelectModal({
                series: machineSeries,
                headType: machineHeadType,

                onConfirm: (seriesT, headTypeT) => {
                    dispatch(machineActions.updateMachineState({
                        series: seriesT,
                        headType: headTypeT,
                        canReselectMachine: true
                    }));
                    dispatch(machineActions.executeGcodeG54(seriesT, headTypeT));
                }

            });
        }
    }

    function listPorts() {
        // Update loading state
        setLoadingPorts(true);
        loadingTimer = setTimeout(() => {
            if (loadingTimer) {
                setLoadingPorts(false);
            }
        }, 5000);

        controller.listPorts();
    }

    function onPortClosed(options) {
        const { port: _port, err: _err } = options;
        if (_err) {
            setErr('Can not close this port');
            log.error(_err);
            return;
        }

        log.debug(`Disconnected from '${_port}'.`);

        // Refresh ports
        listPorts();
    }

    function openPort(_port) {
        controller.openPort(_port, connectionTimeout);
    }

    function closePort(_port) {
        controller.closePort(_port);
    }

    const renderPortOption = (option) => {
        const { value, label, manufacturer } = option;
        const style = {
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden'
        };

        const inuse = value === portState && isConnected;

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
                    <i>{i18n._('key_ui/widgets/Connection/SerialConnection_Manufacturer: {{manufacturer}}', { manufacturer })}</i>
                )}
            </div>
        );
    };

    const renderPortValue = (option) => {
        const { value, label } = option;
        const style = {
            color: '#333',
            textOverflow: 'ellipsis',
            overflow: 'hidden'
        };
        const inuse = value === portState && isConnected;

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

    const actions = {
        onChangePortOption: (option) => {
            setPortState(option.value);
        },
        onRefreshPorts: () => {
            listPorts();
        },
        onOpenPort: () => {
            openPort(portState);
        },
        onClosePort: () => {
            closePort(portState);
        }

    };

    const controllerEvents = {
        'serialport:list': (options) => onListPorts(options),
        'serialport:open': (options) => onPortOpened(options),
        'serialport:connected': (options) => onPortReady(options),
        'serialport:close': (options) => onPortClosed(options)
    };

    function addControllerEvents() {
        Object.keys(controllerEvents).forEach(eventName => {
            const callback = controllerEvents[eventName];
            controller.on(eventName, callback);
        });
    }

    function removeControllerEvents() {
        Object.keys(controllerEvents).forEach(eventName => {
            const callback = controllerEvents[eventName];
            controller.off(eventName, callback);
        });
    }

    useEffect(() => {
        addControllerEvents();
        // refresh ports on mount
        setTimeout(() => listPorts());
        return () => {
            removeControllerEvents();
            if (loadingTimer) {
                clearTimeout(loadingTimer);
                loadingTimer = null;
            }
        };
    }, []);

    const canRefresh = !loadingPorts && !isOpen;
    const canChangePort = canRefresh;
    const canOpenPort = portState && !isOpen;

    return (
        <div>
            <div className="sm-flex justify-space-between margin-bottom-16">
                <Select
                    backspaceRemoves={false}
                    className={classNames('sm-flex-width', 'sm-flex-order-negative')}
                    clearable={false}
                    searchable={false}
                    disabled={!canChangePort}
                    name="port"
                    noResultsText={i18n._('key_ui/widgets/Connection/SerialConnection_No ports available.')}
                    onChange={actions.onChangePortOption}
                    optionRenderer={renderPortOption}
                    options={map(ports, (o) => ({
                        value: o.port,
                        label: o.port,
                        manufacturer: o.manufacturer
                    }))}
                    placeholder={i18n._('key_ui/widgets/Connection/SerialConnection_Choose a port')}
                    value={portState}
                    valueRenderer={renderPortValue}
                />
                <SvgIcon
                    className="border-default-black-5 margin-left-8 border-radius-8"
                    size={24}
                    borderRadius={8}
                    name={loadingPorts ? 'Refresh' : 'Reset'}
                    title={i18n._('key_ui/widgets/Connection/SerialConnection_Refresh')}
                    onClick={actions.onRefreshPorts}
                    disabled={!canRefresh}
                />
            </div>

            {isConnected && (
                <div className="margin-bottom-16">
                    {headType === HEAD_PRINTING && <PrintingState headType={headType} />}
                    {headType === HEAD_LASER && <LaserState headType={headType} />}
                    {headType === HEAD_CNC && <CNCState headType={headType} />}
                </div>
            )}
            {isConnected && enclosureOnline && (
                <div className="margin-bottom-16">
                    <EnclosureState />
                </div>
            )}

            <div>
                {!isConnected && (
                    <Button
                        width="120px"
                        type="primary"
                        priority="level-two"
                        disabled={!canOpenPort}
                        onClick={actions.onOpenPort}
                    >
                        {i18n._('key_ui/widgets/Connection/SerialConnection_Connect')}
                    </Button>
                )}
                {isConnected && (
                    <Button
                        width="120px"
                        type="default"
                        priority="level-two"
                        onClick={actions.onClosePort}
                    >
                        {i18n._('key_ui/widgets/Connection/SerialConnection_Disconnect')}
                    </Button>
                )}
                {err && (
                    <span className="margin-horizontal-8">{err}</span>
                )}
            </div>
        </div>
    );
}

export default SerialConnection;
