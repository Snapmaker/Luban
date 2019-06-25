/* eslint no-var: 0 */
/* eslint prefer-arrow-callback: 0 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
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
    context: path.resolve(__dirname, 'src/server'),
    entry: {
        index: [
            // 'webpack/hot/poll?1000',
            './index.js'
        ]
    },
    output: {
        path: path.resolve(__dirname, 'output/server'),
        filename: '[name].js',
        libraryTarget: 'commonjs2'
    },
    plugins: [
        new webpack.DefinePlugin({
            'global.PUBLIC_PATH': JSON.stringify(publicPath)
        })
        // new webpack.HotModuleReplacementPlugin(),
    ],
    module: {
        rules: [
            {
                test: /\.jsx?$/,
                loader: 'babel-loader',
                exclude: /node_modules/
            }
        ]
    },
    externals: externals,
    resolve: {
        extensions: ['.js', '.json', '.jsx']
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
