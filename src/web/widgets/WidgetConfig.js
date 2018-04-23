import store from '../store';

/**
 * Widget configuration store.
 */
class WidgetConfig {
    widgetId = '';

    constructor(widgetId) {
        if (!widgetId) {
            throw new Error('The widget ID cannot be an empty string.');
        }
        this.widgetId = widgetId;
    }

    translateKey(key) {
        const widgetId = this.widgetId;
        return `widgets["${widgetId}"].${key}`;
    }

    get(key, defaultValue) {
        key = this.translateKey(key);
        return store.get(key, defaultValue);
    }

    set(key, value) {
        key = this.translateKey(key);
        return store.set(key, value);
    }

    unset(key) {
        key = this.translateKey(key);
        return store.unset(key);
    }

    replace(key, value) {
        key = this.translateKey(key);
        return store.replace(key, value);
    }
}

export default WidgetConfig;
