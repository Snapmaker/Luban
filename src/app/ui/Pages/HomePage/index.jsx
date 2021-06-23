import React, { useState, useEffect } from 'react';
import isElectron from 'is-electron';
import i18next from 'i18next';
import { gte } from 'lodash';
import { withRouter } from 'react-router-dom';
import styles from './styles.styl';
import { machineStore } from '../../../store/local-storage';

// component
import Begin from './Begin';
import QuickStart from './QuickStart';
import MoreInfo from './MoreInfo';
import SettingGuideModal from './SettingGuideModal';

const HomePage = (props) => { // Todo, what's the props ?
    const [modalShow, setModalShow] = useState(false);
    useEffect(() => {
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
    return (
        <div className={styles.homepageContainer}>
            <Begin {...props} />
            <QuickStart {...props} />
            <MoreInfo />
            {modalShow
                && (
                    <SettingGuideModal
                        handleModalShow={setModalShow}
                        initLanguage={i18next.language}
                    />
                )
            }
        </div>
    );
};

export default withRouter(HomePage);
