import React, { useState, useEffect } from 'react';
// import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import isElectron from 'is-electron';
import fetch from 'node-fetch';
import UniApi from '../lib/uni-api';
import DownloadProgressBar from './widgets/DownloadProgressBar';
import i18n from '../lib/i18n';
import { Button } from './components/Buttons';

const CustomIframe = ({
    src,
    children,
    title,
    ...props
}) => {
    const [contentRef, setContentRef] = useState(null);
    const [iframeOnline, setIframeOnline] = useState(false);
    const [showDownloadProgressBar, setShowDownloadProgressBar] = useState(null);
    // console.log('contentRef?.contentWindow', contentRef?.contentWindow);
    // const mountNode = null;
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
    function fetchIframeSrc() {
        const fetchData = async () => {
            await fetch(src, {
                mode: 'no-cors',
                method: 'GET'
            });
            setIframeOnline(true);
        };
        fetchData()
            .catch((e) => {
                console.error(e);
                setIframeOnline(false);
            });
    }
    useEffect(() => {
        window.addEventListener('message', receiveMessage, false);
        return () => {
            window.removeEventListener('message', receiveMessage, false);
        };
    }, [contentRef]);
    useEffect(() => {
        fetchIframeSrc();
    }, []);
    return (
        <>
            {iframeOnline && (
                <iframe {...props} ref={setContentRef} title={title} src={src} />
            )}
            {!iframeOnline && (
                <div>
                    <Button
                        priority="level-two"
                        onClick={fetchIframeSrc}
                    >
                        refresh
                    </Button>
                </div>
            )}

            {showDownloadProgressBar && (
                <DownloadProgressBar
                    tips={i18n._('key-DonwloadList/Downloading files...')}
                    subTips={i18n._('key-DonwloadList/Resources will be loaded automatically when the download is complete.')}
                    onMinimize={onMinimize}
                    onClose={onClose}
                />
            )}
        </>
    );
};
CustomIframe.propTypes = {
    // ...withRouter,
    src: PropTypes.string.isRequired,
    children: PropTypes.object,
    title: PropTypes.string.isRequired
};
export default CustomIframe;
