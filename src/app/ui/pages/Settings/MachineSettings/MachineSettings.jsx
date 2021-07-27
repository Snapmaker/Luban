import React, { useEffect, useState } from 'react';
// import { connect } from 'react-redux';
import { useDispatch, useSelector } from 'react-redux';
// import PropTypes from 'prop-types';
// import classNames from 'classnames';
// import isEqual from 'lodash/isEqual';
import Select from '../../../components/Select';
import SvgIcon from '../../../components/SvgIcon';
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
            window.location.href = '/';
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

    const editable = (state.series === 'Custom');
    return (
        <div className={styles['form-container']}>
            <div className="border-bottom-normal padding-bottom-4">
                <SvgIcon
                    name="TitleSetting"
                />
                <span className="margin-left-4">{i18n._('Machine')}</span>
            </div>
            <Select
                className="margin-top-16"
                searchable={false}
                size="200px"
                disabled={isConnected}
                name="select-machine"
                options={machineSeriesOptions}
                value={state.series}
                onChange={actions.onChangeMachineSeries}
            />
            <div className="margin-top-16">{i18n._('X (Width)')}</div>
            <div className="position-re sm-flex height-32">
                <NumberInput
                    size="large"
                    value={state.size.x}
                    disabled={!editable}
                    onChange={actions.onChangeSizeX}
                />
                <span className="sm-flex__input-unit-l-128">mm</span>
            </div>
            <div className="margin-top-16">{i18n._('Y (Depth)')}</div>
            <div className="position-re sm-flex height-32">
                <NumberInput
                    size="large"
                    value={state.size.y}
                    disabled={!editable}
                    onChange={actions.onChangeSizeY}
                />
                <span className="sm-flex__input-unit-l-128">mm</span>
            </div>
            <div className="margin-top-16">{i18n._('Z (Height)')}</div>
            <div className="position-re sm-flex height-32">
                <NumberInput
                    size="large"
                    value={state.size.z}
                    disabled={!editable}
                    onChange={actions.onChangeSizeZ}
                />
                <span className="sm-flex__input-unit-l-128">mm</span>
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
