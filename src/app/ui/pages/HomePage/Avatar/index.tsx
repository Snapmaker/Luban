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
    const [webviewUrl, setWebviewUrl] = useState('');
    const [errorTips, setErrorTips] = useState('');
    const isOnline = navigator.onLine;

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

    const showModal = () => {
        setIsModalVisible(true);
        setTimeout(() => {
            const webviewBox = document.getElementById('webviewBox');
            webviewBox?.addEventListener('will-navigate', (event) => {
                const url = event.url;
                if (url.includes('token')) {
                    const token = new URL(url).searchParams.get('token');
                    handleToken(token);
                    machineStore.set('machine-token', token);
                    setWebviewUrl('https://snapmaker.com');
                } else if (url.includes('logout')) {
                    setWebviewUrl('https://snapmaker.com');
                }
            });
            webviewBox?.addEventListener('did-fail-load', (event) => {
                log.info(`Load failed: ${event}`);
                const errorDescription = event.errorDescription;
                setErrorTips(errorDescription || 'Load Error');
            });
        }, 0);
    };
    const handleCancel = () => {
        setIsModalVisible(false);
    };

    // define url
    const loginBaseUrl = 'https://id.snapmaker.com';
    // define Login
    const handleLogin = () => {
        if (loading) return;
        setWebviewUrl(`${loginBaseUrl}?from=Luban`);
        showModal();
    };
    // define Logout
    const handleLogout = () => {
        machineStore.set('machine-token', '');
        setUserInfo(null);
        setWebviewUrl(`${loginBaseUrl}/logout?from=Luban`);
        showModal();
    };
    // define Main
    const handleMain = () => {
        setWebviewUrl('https://snapmaker.com');
        showModal();
    };

    useEffect(() => {
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

    const Content = ({ tips, online, src }) => {
        if (tips) {
            return <div className={styles['error-tips']}>{tips}</div>;
        }

        if (!online) {
            return <div className={styles['not-online']}>ERR_INTERNET_DISCONNECTED</div>;
        }

        return (
            <webview id="webviewBox" src={src} title="webview">
                <p>Your browser does not support the webview tag.</p>
            </webview>
        );
    };

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
                className={styles.webviewModal}
                footer={null}
                destroyOnClose
                getContainer={() => document.getElementById('avatar-box')}
            >
                <div className={styles.contentBox}>
                    <Content tips={errorTips} online={isOnline} src={webviewUrl} />
                </div>
            </Modal>
        </div>
    );
};

export default Avatar;
