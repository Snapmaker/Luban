/* eslint-disable */
const _ = require('lodash');

const asistantMap = new Map();
let asistantMapInitialized = false;
const allValues = {
};
let affectKey = '';
let hasValue = false;

function flatAffectedValue(insideAffectKey, affectSet, originalAffectSet, isDeep) {
    affectSet.forEach((item) => {
        if (item !== insideAffectKey) {
            originalAffectSet.add(item);
        }
        if (allValues[item] && item !== insideAffectKey) {
            if (!isDeep || (isDeep && !originalAffectSet.has(item))) {
                flatAffectedValue(insideAffectKey, allValues[item], originalAffectSet, true);
            }
        }
    });
}

const allContext = {};

function resolveDefinition(definition, modifiedParams, skipValues = false) {
    // make context
    let shouldReCalcu = true;
    let context = {};
    if (!allContext[definition.definitionId]) {
        context = {
            sum: _.sum,
            map: function (fn, arr) {
                return _.map(arr, fn);
            },
            math: {
                radians: function (degree) {
                    return degree / 180 * Math.PI;
                }
            },
            resolveOrValue: input => (_.isUndefined(context[input]) ? input : context[input]),
            extruderValue: (ignore, input) => context[input],
            extruderValues: input => [context[input]],
            defaultExtruderPosition: () => 0
        };
    } else {
        shouldReCalcu = false;
        context = allContext[definition.definitionId];
    }

    const obj = definition.settings;

    if (shouldReCalcu) {
        for (const key of Object.keys(obj)) {
            const value = obj[key];
            if (value.type && (value.type !== 'category' && value.type !== 'mainCategory')) {
                if (!asistantMapInitialized) {
                    const cloneValue = _.cloneDeep(value);
                    asistantMap.set(key, cloneValue);
                }
                Object.defineProperties(context, {
                    [key]: {
                        get() {
                            if (hasValue) {
                                if (!(allValues[affectKey] instanceof Set)) {
                                    allValues[affectKey] = new Set();
                                }
                                allValues[affectKey].add(key);
                            }
                            return value.default_value;
                        },
                        set(newValue) {
                            value.default_value = newValue;
                        }
                    }
                });
                context[key] = value.default_value;
            }
        }
    }
    for (const [key, insideValue] of asistantMap) {
        affectKey = key;
        try {
            const defaultValue = obj[key].default_value;
            const calcValue = insideValue.calcu_value && eval(`(function calcValue() {
                    hasValue = true;
                    with (context) {
                        return ${insideValue.calcu_value};
                    }
                })()`);
            if (_.isUndefined(calcValue)) {
                hasValue = false;
            }
            const calcMinValue = insideValue.min && eval(`(function calcMinMax() {
                hasValue = true;
                with (context) {
                    return ${insideValue.min};
                }
            })()`);
            const calcMaxValue = insideValue.max && eval(`(function calcMinMax() {
                hasValue = true;
                with (context) {
                    return ${insideValue.max};
                }
            })()`);
            const calcEnabled = insideValue.visible && eval(`(function calcEnable() {
                hasValue = true;
                with (context) {
                    return ${insideValue.visible};
                }
            })()`);

            if (typeof calcEnabled !== 'undefined') {
                definition.settings[key].visible = calcEnabled;
            }

            if (insideValue.type === 'float' || insideValue.type === 'int') {
                if (!_.isNil(calcMinValue)) {
                    definition.settings[key].min = calcMinValue;
                }
                if (!_.isNil(calcMaxValue)) {
                    definition.settings[key].max = calcMaxValue;
                }
                if (Math.abs(calcValue - defaultValue) > 1e-6 && !_.isUndefined(calcValue)) {
                    definition.settings[key].mismatch = true;
                } else {
                    definition.settings[key].mismatch = false;
                }
            } else {
                if (calcValue !== defaultValue && !_.isUndefined(calcValue)) {
                    definition.settings[key].mismatch = true;
                } else {
                    definition.settings[key].mismatch = false;
                }
            }
        } catch (e) {
            console.error(e, insideValue.visible);
        }
    }
    asistantMapInitialized = true;

    Object.entries(allValues).forEach(([key, affectSet]) => {
        flatAffectedValue(key, new Set(affectSet), affectSet);
    });


    let allAsistantArray = new Set();
    if (modifiedParams) {
        modifiedParams.forEach((param) => {
            allAsistantArray.add({
                param: param[0],
                index: 0
            });
            Object.entries(allValues).forEach(([valueKey, valueItem]) => {
                const valueArray = Array.from(valueItem);
                const indexOfValue = valueArray.indexOf(param[0]);
                if (indexOfValue > -1) {
                    allAsistantArray.add({
                        param: valueKey,
                        index: indexOfValue
                    });
                }
            });
        });
        allAsistantArray = Array.from(allAsistantArray)
            .sort((a, b) => {
                return a.index - b.index;
            })
            .map(d => d.param);
        // console.log('allAsistantArray', modifiedParams, allAsistantArray);
    }

    // calc value & default_value
    for (const key of allAsistantArray) {
        const value = _.cloneDeep(asistantMap.get(key));
        try {
            let defaultValue;
            const calcValue = value.calcu_value && eval(`(function calcValue() {
                with (context) {
                    return ${value.calcu_value};
                }
            })()`);
            const calcMinValue = value.min && eval(`(function calcMinMax() {
                with (context) {
                    return ${value.min};
                }
            })()`);
            const calcMaxValue = value.max && eval(`(function calcMinMax() {
                with (context) {
                    return ${value.max};
                }
            })()`);
            const calcEnabled = value.visible && eval(`(function calcEnable() {
                with (context) {
                    return ${value.visible};
                }
            })()`);

            if (typeof calcValue !== 'undefined') {
                if (value.type === 'float' || value.type === 'int') {
                    defaultValue = Number((calcValue).toFixed(3));
                }else {
                    defaultValue = calcValue;
                }
                if (!skipValues) {
                    definition.settings[key].default_value = defaultValue;
                }
            }
            if (typeof calcEnabled !== 'undefined') {
                definition.settings[key].visible = calcEnabled;
            }

            const modifiedParamItem = modifiedParams && modifiedParams.find(item => item[0] === key);
            if (modifiedParamItem) {
                defaultValue = modifiedParamItem[1];
                context[key] = defaultValue;
                if (!skipValues) {
                    definition.settings[key].default_value = defaultValue;
                }
            }

            if (typeof calcMaxValue !== 'undefined' && defaultValue > calcMaxValue) {
                defaultValue = calcMaxValue;
                context[key] = defaultValue;
                if (!skipValues) {
                    definition.settings[key].default_value = defaultValue;
                }
            }
            if (typeof calcMinValue !== 'undefined' && defaultValue < calcMinValue) {
                defaultValue = calcMinValue;
                context[key] = defaultValue;
                if (!skipValues) {
                    definition.settings[key].default_value = defaultValue;
                }
            }
            if (value.type === 'float' || value.type === 'int') {
                if (Math.abs(calcValue - defaultValue) > 1e-6 && !_.isUndefined(calcValue)) {
                    definition.settings[key].mismatch = true;
                } else {
                    definition.settings[key].mismatch = false;
                }
            } else {
                if (calcValue !== defaultValue && !_.isUndefined(calcValue)) {
                    definition.settings[key].mismatch = true;
                } else {
                    definition.settings[key].mismatch = false;
                }
            }
        } catch (e) {
            console.error(e, key);
        }
    }
}


module.exports = {
    resolveDefinition
};
