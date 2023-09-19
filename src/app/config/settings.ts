import pkg from '../../package.json';
import log from '../lib/log';

const webroot = '/';

const settings = {
    name: pkg.name,
    version: pkg.version,
    webroot: webroot,
    log: {
        level: 'info' // trace, debug, info, warn, error
    },
    i18next: {
        lowerCaseLng: false,

        // logs out more info (console)
        debug: false,

        // language to lookup key if not found on set language
        fallbackLng: 'en',

        // string or array of namespaces
        ns: [
            'gcode', // G-code
            'resource', // default
        ],
        // default namespace used if not passed to translation function
        defaultNS: 'resource',

        whitelist: [
            'en', // English (default)
            'de', // German
            'es', // Spanish
            'fr', // French
            'it', // Italian
            'ja', // Japanese
            'ko', // Korean
            'ru', // Russian
            'uk', // Ukrainian
            'zh-CN', // Simplified Chinese
        ],

        // array of languages to preload
        preload: [],

        // language codes to lookup, given set language is 'en-US':
        // 'all' --> ['en-US', 'en', 'dev']
        // 'currentOnly' --> 'en-US'
        // 'languageOnly' --> 'en'
        load: 'currentOnly',

        // char to separate keys
        keySeparator: false,

        // char to split namespace from key
        nsSeparator: false,

        interpolation: {
            prefix: '{{',
            suffix: '}}'
        },

        // options for language detection
        // https://github.com/i18next/i18next-browser-languageDetector
        detection: {
            // order and from where user language should be detected
            order: ['querystring', 'cookie', 'localStorage'],

            // keys or params to lookup language from
            lookupQuerystring: 'lang',
            lookupCookie: 'lang',
            lookupLocalStorage: 'lang',

            // cache user language on
            caches: ['localStorage', 'cookie']
        },
        // options for backend
        // https://github.com/i18next/i18next-http-backend
        backend: {
            // path where resources get loaded from
            loadPath: `${webroot}resources/i18n/{{lng}}/{{ns}}.json`,

            // path to post missing resources
            addPath: 'api/resources/i18n/sendMissing/{{lng}}/{{ns}}',

            // your backend server supports multiloading
            // /locales/resources.json?lng=de+en&ns=ns1+ns2
            allowMultiLoading: false,

            // parse data after it has been fetched
            parse: function parse(data, url) {
                log.debug(`Loading resource: url="${url}"`);

                // gcode.json
                // resource.json
                // if (endsWith(url, '/gcode.json') || endsWith(url, '/resource.json')) {
                //     return mapKeys(JSON.parse(data), (value, key) => sha1(key));
                // }

                return JSON.parse(data);
            },

            // allow cross domain requests
            crossDomain: false
        }
    }
};

export default settings;
