import React, { useState, useEffect } from 'react';
import { Dropdown, Menu, Modal } from 'antd';
import api from '../../../../api';
import { machineStore } from '../../../../store/local-storage';
import styles from './styles.styl';
import log from '../../../../lib/log';

import defaultAvatarUrl from '../images/default-avatar.png';

const Avatar: React.FC = () => {
    const [userInfo, setUserInfo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [iframeUrl, setIframeUrl] = useState('');

    const showModal = () => {
        setIsModalVisible(true);
    };
    const handleCancel = () => {
        setIsModalVisible(false);
    };
    const handleToken = async (token: string) => {
        try {
            setLoading(true);
            const { body: res } = await api.getUserInfo(token);
            if (res.code === 200) {
                setUserInfo(res.data);
            } if (res.code === 100010110) {
                log.info(`user login session time out: ${res}`);
                setUserInfo(null);
                machineStore.set('machine-token', '');
            } else {
                log.info(`userinfo load failed: ${res}`);
            }
            setLoading(false);
        } catch (error) {
            log.info(`userinfo load error: ${error}`);
        }
    };
    // define Login
    const handleLogin = () => {
        if (loading) return;
        setIframeUrl('https://id.snapmaker.com?postKey=Luban');
        showModal();
    };
    // define Logout
    const handleLogout = () => {
        machineStore.set('machine-token', '');
        setUserInfo(null);
        setIframeUrl('http://id.snapmaker.com/logout#Luban');
        showModal();
    };
    // define Main
    const handleMain = () => {
        setIframeUrl('https://snapmaker.com');
        showModal();
    };

    useEffect(() => {
        window.addEventListener(
            'message',
            (event) => {
                setIframeUrl('https://snapmaker.com');
                const token = event.data;
                if (token && typeof token === 'string') {
                    if (token === 'logout') {
                        setIframeUrl('https://snapmaker.com');
                    } else {
                        handleToken(token);
                        machineStore.set('machine-token', token);
                    }
                }
            }
        );
        // get token from local storage
        const machineToken = machineStore.get('machine-token');
        if (machineToken) {
            handleToken(machineToken);
        }
    }, []);

    const menu = (
        <Menu>
            <Menu.Item key="profile">
                <div className={styles.userInfoName}>{userInfo?.nickname}</div>
            </Menu.Item>
            <Menu.Item key="com" onClick={handleMain}>
                Snapmaker Website
            </Menu.Item>
            <Menu.Item key="logout" onClick={handleLogout}>
                Logout
            </Menu.Item>
        </Menu>
    );

    return (
        <div id="avatar-box" className={styles.avatarBox}>
            {
                userInfo?.id ? (
                    <Dropdown overlay={menu} trigger={['click', 'hover']}>
                        <div className={styles.userInfo}>
                            <div className={styles.imgBox}>
                                <img src={userInfo?.icon} alt="avatar" />
                            </div>
                        </div>
                    </Dropdown>
                ) : (
                    <div
                        role="button"
                        tabIndex={0}
                        onClick={handleLogin}
                        onKeyDown={handleLogin}
                        aria-disabled={loading}
                        className={styles.imgBox}
                    >
                        <img
                            src={defaultAvatarUrl}
                            alt="avatar"
                        />
                    </div>
                )
            }

            <Modal
                open={isModalVisible}
                onCancel={handleCancel}
                className={styles.iframeModal}
                footer={null}
                getContainer={() => document.getElementById('avatar-box')}
            >
                <div className={styles.iframeBox}>
                    <iframe id="dashboard" key={iframeUrl} src={iframeUrl} title="iframe">
                        <p>Your browser does not support the iframe tag.</p>
                    </iframe>
                </div>
            </Modal>
        </div>
    );
};

export default Avatar;
