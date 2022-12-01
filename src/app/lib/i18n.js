import i18next from 'i18next';

const t = (...args) => {
    const key = args[0];
    const options = args[1];

    let text = i18next.t(key, options);
    if (typeof text === 'string' && text.length === 0) {
        text = i18next.t(key, { ...options, lng: 'en' });
    }

    return text;
};

function processKey(value, options) {
    const { context, count } = { ...options };
    const containsContext = (context !== undefined) && (context !== null);
    const containsPlural = (typeof count === 'number');

    if (containsContext) {
        value = value + i18next.options.contextSeparator + options.context;
    }
    if (containsPlural) {
        value = `${value}${i18next.options.pluralSeparator}plural`;
    }

    return value;
    // return sha1(value);
}

const _ = (...args) => {
    if ((args.length === 0) || (typeof args[0] === 'undefined')) {
        return i18next.t(...args);
    }

    const [value = '', options = {}] = args;
    const key = processKey(value, options);

    options.defaultValue = value;

    let text = i18next.t(key, options);
    if (typeof text !== 'string' || text.length === 0) {
        text = i18next.t(key, { ...options, lng: 'en' });
    }

    return text;
};

const clearCookies = () => {
    window.document.cookie
        .split(';')
        .forEach((cookie) => {
            document.cookie = `${cookie.replace(/(.+=)([\s\S]*)/ig, '$1').trim()};expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        });
};

export default {
    t,
    _,
    clearCookies
};
