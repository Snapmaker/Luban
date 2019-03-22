const path = require('path');

module.exports = {
    extends: 'trendmicro',
    parser: 'babel-eslint',
    env: {
        browser: true,
        node: true
    },
    settings: {
        'import/resolver': {
            webpack: {
                config: {
                    resolve: {
                        modules: [
                            path.resolve(__dirname, 'src'),
                            'node_modules'
                        ],
                        extensions: ['.js', '.jsx']
                    }
                }
            }
        }
    },
    rules: {
        "react/jsx-no-bind": [1, {
            "allowArrowFunctions": true
        }],
        "react/prefer-stateless-function": 0,
        "react/no-access-state-in-setstate": 0,
        "import/extensions": ["error", "never", {
            "styl": "always",
            "json": "always"
        }],
        'no-var': "error",
        'indent': [2, 4, {
            "SwitchCase": 1
        }],
        "no-constant-condition": [2, {
            "checkLoops": false
        }],
        "spaced-comment": [1, "always"],
        "no-multi-str": 0,
        "no-lonely-if": 0,
        "no-bitwise": 0,
        "max-classes-per-file": 0
    }
};
