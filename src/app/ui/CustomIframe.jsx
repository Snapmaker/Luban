import React, { useState, useEffect } from 'react';
// import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import isElectron from 'is-electron';
import fetch from 'node-fetch';
import UniApi from '../lib/uni-api';
import DownloadProgressBar from './widgets/DownloadProgressBar';
import i18n from '../lib/i18n';
import { Button } from './components/Buttons';
import { downloadPopup } from './widgets/PrintingVisualizer/VisualizerPopup';
import { actions as machineActions } from '../flux/machine';

const CustomIframe = ({
    src,
    children,
    title,
    ...props
}) => {
    const [contentRef, setContentRef] = useState(null);
    const [iframeOnline, setIframeOnline] = useState(false);
    const cancelDownloadPopup = useSelector(state => state.machine.cancelDownloadPopup);
    const minimizeDownloadPopup = useSelector(state => state.machine.minimizeDownloadPopup);
    const dispatch = useDispatch();
    const [showDownloadProgressBar, setShowDownloadProgressBar] = useState(null);
    // const mountNode = null;
    const onMinimize = () => {
        if (minimizeDownloadPopup) {
            downloadPopup('minimize').then((ignore) => {
                dispatch(machineActions.updateFluxAndStorageByKey('minimizeDownloadPopup', !ignore));
                setShowDownloadProgressBar(false);
            }).catch((ignore) => {
                dispatch(machineActions.updateFluxAndStorageByKey('minimizeDownloadPopup', !ignore));
            });
        } else {
            setShowDownloadProgressBar(false);
        }
    };
    const onClose = () => {
        if (cancelDownloadPopup) {
            downloadPopup('cancel').then((ignore) => {
                dispatch(machineActions.updateFluxAndStorageByKey('cancelDownloadPopup', !ignore));
                if (isElectron()) {
                    const browserWindow = window.require('electron').remote.BrowserWindow.getFocusedWindow();
                    browserWindow.webContents.send('cancel-download-case');
                } else {
                    UniApi.Event.emit('appbar-menu:cancel-download-case');
                }
                setShowDownloadProgressBar(false);
            }).catch((ignore) => {
                dispatch(machineActions.updateFluxAndStorageByKey('cancelDownloadPopup', !ignore));
            });
        } else {
            if (isElectron()) {
                const browserWindow = window.require('electron').remote.BrowserWindow.getFocusedWindow();
                browserWindow.webContents.send('cancel-download-case');
            } else {
                UniApi.Event.emit('appbar-menu:cancel-download-case');
            }
            setShowDownloadProgressBar(false);
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
