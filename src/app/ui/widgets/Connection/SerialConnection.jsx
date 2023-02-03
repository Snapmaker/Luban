import classNames from 'classnames';
import { isObject, map } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { WORKFLOW_STATE_IDLE, WORKFLOW_STATE_PAUSED, WORKFLOW_STATE_RUNNING } from '../../../constants';
import {
    HEAD_CNC,
    HEAD_LASER,
    HEAD_PRINTING,
    isDualExtruder,
    LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2,
    LEVEL_TWO_POWER_LASER_FOR_SM2,
    MACHINE_SERIES,
} from '../../../constants/machines';
import { actions as machineActions } from '../../../flux/machine';
import { controller } from '../../../lib/controller';
import i18n from '../../../lib/i18n';
import log from '../../../lib/log';

import { Button } from '../../components/Buttons';
import Select from '../../components/Select';
import SvgIcon from '../../components/SvgIcon';

import MachineModuleStatusBadge from './components/MachineModuleStatusBadge';
import styles from './index.styl';
import MismatchModal from './MismatchModal';

let loadingTimer = null;

function SerialConnection() {
    const {
        isOpen, enclosureOnline, isConnected, server, servers,
        // connectionTimeout, airPurifier, airPurifierHasPower,
        airPurifier, airPurifierHasPower,
        heatedBedTemperature, laserCamera, workflowStatus, emergencyStopOnline, connectLoading
    } = useSelector(state => state.machine);
    const {
        toolHead, headType, series: seriesInfo,
        isRotate
    } = useSelector(state => state?.workspace);
    // Selected port
    const [portState, setPortState] = useState(server);
    // connect status: 'idle', 'connecting', 'connected'
    const [err, setErr] = useState(null);
    // UI state
    const [loadingPorts, setLoadingPorts] = useState(false);
    const [moduleStatusList, setModuleStatusList] = useState(null);
    const [loading, setConnectLoading] = useState(connectLoading);
    const dispatch = useDispatch();

    useEffect(() => {
        setConnectLoading(connectLoading);
    }, [connectLoading]);

    function onPortReady(data) {
        const { err: _err } = data;
        if (_err) {
            setErr(i18n._('key-workspace_open_port-The machine is not ready'));
            return;
        } else {
            setErr(null);
        }

        log.debug(`Connected to ${portState}.`);
    }

    function listPorts() {
        // Update loading state
        setLoadingPorts(true);
        loadingTimer = setTimeout(() => {
            if (loadingTimer) {
                setLoadingPorts(false);
            }
        }, 500);

        controller.listPorts();
    }

    function openPort() {
        server.openServer(({ msg }) => {
            if (!isObject(msg) && msg !== 'inuse') {
                setErr(i18n._('key-workspace_open_port-Can not open this port'));
                log.error('Error opening serial port', msg);
                return;
            }
            setErr(null);
        });
    }

    function closePort() {
        server.closeServer();
    }

    const actions = {
        onChangePortOption: (option) => {
            const serverFound = servers.find(v => v.port === option.value);
            if (serverFound) {
                dispatch(machineActions.connect.setSelectedServer(serverFound));
                setPortState(serverFound);
            }
        },
        onRefreshPorts: () => {
            listPorts();
        },
        onOpenPort: () => {
            // setConnectLoading(true);
            // dispatch(machineActions.updateMachineState)
            openPort();
        },
        onClosePort: () => {
            // setConnectLoading(true);
            closePort();
        }

    };

    const controllerEvents = {
        'connection:connected': (options) => onPortReady(options),
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
            // TODO
            if (toolHead === LEVEL_TWO_POWER_LASER_FOR_SM2) { // TODO
                newModuleStatusList.push({
                    key: 'headtype',
                    moduleName: i18n._('key-Workspace/Connection-10W Laser'),
                    status: true
                });
            } else if (headType === HEAD_LASER) {
                newModuleStatusList.push({
                    key: 'headtype',
                    moduleName: i18n._('key-Workspace/Connection-laser'),
                    status: true
                });
            } else if (headType === HEAD_PRINTING) {
                if (isDualExtruder(toolHead)) {
                    newModuleStatusList.push({
                        key: 'headtype',
                        moduleName: i18n._('key-App/Settings/MachineSettings-Dual Extruder Toolhead'),
                        status: true
                    });
                } else {
                    newModuleStatusList.push({
                        key: 'headtype',
                        moduleName: i18n._('key-App/Settings/MachineSettings-Single Extruder Toolhead'),
                        status: true
                    });
                }
            } else if (headType === HEAD_CNC) {
                if (toolHead === LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2) {
                    newModuleStatusList.push({
                        key: 'headtype',
                        moduleName: i18n._('key-Workspace/High CNC'),
                        status: true
                    });
                } else {
                    newModuleStatusList.push({
                        key: 'headtype',
                        moduleName: i18n._('key-Workspace/Connection-CNC'),
                        status: true
                    });
                }
            }
            headType === HEAD_PRINTING && newModuleStatusList.push({
                key: 'heatedBed',
                moduleName: i18n._('key-Workspace/Connection-Heated bed'),
                status: heatedBedTemperature > 0
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
            isRotate && newModuleStatusList.push({
                key: 'rotaryModule',
                moduleName: i18n._('key-Workspace/Connection-rotaryModule'),
                status: isRotate
            });
        }
        setModuleStatusList(newModuleStatusList);
    }, [
        headType, airPurifier, airPurifierHasPower, toolHead, isRotate,
        enclosureOnline, heatedBedTemperature > 0, laserCamera, emergencyStopOnline, seriesInfo
    ]);

    const canRefresh = !loadingPorts && !isOpen;
    const canChangePort = canRefresh;
    const canOpenPort = portState.port && !portState.address && !isOpen && servers.length;

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
                        options={map(servers, (o) => ({
                            value: o.port,
                            label: o.port,
                            manufacturer: o.manufacturer
                        }))}
                        placeholder={i18n._('key-Workspace/Connection-Choose a port')}
                        value={portState.port}
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
            {isConnected && seriesInfo && (
                <div className="margin-bottom-16 margin-top-12">
                    <div
                        className={classNames(styles['connection-state'], 'padding-bottom-8', 'border-bottom-dashed-default')}
                    >
                        <span className={styles['connection-state-name']}>
                            {i18n._(MACHINE_SERIES[seriesInfo.toUpperCase()].label)}
                        </span>
                        <span className={styles['connection-state-icon']}>
                            {workflowStatus === WORKFLOW_STATE_IDLE
                            && <i className="sm-icon-14 sm-icon-idle" />}
                            {workflowStatus === WORKFLOW_STATE_PAUSED
                            && <i className="sm-icon-14 sm-icon-paused" />}
                            {workflowStatus === WORKFLOW_STATE_RUNNING
                            && <i className="sm-icon-14 sm-icon-running" />}
                        </span>
                    </div>
                    {moduleStatusList && moduleStatusList.length && (
                        <div className="sm-flex sm-flex-wrap">
                            {
                                moduleStatusList.map(item => (
                                    <MachineModuleStatusBadge
                                        key={item.moduleName}
                                        moduleName={item.moduleName}
                                        status={item.status}
                                    />
                                ))
                            }
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
                        loading={loading}
                        innerClassNames="sm-flex-important justify-center"
                    >
                        {!loading && i18n._('key-Workspace/Connection-Connect')}
                    </Button>
                )}
                {isConnected && (
                    <Button
                        width="120px"
                        type="default"
                        priority="level-two"
                        onClick={actions.onClosePort}
                        loading={loading}
                    >
                        {!loading && i18n._('key-Workspace/Connection-Disconnect')}
                    </Button>
                )}
                {err && (
                    <span className="margin-horizontal-8">{err}</span>
                )}
            </div>
            <MismatchModal />
        </div>
    );
}

export default SerialConnection;
