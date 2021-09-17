import React, { useEffect, useState } from 'react';
// import { connect } from 'react-redux';
import { useDispatch, useSelector } from 'react-redux';
// import PropTypes from 'prop-types';
// import classNames from 'classnames';
// import isEqual from 'lodash/isEqual';
import Select from '../../../components/Select';
import SvgIcon from '../../../components/SvgIcon';
// import { NumberInput } from '../../../components/Input';
import i18n from '../../../../lib/i18n';
import { actions as machineActions } from '../../../../flux/machine';
import styles from '../form.styl';
import { MACHINE_SERIES, MACHINE_TOOL_HEAD } from '../../../../constants';
import UniApi from '../../../../lib/uni-api';


const customOption = {
    value: 'Custom',
    label: 'Custom',
    setting: {
        size: {
            x: 125,
            y: 125,
            z: 125
        }
    }
};
const printingToolHeadOption = [
    {
        value: MACHINE_TOOL_HEAD.singleExtruderToolheadForSM2.value,
        label: MACHINE_TOOL_HEAD.singleExtruderToolheadForSM2.label
    }, {
        value: MACHINE_TOOL_HEAD.dualExtruderToolheadForSM2.value,
        label: MACHINE_TOOL_HEAD.dualExtruderToolheadForSM2.label
    }
];
const printingToolHeadOptionForOriginal = [
    {
        value: MACHINE_TOOL_HEAD.singleExtruderToolheadForOriginal.value,
        label: MACHINE_TOOL_HEAD.singleExtruderToolheadForOriginal.label
    }
];
const laserToolHeadOption = [
    {
        value: MACHINE_TOOL_HEAD.levelOneLaserToolheadForSM2.value,
        label: MACHINE_TOOL_HEAD.levelOneLaserToolheadForSM2.label
    }, {
        value: MACHINE_TOOL_HEAD.levelTwoLaserToolheadForSM2.value,
        label: MACHINE_TOOL_HEAD.levelTwoLaserToolheadForSM2.label
    }
];
const laserToolHeadOptionForOriginal = [
    {
        value: MACHINE_TOOL_HEAD.levelOneLaserToolheadForOriginal.value,
        label: MACHINE_TOOL_HEAD.levelOneLaserToolheadForOriginal.label
    }, {
        value: MACHINE_TOOL_HEAD.levelTwoLaserToolheadForOriginal.value,
        label: MACHINE_TOOL_HEAD.levelTwoLaserToolheadForOriginal.label
    }
];
const cncToolHeadOptionForOriginal = [
    {
        value: MACHINE_TOOL_HEAD.standardCNCToolheadForOriginal.value,
        label: MACHINE_TOOL_HEAD.standardCNCToolheadForOriginal.label
    }
];
const cncToolHeadOption = [
    {
        value: MACHINE_TOOL_HEAD.standardCNCToolheadForSM2.value,
        label: MACHINE_TOOL_HEAD.standardCNCToolheadForSM2.label
    }
];
const machineSeriesOptions = [
    {
        ...MACHINE_SERIES.ORIGINAL
    },
    {
        ...MACHINE_SERIES.ORIGINAL_LZ
    },
    {
        ...MACHINE_SERIES.A150
    },
    {
        ...MACHINE_SERIES.A250
    },
    {
        ...MACHINE_SERIES.A350
    }
];

