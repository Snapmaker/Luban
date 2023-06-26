import { ConfigProvider } from 'antd';
import 'antd/dist/antd.css';
import series from 'async/series';
import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import XHR from 'i18next-xhr-backend';
import React from 'react';
import ReactDOM from 'react-dom';
import { initReactI18next } from 'react-i18next';
import { Provider } from 'react-redux';

import settings from './config/settings';
import { controller } from './lib/controller';
import { initialize } from './lib/gaEvent';
import log from './lib/log';
import user from './lib/user';
import reduxStore from './store';
import { machineStore } from './store/local-storage';
import './styles/app.styl';
import './styles/vendor.styl';
import workerManager from './lib/manager/workerManager';
import App from './ui/App';

series([
    (next) => {
        // Setup log level
        log.setLevel(settings.log.level);
        next();
    },
    (next) => {
        // Setup i18next
        i18next
            .use(XHR)
            .use(LanguageDetector)
            .use(initReactI18next)
            .init(settings.i18next, () => {
                next();
            });
    },
    (next) => {
        const token = machineStore.get('session.token');
        user.signin({ token: token })
            .then(({ authenticated }) => {
                if (authenticated) {
                    log.debug('Create and establish a WebSocket connection');
                    controller.connect(() => {
                        next();
                    });
                    return;
                }
                next();
            });
    },
    (next) => {
        workerManager.initPool();
        next();
    },
], () => {
    log.info(`Launching App ${settings.name}@${settings.version}...`);

    // Prevent browser from loading a drag-and-dropped file
    // http://stackoverflow.com/questions/6756583/prevent-browser-from-loading-a-drag-and-dropped-file
    window.addEventListener('dragover', (e) => {
        e = e || window.event;
        e.preventDefault();
    }, false);

    window.addEventListener('drop', (e) => {
        e = e || window.event;
        e.preventDefault();
    }, false);

    // Hide loading
    const loading = document.getElementById('loading');
    loading && loading.remove();

    // Change background color after loading complete
    const body = document.querySelector('body');
    body.style.backgroundColor = '#f8f8f8'; // sidebar background color

    const container = document.createElement('div');
    document.body.appendChild(container);
    const userId = machineStore.get('userId');
    initialize(userId);

    ReactDOM.render(
        <ConfigProvider autoInsertSpaceInButton={false}>
            <Provider store={reduxStore}>
                <App />
            </Provider>
        </ConfigProvider>,
        container
    );
});
