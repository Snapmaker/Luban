/* eslint-disable */

class ParameterContext {
    context;

    constructor() {
        this.context = {};

        this.usedProperties = new Set();
    }

    setContext(context) {
        this.context = context;
    }

    defineProperty(key, getter, setter) {
        const usedProperties = this.usedProperties;

        Object.defineProperties(this.context, {
            [key]: {
                get() {
                    usedProperties.add(key);
                    return getter();
                },
                set(value) {
                    setter(value);
                }
            }
        })
    }

    executeExpression(expression) {
        const context = this.context;

        this.usedProperties.clear();

        if (context) {
            // eslint-disable-next-line no-eval
            return eval(`
            (function func() {
                with (context) {
                    return ${expression};                    
                }
            })();
            `);
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
