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
    const [isModalVisible, setIsModalVisible] = useState(false); // State for modal visibility

    const showModal = () => {
        setIsModalVisible(true);
    };

    const handleOk = () => {
        setIsModalVisible(false);
    };

    const handleCancel = () => {
        setIsModalVisible(false);
    };

    useEffect(() => {
        showModal(); // open modal after render

        const handleToken = async (token: string) => {
            try {
                setLoading(true);
                const { body: res } = await api.getUserInfo(token);
                if (res.code === 200) {
                    setUserInfo(res.data);
                } else {
                    log.info(`userinfo load failed: ${res}`);
                }
                setLoading(false);
            } catch (error) {
                log.info(`userinfo load error: ${error}`);
            }
        };
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        if (token) {
            machineStore.set('machine-token', token);
            // Remove token from URL
            const url = new URL(window.location.href);
            url.searchParams.delete('token');
            window.history.replaceState({}, '', url.href);

            handleToken(token);
        } else {
            const machineToken = machineStore.get('machine-token');
            if (machineToken) {
                handleToken(machineToken);
            }
        }
    }, []);

    function login() {
        if (loading) return;
        const redirectUrl = `https://id.snapmaker.com?redirect=${window.location.origin}`;
        window.location.href = redirectUrl;
    }

    const handleLogout = () => {
        machineStore.set('machine-token', '');
        setUserInfo(null);
        const redirectUrl = `https://id.snapmaker.com/logout?redirect=${window.location.origin}`;
        window.location.href = redirectUrl;
    };

    const menu = (
        <Menu>
            <Menu.Item key="profile">
                <div className={styles.userInfoName}>{userInfo?.nickname}</div>
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
                title="Modal Title"
                visible={isModalVisible}
                onOk={handleOk}
                onCancel={handleCancel}
                className={styles.iframeModal}
            >
                <div>
                    <iframe src="https://www.snapmaker.com/" title="ww" width="100%" height="600">
                        <p>Your browser does not support the iframe tag.</p>
                    </iframe>
                </div>
            </Modal>
        </div>
    );
};

export default Avatar;
