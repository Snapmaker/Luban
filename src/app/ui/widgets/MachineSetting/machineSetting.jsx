import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from 'react-bootstrap';
import i18n from '../../../lib/i18n';
import styles from './styles.styl';
import { actions as machineActions } from '../../../flux/machine';

// component
import Select from '../../components/Select';

const MachineSetting = (props) => {
    const dispatch = useDispatch();
    const machine = useSelector(state => state?.machine);
    const workspace = useSelector(state => state?.workspace);
    const { isConnected, connectionType, workflowState } = machine;
    const { headType, series } = workspace;
    const [enclosureDoorDetection, setEnclosureDoorDetection] = useState(machine?.enclosureDoorDetection);
    const [zAxisModule, setZAxisModule] = useState(machine?.zAxisModule);
    useEffect(() => {
        props.widgetActions.setTitle(i18n._('key-App/Settings/Settings-Machine Settings'));
        dispatch(machineActions.getEnclosureState());
        dispatch(machineActions.getZAxisModuleState());
    }, []);
    useEffect(() => {
        if (
            isConnected
            && connectionType === 'serial'
            && !!headType
            && (series === 'Original' || series === 'Original Long Z-axis')
            && workflowState !== 'running'
        ) {
            props.widgetActions.setDisplay(true);
        } else {
            props.widgetActions.setDisplay(false);
        }
    }, [isConnected, connectionType, headType, series, workflowState]);
    const onSave = () => {
        dispatch(machineActions.setZAxisModuleState(zAxisModule));
        dispatch(machineActions.setEnclosureState(enclosureDoorDetection));
    };
    const doorDetectionOptions = [
        {
            value: true,
            label: i18n._('key-Workspace/MachineSetting-On')
        },
        {
            value: false,
            label: i18n._('key-Workspace/MachineSetting-Off')
        }
    ];
    const zAxisModuleOptions = [
        {
            value: 0,
            label: i18n._('key-Workspace/MachineSetting-Standard Module')
        },
        {
            value: 1,
            label: i18n._('key-Workspace/MachineSetting-Extension Module')
        }
    ];
    return (
        <div className={styles.machineSettingContainer}>
            <div className={styles.doorDetection}>
                <div className={styles.selectLabel}>
                    {i18n._('key-Workspace/MachineSetting-Door Detection')}
                </div>
                <Select
                    clearable={false}
                    searchable={false}
                    name={i18n._('key-Workspace/MachineSetting-Door Detection')}
                    options={doorDetectionOptions}
                    value={enclosureDoorDetection}
                    onChange={e => setEnclosureDoorDetection(e.value)}
                />
            </div>
            <div className={styles.zAxis}>
                <div className={styles.selectLabel}>
                    {i18n._('key-Workspace/MachineSetting-Z-Axis Extension Module')}
                </div>
                <Select
                    clearable={false}
                    searchable={false}
                    name={i18n._('key-Workspace/MachineSetting-Z-Axis Extension Module')}
                    options={zAxisModuleOptions}
                    value={zAxisModule}
                    onChange={e => setZAxisModule(e.value)}
                />
            </div>
            <Button
                type="primary"
                onClick={onSave}
                className={styles.confirmBtn}
            >
                {i18n._('key-Workspace/MachineSetting-Confirm')}
            </Button>
        </div>
    );
};

MachineSetting.propTypes = {
    widgetActions: PropTypes.object.isRequired
};

export default MachineSetting;
