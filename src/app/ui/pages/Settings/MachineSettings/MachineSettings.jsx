import React, { useEffect, useState } from 'react';
// import { connect } from 'react-redux';
import { useDispatch, useSelector } from 'react-redux';
// import PropTypes from 'prop-types';
import classNames from 'classnames';
// import isEqual from 'lodash/isEqual';
import Select from '../../../components/Select';
import { NumberInput } from '../../../components/Input';
import i18n from '../../../../lib/i18n';
import { actions as machineActions } from '../../../../flux/machine';
import styles from '../form.styl';
import { MACHINE_SERIES } from '../../../../constants';
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
const machineSeriesOptions = [
    {
        ...MACHINE_SERIES.ORIGINAL
    },
    {
        ...MACHINE_SERIES.A150
    },
    {
        ...MACHINE_SERIES.A250
    },
    {
        ...MACHINE_SERIES.A350
    },
    customOption
];

function MachineSettings() {
    const dispatch = useDispatch();
    const series = useSelector(state => state?.machine?.series);
    const size = useSelector(state => state?.machine?.size);
    const enclosureDoorDetection = useSelector(state => state?.machine?.enclosureDoorDetection);
    const zAxisModule = useSelector(state => state?.machine?.zAxisModule);
    const isConnected = useSelector(state => state?.machine?.isConnected);
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


    const actions = {
        initState: () => {
            setState({
                series: series,
                connectionTimeout: connectionTimeout,
                size: size,
                enclosureDoorDetection: enclosureDoorDetection,
                zAxisModule: zAxisModule
            });
        },
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
        }
    };

    useEffect(() => {
        actions.initState();
        dispatch(machineActions.getEnclosureState());
        dispatch(machineActions.getZAxisModuleState());
    }, [dispatch]);

    useEffect(() => {
        function cleanup() {
            UniApi.Event.off('appbar-menu:settings.save', actions.onSave);
            UniApi.Event.off('appbar-menu:settings.cancel', actions.onCancel);
        }
        cleanup();
        UniApi.Event.on('appbar-menu:settings.save', actions.onSave);
        UniApi.Event.on('appbar-menu:settings.cancel', actions.onCancel);
        return cleanup;
    }, [actions]);

    useEffect(() => {
        setState({
            series: series,
            connectionTimeout: connectionTimeout,
            size: size,
            enclosureDoorDetection: enclosureDoorDetection,
            zAxisModule: zAxisModule
        });
    }, [series, size, enclosureDoorDetection, zAxisModule, connectionTimeout]);

    // const doorDetectionOptions = [
    //     {
    //         value: true,
    //         label: i18n._('On')
    //     },
    //     {
    //         value: false,
    //         label: i18n._('Off')
    //     }
    // ];
    // const zAxisModuleOptions = [
    //     {
    //         value: 0,
    //         label: i18n._('Standard Module')
    //     },
    //     {
    //         value: 1,
    //         label: i18n._('Extension Module')
    //     }
    // ];

    // const stateChanged = (state.series !== series)
    //     || !isEqual(size, state.size)
    //     || !isEqual(enclosureDoorDetection, state.enclosureDoorDetection)
    //     || !isEqual(zAxisModule, state.zAxisModule)
    //     || !isEqual(connectionTimeout, state.connectionTimeout);

    const editable = (state.series === 'Custom');
    return (
        <div className={styles['form-container']} style={{ marginBottom: '55px' }}>
            <p className={styles['form-title']}>{i18n._('Machine')}</p>
            <div className={styles['form-group']}>
                <div className={classNames(styles['form-control'], styles.short)}>
                    <Select
                        clearable={false}
                        searchable={false}
                        disabled={isConnected}
                        name="select-machine"
                        options={machineSeriesOptions}
                        value={state.series}
                        onChange={actions.onChangeMachineSeries}
                    />
                </div>
            </div>
            <div className={styles['form-group']}>
                <span>{i18n._('X (Width)')}</span>
                <div className={classNames(styles['form-control'], styles.short)}>
                    <NumberInput
                        value={state.size.x}
                        disabled={!editable}
                        onChange={actions.onChangeSizeX}
                    />
                    <span className={styles.unit}>mm</span>
                </div>
            </div>
            <div className={styles['form-group']}>
                <span>{i18n._('Y (Depth)')}</span>
                <div className={classNames(styles['form-control'], styles.short)}>
                    <NumberInput
                        value={state.size.y}
                        disabled={!editable}
                        onChange={actions.onChangeSizeY}
                    />
                    <span className={styles.unit}>mm</span>
                </div>
            </div>
            <div className={styles['form-group']}>
                <span>{i18n._('Z (Height)')}</span>
                <div className={classNames(styles['form-control'], styles.short)}>
                    <NumberInput
                        value={state.size.z}
                        disabled={!editable}
                        onChange={actions.onChangeSizeZ}
                    />
                    <span className={styles.unit}>mm</span>
                </div>
            </div>
            {/* <p className={styles['form-title']}>{i18n._('Enclosure')}</p>
            <div className={styles['form-group']}>
                <span>{i18n._('Door Detection')}</span>
                <div className={classNames(styles['form-control'], styles.short)}>
                    <Select
                        clearable={false}
                        searchable={false}
                        name={i18n._('Door Detection')}
                        options={doorDetectionOptions}
                        value={state.enclosureDoorDetection}
                        onChange={actions.onChangeEnclosureState}
                    />
                </div>
            </div>
            <p className={styles['form-title']}>{i18n._('Module')}</p>
            <div className={styles['form-group']}>
                <span>{i18n._('Z-Axis Extension Module')}</span>
                <div className={classNames(styles['form-control'], styles.short)}>
                    <Select
                        clearable={false}
                        searchable={false}
                        name={i18n._('Z-Axis Extension Module')}
                        options={zAxisModuleOptions}
                        value={state.zAxisModule}
                        onChange={actions.onChangeZAxisModuleState}
                    />
                </div>
            </div>
            <p className={styles['form-title']}>{i18n._('Connection')}</p>
            <div className={styles['form-group']}>
                <span>{i18n._('Timeout')}</span>
                <div className={classNames(styles['form-control'], styles.short)}>
                    <Select
                        clearable={false}
                        searchable={false}
                        name={i18n._('Wait Time')}
                        options={[
                            {
                                value: 3000,
                                label: '3s'
                            },
                            {
                                value: 15000,
                                label: '15s'
                            },
                            {
                                value: 30000,
                                label: '30s'
                            }
                        ]}
                        value={state.connectionTimeout}
                        onChange={actions.onChangeConnectionTimeoutState}
                    />
                </div>
            </div> */}
            {/* <div className={styles['form-actions']}>
                <div className="row">
                    <div className="col-12">
                        <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={actions.onCancel}
                        >
                            {i18n._('Cancel')}
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={!stateChanged}
                            onClick={actions.onSave}
                        >
                            <i className="fa fa-save" />
                            <span className="space" />
                            {i18n._('Save Changes')}
                        </button>
                    </div>
                </div>
            </div> */}
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
