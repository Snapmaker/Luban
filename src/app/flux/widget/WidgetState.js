import _ from 'lodash';

function customizer(objValue, srcValue) {
    if (_.isArray(srcValue)) {
        return srcValue;
    }
    if (typeof srcValue === 'object') {
        return _.mergeWith(objValue, srcValue, customizer);
    }
    return srcValue;
}

function merge(...args) {
    let data = args[0];
    for (let i = 1; i < args.length; i++) {
        data = _.mergeWith(data, args[i], customizer);
    }
    return data;
}


class WidgetState {
    constructor(store) {
        this.localStore = store;
        this.version = store.version;
        const state = store.state;
        this.widgetState = merge(
            {},
            {
                defaultState: state.defaultState,
                seriesStates: state.seriesStates
            }
        );
        this.localStore.setState(this.widgetState);
        this.series = this.widgetState.defaultState.machine.series;
    }

    updateTabContainer(tab, container, value) {
        const path = `${tab}.${container}`;
        return this.update(path, value);
    }

    get(path) {
        const machineSeriesState = this.widgetState.seriesStates[this.series];
        const dState = this.widgetState.defaultState;
        let value = _.get(machineSeriesState, path);
        if (value === undefined) {
            value = _.get(dState, path);
        }
        return value;
    }

    set(path, value) {
        const machineSeriesState = this.widgetState.seriesStates[this.series];
        const dState = this.widgetState.defaultState;
        if (_.has(machineSeriesState, path)) {
            const newVar = _.get(machineSeriesState, path);
            const v = typeof newVar === 'object' ? merge(_.isArray(newVar) ? [] : {}, newVar, value) : value;
            _.set(machineSeriesState, path, v);
            this.localStore.setState(this.widgetState);
            return this.getState();
        }
        const newVar = _.get(dState, path);
        const v = typeof newVar === 'object' ? merge(_.isArray(newVar) ? [] : {}, newVar, value) : value;
        _.set(dState, path, v);
        this.localStore.setState(this.widgetState);
        return this.getState();
    }

    unset(path) {
        const machineSeriesState = this.widgetState.seriesStates[this.series];
        const dState = this.widgetState.defaultState;
        _.unset(machineSeriesState, path);
        _.unset(dState, path);
        this.localStore.setState(this.widgetState);
    }

    setWidgetState(widgetId, key, value) {
        const path = (key && key !== '') ? `widgets[${widgetId}].${key}` : `widgets[${widgetId}]`;
        return this.set(path, value);
    }

    update(path, value) {
        const machineSeriesState = this.widgetState.seriesStates[this.series];
        const dState = this.widgetState.defaultState;
        if (_.has(machineSeriesState, path)) {
            const newVar = _.get(machineSeriesState, path);
            const v = typeof newVar === 'object' ? merge(_.isArray(newVar) ? [] : {}, newVar, value) : value;
            _.set(machineSeriesState, path, v);
            this.localStore.setState(this.widgetState);
            return this.getState();
        }
        if (_.has(dState, path)) {
            const newVar = _.get(dState, path);
            const v = typeof newVar === 'object' ? merge(_.isArray(newVar) ? [] : {}, newVar, value) : value;
            _.set(dState, path, v);
            this.localStore.setState(this.widgetState);
            return this.getState();
        }
        return null;
    }

    updateWidgetState(widgetId, key, value) {
        const path = `widgets[${widgetId}].${key}`;
        return this.update(path, value);
    }

    getWidgetState(widgetId, key) {
        const path = `widgets[${widgetId}}].${key}}`;
        const machineSeriesState = this.widgetState.seriesStates[this.series];
        const dState = this.widgetState.defaultState;
        return _.get(machineSeriesState, path) || _.get(dState, path);
    }

    toggleWorkspaceWidgetToDefault(widgetId) {
        const defaultPath = 'workspace.default.widgets';

        const defaultWidgets = this.get(defaultPath);

        if (defaultWidgets.indexOf(widgetId) === -1) {
            const push = defaultWidgets.push(widgetId);
            return this.set(defaultPath, push);
        } else {
            defaultWidgets.splice(defaultWidgets.indexOf(widgetId), 1);
            return this.set(defaultPath, defaultWidgets);
        }
    }

    updateSeries(series) {
        this.series = series;
        const path = 'machine.series';
        return this.set(path, series);
    }

    // getDefaultState() {
    //     return merge({}, defaultState, seriesStates[this.series]);
    // }

    getState() {
        return merge({}, this.widgetState.defaultState, this.widgetState.seriesStates[this.series]);
    }
}

export default WidgetState;
