/* eslint-disable */
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var _ = require('lodash');
var asistantMap = new Map();
let asistantMapInitialized = false;
var allValues = {};
var affectKey = '';
var hasValue = false;
function flatAffectedValue(affectSet, originalAffectSet) {
    affectSet.forEach(function (item) {
        if (!originalAffectSet.has(item) && allValues[item]) {
            flatAffectedValue(allValues[item], originalAffectSet);
        }
        originalAffectSet.add(item);
    });
}
function resolveDefinition(definition, modifiedParams) {
    var e_1, _a, e_2, _b, e_3, _c;
    // make context
    var context = {
        sum: _.sum,
        map: function (fn, arr) {
            return _.map(arr, fn);
        },
        math: {
            radians: function (degree) {
                return degree / 180 * Math.PI;
            }
        },
        resolveOrValue: function (input) { return _.isUndefined(context[input]) ? input : context[input]; },
        extruderValue: function (ignore, input) { return context[input]; },
        extruderValues: function (input) { return [context[input]]; },
        defaultExtruderPosition: function () { return 0; }
    };
    var obj = definition.settings;
    var _loop_1 = function (key) {
        var _g;
        var value = obj[key];
        if (value.type && (value.type !== 'category' && value.type !== 'mainCategory')) {
            if (!asistantMapInitialized) {
                var cloneValue = _.cloneDeep(value);
                asistantMap.set(key, cloneValue);
            }
            Object.defineProperties(context, (_g = {},
                _g[key] = {
                    get: function () {
                        if (hasValue) {
                            if (!(allValues[affectKey] instanceof Set)) {
                                allValues[affectKey] = new Set();
                            }
                            allValues[affectKey].add(key);
                        }
                        return value.default_value;
                    },
                    set: function (newValue) {
                        value.default_value = newValue;
                    }
                },
                _g));
            context[key] = value.default_value;
        }
    };
    try {
        for (var _d = __values(Object.keys(obj)), _e = _d.next(); !_e.done; _e = _d.next()) {
            var key = _e.value;
            _loop_1(key);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
        }
        finally { if (e_1) throw e_1.error; }
    }
    try {
        for (var asistantMap_1 = __values(asistantMap), asistantMap_1_1 = asistantMap_1.next(); !asistantMap_1_1.done; asistantMap_1_1 = asistantMap_1.next()) {
            var _f = __read(asistantMap_1_1.value, 2), key = _f[0], insideValue = _f[1];
            affectKey = key;
            try {
                var defaultValue = obj[key].default_value;
                var calcValue = insideValue.calcu_value && eval("(function calcValue() {\n                    hasValue = true;\n                    with (context) {\n                        return ".concat(insideValue.calcu_value, ";\n                    }\n                })()"));
                if (_.isUndefined(calcValue)) {
                    hasValue = false;
                }
                insideValue.minimum_value && eval("(function calcMinMax() {\n                hasValue = true;\n                with (context) {\n                    return ".concat(insideValue.minimum_value, ";\n                }\n            })()"));
                insideValue.maximum_value && eval("(function calcMinMax() {\n                hasValue = true;\n                with (context) {\n                    return ".concat(insideValue.maximum_value, ";\n                }\n            })()"));
                var calcEnabled = insideValue.visible && eval("(function calcEnable() {\n                hasValue = true;\n                with (context) {\n                    return ".concat(insideValue.visible, ";\n                }\n            })()"));
                // if (key === 'z_seam_position') {
                // }
                if (typeof calcEnabled !== 'undefined') {
                    definition.settings[key].visible = calcEnabled;
                }
                if (insideValue.type === 'float' || insideValue.type === 'int') {
                    if (Math.abs(calcValue - defaultValue) > 1e-6 && !_.isUndefined(calcValue)) {
                        definition.settings[key].mismatch = true;
                    }
                    else {
                        definition.settings[key].mismatch = false;
                    }
                }
                else {
                    if (calcValue !== defaultValue && !_.isUndefined(calcValue)) {
                        definition.settings[key].mismatch = true;
                    }
                    else {
                        definition.settings[key].mismatch = false;
                    }
                }
            }
            catch (e) {
                console.error(e, insideValue.visible);
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (asistantMap_1_1 && !asistantMap_1_1.done && (_b = asistantMap_1.return)) _b.call(asistantMap_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    asistantMapInitialized = true;
    Object.entries(allValues).forEach(function (_a) {
        var _b = __read(_a, 2), undefined = _b[0], affectSet = _b[1];
        flatAffectedValue(affectSet, affectSet);
    });
    var allAsistantArray = new Set();
    var affectArray = [];
    if (modifiedParams) {
        affectArray = modifiedParams.map(function (item) {
            allAsistantArray.add(item[0]);
            return item[0];
        });
        Object.entries(allValues).forEach(function (_a) {
            var _b = __read(_a, 2), key = _b[0], item = _b[1];
            if (_.intersection(Array.from(item), affectArray).length > 0) {
                allAsistantArray.add(key);
            }
        });
    }
    var _loop_2 = function (key) {''
        var value = _.cloneDeep(asistantMap.get(key));
        try {
            var defaultValue = void 0;
            var calcValue = value.calcu_value && eval("(function calcValue() {\n                with (context) {\n                    return ".concat(value.calcu_value, ";\n                }\n            })()"));

            var calcMinValue = value.minimum_value && eval("(function calcMinMax() {\n                with (context) {\n                    return ".concat(value.minimum_value, ";\n                }\n            })()"));
            var calcMaxValue = value.maximum_value && eval("(function calcMinMax() {\n                with (context) {\n                    return ".concat(value.maximum_value, ";\n                }\n            })()"));
            var calcEnabled = value.visible && eval("(function calcEnable() {\n                with (context) {\n                    return ".concat(value.visible, ";\n                }\n            })()"));
            if (typeof calcValue !== 'undefined') {
                defaultValue = calcValue;
                definition.settings[key].default_value = defaultValue;
            }
            if (typeof calcEnabled !== 'undefined') {
                definition.settings[key].visible = calcEnabled;
            }
            var modifiedParamItem = modifiedParams && modifiedParams.find(function (item) { return item[0] === key; });
            if (modifiedParamItem) {
                defaultValue = modifiedParamItem[1];
                context[key] = defaultValue;
                definition.settings[key].default_value = defaultValue;
            }
            if (typeof calcMaxValue !== 'undefined' && defaultValue > calcMaxValue) {
                defaultValue = calcMaxValue;
                context[key] = defaultValue;
                definition.settings[key].default_value = defaultValue;
            }
            if (typeof calcMinValue !== 'undefined' && defaultValue < calcMinValue) {
                defaultValue = calcMinValue;
                context[key] = defaultValue;
                definition.settings[key].default_value = defaultValue;
            }
            if (value.type === 'float' || value.type === 'int') {
                if (Math.abs(calcValue - defaultValue) > 1e-6 && !_.isUndefined(calcValue)) {
                    definition.settings[key].mismatch = true;
                }
                else {
                    definition.settings[key].mismatch = false;
                }
            }
            else {
                if (calcValue !== defaultValue && !_.isUndefined(calcValue)) {
                    definition.settings[key].mismatch = true;
                }
                else {
                    definition.settings[key].mismatch = false;
                }
            }
        }
        catch (e) {
            console.error(e, value.visible);
        }
    };
    try {
        // calc value & default_value
        for (var allAsistantArray_1 = __values(allAsistantArray), allAsistantArray_1_1 = allAsistantArray_1.next(); !allAsistantArray_1_1.done; allAsistantArray_1_1 = allAsistantArray_1.next()) {
            var key = allAsistantArray_1_1.value;
            _loop_2(key);
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (allAsistantArray_1_1 && !allAsistantArray_1_1.done && (_c = allAsistantArray_1.return)) _c.call(allAsistantArray_1);
        }
        finally { if (e_3) throw e_3.error; }
    }
}
module.exports = {
    resolveDefinition: resolveDefinition
};
//# sourceMappingURL=allparams.js.map
// @ sourceURL=name