function MachineSettings() {
    const dispatch = useDispatch();
    const series = useSelector(state => state?.machine?.series);
    const toolHead = useSelector(state => state?.machine?.toolHead);
    const size = useSelector(state => state?.machine?.size);
    const enclosureDoorDetection = useSelector(state => state?.machine?.enclosureDoorDetection);
    const zAxisModule = useSelector(state => state?.machine?.zAxisModule);
    const isConnected = useSelector(state => state?.machine?.isConnected);
    const connectionTimeout = useSelector(state => state?.machine?.connectionTimeout);

    const [printingToolheadSelected, setPrintingToolheadSelected] = useState(toolHead.printingToolhead);
    const [laserToolheadSelected, setLaserToolheadSelected] = useState(toolHead.laserToolhead);
    const [cncToolheadSelected, setCncToolheadSelected] = useState(toolHead.cncToolhead);
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


    const actions = {
        // Machine Model
        onChangeMachineSeries: (option) => {
            setState({
                ...state,
                series: option.value,
                size: option.setting.size
            });
        },
        onChangeSizeX: (value) => {
            customOption.setting.size.x = value;

            setState(prevState => ({
                ...state,
                size: {
                    ...prevState.size,
                    x: value
                }
            }));
        },
        onChangeSizeY: (value) => {
            customOption.setting.size.y = value;
            setState(prevState => ({
                ...state,
                size: {
                    ...prevState.size,
                    y: value
                }
            }));
        },
        onChangeSizeZ: (value) => {
            customOption.setting.size.z = value;
            setState(prevState => ({
                ...state,
                size: {
                    ...prevState.size,
                    z: value
                }
            }));
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
        onSave: () => {
            dispatch(machineActions.connect.setConnectionType(state.connectionTimeout));
            dispatch(machineActions.updateMachineSeries(state.series));
            dispatch(machineActions.updateMachineSize(state.size));
            dispatch(machineActions.setEnclosureState(state.enclosureDoorDetection));
            dispatch(machineActions.setZAxisModuleState(state.zAxisModule));
            dispatch(machineActions.updateMachineToolHead({
                printingToolhead: printingToolheadSelected,
                laserToolhead: laserToolheadSelected,
                cncToolhead: cncToolheadSelected
            }, state.series));
            window.location.href = '/';
        },
        handleToolheadChange: (e, type) => {
            const nextValue = e.value;
            switch (type) {
                case 'printing':
                    setPrintingToolheadSelected(nextValue);
                    break;
                case 'laser':
                    setLaserToolheadSelected(nextValue);
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

    useEffect(() => {
        if (series === 'A150' || series === 'A250' || series === 'A350') {
            setLaserToolheadSelected(MACHINE_TOOL_HEAD.levelTwoLaserToolheadForSM2.value);
            setPrintingToolheadSelected(MACHINE_TOOL_HEAD.singleExtruderToolheadForSM2.value);
            setCncToolheadSelected(MACHINE_TOOL_HEAD.standardCNCToolheadForSM2.value);
        } else {
            setLaserToolheadSelected(MACHINE_TOOL_HEAD.levelTwoLaserToolheadForOriginal.value);
            setPrintingToolheadSelected(MACHINE_TOOL_HEAD.singleExtruderToolheadForOriginal.value);
            setCncToolheadSelected(MACHINE_TOOL_HEAD.standardCNCToolheadForOriginal.value);
        }
    }, [series]);
    // const editable = (state.series === 'Custom');
    return (
        <div className={styles['form-container']}>
            <div className="border-bottom-normal padding-bottom-4">
                <SvgIcon
                    name="TitleSetting"
                    type={['static']}
                />
                <span className="margin-left-4">{i18n._('Machine')}</span>
            </div>
            <Select
                className="margin-vertical-16"
                searchable={false}
                size="200px"
                disabled={isConnected}
                name="select-machine"
                options={machineSeriesOptions}
                value={state.series}
                onChange={actions.onChangeMachineSeries}
            />
            <div>
                <span className="unit-text margin-right-12">{i18n._('Dimensions')}:</span>
                <span className="main-text-normal">{`${state.size.x} x ${state.size.y} x ${state.size.z} mm`}</span>
            </div>
            <div className="border-bottom-normal padding-bottom-4 margin-top-32">
                <SvgIcon
                    name="TitleSetting"
                    type={['static']}
                />
                <span className="margin-left-4">{i18n._('Head')}</span>
            </div>
            <div className={styles.headDetail}>
                <div className="margin-bottom-16">
                    <div className="main-text-normal margin-bottom-8 margin-top-16">{i18n._('3D Print Toolhead')}</div>
                    <Select
                        value={printingToolheadSelected}
                        options={(state.series === 'Original' || state.series === 'Original Long Z-axis' ? printingToolHeadOptionForOriginal : printingToolHeadOption).map(item => {
                            return {
                                value: item.value,
                                label: i18n._(item.label)
                            };
                        })}
                        onChange={e => actions.handleToolheadChange(e, 'printing')}
                        size="large"
                        disabled
                    />
                </div>
                <div className="margin-bottom-16">
                    <div className="main-text-normal margin-bottom-8">{i18n._('Laser Toolhead')}</div>
                    <Select
                        value={laserToolheadSelected}
                        options={(state.series === 'Original' || state.series === 'Original Long Z-axis' ? laserToolHeadOptionForOriginal : laserToolHeadOption).map(item => {
                            return {
                                value: item.value,
                                label: i18n._(item.label)
                            };
                        })}
                        onChange={e => actions.handleToolheadChange(e, 'laser')}
                        size="large"
                    />
                </div>
                <div className="margin-bottom-16">
                    <div className="main-text-normal margin-bottom-8">{i18n._('CNC Toolhead')}</div>
                    <Select
                        value={cncToolheadSelected}
                        options={(state.series === 'Original' || state.series === 'Original Long Z-axis' ? cncToolHeadOptionForOriginal : cncToolHeadOption).map(item => ({
                            value: item.value,
                            label: i18n._(item.label)
                        }))}
                        onChange={e => actions.handleToolheadChange(e, 'cnc')}
                        size="large"
                        disabled
                    />
                </div>
            </div>
        </div>
    );
}

// const mapStateToProps = (state) => {
//     const machine = state.machine;

//     const { series, size, enclosureDoorDetection, zAxisModule, isConnected, connectionTimeout } = machine;

//     return {
//         series,
//         isConnected,
//         zAxisModule,
//         size,
//         enclosureDoorDetection,
//         connectionTimeout
//     };
// };

// const mapDispatchToProps = (dispatch) => {
//     return {
//         updateMachineSeries: (series) => dispatch(machineActions.updateMachineSeries(series)),
//         updateMachineSize: (size) => dispatch(machineActions.updateMachineSize(size)),
//         getEnclosureState: () => dispatch(machineActions.getEnclosureState()),
//         setEnclosureState: (on) => dispatch(machineActions.setEnclosureState(on)),
//         getZAxisModuleState: () => dispatch(machineActions.getZAxisModuleState()),
//         setZAxisModuleState: (moduleId) => dispatch(machineActions.setZAxisModuleState(moduleId)),
//         setConnectionTimeout: (connectionTimeout) => dispatch(machineActions.connect.setConnectionType(connectionTimeout))
//     };
// };

// export default connect(mapStateToProps, mapDispatchToProps)(MachineSettings);

export default MachineSettings;
