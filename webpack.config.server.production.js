const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const SentryWebpackPlugin = require('@sentry/webpack-plugin');
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

const webpackConfig = {
    mode: 'production',
    target: 'node',
    context: path.resolve(__dirname, 'src/server'),
    entry: {
        index: [
            './index.js'
        ]
    },
    output: {
        path: path.resolve(__dirname, 'dist/Luban/server'),
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

const hasSentryConfig = fs.existsSync(
    path.resolve(__dirname, '.sentry.config.json')
);
if (hasSentryConfig) {
    /* eslint-disable-next-line import/no-unresolved */
    const sentryConfig = require('./.sentry.config.json');

    if (sentryConfig && sentryConfig.auth && sentryConfig.auth.token) {
        webpackConfig.devtool = 'source-map';
        webpackConfig.output.sourceMapFilename = '[name].js.map';
        webpackConfig.plugins.push(
            new SentryWebpackPlugin({
                // see https://docs.sentry.io/product/cli/configuration/ for details
                authToken: sentryConfig.auth.token,
                org: sentryConfig.defaults.org,
                project: sentryConfig.defaults.project,
                release: `${sentryConfig.tagName}-server`,

                include: ['./dist/Luban/server/*.js', './dist/Luban/server/*.js.map'],
                ignore: ['node_modules', 'webpack.config.js'],
                config: {
                    environment: 'production'
                }
            })
        );
    }
}

module.exports = webpackConfig;
