/* eslint-disable */
var _interopRequireDefault = require('@babel/runtime/helpers/interopRequireDefault');
var _slicedToArray2 = _interopRequireDefault(require('@babel/runtime/helpers/slicedToArray'));
var _defineProperty2 = _interopRequireDefault(require('@babel/runtime/helpers/defineProperty'));

function _createForOfIteratorHelper(o, allowArrayLike) {
    var it = typeof Symbol !== 'undefined' && o[Symbol.iterator] || o['@@iterator'];
    if (!it) {
        if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === 'number') {
            if (it) o = it;
            var i = 0;
            var F = function F() {
            };
            return {
                s: F, n: function n() {
                    if (i >= o.length) return { done: true };
                    return { done: false, value: o[i++] };
                }, e: function e(_e) {
                    throw _e;
                }, f: F
            };
        }
        throw new TypeError('Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.');
    }
    var normalCompletion = true, didErr = false, err;
    return {
        s: function s() {
            it = it.call(o);
        }, n: function n() {
            var step = it.next();
            normalCompletion = step.done;
            return step;
        }, e: function e(_e2) {
            didErr = true;
            err = _e2;
        }, f: function f() {
            try {
                if (!normalCompletion && it['return'] != null) it['return']();
            } finally {
                if (didErr) throw err;
            }
        }
    };
}

