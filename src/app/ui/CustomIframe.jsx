import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import isElectron from 'is-electron';
import UniApi from '../lib/uni-api';

const CustomIframe = ({
    children,
    title,
    ...props
}) => {
    const [contentRef, setContentRef] = useState(null);

    // const mountNode = contentRef?.contentWindow ? contentRef?.contentWindow?.document?.body : null;
    const mountNode = null;
    const receiveMessage = (message) => {
        console.log('message', message, UniApi, isElectron);
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
        <iframe {...props} ref={setContentRef} title={title}>
            {mountNode && createPortal(children, mountNode)}
        </iframe>
    );
};
CustomIframe.propTypes = {
    // ...withRouter,
    children: PropTypes.object,
    title: PropTypes.string.isRequired
};
export default CustomIframe;
