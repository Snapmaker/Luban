/* eslint-disable */
const _ = require('lodash');
import { sum, isUndefined, isNil, cloneDeep } from 'lodash';

// We put with statement
import SettingResolverContext from './parameter-context.es5';

const assistantMap = new Map();
const allValues = {};

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

function getContext(definition) {

}

function addAffect(affectKey, key) {
    if (!(allValues[affectKey] instanceof Set)) {
        allValues[affectKey] = new Set();
    }
    allValues[affectKey].add(key);
}

/**
 *
 * @param definition
 * @param modifiedParams
 * @param skipValues - Not overwrite value to calculated value
 */
export function resolveParameterValues(definition, modifiedParams, skipValues = false) {
    let context;
    let affectKey = '';
    if (!allContext[definition.definitionId]) {
        // Create a new context
        const ctx = {
            sum: sum,
            math: {
                radians: function (degree) {
                    return degree / 180 * Math.PI;
                }
            },
            resolveOrValue: input => (isUndefined(context[input]) ? input : context[input]),
            extruderValue: (ignore, input) => context[input],
            extruderValues: input => [context[input]],
            defaultExtruderPosition: () => 0
        };

        const newContext = new SettingResolverContext();
        newContext.setContext(ctx);

        const obj = definition.settings;
        for (const key of Object.keys(obj)) {
            const value = obj[key];
            if (value.type && (value.type !== 'category' && value.type !== 'mainCategory')) {
                if (!assistantMap.get(key)) {
                    const cloneValue = cloneDeep(value);
                    assistantMap.set(key, cloneValue);
                }

                newContext.defineProperty(
                    key,
                    () => {
                        return value.default_value;
                    },
                    (v) => {
                        value.default_value = v;
                    }
                );

                ctx[key] = value.default_value;
            }
        }

        allContext[definition.definitionId] = newContext;
        context = newContext;
    } else {
        context = allContext[definition.definitionId];
    }

    const obj = definition.settings;
    for (const [key, insideValue] of assistantMap) {
        affectKey = key;
        try {
            const defaultValue = obj[key].default_value;

            const calcValue = insideValue.calcu_value && context.executeExpression(insideValue.calcu_value);

            for (const property of context.getUsedProperties()) {
                addAffect(key, property);
            }

            const calcMinValue = insideValue.min && context.executeExpression(insideValue.min);
            for (const property of context.getUsedProperties()) {
                addAffect(key, property);
            }

            const calcMaxValue = insideValue.max && context.executeExpression(insideValue.max);
            for (const property of context.getUsedProperties()) {
                addAffect(key, property);
            }

            const calcEnabled = insideValue.visible && context.executeExpression(insideValue.visible);
            for (const property of context.getUsedProperties()) {
                addAffect(key, property);
            }

            if (typeof calcEnabled !== 'undefined') {
                definition.settings[key].visible = calcEnabled;
            }

            if (insideValue.type === 'float' || insideValue.type === 'int') {
                if (!isNil(calcMinValue)) {
                    definition.settings[key].min = calcMinValue;
                }
                if (!isNil(calcMaxValue)) {
                    definition.settings[key].max = calcMaxValue;
                }
                if (Math.abs(calcValue - defaultValue) > 1e-6 && !isUndefined(calcValue)) {
                    definition.settings[key].mismatch = true;
                } else {
                    definition.settings[key].mismatch = false;
                }
            } else {
                if (calcValue !== defaultValue && !isUndefined(calcValue)) {
                    definition.settings[key].mismatch = true;
                } else {
                    definition.settings[key].mismatch = false;
                }
            }
        } catch (e) {
            console.error(e, insideValue.visible);
        }
    }

    console.log('log allValues', definition.definitionId);
    console.log('  keys =', Object.keys(allValues).length);
    const depCount = sum(Object.values(allValues).map(s => s.size));
    console.log('  depCount =', depCount);

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
    }

    // calc value & default_value
    for (const key of allAsistantArray) {
        const value = cloneDeep(assistantMap.get(key));

        try {
            let defaultValue;
            const calcValue = value.calcu_value && context.executeExpression(value.calcu_value);

            const calcMinValue = value.min && context.executeExpression(value.min);
            const calcMaxValue = value.max && context.executeExpression(value.max);
            const calcEnabled = value.visible && context.executeExpression(value.visible);

            if (typeof calcValue !== 'undefined') {
                if (value.type === 'float' || value.type === 'int') {
                    defaultValue = Number((calcValue).toFixed(3));
                } else {
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
                context.context[key] = defaultValue;
                if (!skipValues) {
                    definition.settings[key].default_value = defaultValue;
                }
            }

            if (typeof calcMaxValue !== 'undefined' && defaultValue > calcMaxValue) {
                defaultValue = calcMaxValue;
                context.context[key] = defaultValue;
                if (!skipValues) {
                    definition.settings[key].default_value = defaultValue;
                }
            }
            if (typeof calcMinValue !== 'undefined' && defaultValue < calcMinValue) {
                defaultValue = calcMinValue;
                context.context[key] = defaultValue;
                if (!skipValues) {
                    definition.settings[key].default_value = defaultValue;
                }
            }
            if (value.type === 'float' || value.type === 'int') {
                if (Math.abs(calcValue - defaultValue) > 1e-6 && !isUndefined(calcValue)) {
                    definition.settings[key].mismatch = true;
                } else {
                    definition.settings[key].mismatch = false;
                }
            } else {
                if (calcValue !== defaultValue && !isUndefined(calcValue)) {
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

