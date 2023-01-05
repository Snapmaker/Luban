/* eslint-disable */

var _interopRequireDefault = require('@babel/runtime/helpers/interopRequireDefault');
Object.defineProperty(exports, '__esModule', {
    value: true
});
exports['default'] = void 0;
var _classCallCheck2 = _interopRequireDefault(require('@babel/runtime/helpers/classCallCheck'));
var _createClass2 = _interopRequireDefault(require('@babel/runtime/helpers/createClass'));
var _defineProperty2 = _interopRequireDefault(require('@babel/runtime/helpers/defineProperty'));
/* eslint-disable */
var ParameterContext = /*#__PURE__*/function () {
    function ParameterContext() {
        (0, _classCallCheck2['default'])(this, ParameterContext);
        (0, _defineProperty2['default'])(this, 'context', void 0);
        this.context = {};
        this.usedProperties = new Set();
    }

    (0, _createClass2['default'])(ParameterContext, [{
        key: 'setContext',
        value: function setContext(context) {
            this.context = context;
        }
    }, {
        key: 'defineProperty',
        value: function defineProperty(key, getter, setter) {
            var usedProperties = this.usedProperties;
            Object.defineProperties(this.context, (0, _defineProperty2['default'])({}, key, {
                get: function get() {
                    usedProperties.add(key);
                    return getter();
                },
                set: function set(value) {
                    setter(value);
                }
            }));
        }
    }, {
        key: 'executeExpression',
        value: function executeExpression(expression) {
            var context = this.context;
            this.usedProperties.clear();
            if (context) {
                // eslint-disable-next-line no-eval
                return eval('\n            (function func() {\n                with (context) {\n                    return '.concat(expression, ';                    \n                }\n            })();\n            '));
            } else {
                return '';
            }
        }

        /**
         * Get recently used properties.
         */
    }, {
        key: 'getUsedProperties',
        value: function getUsedProperties() {
            return Array.from(this.usedProperties);
        }
    }]);
    return ParameterContext;
}();
var _default = ParameterContext;
exports['default'] = _default;
