const path = require('path');

module.exports = {
    extends: 'snapmaker',
    parser: '@babel/eslint-parser',
    parserOptions: {
        'requireConfigFile': false,
        'babelOptions': {
            'presets': [
                ['@babel/preset-react', {
                    'runtime': 'automatic'
                }]
            ]
        },
        project: ['./tsconfig.json']
    },
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
                            path.resolve(__dirname, 'packages'),
                        ],
                        extensions: ['.js', '.jsx', '.ts', '.tsx']
                    }
                }
            }
        }
    },
    ignorePatterns: [
        '*.d.ts',
        '**/*.es5.js', // ignore manually compiled ES5 files
    ],
    plugins: [
        'react-hooks',
    ],
    rules: {
        'no-use-before-define': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/no-use-before-define': ['error'],
        'react/jsx-filename-extension': [2, {
            'extensions': [
                '.js',
                '.jsx',
                '.ts',
                '.tsx'
            ]
        }],

        // React 17 new transform
        // react/jsx-uses-react and react/react-in-jsx-scope are no longer necessary
        // https://reactjs.org/blog/2020/09/22/introducing-the-new-jsx-transform.html
        // 'react/jsx-uses-react': 'off',
        // 'react/react-in-jsx-scope': 'off',

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
        'max-classes-per-file': 0,
        'lines-between-class-members': [
            2,
            'always', {
                'exceptAfterSingleLine': true // skip checking empty lines after single-line class members
            }
        ],
        'semi': [2, 'always'],
        'jsx-a11y/label-has-associated-control': ['error', {
            'required': {
                'some': ['nesting', 'id']
            }
        }],
        'jsx-a11y/label-has-for': ['error', {
            'required': {
                'some': ['nesting', 'id']
            }
        }]
    },
    overrides: [{
        files: ['*.ts', '*.tsx'],
        extends: [
            'eslint:recommended',
            'plugin:@typescript-eslint/eslint-recommended',
            'plugin:@typescript-eslint/recommended',
        ],
        parser: '@typescript-eslint/parser',
        // plugins: ['react', '@typescript-eslint'],
        parserOptions: {
            project: [
                './packages/*/tsconfig.json',
                './tsconfig.json',
            ]
        },
        rules: {
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/no-inferrable-types': 'off',
            // 'react/jsx-uses-react': 'off',
            // 'react/react-in-jsx-scope': 'off',

            '@typescript-eslint/ban-types': 'off',
            'no-use-before-define': 'off',
            '@typescript-eslint/no-use-before-define': ['error'],
            'react/prop-types': 'off',
            'no-shadow': 'off',
            '@typescript-eslint/no-shadow': ['error'],
            'no-empty-function': 'off',
            '@typescript-eslint/no-empty-function': ['error'],
            'no-extra-semi': 'off',
            '@typescript-eslint/no-extra-semi': ['error'],
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['error'],
            '@typescript-eslint/explicit-member-accessibility': ['error'], // Require explicit accessibility modifiers on class properties and methods
            '@typescript-eslint/promise-function-async': 'error',

            // https://eslint.org/docs/latest/rules/max-len
            'max-len': ['error', {
                code: 160,
                ignoreUrls: true,
                ignoreStrings: true,
                ignoreTemplateLiterals: true,
            }],
        }
    }]
};
