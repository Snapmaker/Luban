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
    const { isConnected, connectionType, headType } = machine;
    const [enclosureDoorDetection, setEnclosureDoorDetection] = useState(machine?.enclosureDoorDetection);
    const [zAxisModule, setZAxisModule] = useState(machine?.zAxisModule);
    useEffect(() => {
        props.widgetActions.setTitle('Machine Setting');
        dispatch(machineActions.getEnclosureState());
        dispatch(machineActions.getZAxisModuleState());
    }, []);
    useEffect(() => {
        if (isConnected && connectionType === 'serial' && !!headType) {
            props.widgetActions.setDisplay(true);
        } else {
            props.widgetActions.setDisplay(false);
        }
    }, [isConnected, connectionType, headType]);
    const onSave = () => {
        dispatch(machineActions.setZAxisModuleState(zAxisModule));
        dispatch(machineActions.setEnclosureState(enclosureDoorDetection));
    };
    const doorDetectionOptions = [
        {
            value: true,
            label: i18n._('key_ui/widgets/MachineSetting/machineSetting_On')
        },
        {
            value: false,
            label: i18n._('key_ui/widgets/MachineSetting/machineSetting_Off')
        }
    ];
    const zAxisModuleOptions = [
        {
            value: 0,
            label: i18n._('key_ui/widgets/MachineSetting/machineSetting_Standard Module')
        },
        {
            value: 1,
            label: i18n._('key_ui/widgets/MachineSetting/machineSetting_Extension Module')
        }
    ];
    return (
        <div className={styles.machineSettingContainer}>
            <div className={styles.doorDetection}>
                <div className={styles.selectLabel}>
                    {i18n._('key_ui/widgets/MachineSetting/machineSetting_Door Detection')}
                </div>
                <Select
                    clearable={false}
                    searchable={false}
                    name={i18n._('key_ui/widgets/MachineSetting/machineSetting_Door Detection')}
                    options={doorDetectionOptions}
                    value={enclosureDoorDetection}
                    onChange={e => setEnclosureDoorDetection(e.value)}
                />
            </div>
            <div className={styles.zAxis}>
                <div className={styles.selectLabel}>
                    {i18n._('key_ui/widgets/MachineSetting/machineSetting_Z-Axis Extension Module')}
                </div>
                <Select
                    clearable={false}
                    searchable={false}
                    name={i18n._('key_ui/widgets/MachineSetting/machineSetting_Z-Axis Extension Module')}
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
                {i18n._('key_ui/widgets/MachineSetting/machineSetting_Confirm')}
            </Button>
        </div>
    );
};

MachineSetting.propTypes = {
    widgetActions: PropTypes.object.isRequired
};

export default MachineSetting;
