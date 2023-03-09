/* eslint no-var: 0 */
/* eslint prefer-arrow-callback: 0 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const babelConfig = require('./babel.config');
const pkg = require('./package.json');

const NODE_MODULES = path.resolve(__dirname, 'node_modules');

// http://jlongster.com/Backend-Apps-with-Webpack--Part-I
const externals = {};
fs.readdirSync(NODE_MODULES)
    .filter((x) => {
        return ['.bin'].indexOf(x) === -1;
    })
    .forEach((mod) => {
        externals[mod] = `commonjs ${mod}`;
    });
externals['@snapmaker/snapmaker-lunar'] = 'commonjs @snapmaker/snapmaker-lunar';

// Use publicPath for production
const publicPath = (function calculatePublicPath(payload) {
    const algorithm = 'sha1';
    const buf = String(payload);
    const hash = crypto.createHash(algorithm).update(buf).digest('hex');
    return `/${hash.substr(0, 8)}/`; // 8 digits
}(pkg.version));

module.exports = {
    mode: 'development',
    devtool: 'eval-source-map',
    target: 'node',
    watch: true,
    context: path.resolve(__dirname, './src/server'),
    entry: path.resolve(__dirname, './src/server/services/task-manager/Pool.worker.js'),
    output: {
        path: path.resolve(__dirname, 'output/src/server'),
        filename: '[name].js',
        libraryTarget: 'commonjs2'
    },
    plugins: [
        new webpack.DefinePlugin({
            'global.PUBLIC_PATH': JSON.stringify(publicPath)
        })
    ],
    module: {
        rules: [
            {
                test: /\.ts$/,
                loader: 'ts-loader'
            },
            {
                test: /\.worker\.(j|t)s$/,
                loader: 'worker-loader',
                options: {
                    filename: '[name].js',
                },
            },
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                loader: 'babel-loader',
                options: babelConfig
            }
        ]
    },
    externals: externals,
    resolve: {
        extensions: ['.js', '.json', '.jsx', '.ts']
    },
    resolveLoader: {
        modules: [NODE_MODULES]
    },
    node: {
        console: true,
        global: true,
        process: true,
        Buffer: true,
        __filename: true, // Use relative path
        __dirname: true, // Use relative path
        setImmediate: true
    }
};
