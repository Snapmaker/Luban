/* eslint import/no-dynamic-require: 0 */
import series from 'async/series';
import moment from 'moment';
import React from 'react';
import ReactDOM from 'react-dom';
import { createStore, applyMiddleware } from 'redux';
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import ReactGA from 'react-ga';
import LanguageDetector from 'i18next-browser-languagedetector';
import XHR from 'i18next-xhr-backend';
import { TRACE, DEBUG, INFO, WARN, ERROR } from 'universal-logger';

import settings from './config/settings';
import { controller, screenController } from './lib/controller';
import log from './lib/log';
import { toQueryObject } from './lib/query';
import user from './lib/user';
import { machineStore } from './store/local-storage';
import reducer from './flux';
import App from './ui/App';
import './styles/vendor.styl';
import './styles/app.styl';


series([
    (next) => {
        // Setup log level
        const queryParams = toQueryObject(window.location.search);
        const level = {
            trace: TRACE,
            debug: DEBUG,
            info: INFO,
            warn: WARN,
            error: ERROR
        }[queryParams.log_level || settings.log.level];
        log.setLevel(level);
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
        // Setup locale
        const locale = i18next.language;
        if (locale === 'en') {
            next();
            return;
        }

        require(`bundle-loader!moment/locale/${locale}`)(() => {
            log.debug(`moment: locale=${locale}`);
            moment().locale(locale);
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
                    screenController.connect(() => {
                        next();
                    });
                    return;
                }
                next();
            });
    }
], () => {
    log.info(`${settings.name} ${settings.version}`);

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

    ReactGA.initialize('UA-106828154-1');

    const reduxStore = createStore(reducer, applyMiddleware(thunk));

    ReactDOM.render(
        <Provider store={reduxStore}>
            <App />
        </Provider>,
        container
    );
});
