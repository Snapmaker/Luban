import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import classNames from 'classnames';
import Switch from '../../components/Switch';
import styles from './index.styl';
import {
    SPEED_HIGH,
    SPEED_MEDIUM,
    SPEED_LOW
} from '../../../constants';
import i18n from '../../../lib/i18n';
import log from '../../../lib/log';
import { actions as machineActions } from '../../../flux/machine';

function Purifier({ widgetActions }) {
    const { isConnected, server, connectionType, airPurifier, airPurifierSwitch, airPurifierFanSpeed, airPurifierFilterHealth } = useSelector(state => state.machine);
    const [isFilterEnable, setIsFilterEnable] = useState(true);
    const [workSpeed, setWorkSpeed] = useState(SPEED_HIGH);
    const [filterLife, setFilterLife] = useState(2);
    const dispatch = useDispatch();

    const actions = {
        onHandleFilterEnabled: () => {
            if (connectionType === 'wifi') {
                server.setFilterSwitch(!isFilterEnable, (errMsg, res) => {
                    if (errMsg) {
                        log.error(errMsg);
                        return;
                    }
                    if (res) {
                        setIsFilterEnable(res.airPurifierSwitch);
                    }
                });
            } else {
                dispatch(machineActions.executeGcode(`M1011 F${isFilterEnable ? 0 : workSpeed};`));
            }
            setIsFilterEnable(!isFilterEnable);
        },
        onChangeFilterSpeed: (_workSpeed) => {
            if (connectionType === 'wifi') {
                server.setFilterWorkSpeed(_workSpeed, (errMsg, res) => {
                    if (errMsg) {
                        log.error(errMsg);
                        return;
                    }
                    if (res) {
                        setWorkSpeed(res.airPurifierFanSpeed);
                    }
                });
            } else {
                if (isFilterEnable) {
                    dispatch(machineActions.executeGcode(`M1011 F${_workSpeed};`));
                }
            }
            setWorkSpeed(_workSpeed);
        }
    };

    useEffect(() => {
        widgetActions.setTitle(i18n._('key_ui/widgets/Purifier/Purifier_Air Purifier'));
        if (!isConnected) {
            widgetActions.setDisplay(false);
        }
    }, []);

    useEffect(() => {
        if (airPurifier && isConnected) {
            widgetActions.setDisplay(true);
        } else {
            widgetActions.setDisplay(false);
        }
    }, [isConnected, airPurifier]);

    useEffect(() => {
        if (airPurifierSwitch !== isFilterEnable) {
            setIsFilterEnable(airPurifierSwitch);
        }
    }, [airPurifierSwitch, isFilterEnable]);

    useEffect(() => {
        if (airPurifierFanSpeed !== workSpeed) {
            setWorkSpeed(airPurifierFanSpeed);
        }
    }, [airPurifierFanSpeed, workSpeed]);

    useEffect(() => {
        if (airPurifierFilterHealth !== filterLife) {
            setFilterLife(airPurifierFilterHealth);
        }
    }, [airPurifierFilterHealth, filterLife]);

    return (
        <div className="">
            <div className="sm-flex justify-space-between margin-vertical-8">
                <span>{i18n._('key_ui/widgets/Purifier/Purifier_Switch')}</span>
                <Switch
                    onClick={actions.onHandleFilterEnabled}
                    checked={isFilterEnable}
                />
            </div>
            <div className="sm-flex justify-space-between margin-vertical-8">
                <span>{i18n._('key_ui/widgets/Purifier/Purifier_Fan Speed')}</span>
                <span
                    className={classNames(
                        'border-radius-8',
                        styles['btn-3btns']
                    )}
                >
                    <button
                        type="button"
                        className={classNames(
                            (workSpeed === SPEED_LOW) ? styles.active : styles.passive,
                        )}
                        onClick={() => actions.onChangeFilterSpeed(SPEED_LOW)}
                    >
                        {i18n._('key_ui/widgets/Purifier/Purifier_Low')}
                    </button>
                    <button
                        type="button"
                        className={classNames(
                            (workSpeed === SPEED_MEDIUM) ? styles.active : styles.passive,
                        )}
                        onClick={() => actions.onChangeFilterSpeed(SPEED_MEDIUM)}
                    >
                        {i18n._('key_ui/widgets/Purifier/Purifier_Medium')}
                    </button>
                    <button
                        type="button"
                        className={classNames(
                            (workSpeed === SPEED_HIGH) ? styles.active : styles.passive,
                        )}
                        onClick={() => actions.onChangeFilterSpeed(SPEED_HIGH)}
                    >
                        {i18n._('key_ui/widgets/Purifier/Purifier_High')}
                    </button>
                </span>
            </div>
            <div className="sm-flex justify-space-between margin-vertical-8">
                <span>{i18n._('key_ui/widgets/Purifier/Purifier_Filter Life')}</span>
                <span
                    className={classNames(
                        'border-radius-8',
                        styles.lifeLength
                    )}
                >
                    <span
                        className={classNames(
                            'space',
                            filterLife >= 0 ? styles.active : styles.passive
                        )}
                    />
                    <span
                        className={classNames(
                            'space',
                            filterLife >= 1 ? styles.active : styles.passive
                        )}
                    />
                    <span
                        className={classNames(
                            'space',
                            filterLife >= 2 ? styles.active : styles.passive
                        )}
                    />
                </span>
            </div>
            {(filterLife === 0) && (
                <div className={classNames(styles.notice)}>
                    {i18n._('key_ui/widgets/Purifier/Purifier_You should replace the filter cartridge.')}
                </div>
            )}
        </div>
    );
}
Purifier.propTypes = {
    widgetActions: PropTypes.object.isRequired
};

export default Purifier;
