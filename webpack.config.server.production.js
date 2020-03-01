/* eslint no-var: 0 */
/* eslint prefer-arrow-callback: 0 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
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
    entry: {
        index: [
            './index.js'
        ]
    },
    output: {
        path: path.resolve(__dirname, 'dist/Snapmakerjs/server'),
        filename: '[name].js',
        libraryTarget: 'commonjs2'
    },
    optimization: {
        // TerserPlugin@v1 uses a deprecated approach that causes Node.js 10 to print
        // this warning to stderr:
        //
        // "Using a domain property in MakeCallback is deprecated. Use the async_context
        // variant of MakeCallback or the AsyncResource class instead."
        //
        // For details: see
        // https://www.bountysource.com/issues/72452391-fix-deprecation-warning
        // and
        // https://github.com/TNRIS/tnris.org/issues/9
        //
        // We explicitly specify to use terser-webpack-plugin@~2.3.5 to bypass the warning
        minimizer: [new TerserPlugin()]
    },
    plugins: [
        new webpack.DefinePlugin({
            'global.PUBLIC_PATH': JSON.stringify(publicPath)
        })
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
