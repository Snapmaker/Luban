import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import classNames from 'classnames';
import Switch from '../../components/Switch';
import styles from './index.styl';
import {
    SPEED_HIGH,
    SPEED_MEDIUM,
    SPEED_LOW,
    CONNECTION_FILTER_SWITCH,
    CONNECTION_FILTER_WORKSPEED,
    MACHINE_SERIES
} from '../../../constants';
import i18n from '../../../lib/i18n';
// import log from '../../../lib/log';
import { controller } from '../../../lib/controller';

function Purifier({ widgetActions }) {
    const { isConnected, airPurifier, airPurifierSwitch, airPurifierFanSpeed, airPurifierFilterHealth } = useSelector(state => state.machine);
    const series = useSelector(state => state.machine.series);
    const [isFilterEnable, setIsFilterEnable] = useState(true);
    const [workSpeed, setWorkSpeed] = useState(SPEED_HIGH);
    const [filterLife, setFilterLife] = useState(2);

    const actions = {
        onHandleFilterEnabled: () => {
            controller.emitEvent(CONNECTION_FILTER_SWITCH, {
                enable: !isFilterEnable,
                value: workSpeed
            });
            setIsFilterEnable(!isFilterEnable);
        },
        onChangeFilterSpeed: (_workSpeed) => {
            controller.emitEvent(CONNECTION_FILTER_WORKSPEED, {
                value: _workSpeed
            });
            setWorkSpeed(_workSpeed);
        }
    };

    useEffect(() => {
        widgetActions.setTitle(i18n._('key-Workspace/Purifier-Air Purifier'));
        if (!isConnected) {
            widgetActions.setDisplay(false);
        }
    }, []);

    useEffect(() => {
        if (airPurifier && isConnected && series !== MACHINE_SERIES.ORIGINAL.value && series !== MACHINE_SERIES.ORIGINAL_LZ.value) {
            widgetActions.setDisplay(true);
        } else {
            widgetActions.setDisplay(false);
        }
    }, [isConnected, airPurifier, series]);

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
                <span>{i18n._('key-Workspace/Purifier-Switch')}</span>
                <Switch
                    onClick={actions.onHandleFilterEnabled}
                    checked={isFilterEnable}
                />
            </div>
            <div className="sm-flex justify-space-between margin-vertical-8">
                <span>{i18n._('key-Workspace/Purifier-Fan Speed')}</span>
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
                        {i18n._('key-Workspace/Purifier-Low')}
                    </button>
                    <button
                        type="button"
                        className={classNames(
                            (workSpeed === SPEED_MEDIUM) ? styles.active : styles.passive,
                        )}
                        onClick={() => actions.onChangeFilterSpeed(SPEED_MEDIUM)}
                    >
                        {i18n._('key-Workspace/Purifier-Medium')}
                    </button>
                    <button
                        type="button"
                        className={classNames(
                            (workSpeed === SPEED_HIGH) ? styles.active : styles.passive,
                        )}
                        onClick={() => actions.onChangeFilterSpeed(SPEED_HIGH)}
                    >
                        {i18n._('key-Workspace/Purifier-High')}
                    </button>
                </span>
            </div>
            <div className="sm-flex justify-space-between margin-vertical-8">
                <span>{i18n._('key-Workspace/Purifier-Filter Life')}</span>
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
                    {i18n._('key-Workspace/Purifier-You should replace the filter cartridge.')}
                </div>
            )}
        </div>
    );
}
Purifier.propTypes = {
    widgetActions: PropTypes.object.isRequired
};

export default Purifier;
