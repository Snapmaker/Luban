const path = require('path');
const webpack = require('webpack');
const WriteFileWebpackPlugin = require('write-file-webpack-plugin');
// const ExtractTextPlugin = require('extract-text-webpack-plugin');
// const CSSSplitWebpackPlugin = require('css-split-webpack-plugin').default;
const ManifestPlugin = require('webpack-manifest-plugin');

const babelConfig = require('./babel.config');

const timestamp = new Date().getTime();

module.exports = {
    mode: 'development',
    target: 'web',
    devtool: 'source-map',
    cache: true,
    watch: true,
    watchOptions: {
        poll: true
    },
    context: path.resolve(__dirname, 'src/app'),
    entry: path.resolve(__dirname, 'src/app/lib/manager/Pool.worker.js'),
    output: {
        path: path.resolve(__dirname, 'output/app'),
        chunkFilename: `[name].[hash].bundle.js?_=${timestamp}`,
        filename: `[name].[hash].bundle.js?_=${timestamp}`,
        publicPath: '',
        globalObject: 'this'
    },
    plugins: [
        new webpack.HotModuleReplacementPlugin(),
        new webpack.LoaderOptionsPlugin({
            debug: true
        }),
        new webpack.NoEmitOnErrorsPlugin(),
        new WriteFileWebpackPlugin(),
        new ManifestPlugin()
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
                test: /\.jsx?$|\.ts$/,
                loader: 'eslint-loader',
                enforce: 'pre',
                exclude: /node_modules/,
                options: {
                    cache: true
                }
            },
            {
                test: /\.js(x)?$/,
                loader: 'babel-loader',
                exclude: /node_modules/,
                options: babelConfig
            }
        ]
    },
    // Some libraries import Node modules but don't use them in the browser.
    // Tell Webpack to provide empty mocks for them so importing them works.
    node: {
        fs: 'empty',
        net: 'empty',
        tls: 'empty'
    }
};
