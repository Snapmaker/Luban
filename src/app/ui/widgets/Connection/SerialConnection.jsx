import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import classNames from 'classnames';
// import { InputGroup } from 'react-bootstrap';
import { includes, map } from 'lodash';
import Select from '../../components/Select';
import SvgIcon from '../../components/SvgIcon';
import { Button } from '../../components/Buttons';
import { ModuleStatus } from './WifiConnection';

import log from '../../../lib/log';
import i18n from '../../../lib/i18n';
import { controller } from '../../../lib/controller';
import {
    MACHINE_SERIES,
    MACHINE_HEAD_TYPE,
    WORKFLOW_STATE_IDLE,
    WORKFLOW_STATE_PAUSED,
    WORKFLOW_STATE_RUNNING
    // , HEAD_PRINTING, HEAD_LASER, HEAD_CNC
} from '../../../constants';
import { valueOf } from '../../../lib/contants-utils';
import { actions as machineActions } from '../../../flux/machine';
// import PrintingState from './PrintingState';
// import LaserState from './LaserState';
// import CNCState from './CNCState';
// import EnclosureState from './EnclosureState';
import MachineSelectModal from '../../modals/modal-machine-select';
import styles from './index.styl';

let loadingTimer = null;
function SerialConnection() {
    const {
        port, isOpen, enclosureOnline, isConnected,
        headType, connectionTimeout, airPurifier, airPurifierHasPower,
        heatedBedTemperature, laserCamera, workflowState, series: seriesInfo, emergencyStopOnline
    } = useSelector(state => state.machine);
    // Available serial ports
    const [ports, setPorts] = useState([]);
    // Selected port
    const [portState, setPortState] = useState(port);
    // connect status: 'idle', 'connecting', 'connected'
    const [err, setErr] = useState(null);
    // UI state
    const [loadingPorts, setLoadingPorts] = useState(false);
    const [moduleStatusList, setModuleStatusList] = useState(null);
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
                    <i>{i18n._('key-Workspace/Connection-Manufacturer: {{manufacturer}}', { manufacturer })}</i>
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

    useMemo(() => {
        const newModuleStatusList = [];
        if (headType) {
            newModuleStatusList.push({
                key: 'headtype',
                moduleName: i18n._(`key-Workspace/Connection-${headType}`),
                status: true
            });
            headType === 'printing' && newModuleStatusList.push({
                key: 'heatedBed',
                moduleName: i18n._('key-Workspace/Connection-Heated bed'),
                status: heatedBedTemperature > 0
            });
            headType === 'laser' && newModuleStatusList.push({
                key: 'laserCamera',
                moduleName: i18n._('key-Workspace/Connection-Laser camera'),
                status: laserCamera
            });
        }
        if (seriesInfo !== 'Original' && seriesInfo !== 'Original Long Z-axis') {
            airPurifier && newModuleStatusList.push({
                key: 'airPurifier',
                moduleName: i18n._('key-Workspace/Connection-airPurifier'),
                status: airPurifierHasPower
            });
            enclosureOnline && newModuleStatusList.push({
                key: 'enclosure',
                moduleName: i18n._('key-Workspace/Connection-enclosure'),
                status: enclosureOnline
            });
            emergencyStopOnline && newModuleStatusList.push({
                key: 'emergencyStop',
                moduleName: i18n._('key-Workspace/Connection-emergencyStopButton'),
                status: emergencyStopOnline
            });
        }
        setModuleStatusList(newModuleStatusList);
    }, [
        headType, airPurifier, airPurifierHasPower,
        enclosureOnline, heatedBedTemperature > 0, laserCamera, emergencyStopOnline, seriesInfo
    ]);

    const canRefresh = !loadingPorts && !isOpen;
    const canChangePort = canRefresh;
    const canOpenPort = portState && !isOpen;

    return (
        <div>
            {!isConnected && (
                <div className="sm-flex justify-space-between margin-bottom-16">
                    <Select
                        backspaceRemoves={false}
                        className={classNames('sm-flex-width', 'sm-flex-order-negative')}
                        clearable={false}
                        searchable={false}
                        disabled={!canChangePort}
                        name="port"
                        noResultsText={i18n._('key-Workspace/Connection-No ports available.')}
                        onChange={actions.onChangePortOption}
                        optionRenderer={renderPortOption}
                        options={map(ports, (o) => ({
                            value: o.port,
                            label: o.port,
                            manufacturer: o.manufacturer
                        }))}
                        placeholder={i18n._('key-Workspace/Connection-Choose a port')}
                        value={portState}
                        valueRenderer={renderPortValue}
                    />
                    <SvgIcon
                        className="border-default-black-5 margin-left-8 border-radius-8"
                        size={24}
                        borderRadius={8}
                        name={loadingPorts ? 'Refresh' : 'Reset'}
                        title={i18n._('key-Workspace/Connection-Refresh')}
                        onClick={actions.onRefreshPorts}
                        disabled={!canRefresh}
                    />
                </div>
            )}
            {isConnected && (
                <div className="margin-bottom-16 margin-top-12">
                    <div
                        className={classNames(styles['connection-state'], 'padding-bottom-8', 'border-bottom-dashed-default')}
                    >
                        <span className={styles['connection-state-name']}>
                            {seriesInfo}
                        </span>
                        <span className={styles['connection-state-icon']}>
                            {workflowState === WORKFLOW_STATE_IDLE
                            && <i className="sm-icon-14 sm-icon-idle" />}
                            {workflowState === WORKFLOW_STATE_PAUSED
                            && <i className="sm-icon-14 sm-icon-paused" />}
                            {workflowState === WORKFLOW_STATE_RUNNING
                            && <i className="sm-icon-14 sm-icon-running" />}
                        </span>
                    </div>
                    {moduleStatusList && moduleStatusList.length && (
                        <div className={classNames('sm-flex', 'flex-wrap')}>
                            {/* <ModuleStatus moduleName={currentHeadType} status /> */}
                            {moduleStatusList.map(item => (
                                <ModuleStatus moduleName={item.moduleName} status={item.status} />
                            ))}
                        </div>
                    )}
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
                        {i18n._('key-Workspace/Connection-Connect')}
                    </Button>
                )}
                {isConnected && (
                    <Button
                        width="120px"
                        type="default"
                        priority="level-two"
                        onClick={actions.onClosePort}
                    >
                        {i18n._('key-Workspace/Connection-Disconnect')}
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
