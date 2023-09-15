import type { Machine } from '@snapmaker/luban-platform';
import { WorkflowStatus } from '@snapmaker/luban-platform';
import classNames from 'classnames';
import { includes, isObject, map } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { CONNECTION_STATUS_CONNECTING } from '../../../constants';
import {
    HEAD_CNC,
    HEAD_LASER,
    HEAD_PRINTING,
    LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2,
    MACHINE_SERIES,
    isDualExtruder
} from '../../../constants/machines';
import { RootState } from '../../../flux/index.def';
import { MachineAgent } from '../../../flux/workspace/MachineAgent';
import connectActions from '../../../flux/workspace/actions-connect';
import { controller } from '../../../communication/socket-communication';
import i18n from '../../../lib/i18n';
import log from '../../../lib/log';
import { highPower10WLaserToolHead, standardLaserToolHead } from '../../../machines/snapmaker-2-toolheads';
import { laser1600mWToolHeadOriginal, laserToolHeadOriginal } from '../../../machines/snapmaker-original-toolheads';
import { Button } from '../../components/Buttons';
import Select from '../../components/Select';
import SvgIcon from '../../components/SvgIcon';
import MachineModuleStatusBadge from './components/MachineModuleStatusBadge';
import MismatchModal from './modals/MismatchModal';
import styles from './styles.styl';

let loadingTimer = null;

