/* eslint-disable */

/**
 * ParameterContext class using ES5 syntax to support the 'with' statement.
 * The 'with' statement is not allowed in ES6+ strict mode, so we keep this as ES5.
 */
class ParameterContext {
    constructor() {
        this.context = {};
        this.usedProperties = new Set();
    }

    setContext(context) {
        this.context = context;
    }

    defineProperty(key, getter, setter) {
        var usedProperties = this.usedProperties;
        Object.defineProperties(this.context, {
            [key]: {
                get: function get() {
                    usedProperties.add(key);
                    return getter();
                },
                set: function set(value) {
                    setter(value);
                }
            }
        });
    }

    executeExpression(expression) {
        var context = this.context;
        this.usedProperties.clear();
        if (context) {
            // eslint-disable-next-line no-eval, no-with
            return eval('\n            (function func() {\n                with (context) {\n                    return '.concat(expression, ';                    \n                }\n            })();\n            '));
        } else {
            return '';
        }
    }

    /**
     * Get recently used properties.
     */
    getUsedProperties() {
        return Array.from(this.usedProperties);
    }
}

export default ParameterContext;