function _unsupportedIterableToArray(o, minLen) {
    if (!o) return;
    if (typeof o === 'string') return _arrayLikeToArray(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === 'Object' && o.constructor) n = o.constructor.name;
    if (n === 'Map' || n === 'Set') return Array.from(o);
    if (n === 'Arguments' || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
}

function _arrayLikeToArray(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for (var i = 0, arr2 = new Array(len); i < len; i++) {
        arr2[i] = arr[i];
    }
    return arr2;
}

/* eslint-disable */
var _ = require('lodash');
var asistantMap = new Map();
var asistantMapInitialized = false;
var allValues = {};
var affectKey = '';
var hasValue = false;

function flatAffectedValue(insideAffectKey, affectSet, originalAffectSet, isDeep) {
    affectSet.forEach(function (item) {
        if (item !== insideAffectKey) {
            originalAffectSet.add(item);
        }
        if (allValues[item] && item !== insideAffectKey) {
            if (!isDeep || isDeep && !originalAffectSet.has(item)) {
                flatAffectedValue(insideAffectKey, allValues[item], originalAffectSet, true);
            }
        }
    });
}

var allContext = {};

function resolveDefinition(definition, modifiedParams) {
    var skipValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
    // make context
    var shouldReCalcu = true;
    var context = {};
    if (!allContext[definition.definitionId]) {
        context = {
            sum: _.sum,
            map: function map(fn, arr) {
                return _.map(arr, fn);
            },
            math: {
                radians: function radians(degree) {
                    return degree / 180 * Math.PI;
                }
            },
            resolveOrValue: function resolveOrValue(input) {
                return _.isUndefined(context[input]) ? input : context[input];
            },
            extruderValue: function extruderValue(ignore, input) {
                return context[input];
            },
            extruderValues: function extruderValues(input) {
                return [context[input]];
            },
            defaultExtruderPosition: function defaultExtruderPosition() {
                return 0;
            }
        };
    } else {
        shouldReCalcu = false;
        context = allContext[definition.definitionId];
    }
    var obj = definition.settings;
    if (shouldReCalcu) {
        var _loop = function _loop() {
            var key = _Object$keys[_i];
            var value = obj[key];
            if (value.type && value.type !== 'category' && value.type !== 'mainCategory') {
                if (!asistantMapInitialized) {
                    var cloneValue = _.cloneDeep(value);
                    asistantMap.set(key, cloneValue);
                }
                Object.defineProperties(context, (0, _defineProperty2['default'])({}, key, {
                    get: function get() {
                        if (hasValue) {
                            if (!(allValues[affectKey] instanceof Set)) {
                                allValues[affectKey] = new Set();
                            }
                            allValues[affectKey].add(key);
                        }
                        return value.default_value;
                    },
                    set: function set(newValue) {
                        value.default_value = newValue;
                    }
                }));
                context[key] = value.default_value;
            }
        };
        for (var _i = 0, _Object$keys = Object.keys(obj); _i < _Object$keys.length; _i++) {
            _loop();
        }
    }
    var _iterator = _createForOfIteratorHelper(asistantMap),
        _step;
    try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
            var _step$value = (0, _slicedToArray2['default'])(_step.value, 2),
                key = _step$value[0],
                insideValue = _step$value[1];
            affectKey = key;
            try {
                var defaultValue = obj[key].default_value;
                var calcValue = insideValue.calcu_value && eval('(function calcValue() {\n                    hasValue = true;\n                    with (context) {\n                        return '.concat(insideValue.calcu_value, ';\n                    }\n                })()'));
                if (_.isUndefined(calcValue)) {
                    hasValue = false;
                }
                var calcMinValue = insideValue.min && eval('(function calcMinMax() {\n                hasValue = true;\n                with (context) {\n                    return '.concat(insideValue.min, ';\n                }\n            })()'));
                var calcMaxValue = insideValue.max && eval('(function calcMinMax() {\n                hasValue = true;\n                with (context) {\n                    return '.concat(insideValue.max, ';\n                }\n            })()'));
                var calcEnabled = insideValue.visible && eval('(function calcEnable() {\n                hasValue = true;\n                with (context) {\n                    return '.concat(insideValue.visible, ';\n                }\n            })()'));
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
    } catch (err) {
        _iterator.e(err);
    } finally {
        _iterator.f();
    }
    asistantMapInitialized = true;
    Object.entries(allValues).forEach(function (_ref) {
        var _ref2 = (0, _slicedToArray2['default'])(_ref, 2),
            key = _ref2[0],
            affectSet = _ref2[1];
        flatAffectedValue(key, new Set(affectSet), affectSet);
    });
    var allAsistantArray = new Set();
    if (modifiedParams) {
        modifiedParams.forEach(function (param) {
            allAsistantArray.add({
                param: param[0],
                index: 0
            });
            Object.entries(allValues).forEach(function (_ref3) {
                var _ref4 = (0, _slicedToArray2['default'])(_ref3, 2),
                    valueKey = _ref4[0],
                    valueItem = _ref4[1];
                var valueArray = Array.from(valueItem);
                var indexOfValue = valueArray.indexOf(param[0]);
                if (indexOfValue > -1) {
                    allAsistantArray.add({
                        param: valueKey,
                        index: indexOfValue
                    });
                }
            });
        });
        allAsistantArray = Array.from(allAsistantArray).sort(function (a, b) {
            return a.index - b.index;
        }).map(function (d) {
            return d.param;
        });
        // console.log('allAsistantArray', modifiedParams, allAsistantArray);
    }

    // calc value & default_value
    var _iterator2 = _createForOfIteratorHelper(allAsistantArray),
        _step2;
    try {
        var _loop2 = function _loop2() {
            var key = _step2.value;
            var value = _.cloneDeep(asistantMap.get(key));
            try {
                var _defaultValue;
                var _calcValue = value.calcu_value && eval('(function calcValue() {\n                with (context) {\n                    return '.concat(value.calcu_value, ';\n                }\n            })()'));
                var _calcMinValue = value.min && eval('(function calcMinMax() {\n                with (context) {\n                    return '.concat(value.min, ';\n                }\n            })()'));
                var _calcMaxValue = value.max && eval('(function calcMinMax() {\n                with (context) {\n                    return '.concat(value.max, ';\n                }\n            })()'));
                var _calcEnabled = value.visible && eval('(function calcEnable() {\n                with (context) {\n                    return '.concat(value.visible, ';\n                }\n            })()'));
                if (typeof _calcValue !== 'undefined') {
                    if (value.type === 'float' || value.type === 'int') {
                        _defaultValue = Number(_calcValue.toFixed(3));
                    } else {
                        _defaultValue = _calcValue;
                    }
                    if (!skipValues) {
                        definition.settings[key].default_value = _defaultValue;
                    }
                }
                if (typeof _calcEnabled !== 'undefined') {
                    definition.settings[key].visible = _calcEnabled;
                }
                var modifiedParamItem = modifiedParams && modifiedParams.find(function (item) {
                    return item[0] === key;
                });
                if (modifiedParamItem) {
                    _defaultValue = modifiedParamItem[1];
                    context[key] = _defaultValue;
                    if (!skipValues) {
                        definition.settings[key].default_value = _defaultValue;
                    }
                }
                if (typeof _calcMaxValue !== 'undefined' && _defaultValue > _calcMaxValue) {
                    _defaultValue = _calcMaxValue;
                    context[key] = _defaultValue;
                    if (!skipValues) {
                        definition.settings[key].default_value = _defaultValue;
                    }
                }
                if (typeof _calcMinValue !== 'undefined' && _defaultValue < _calcMinValue) {
                    _defaultValue = _calcMinValue;
                    context[key] = _defaultValue;
                    if (!skipValues) {
                        definition.settings[key].default_value = _defaultValue;
                    }
                }
                if (value.type === 'float' || value.type === 'int') {
                    if (Math.abs(_calcValue - _defaultValue) > 1e-6 && !_.isUndefined(_calcValue)) {
                        definition.settings[key].mismatch = true;
                    } else {
                        definition.settings[key].mismatch = false;
                    }
                } else {
                    if (_calcValue !== _defaultValue && !_.isUndefined(_calcValue)) {
                        definition.settings[key].mismatch = true;
                    } else {
                        definition.settings[key].mismatch = false;
                    }
                }
            } catch (e) {
                console.error(e, key);
            }
        };
        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
            _loop2();
        }
    } catch (err) {
        _iterator2.e(err);
    } finally {
        _iterator2.f();
    }
}

module.exports = {
    resolveDefinition: resolveDefinition
};

