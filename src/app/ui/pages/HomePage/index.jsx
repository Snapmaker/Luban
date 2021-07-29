import React, { useState, useEffect } from 'react';
import isElectron from 'is-electron';
import i18next from 'i18next';
import { gte } from 'lodash';
import { withRouter } from 'react-router-dom';
import styles from './styles.styl';
import { machineStore } from '../../../store/local-storage';

import { useRenderRecoveryModal } from '../../utils';
import { HEAD_3DP, HEAD_CNC, HEAD_LASER } from '../../../constants';

// component
import Begin from './Begin';
import QuickStart from './QuickStart';
import MoreInfo from './MoreInfo';
import SettingGuideModal from './SettingGuideModal';
import MainToolBar from '../../layouts/MainToolBar';

const HomePage = (props) => { // Todo, what's the props ?
    const [modalShow, setModalShow] = useState(false);
    useEffect(() => {
        document.querySelector('body').setAttribute('style', 'height: calc(100vh - 82px); background: #f5f5f7;');
        const settingStore = machineStore.get('settings');
        if (gte(machineStore.version, '3.16.0') && (!settingStore?.finishGuide || settingStore?.guideVersion !== 1)) {
            setModalShow(true);
        } else {
            setModalShow(false);
        }
    }, []);
    useEffect(() => {
        if (isElectron()) {
            const ipc = window.require('electron').ipcRenderer;
            ipc.send('get-recent-file');
        }
    }, []);

    const printingModal = useRenderRecoveryModal(HEAD_3DP);
    const laserModal = useRenderRecoveryModal(HEAD_LASER);
    const cncModal = useRenderRecoveryModal(HEAD_CNC);

    return (
        <div className={styles.homepageContainer}>
            {props?.isPopup && (
                <MainToolBar
                    leftItems={[
                        {
                            title: 'Back',
                            name: 'MainToolbarBack',
                            action: () => props?.onClose()
                        }
                    ]}
                />
            )}
            <Begin {...props} />
            <div className={styles.secondLine}>
                <QuickStart {...props} />
                <MoreInfo />
            </div>
            {modalShow
                && (
                    <SettingGuideModal
                        handleModalShow={setModalShow}
                        initLanguage={i18next.language}
                    />
                )
            }
            {props?.isPopup || (printingModal || laserModal || cncModal)}
        </div>
    );
};

export default withRouter(HomePage);
