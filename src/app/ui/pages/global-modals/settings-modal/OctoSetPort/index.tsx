import { Input } from 'antd';
import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import i18n from '../../../../../lib/i18n';
import connectActions from '../../../../../flux/workspace/actions-connect';
import UniApi from '../../../../../lib/uni-api';
import { machineStore } from '../../../../../store/local-storage';

import SvgIcon from '../../../../components/SvgIcon';
import styles from '../form.styl';

const OctoSetPort: React.FC = () => {
    const dispatch = useDispatch();
    // from local get port
    const storeOctoPort = machineStore.get('octo-port') || 5000;

    const [port, setPort] = useState(storeOctoPort);

    const onSave = async () => {
        if (!port) setPort(storeOctoPort);
        await dispatch(connectActions.onResetPort(port));
        machineStore.set('octo-port', port);
    };

    const handleChangePort = (e) => {
        const value = e.target.value;
        if (/^\d*$/.test(value)) {
            setPort(value);
        }
    };
    useEffect(() => {
        UniApi.Event.on('appbar-menu:settings.save', onSave);

        return () => {
            UniApi.Event.off('appbar-menu:settings.save', onSave);
        };
    }, [onSave]);

    return (
        <>
            <div className={styles['form-container']}>
                <div className="border-bottom-normal padding-bottom-4">
                    <SvgIcon
                        name="TitleSetting"
                        type={['static']}
                    />
                    <span className="margin-left-4">{i18n._('key-App/Settings/MachineSettings-Port Settings')}</span>
                </div>
                <div className={styles['set-port-box']}>
                    <Input value={port} onChange={handleChangePort} placeholder={storeOctoPort} className={styles['port-input']} />
                    <div className={styles['port-tips']}>{i18n._('key-App/Settings/MachineSettings-Port Settings Tips')}</div>
                </div>
            </div>
        </>
    );
};

export default OctoSetPort;
