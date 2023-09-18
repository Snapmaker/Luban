import { Checkbox } from 'antd';
import type { CheckboxValueType } from 'antd/es/checkbox/Group';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
    findMachineByName,
    findMachineModule,
    getMachineOptions,
    getMachineSupportedToolOptions,
    HEAD_CNC,
    HEAD_LASER,
    HEAD_PRINTING,
} from '../../../../../constants/machines';
import { RootState } from '../../../../../flux/index.def';
import { actions as machineActions } from '../../../../../flux/machine';
import { actions as projectActions } from '../../../../../flux/project';
import { actions as workspaceActions } from '../../../../../flux/workspace';
import i18n from '../../../../../lib/i18n';
import UniApi from '../../../../../lib/uni-api';
import { getCurrentHeadType } from '../../../../../lib/url-utils';
import Select from '../../../../components/Select';
import SvgIcon from '../../../../components/SvgIcon';
import styles from '../form.styl';


const MachineSettings: React.FC = () => {
    const series = useSelector((state: RootState) => state.machine?.series);
    const toolHead = useSelector((state: RootState) => state.machine?.toolHead);
    const modules = useSelector((state: RootState) => state.machine.modules) as string[];

    const size = useSelector((state: RootState) => state.machine?.size);
    const enclosureDoorDetection = useSelector((state: RootState) => state.machine?.enclosureDoorDetection);
    const zAxisModule = useSelector((state: RootState) => state.machine?.zAxisModule);
    const connectionTimeout = useSelector((state: RootState) => state.machine?.connectionTimeout);

    const [state, setState] = useState({
        series: '',
        size: [0, 0, 0],
        enclosureDoorDetection: false,
        zAxisModule: null,
        connectionTimeout: 3000,
        modules: modules,
    });

    // machine options
    const machineOptions = useMemo(() => getMachineOptions(), []);

    const machine = useMemo(() => {
        return findMachineByName(state.series);
    }, [state.series]);

    // tool head options
    const [printingToolHeadOptions, setPrintingToolHeadOptions] = useState([]);
    const [laserToolHeadOptions, setLaserToolHeadOptions] = useState([]);
    const [cncToolHeadOptions, setCncToolHeadOptions] = useState([]);

    const [printingToolHeadSelected, setPrintingToolHeadSelected] = useState(toolHead.printingToolhead);
    const [laserToolHeadSelected, setLaserToolHeadSelected] = useState(toolHead.laserToolhead);
    const [cncToolHeadSelected, setCncToolHeadSelected] = useState(toolHead.cncToolhead);

    // change options when new machine series selected
    useEffect(() => {
        const printingOptions = getMachineSupportedToolOptions(state.series, HEAD_PRINTING);
        setPrintingToolHeadOptions(printingOptions);

        if (printingOptions.length > 0) {
            const found = printingOptions.find(option => option.value === printingToolHeadSelected);
            if (!found) {
                setPrintingToolHeadSelected(printingOptions[0].value);
            }
        }

        const laserOptions = getMachineSupportedToolOptions(state.series, HEAD_LASER);
        setLaserToolHeadOptions(laserOptions);

        if (laserOptions.length > 0) {
            const found = laserOptions.find(option => option.value === laserToolHeadSelected);
            if (!found) {
                setLaserToolHeadSelected(laserOptions[0].value);
            }
        }

        const cncOptions = getMachineSupportedToolOptions(state.series, HEAD_CNC);
        setCncToolHeadOptions(cncOptions);

        if (cncOptions.length > 0) {
            const found = cncOptions.find(option => option.value === cncToolHeadSelected);
            if (!found) {
                setCncToolHeadSelected(cncOptions[0].value);
            }
        }
    }, [state.series]);

    // machine modules options
    const [machineModuleOptions, setMachineModuleOptions] = useState([]);

    useEffect(() => {
        if (machine && machine.metadata?.modules) {
            const options = [];

            for (const moduleOptions of machine.metadata.modules) {
                const machineModule = findMachineModule(moduleOptions.identifier);

                if (machineModule) {
                    options.push({
                        value: moduleOptions.identifier,
                        label: machineModule.name,
                    });
                }
            }

            setMachineModuleOptions(options);
        } else {
            setMachineModuleOptions([]);
        }
    }, [machine]);

    const onCheckMachineModule = useCallback((checkedValues: CheckboxValueType[]) => {
        setState((previousState) => {
            return Object.assign({}, previousState, { modules: checkedValues });
        });
    }, []);

    const dispatch = useDispatch();

    const actions = {
        // Machine Model
        onChangeMachineSeries: (option) => {
            setState({
                ...state,
                series: option.value,
                // size for display, and on save/cancel it is also used for work volume construct
                size: option.machine.metadata.size,
            });
        },
        // Enclosure
        onChangeEnclosureState: (option) => {
            setState({
                ...state,
                enclosureDoorDetection: option.value
            });
        },
        // Extension z-axis module select
        onChangeZAxisModuleState: (option) => {
            setState({
                ...state,
                zAxisModule: option.value
            });
        },
        onChangeConnectionTimeoutState: (option) => {
            setState({
                ...state,
                connectionTimeout: option.value
            });
        },
        handleToolheadChange: (option, type) => {
            switch (type) {
                case 'printing':
                    setPrintingToolHeadSelected(option.value);
                    break;
                case 'laser':
                    setLaserToolHeadSelected(option.value);
                    break;
                case 'cnc':
                    setCncToolHeadSelected(option.value);
                    break;
                default:
                    break;
            }
        }
    };

    useEffect(() => {
        setState({
            series: series,
            connectionTimeout: connectionTimeout,
            size: size,
            enclosureDoorDetection: enclosureDoorDetection,
            zAxisModule: zAxisModule,
            modules,
        });
    }, [series, size, enclosureDoorDetection, zAxisModule, connectionTimeout, modules]);

    useEffect(() => {
        setState({
            series: series,
            connectionTimeout: connectionTimeout,
            size: size,
            enclosureDoorDetection: enclosureDoorDetection,
            zAxisModule: zAxisModule,
            modules,
        });
        dispatch(machineActions.getEnclosureState());
        dispatch(machineActions.getZAxisModuleState());
    }, [
        dispatch,
        series, connectionTimeout, size, enclosureDoorDetection, zAxisModule, modules,
    ]);


    // Save changes
    const onSave = useCallback(async () => {
        dispatch(workspaceActions.connect.setConnectionTimeout(state.connectionTimeout));
        dispatch(machineActions.updateMachineSeries(state.series));
        dispatch(machineActions.updateMachineSize(state.size));
        dispatch(machineActions.setEnclosureState(state.enclosureDoorDetection));
        dispatch(machineActions.setZAxisModuleState(state.zAxisModule));
        dispatch(machineActions.updateMachineToolHead({
            printingToolhead: printingToolHeadSelected,
            laserToolhead: laserToolHeadSelected,
            cncToolhead: cncToolHeadSelected
        }, state.series));
        dispatch(machineActions.setMachineModules(state.modules));

        // save and redirect
        const headType = getCurrentHeadType(window.location.href);
        if (headType) {
            await dispatch(projectActions.clearSavedEnvironment(headType));
        }
        window.location.href = '/';
    }, [dispatch, state, printingToolHeadSelected, laserToolHeadSelected, cncToolHeadSelected]);

    const onCancel = useCallback(() => {
        setState({
            series: series,
            size: size,
            enclosureDoorDetection: enclosureDoorDetection,
            zAxisModule: zAxisModule,
            connectionTimeout: connectionTimeout,
            modules,
        });
    }, [series, size, enclosureDoorDetection, zAxisModule, connectionTimeout, modules]);

    useEffect(() => {
        UniApi.Event.on('appbar-menu:settings.save', onSave);
        UniApi.Event.on('appbar-menu:settings.cancel', onCancel);

        return () => {
            UniApi.Event.off('appbar-menu:settings.save', onSave);
            UniApi.Event.off('appbar-menu:settings.cancel', onCancel);
        };
    }, [onSave, onCancel]);

    return (
        <div className={styles['form-container']}>
            <div className="border-bottom-normal padding-bottom-4">
                <SvgIcon
                    name="TitleSetting"
                    type={['static']}
                />
                <span className="margin-left-4">{i18n._('key-App/Settings/MachineSettings-Machine')}</span>
            </div>
            <Select
                className="margin-vertical-16"
                searchable={false}
                size="200px"
                name="select-machine"
                options={machineOptions}
                value={state.series}
                onChange={actions.onChangeMachineSeries}
            />
            <div>
                <span className="unit-text margin-right-12">{i18n._('key-App/Settings/MachineSettings-Dimensions')}:</span>
                <span className="main-text-normal">{`${state.size.x} x ${state.size.y} x ${state.size.z} mm`}</span>
            </div>
            <div className="border-bottom-normal padding-bottom-4 margin-top-32">
                <SvgIcon
                    name="TitleSetting"
                    type={['static']}
                />
                <span className="margin-left-4">{i18n._('key-App/Settings/MachineSettings-Head')}</span>
            </div>
            <div className={styles['head-detail']}>
                {
                    printingToolHeadOptions.length > 0 && (
                        <div className="margin-bottom-16">
                            <div className="main-text-normal margin-bottom-8 margin-top-16">{i18n._('key-App/Settings/MachineSettings-3D Print Toolhead')}</div>
                            <Select
                                value={printingToolHeadSelected}
                                options={printingToolHeadOptions.map(item => {
                                    return {
                                        value: item.value,
                                        label: item.label,
                                    };
                                })}
                                onChange={e => actions.handleToolheadChange(e, 'printing')}
                                size="large"
                                disabled={printingToolHeadOptions.length <= 1}
                            />
                        </div>
                    )
                }
                {
                    laserToolHeadOptions.length > 0 && (
                        <div className="margin-bottom-16">
                            <div className="main-text-normal margin-bottom-8">{i18n._('key-App/Settings/MachineSettings-Laser Toolhead')}</div>
                            <Select
                                value={laserToolHeadSelected}
                                options={laserToolHeadOptions.map(item => {
                                    return {
                                        value: item.value,
                                        label: i18n._(item.label)
                                    };
                                })}
                                onChange={e => actions.handleToolheadChange(e, 'laser')}
                                size="large"
                                disabled={laserToolHeadOptions.length <= 1}
                            />
                        </div>

                    )
                }
                {
                    cncToolHeadOptions.length > 0 && (
                        <div className="margin-bottom-16">
                            <div className="main-text-normal margin-bottom-8">{i18n._('key-App/Settings/MachineSettings-CNC Toolhead')}</div>
                            <Select
                                value={cncToolHeadSelected}
                                options={cncToolHeadOptions.map(item => ({
                                    value: item.value,
                                    label: i18n._(item.label)
                                }))}
                                onChange={e => actions.handleToolheadChange(e, 'cnc')}
                                size="large"
                                disabled={cncToolHeadOptions.length <= 1}
                            />
                        </div>

                    )
                }
            </div>

            {
                machineModuleOptions.length > 0 && (
                    <div className="border-bottom-normal padding-bottom-4 margin-top-32">
                        <SvgIcon
                            name="TitleSetting"
                            type={['static']}
                        />
                        <span className="margin-left-4">{i18n._('key-App/Settings/MachineSettings-Modules')}</span>
                    </div>
                )
            }

            {
                machineModuleOptions.length > 0 && (
                    <div className={classNames(styles['head-detail'], 'margin-top-8')}>
                        <div className="margin-bottom-16">
                            <Checkbox.Group
                                options={machineModuleOptions}
                                onChange={onCheckMachineModule}
                                defaultValue={state.modules}
                            />
                        </div>
                    </div>
                )
            }
        </div>
    );
};

export default MachineSettings;
