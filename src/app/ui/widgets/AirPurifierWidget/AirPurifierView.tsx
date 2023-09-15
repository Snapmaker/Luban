import classNames from 'classnames';
import React, { useEffect, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';

import SocketEvent from '../../../communication/socket-events';
import {
    SPEED_HIGH,
    SPEED_LOW,
    SPEED_MEDIUM,
} from '../../../constants';
import { MACHINE_SERIES } from '../../../constants/machines';
import { RootState } from '../../../flux/index.def';
import { controller } from '../../../communication/socket-communication';
import i18n from '../../../lib/i18n';
import Switch from '../../components/Switch';
import styles from './styles.styl';

interface AirPurifierViewProps {
    setDisplay: (display: boolean) => void;
}

const AirPurifierView: React.FC<AirPurifierViewProps> = (props) => {
    const { setDisplay } = props;

    const {
        isConnected,
    } = useSelector((state: RootState) => state.workspace);

    const {
        airPurifier,
        airPurifierSwitch,
        airPurifierFanSpeed,
        airPurifierFilterHealth,
    } = useSelector((state: RootState) => state.workspace, shallowEqual);

    const series = useSelector((state: RootState) => state.machine.series);
    const [isFilterEnable, setIsFilterEnable] = useState(airPurifierSwitch);
    const [workSpeed, setWorkSpeed] = useState(airPurifierFanSpeed || SPEED_HIGH);
    const [filterLife, setFilterLife] = useState(2);

    const actions = {
        onHandleFilterEnabled: () => {
            setIsFilterEnable(!isFilterEnable);
            controller.emitEvent(SocketEvent.SetAirPurifierSwitch, {
                enable: !isFilterEnable,
                value: workSpeed
            });
        },
        onChangeFilterSpeed: (_workSpeed) => {
            setWorkSpeed(_workSpeed);
            controller.emitEvent(SocketEvent.SetAirPurifierStrength, {
                value: _workSpeed
            });
        }
    };

    useEffect(() => {
        if (airPurifier && isConnected && series !== MACHINE_SERIES.ORIGINAL.identifier && series !== MACHINE_SERIES.ORIGINAL_LZ.identifier) {
            setDisplay(true);
        } else {
            setDisplay(false);
        }
    }, [setDisplay, isConnected, airPurifier, series]);

    useEffect(() => {
        if (airPurifierSwitch !== isFilterEnable) {
            setIsFilterEnable(airPurifierSwitch);
        }
    }, [airPurifierSwitch]);

    useEffect(() => {
        if (airPurifierFanSpeed !== workSpeed) {
            setWorkSpeed(airPurifierFanSpeed);
        }
    }, [airPurifierFanSpeed]);

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
                <span className="max-width-132 text-overflow-ellipsis line-height-32">{i18n._('key-Workspace/Purifier-Fan Speed')}</span>
                <span
                    className={classNames(
                        'border-radius-8',
                        styles['btn-3btns'],
                        isFilterEnable ? '' : styles['disabled-btns']
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
                        styles['life-length'],
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
};

export default AirPurifierView;
