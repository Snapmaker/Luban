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
                        extensions: ['.js', '.jsx', '.ts']
                    }
                }
            }
        }
    },
    'plugins': [
        'react-hooks'
    ],
    rules: {
        'react-hooks/rules-of-hooks': 'error', // Checks rules of Hooks
        'react-hooks/exhaustive-deps': 'warn', // Checks effect dependencies
        'react/jsx-no-bind': [1, {
            'allowArrowFunctions': true
        }],
        'jsx-a11y/control-has-associated-label': 0,
        'react/state-in-constructor': 0,
        'react/sort-comp': 0,
        'react/static-property-placement': 0,
        'react/prefer-stateless-function': 0,
        'react/no-access-state-in-setstate': 0,
        'react/jsx-props-no-spreading': 0,
        'react/jsx-indent': 0,
        'react/no-deprecated': 'warn',
        'react/jsx-fragments': 0,
        'import/extensions': ['error', 'never', {
            'styl': 'always',
            'json': 'always'
        }],
        'no-self-assign': 0,
        'prefer-object-spread': 0,
        'no-async-promise-executor': 0,
        'comma-dangle': 0,
        'no-multiple-empty-lines': 0,
        'no-var': 'error',
        'no-await-in-loop': 0,
        'no-loop-func': 0,
        'indent': [2, 4, {
            'SwitchCase': 1
        }],
        'no-constant-condition': [2, {
            'checkLoops': false
        }],
        'spaced-comment': [1, 'always'],
        'no-multi-str': 0,
        'no-lonely-if': 0,
        'no-bitwise': 0,
        'max-classes-per-file': 0
    },
    overrides: [{
        files: ['*.ts', '*.tsx'],
        parser: '@typescript-eslint/parser',
        plugins: ['@typescript-eslint'],
        rules: {
            'no-shadow': 'off',
            '@typescript-eslint/no-shadow': ['error'],
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['error']
        }
    }]
};
