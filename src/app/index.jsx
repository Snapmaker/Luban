import { ConfigProvider } from 'antd';
import 'antd/dist/antd.css';
import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import i18nHttpApi from 'i18next-http-backend';
import once from 'lodash/once';
import React from 'react';
import ReactDOM from 'react-dom';
import { initReactI18next } from 'react-i18next';
import { Provider } from 'react-redux';

import settings from './config/settings';
import { controller } from './communication/socket-communication';
import { listenForBackendOrigin, whenBackendOrigin } from './lib/backend-origin';
import { initialize } from './lib/gaEvent';
import log from './lib/log';
import user from './lib/user';
import reduxStore from './store';
import { machineStore } from './store/local-storage';
import './styles/app.styl';
import './styles/vendor.styl';
import workerManager from './lib/manager/workerManager';
import App from './ui/App';
import { formatTimeline as formatStartupTimeline, mark as startupMark, markAt as startupMarkAt } from '../startup-timeline';


// Marked here, at module scope, so the gap from navigation to the first line
// of app code (bundle download + parse) is visible in the table.
if (typeof performance !== 'undefined' && performance.timeOrigin) {
    startupMarkAt('renderer: document start', performance.timeOrigin);
}
startupMark('renderer: script eval');

function setupLog() {
    log.setLevel(settings.log.level);
}

// Translations are the one thing worth waiting for -- painting without them
// shows raw keys. Capped so an unreachable backend delays the paint by at most
// I18N_TIMEOUT; i18next carries on loading in the background either way.
const I18N_TIMEOUT = 3000;

async function setupI18next() {
    return new Promise((resolve) => {
        const done = once(resolve);

        i18next
            .use(i18nHttpApi)
            .use(LanguageDetector)
            .use(initReactI18next)
            .init(settings.i18next, () => {
                done();
            });

        setTimeout(() => {
            if (!i18next.isInitialized) {
                log.warn(`i18n not ready after ${I18N_TIMEOUT}ms, painting anyway`);
            }
            done();
        }, I18N_TIMEOUT);
    });
}

function setupWorkerManager() {
    workerManager.initPool();
}

async function setup() {
    log.info('Bootstrap');

    // Setup log level
    setupLog();

    // Find out where the backend is before anything asks for it
    listenForBackendOrigin();

    // Setup i18n
    await setupI18next();
    startupMark('renderer: i18n ready');

    // Setup worker
    setupWorkerManager();

    log.info('Bootstrap finished.');
}

function renderApp() {
    log.info(`Launching Snapmaker Luban v${settings.version}...`);

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
        container,
        () => {
            startupMark('renderer: first paint');
            log.info(`\n${formatStartupTimeline('Luban startup - renderer')}`);
        }
    );
}

// Authenticate and open the socket. Deliberately not awaited: nothing on the
// home screen needs a session, and controller.connect()'s callback only fires
// once the server answers -- which used to mean an unreachable backend left the
// user staring at the spinner for ever.
function connectBackend() {
    // The page can be up before the server is, so wait to be told where it is
    // rather than firing at a URL that would resolve to the file handler.
    return whenBackendOrigin().then(() => {
        startupMark('renderer: backend origin known');

        const token = machineStore.get('session.token');

        return user.signin({ token: token })
            .then(({ authenticated }) => {
                startupMark('renderer: signin done');
                if (!authenticated) {
                    log.warn('Not authenticated; socket not opened');
                    return;
                }
                controller.connect(() => {
                    startupMark('renderer: socket connected');
                });
            });
    })
        .catch(err => log.error('Backend connect failed', err));
}

setup()
    .catch(err => log.error('Bootstrap failed', err))
    .then(() => {
        renderApp();
        connectBackend();
    });
