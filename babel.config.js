module.exports = {
    presets: [
        '@babel/preset-react',
        ['@babel/preset-env', {
            useBuiltIns: 'entry',
            corejs: 3,
        }],
    ],
    plugins: [
        // Plugins sorted by stage
        // Checkout https://github.com/tc39/proposals for proposal status.
        // Checkout https://babeljs.io/docs/en/plugins-list for available plugins.

        // needs consensus
        // https://github.com/tc39/proposal-export-ns-from
        // '@babel/plugin-proposal-export-namespace-from',

        /**
         * Stage 0
         */
        // bind operator: https://github.com/tc39/proposal-bind-operator
        '@babel/plugin-proposal-function-bind',

        /**
         * Step 1
         */
        // export default from: https://github.com/tc39/proposal-export-default-from
        '@babel/plugin-proposal-export-default-from',
        // do expressions: https://github.com/tc39/proposal-do-expressions
        '@babel/plugin-proposal-do-expressions',
        // pipe operator: https://github.com/tc39/proposal-pipeline-operator
        // ['@babel/plugin-proposal-pipeline-operator', { 'proposal': 'minimal' }],

        /**
         * Stage 2
         */

        // generator function.sent: https://github.com/tc39/proposal-function.sent
        // '@babel/plugin-proposal-function-sent',
        '@babel/plugin-proposal-throw-expressions',

        /**
         * Stage 3
         */
        // decorators
        // https://github.com/tc39/proposal-decorators
        ['@babel/plugin-proposal-decorators', { 'legacy': true }],

        // ['@babel/plugin-proposal-class-properties', { 'loose': false }],
        // '@babel/plugin-proposal-json-strings',

        /**
         * Stage 4
         */
        // logical assignment
        // https://github.com/tc39/proposal-logical-assignment
        '@babel/plugin-proposal-logical-assignment-operators',

        // https://github.com/babel/babel/issues/9849
        '@babel/plugin-transform-runtime',
    ]
};
