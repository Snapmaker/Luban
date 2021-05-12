const path = require('path');

module.exports = {
    extends: 'snapmaker',
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
                            path.resolve(__dirname, 'src')
                        ],
                        extensions: ['.js', '.jsx']
                    }
                }
            }
        }
    },
    "plugins": [
        "react-hooks"
    ],
    rules: {
        "react-hooks/rules-of-hooks": "error", // Checks rules of Hooks
        "react-hooks/exhaustive-deps": "warn", // Checks effect dependencies
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
        "no-await-in-loop": 0,
        "no-loop-func": 0,
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
