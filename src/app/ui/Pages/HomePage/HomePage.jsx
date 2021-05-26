import React, { useEffect } from 'react';
import isElectron from 'is-electron';
import styles from './styles.styl';
import HomeLayout from '../../Layouts/HomeLayout';

// component
import Begin from './Begin';
import QuickStart from './QuickStart';
import MoreInfo from './MoreInfo';

const HomePage = (props) => {
    useEffect(() => {
        if (isElectron()) {
            const ipc = window.require('electron').ipcRenderer;
            ipc.send('getRecentFile');
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
    return (
        <HomeLayout
            className={styles.homepageContainer}
            renderMiddleView={renderMiddleView}
            renderBottomBar={renderBottomBar}
        />
    );
};

export default HomePage;
