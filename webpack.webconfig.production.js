/* eslint no-var: 0 */
/* eslint prefer-arrow-callback: 0 */
const without = require('lodash/without');
const crypto = require('crypto');
const path = require('path');
const findImports = require('find-imports');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
// const CSSSplitWebpackPlugin = require('css-split-webpack-plugin').default;
const ManifestPlugin = require('webpack-manifest-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
// const HtmlWebpackPluginAddons = require('html-webpack-plugin-addons');
const nib = require('nib');
const stylusLoader = require('stylus-loader');
const languages = require('./webpack.webconfig.i18n').languages;
const pkg = require('./package.json');

// Use publicPath for production
const payload = pkg.version;
const publicPath = (function(payload) {
    const algorithm = 'sha1';
    const buf = String(payload);
    const hash = crypto.createHash(algorithm).update(buf).digest('hex');
    return '/' + hash.substr(0, 8) + '/'; // 8 digits
}(payload));

const timestamp = new Date().getTime();


module.exports = {
    mode: 'production',
    target: 'web',
    cache: true,
    // devtool: 'source-map', // used in pre-production, comment this on production
    context: path.resolve(__dirname, 'src/web'),
    resolve: {
        modules: [
            path.resolve(__dirname, 'src/shared'),
            path.resolve(__dirname, 'src/web'),
            'node_modules'
        ],
        extensions: ['.js', '.json', '.jsx', '.styl']
    },
    entry: {
        polyfill: path.resolve(__dirname, 'src/web/polyfill/index.js'),
        vendor: findImports([
            'src/web/**/*.{js,jsx}',
            '!src/web/polyfill/**/*.js',
            '!src/web/containers/DevTools.js', // redux-devtools
            '!src/web/**/*.development.js'
        ], { flatten: true }),
        app: path.resolve(__dirname, 'src/web/index.jsx')
    },
    output: {
        path: path.resolve(__dirname, 'dist/cnc/web'),
        chunkFilename: `[name].[chunkhash].bundle.js?_=${timestamp}`,
        filename: `[name].[chunkhash].bundle.js?_=${timestamp}`,
        publicPath: publicPath
    },
    plugins: [
        new stylusLoader.OptionsPlugin({
            default: {
                // nib - CSS3 extensions for Stylus
                use: [nib()],
                // no need to have a '@import "nib"' in the stylesheet
                import: ['~nib/lib/nib/index.styl']
            }
        }),
        new webpack.ContextReplacementPlugin(
            /moment[\/\\]locale$/,
            new RegExp('^\./(' + without(languages, 'en').join('|') + ')$')
        ),
        // Generates a manifest.json file in your root output directory with a mapping of all source file names to their corresponding output file.
        new ManifestPlugin({
            fileName: 'manifest.json'
        }),
        new MiniCssExtractPlugin({
            filename: '[name].css',
            chunkFilename: '[id].css'
        }),
        /*
        new CSSSplitWebpackPlugin({
            size: 4000,
            imports: '[name].[ext]?[hash]',
            filename: '[name]-[part].[ext]?[hash]',
            preserve: false
        }),*/
        new HtmlWebpackPlugin({
            // title: `Snapmakerjs ${pkg.version}`,
            filename: 'index.hbs',
            template: path.resolve(__dirname, 'src/web/assets/index.hbs'),
            chunksSortMode: 'dependency' // Sort chunks by dependency
        })
    ],
    module: {
        rules: [
            {
                test: /\.jsx?$/,
                loader: 'eslint-loader',
                enforce: 'pre',
                exclude: /node_modules/
            },
            {
                test: /\.jsx?$/,
                loader: 'babel-loader',
                exclude: /(node_modules|bower_components)/
            },
            {
                test: /\.styl$/,
                use: [
                    // 'style-loader',
                    MiniCssExtractPlugin.loader,
                    {
                        loader: 'css-loader',
                        options: {
                            camelCase: true, // export class names in camelCase
                            modules: true, // enable CSS module
                            importLoaders: 1, // loaders applied before css loader
                            localIdentName: '[path][name]__[local]--[hash:base64:5]' // generated identifier
                        }
                    },
                    'stylus-loader'
                ],
                exclude: [
                    path.resolve(__dirname, 'src/web/styles')
                ]
            },
            {
                test: /\.styl$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    'css-loader?camelCase',
                    'stylus-loader'
                ],
                include: [
                    path.resolve(__dirname, 'src/web/styles')
                ]
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            },
            {
                test: /\.(png|jpg|svg)$/,
                loader: 'url-loader',
                options: {
                    limit: 8192
                }
            },
            {
                test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                loader: 'url-loader',
                options: {
                    limit: 10000,
                    mimetype: 'application/font-woff'
                }
            },
            {
                test: /\.(ttf|eot)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                loader: 'file-loader'
            },
            {
                test: /\.worker\.js$/,
                use: { loader: 'worker-loader' }
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
