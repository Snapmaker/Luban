const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
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

// Use publicPath for production
// const payload = pkg.version;
const publicPath = (function calculatePublicPath(payload) {
    const algorithm = 'sha1';
    const buf = String(payload);
    const hash = crypto.createHash(algorithm).update(buf).digest('hex');
    return `/${hash.substr(0, 8)}/`; // 8 digits
}(pkg.version));

module.exports = {
    mode: 'production',
    target: 'node',
    context: path.resolve(__dirname, 'src/server'),
    resolve: {
        modules: ['node_modules'],
        extensions: ['.js', '.json', '.jsx', '.ts']
    },
    entry: {
        index: './index.js'
    },
    output: {
        path: path.resolve(__dirname, 'dist/Luban/src/server'),
        filename: '[name].js',
        libraryTarget: 'commonjs2'
    },
    optimization: {
        minimize: true,
        minimizer: [new TerserPlugin()],
    },
    plugins: [
        new webpack.DefinePlugin({
            'global.PUBLIC_PATH': JSON.stringify(publicPath)
        })
    ],
    module: {
        rules: [
            {
                test: /\.worker\.(j|t)s$/,
                loader: 'worker-loader',
                options: {
                    filename: '[name].js',
                },
            },
            {
                test: /\.ts$/,
                loader: 'ts-loader',
                options: {
                    transpileOnly: true
                }
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
