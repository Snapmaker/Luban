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
    const [modalTitle, setModalTitle] = useState('');

    const showModal = () => {
        setIsModalVisible(true);
    };
    const handleCancel = () => {
        setIsModalVisible(false);
    };
    const handleToken = async (token: string) => {
        console.log('token24::: ', token);
        try {
            setLoading(true);
            const { body: res } = await api.getUserInfo(token);
            console.log('res::: ', res);
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
            console.log('error::: ', error);
            log.info(`userinfo load error: ${error}`);
        }
    };
    // define Login
    const login = () => {
        if (loading) return;
        setIframeUrl('https://id.snapmaker.com?postKey=Luban');
        showModal();
        setModalTitle('Login');
    };
    // define Logout
    const handleLogout = () => {
        machineStore.set('machine-token', '');
        setUserInfo(null);
        setIframeUrl('http://id.snapmaker.com/logout?postKey=Luban');
        showModal();
        setModalTitle('Log out');
    };
    // define Main
    const handleMain = () => {
        setModalTitle('官网');
        setIframeUrl('https://snapmaker.com');
        showModal();
    };

    useEffect(() => {
        window.addEventListener(
            'message',
            (event) => {
                console.log('event::: ', event);
                setIframeUrl('https://snapmaker.com');
                const token = event.data;
                console.log('token 52::: ', token);
                if (token && typeof token === 'string') {
                    console.log('token 54::: ', token);
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
        console.log('machineToken 61::: ', machineToken);
        if (machineToken) {
            handleToken(machineToken);
        }
        // remove listener
        return () => {
            window.removeEventListener('message', (event) => {
                console.log('event 73::: ', event);
            });
        };
    }, []);

    const menu = (
        <Menu>
            <Menu.Item key="profile">
                <div className={styles.userInfoName}>{userInfo?.nickname}</div>
            </Menu.Item>
            <Menu.Item key="com" onClick={handleMain}>
                官网
            </Menu.Item>
            <Menu.Item key="logout" onClick={handleLogout}>
                Logout
            </Menu.Item>
        </Menu>
    );

    return (
        <div className={styles.avatarBox}>
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
                        onClick={login}
                        onKeyDown={login}
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
                title={modalTitle}
                open={isModalVisible}
                onCancel={handleCancel}
                className={styles.iframeModal}
                footer={null}
            >
                <div>
                    <iframe id="dashboard" src={iframeUrl} title="ww" width="100%" height="600">
                        <p>Your browser does not support the iframe tag.</p>
                    </iframe>
                </div>
            </Modal>
        </div>
    );
};

export default Avatar;
