import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Select from '../../../components/Select';
import SvgIcon from '../../../components/SvgIcon';
import i18n from '../../../../lib/i18n';
import { actions as machineActions } from '../../../../flux/machine';
import { actions as projectActions } from '../../../../flux/project';
import styles from '../form.styl';
import {
    getMachineOptions,
    getMachineSupportedToolHeadOptions,
    HEAD_CNC,
    HEAD_LASER,
    HEAD_PRINTING,
} from '../../../../constants/machines';
import UniApi from '../../../../lib/uni-api';
import { getCurrentHeadType } from '../../../../lib/url-utils';


function MachineSettings() {
    const dispatch = useDispatch();
    const series = useSelector(state => state?.machine?.series);
    const toolHead = useSelector(state => state?.machine?.toolHead);
    const size = useSelector(state => state?.machine?.size);
    const enclosureDoorDetection = useSelector(state => state?.machine?.enclosureDoorDetection);
    const zAxisModule = useSelector(state => state?.machine?.zAxisModule);
    const connectionTimeout = useSelector(state => state?.machine?.connectionTimeout);

    const [state, setState] = useState({
        series: '',
        size: {
            x: 0,
            y: 0,
            z: 0
        },
        enclosureDoorDetection: false,
        zAxisModule: null,
        connectionTimeout: 3000
    });

    // machine options
    const machineOptions = getMachineOptions();

    // tool head options
    const [printingToolHeadOptions, setPrintingToolHeadOptions] = useState([]);
    const [laserToolHeadOptions, setLaserToolHeadOptions] = useState([]);
    const [cncToolHeadOptions, setCncToolHeadOptions] = useState([]);

    const [printingToolHeadSelected, setPrintingToolHeadSelected] = useState(toolHead.printingToolhead);
    const [laserToolHeadSelected, setLaserToolHeadSelected] = useState(toolHead.laserToolhead);
    const [cncToolHeadSelected, setCncToolHeadSelected] = useState(toolHead.cncToolhead);

    // change options when new machine series selected
    useEffect(() => {
        const printingOptions = getMachineSupportedToolHeadOptions(state.series, HEAD_PRINTING);
        setPrintingToolHeadOptions(printingOptions);

        if (printingOptions.length > 0) {
            setPrintingToolHeadSelected(printingOptions[0].value);
        }

        const laserOptions = getMachineSupportedToolHeadOptions(state.series, HEAD_LASER);
        setLaserToolHeadOptions(laserOptions);

        if (laserOptions.length > 0) {
            setLaserToolHeadSelected(laserOptions[0].value);
        }

        const cncOptions = getMachineSupportedToolHeadOptions(state.series, HEAD_CNC);
        setCncToolHeadOptions(cncOptions);

        if (cncOptions.length > 0) {
            setCncToolHeadSelected(cncOptions[0].value);
        }
    }, [state.series]);

    const actions = {
        // Machine Model
        onChangeMachineSeries: (option) => {
            const machine = option.machine;
            setState({
                ...state,
                series: option.value,
                // size for display, and on save/cancel it is also used for work volume construct
                size: machine.size,
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
        // Save & Cancel
        onCancel: () => {
            setState({
                series: series,
                size: size,
                enclosureDoorDetection: enclosureDoorDetection,
                zAxisModule: zAxisModule,
                connectionTimeout: connectionTimeout
            });
        },
        onSave: async () => {
            dispatch(machineActions.connect.setConnectionType(state.connectionTimeout));
            dispatch(machineActions.updateMachineSeries(state.series));
            dispatch(machineActions.updateMachineSize(state.size));
            dispatch(machineActions.setEnclosureState(state.enclosureDoorDetection));
            dispatch(machineActions.setZAxisModuleState(state.zAxisModule));
            dispatch(machineActions.updateMachineToolHead({
                printingToolhead: printingToolHeadSelected,
                laserToolhead: laserToolHeadSelected,
                cncToolhead: cncToolHeadSelected
            }, state.series));
            const headType = getCurrentHeadType(window.location.href);
            if (headType) {
                await dispatch(projectActions.clearSavedEnvironment(headType));
            }
            window.location.href = '/';
        },
        handleToolheadChange: (option, type) => {
            const nextValue = option.value;
            switch (type) {
                case 'printing':
                    setPrintingToolHeadSelected(nextValue);
                    break;
                case 'laser':
                    setLaserToolHeadSelected(nextValue);
                    break;
                case 'cnc':
                    setCncToolHeadSelected(nextValue);
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
            zAxisModule: zAxisModule
        });
        dispatch(machineActions.getEnclosureState());
        dispatch(machineActions.getZAxisModuleState());
    }, [dispatch, series, connectionTimeout, size, enclosureDoorDetection, zAxisModule]);

    useEffect(() => {
        function cleanup() {
            UniApi.Event.off('appbar-menu:settings.save', actions.onSave);
            UniApi.Event.off('appbar-menu:settings.cancel', actions.onCancel);
        }

        cleanup();
        UniApi.Event.on('appbar-menu:settings.save', actions.onSave);
        UniApi.Event.on('appbar-menu:settings.cancel', actions.onCancel);
        return cleanup;
    }, [actions.onSave, actions.onCancel]);

    useEffect(() => {
        setState({
            series: series,
            connectionTimeout: connectionTimeout,
            size: size,
            enclosureDoorDetection: enclosureDoorDetection,
            zAxisModule: zAxisModule
        });
    }, [series, size, enclosureDoorDetection, zAxisModule, connectionTimeout]);

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
                                        label: i18n._(item.label)
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
        </div>
    );
}

export default MachineSettings;