const SerialConnection: React.FC = () => {
    // connection
    const machineAgents: MachineAgent[] = useSelector((state: RootState) => state.workspace.machineAgents);
    const agent: MachineAgent = useSelector((state: RootState) => state.workspace.server);

    const {
        connectionStatus,

        isOpen,
        isConnected,
    } = useSelector((state: RootState) => state.workspace);
    const connectLoading = connectionStatus === CONNECTION_STATUS_CONNECTING;

    const {
        toolHead,
        headType,
        machineIdentifier,
        isRotate,
    } = useSelector((state: RootState) => state.workspace);

    const activeMachine: Machine = useSelector((state: RootState) => state.workspace.activeMachine);

    const {
        enclosureOnline,
        airPurifier,
        airPurifierHasPower,
        heatedBedTemperature,
        emergencyStopOnline,
        workflowStatus,
    } = useSelector((state: RootState) => state.workspace);

    // Selected port
    const [selectedAgent, setSelectedAgent] = useState(agent);

    useEffect(() => {
        if (!selectedAgent && machineAgents.length > 0) {
            setSelectedAgent(machineAgents[0]);
        }
    }, [selectedAgent, machineAgents]);

    // connect status: 'idle', 'connecting', 'connected'
    const [err, setErr] = useState(null);
    // UI state
    const [loadingPorts, setLoadingPorts] = useState(false);

    function onPortReady(data) {
        const { err: _err } = data;
        if (_err) {
            setErr(i18n._('key-workspace_open_port-The machine is not ready'));
            return;
        } else {
            setErr(null);
        }

        log.debug(`Connected to ${selectedAgent}.`);
    }

    const listPorts = useCallback(() => {
        // Update loading state
        setLoadingPorts(true);
        loadingTimer = setTimeout(() => {
            if (loadingTimer) {
                setLoadingPorts(false);
                loadingTimer = null;
            }
        }, 500);

        controller.listPorts();
    }, []);

    const dispatch = useDispatch();

    const onChangePortOption = useCallback((option) => {
        const targetAgent = machineAgents.find(a => a.port === option.value);
        if (targetAgent) {
            setSelectedAgent(targetAgent);
        }
    }, [machineAgents]);

    const openPort = useCallback(async () => {
        const { msg } = await dispatch(
            connectActions.connect(selectedAgent)
        ) as unknown as { msg: string };

        if (msg && !isObject(msg) && msg !== 'inuse') {
            setErr(i18n._('key-workspace_open_port-Can not open this port'));
            log.error('Error opening serial port', msg);
            return;
        }

        setErr(null);
    }, [dispatch, selectedAgent]);

    const closePort = useCallback(() => {
        dispatch(connectActions.disconnect(selectedAgent));
    }, [dispatch, selectedAgent]);

    const actions = {
        onRefreshPorts: () => {
            listPorts();
        },
        onOpenPort: () => {
            openPort();
        },
    };

    useEffect(() => {
        const controllerEvents = {
            'connection:connected': (options) => onPortReady(options),
        };

        const addControllerEvents = () => {
            Object.keys(controllerEvents).forEach(eventName => {
                const callback = controllerEvents[eventName];
                controller.on(eventName, callback);
            });
        };

        const removeControllerEvents = () => {
            Object.keys(controllerEvents).forEach(eventName => {
                const callback = controllerEvents[eventName];
                controller.off(eventName, callback);
            });
        };
        addControllerEvents();

        return () => {
            removeControllerEvents();

            if (loadingTimer) {
                clearTimeout(loadingTimer);
                loadingTimer = null;
            }
        };
    }, []);

    useEffect(() => {
        // refresh ports on mount
        setTimeout(() => listPorts());
    }, [listPorts]);

    const moduleStatusInfoList = useMemo(() => {
        const newModuleStatusList = [];
        if (headType) {
            // TODO
            if (headType === HEAD_LASER) {
                if (toolHead === highPower10WLaserToolHead.identifier) { // TODO
                    newModuleStatusList.push({
                        key: 'headtype',
                        moduleName: i18n._('key-Workspace/Connection-Laser-10W'),
                        status: true
                    });
                } else if (toolHead === standardLaserToolHead.identifier) {
                    newModuleStatusList.push({
                        key: 'headtype',
                        moduleName: i18n._('key-Workspace/Connection-Laser'),
                        status: true
                    });
                } else if (toolHead === laserToolHeadOriginal.identifier) {
                    newModuleStatusList.push({
                        key: 'headtype',
                        moduleName: i18n._('key-Workspace/Connection-Laser-200mW'),
                        status: true
                    });
                } else if (toolHead === laser1600mWToolHeadOriginal.identifier) {
                    newModuleStatusList.push({
                        key: 'headtype',
                        moduleName: i18n._('key-Workspace/Connection-Laser-1600mW'),
                        status: true
                    });
                }
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

        if (![MACHINE_SERIES.ORIGINAL.identifier, MACHINE_SERIES.ORIGINAL_LZ.identifier].includes(machineIdentifier)) {
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

        return newModuleStatusList;
    }, [
        machineIdentifier,
        headType,
        toolHead,
        isRotate,
        airPurifier,
        airPurifierHasPower,
        enclosureOnline,
        heatedBedTemperature,
        emergencyStopOnline,
    ]);

    const canRefresh = !loadingPorts && !isOpen;
    const canChangePort = canRefresh;

    const canOpenPort = (() => {
        if (!(selectedAgent && selectedAgent.port && !selectedAgent.address)) {
            return false;
        }

        if (isConnected || isOpen || connectLoading) {
            return false;
        }

        return true;
    })();

    return (
        <div>
            {/* List of serial port options */
                !isConnected && (
                    <div className="sm-flex justify-space-between margin-bottom-16">
                        <Select
                            backspaceRemoves={false}
                            className={classNames('sm-flex-width', 'sm-flex-order-negative')}
                            clearable={false}
                            searchable={false}
                            disabled={!canChangePort}
                            name="port"
                            noResultsText={i18n._('key-Workspace/Connection-No ports available.')}
                            onChange={onChangePortOption}
                            options={map(machineAgents, (o) => ({
                                value: o.port,
                                label: o.port,
                                manufacturer: o.manufacturer
                            }))}
                            placeholder={i18n._('key-Workspace/Connection-Choose a port')}
                            value={selectedAgent && selectedAgent.port || ''}
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
                )
            }
            {/* State of connected machine */
                isConnected && agent && activeMachine && (
                    <div className="margin-bottom-16 margin-top-12">
                        <div
                            className={classNames(styles['connection-state'], 'padding-bottom-8', 'border-bottom-dashed-default')}
                        >
                            <span className="main-text-normal max-width-304 text-overflow-ellipsis display-inline">
                                {activeMachine.fullName} ({agent.port})
                            </span>
                            <span className={styles['connection-state-icon']}>
                                {
                                    includes([WorkflowStatus.Unknown, WorkflowStatus.Idle], workflowStatus)
                                    && <i className="sm-icon-14 sm-icon-idle" />
                                }
                                {
                                    includes([WorkflowStatus.Paused, WorkflowStatus.Pausing], workflowStatus)
                                    && <i className="sm-icon-14 sm-icon-paused" />
                                }
                                {
                                    includes([WorkflowStatus.Running], workflowStatus)
                                    && <i className="sm-icon-14 sm-icon-running" />
                                }
                            </span>
                        </div>
                        {/* Render status badge for each machine module */}
                        {
                            moduleStatusInfoList.length > 0 && (
                                <div className="sm-flex sm-flex-wrap">
                                    {
                                        moduleStatusInfoList.map(item => (
                                            <MachineModuleStatusBadge
                                                key={item.moduleName}
                                                moduleName={item.moduleName}
                                                status={item.status}
                                            />
                                        ))
                                    }
                                </div>
                            )
                        }
                    </div>
                )
            }
            {/* Connect / Disconnect */}
            <div className="margin-top-16">
                {
                    !isConnected && (
                        <Button
                            width="120px"
                            type="primary"
                            priority="level-two"
                            disabled={!canOpenPort}
                            onClick={openPort}
                            loading={connectLoading}
                            innerClassNames="sm-flex-important justify-center"
                        >
                            {!connectLoading && i18n._('key-Workspace/Connection-Connect')}
                        </Button>
                    )
                }
                {
                    isConnected && (
                        <Button
                            width="120px"
                            type="default"
                            priority="level-two"
                            onClick={closePort}
                            loading={connectLoading}
                        >
                            {!connectLoading && i18n._('key-Workspace/Connection-Disconnect')}
                        </Button>
                    )
                }
                {
                    err && (
                        <span className="margin-horizontal-8">{err}</span>
                    )
                }
            </div>

            {/* Machine Mismatch Modal */}
            <MismatchModal />
        </div>
    );
};

export default SerialConnection;
