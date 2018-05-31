/* eslint no-var: 0 */
/* eslint prefer-arrow-callback: 0 */
const without = require('lodash/without');
const path = require('path');
const webpack = require('webpack');
const WriteFileWebpackPlugin = require('write-file-webpack-plugin');
// const ExtractTextPlugin = require('extract-text-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CSSSplitWebpackPlugin = require('css-split-webpack-plugin').default;
const ManifestPlugin = require('webpack-manifest-plugin');
// const InlineChunkWebpackPlugin = require('html-webpack-inline-chunk-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
// const HtmlWebpackPluginAddons = require('html-webpack-plugin-addons');
const nib = require('nib');
const stylusLoader = require('stylus-loader');
const languages = require('./webpack.webconfig.i18n').languages;


const timestamp = new Date().getTime();

module.exports = {
    mode: 'development',
    target: 'web',
    cache: true,
    devtool: 'eval',
    context: path.resolve(__dirname, 'src/web'),
    resolve: {
        modules: [
            path.resolve(__dirname, 'src/web'),
            'node_modules'
        ],
        extensions: ['.js', '.json', '.jsx', '.styl']
    },
    entry: {
        polyfill: [
            // https://github.com/Yaffle/EventSource
            'eventsource-polyfill',
            // https://github.com/glenjamin/webpack-hot-middleware
            'webpack-hot-middleware/client?reload=true',
            path.resolve(__dirname, 'src/web/polyfill/index.js')
        ],
        app: [
            // https://github.com/Yaffle/EventSource
            'eventsource-polyfill',
            // https://github.com/glenjamin/webpack-hot-middleware
            'webpack-hot-middleware/client?reload=true',
            path.resolve(__dirname, 'src/web/index.jsx')
        ]
    },
    output: {
        path: path.resolve(__dirname, 'output/web'),
        chunkFilename: `[name].[hash].bundle.js?_=${timestamp}`,
        filename: `[name].[hash].bundle.js?_=${timestamp}`,
        pathinfo: true,
        publicPath: ''
    },
    optimization: {
        splitChunks: {
        }
    },
    plugins: [
        new webpack.HotModuleReplacementPlugin(),
        new webpack.NamedModulesPlugin(),
        new webpack.LoaderOptionsPlugin({
            debug: true
        }),
        new webpack.NoEmitOnErrorsPlugin(),
        new stylusLoader.OptionsPlugin({
            default: {
                // nib - CSS3 extensions for Stylus
                use: [nib()],
                // no need to have a '@import "nib"' in the stylesheet
                import: ['~nib/lib/nib/index.styl']
            }
        }),
        // https://github.com/gajus/write-file-webpack-plugin
        // Forces webpack-dev-server to write bundle files to the file system.
        new WriteFileWebpackPlugin(),
        new webpack.ContextReplacementPlugin(
            /moment[\/\\]locale$/,
            new RegExp('^\./(' + without(languages, 'en').join('|') + ')$')
        ),
        // Generates a manifest.json file in your root output directory with a mapping of all source file names to their corresponding output file.
        new ManifestPlugin(),
        /*new ExtractTextPlugin({
            filename: '[name].css',
            allChunks: true
        }),*/
        new MiniCssExtractPlugin({
            filename: '[name].css',
            chunkFilename: '[id].css'
        }),
        new CSSSplitWebpackPlugin({
            size: 4000,
            imports: '[name].[ext]?[hash]',
            filename: '[name]-[part].[ext]?[hash]',
            preserve: false
        }),
        new HtmlWebpackPlugin({
            filename: 'index.hbs',
            template: path.resolve(__dirname, 'src/web/assets/index.hbs'),
            chunksSortMode: 'dependency' // Sort chunks by dependency
        })
        /*
        new HtmlWebpackPluginAddons({
            // Do not insert "[name]-[part].css" to the html. For example:
            // <link href="/9b80ca13/[name]-1.css?0584938f631ef1dd3e93d8d8169648a0" rel="stylesheet">
            // <link href="/9b80ca13/[name]-2.css?0584938f631ef1dd3e93d8d8169648a0" rel="stylesheet">
            // <link href="/9b80ca13/[name].css?ff4bb41b7b5e61a63da54dff2e59581d" rel="stylesheet">
            afterHTMLProcessing: function(htmlPluginData, next) {
                const re = new RegExp(/<link.* href="[^"]+\w+\-\d+\.css[^>]+>/);
                htmlPluginData.html = htmlPluginData.html.replace(re, '');
                next(null, htmlPluginData);
            }
        }),*/
        /*
        new InlineChunkWebpackPlugin({
            inlineChunks: ['manifest']
        })
        */
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
                    'style-loader',
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
                    'style-loader',
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

