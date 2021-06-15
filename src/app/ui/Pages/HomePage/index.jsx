import React, { useState, useEffect } from 'react';
import isElectron from 'is-electron';
import i18next from 'i18next';
import { gte } from 'lodash';
import styles from './styles.styl';
import HomeLayout from '../../Layouts/HomeLayout';
import { machineStore } from '../../../store/local-storage';

// component
import Begin from './Begin';
import QuickStart from './QuickStart';
import MoreInfo from './MoreInfo';
import SettingGuideModal from './SettingGuideModal';

const HomePage = (props) => {
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
    // view method
    const renderMiddleView = () => {
        return (
            <div>
                <Begin {...props} />
                <QuickStart {...props} />
            </div>
        );
    };

    const renderBottomBar = () => {
        return (
            <div>
                <MoreInfo />
            </div>
        );
    };
    const renderModalView = () => {
        return (
            <SettingGuideModal
                handleModalShow={setModalShow}
                initLanguage={i18next.language}
            />
        );
    };
    return (
        <HomeLayout
            className={styles.homepageContainer}
            renderMiddleView={renderMiddleView}
            renderBottomBar={renderBottomBar}
            renderModalView={modalShow ? renderModalView : null}
        />
    );
};

export default HomePage;
