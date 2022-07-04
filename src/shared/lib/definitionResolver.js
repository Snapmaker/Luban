import _ from 'lodash';
/* eslint no-eval: 0 */

const asistantMap = new Map();
let asistantMapInitialized = false;

function constructContext(obj, context) {
    for (const key of Object.keys(obj)) {
        const value = obj[key];
        context[key] = value.default_value;
    }
}

function flatMap(obj, map) {
    for (const key of Object.keys(obj)) {
        const cloneValue = _.cloneDeep(obj[key]);
        map.set(key, cloneValue);
    }
}

function serializeObject(context, propInObject = false) {
    let propsDeclare = '';
    for (const k of Object.keys(context)) {
        if (Object.prototype.toString.call(context[k]) === '[object Object]') {
            propsDeclare += `const ${k} = {
                ${serializeObject(context[k], true)}
            };`;
        } else if (typeof context[k] === 'string') {
            propsDeclare += `const ${k} = \`${context[k]}\`;\n`;
        } else if (Object.prototype.toString.call(context[k]) === '[object Array]') {
            propsDeclare += `const ${k} = [${context[k].map(item => `[${item.toString()}]`)}];\n`;
        } else if (Object.prototype.toString.call(context[k]) === '[object Function]') {
            if (propInObject) {
                propsDeclare += `${k}: ${context[k]}\n`;
            } else {
                propsDeclare += `${context[k]};\n`;
            }
        } else {
            propsDeclare += `const ${k} = ${context[k]};\n`;
        }
    }
    return propsDeclare;
}

function resolveDefinition(definition, params = []) {
    if (!asistantMapInitialized) {
        flatMap(definition.settings, asistantMap);
        asistantMapInitialized = true;
    }
    // console.log(asistantMap)
    const modifiedParams = params;

    const context = {
        sum: _.sum,
        map: function map(fn, arr) {
            return _.map(arr, fn);
        },
        math: {
            radians: function (degree) {
                return degree / 180 * Math.PI;
            }
        },
        resolveOrValue: function resolveOrValue(input) { return context[input]; },
        extruderValue: function extruderValue(ignore, input) { return context[input]; },
        extruderValues: function extruderValues(input) { return [context[input]]; },
        defaultExtruderPosition: function defaultExtruderPosition() { return 0; }
    };
    // console.log(modifiedParams)
    constructContext(definition.settings, context);
    // calc value & default_value
    for (const [key, value] of asistantMap) {
        // console.log(key)
        const propsDeclare = serializeObject(context);
        try {
            let defaultValue;
            // console.log(`(function calcValue() {
            //     ${propsDeclare}
            //     return ${value.value};
            // })()`);
            const calcValue = value.value && eval(`(function calcValue() {
                ${propsDeclare}
                return ${value.value};
            })()`);
            const calcMinValue = value.minimum_value && eval(`(function calcMinMax() {
                ${propsDeclare}
                return ${value.minimum_value};
            })()`);
            const calcMaxValue = value.maximum_value && eval(`(function calcMinMax() {
                ${propsDeclare}
                return ${value.maximum_value};
            })()`);
            // console.log(`(function calcEnable() {
            //     ${propsDeclare}
            //     return ${value.enabled};
            // })()`);
            // const calcEnabled = value.enabled && eval(`(function calcEnable() {
            //     ${propsDeclare}
            //     return ${value.enabled};
            // })()`);
            if (typeof calcValue !== 'undefined') {
                defaultValue = calcValue;
                context[key] = defaultValue;
                definition.settings[key].default_value = defaultValue;
            }
            // if (typeof calcEnabled !== 'undefined') {
            //     // definition.settings[key].enabled = calcEnabled;
            // }

            const modifiedParamItem = modifiedParams.find(item => item[0] === key);
            if (modifiedParamItem) {
                defaultValue = modifiedParamItem[1];
                context[key] = defaultValue;
                definition.settings[key].default_value = defaultValue;
                // console.log(calcMinValue, calcMaxValue, calcValue)
                // console.log(definition.settings[key].default_value, calcValue, modifiedParamItem, 'mod');
            }

            if (typeof calcMaxValue !== 'undefined' && defaultValue > calcMaxValue) {
                defaultValue = calcMaxValue;
                context[key] = defaultValue;
                definition.settings[key].default_value = defaultValue;
                // console.log(definition.settings[key].default_value, calcValue, 'max');
            }
            if (typeof calcMinValue !== 'undefined' && defaultValue < calcMinValue) {
                defaultValue = calcMinValue;
                context[key] = defaultValue;
                definition.settings[key].default_value = defaultValue;
                // console.log(definition.settings[key].default_value, calcValue, 'min');
            }
            if (value.type === 'float' || value.type === 'int') {
                if (Math.abs(calcValue - defaultValue) > 1e-6) {
                    definition.settings[key].mismatch = true;
                } else {
                    definition.settings[key].mismatch = false;
                }
            } else {
                if (calcValue !== defaultValue) {
                    definition.settings[key].mismatch = true;
                } else {
                    definition.settings[key].mismatch = false;
                }
            }
        } catch (e) {
            console.error(e.message);
            // return;
        }
    }
}

export default resolveDefinition;
