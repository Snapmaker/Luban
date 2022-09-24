import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import isElectron from 'is-electron';
import UniApi from '../lib/uni-api';
import DownloadProgressBar from './widgets/DownloadProgressBar';
import i18n from '../lib/i18n';

const CustomIframe = ({
    children,
    title,
    ...props
}) => {
    const [contentRef, setContentRef] = useState(null);
    const [showDownloadProgressBar, setShowDownloadProgressBar] = useState(null);

    // const mountNode = contentRef?.contentWindow ? contentRef?.contentWindow?.document?.body : null;
    const mountNode = null;
    const onMinimize = () => {
        setShowDownloadProgressBar(false);
    };
    const onClose = () => {
        if (isElectron()) {
            const browserWindow = window.require('electron').remote.BrowserWindow.getFocusedWindow();
            browserWindow.webContents.send('cancel-download-case');
        } else {
            UniApi.Event.emit('appbar-menu:cancel-download-case');
        }
    };
    const receiveMessage = (message) => {
        setShowDownloadProgressBar(true);
        if (isElectron()) {
            const browserWindow = window.require('electron').remote.BrowserWindow.getFocusedWindow();
            browserWindow.webContents.send('download-case', message.data);
        } else {
            UniApi.Event.emit('appbar-menu:download-case', message.data);
        }
    };
    useEffect(() => {
        window.addEventListener('message', receiveMessage, false);
        return () => {
            window.removeEventListener('message', receiveMessage, false);
        };
    }, [contentRef]);
    return (
        <>
            <iframe {...props} ref={setContentRef} title={title}>
                {mountNode && createPortal(children, mountNode)}
            </iframe>

            {showDownloadProgressBar && (
                <DownloadProgressBar
                    tips={i18n._('downloading case')}
                    subTips={i18n._('after downloading case')}
                    onMinimize={onMinimize}
                    onClose={onClose}
                />
            )}
        </>
    );
};
CustomIframe.propTypes = {
    // ...withRouter,
    children: PropTypes.object,
    title: PropTypes.string.isRequired
};
export default CustomIframe;
