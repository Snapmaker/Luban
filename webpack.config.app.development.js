/* eslint no-var: 0 */
/* eslint prefer-arrow-callback: 0 */
const without = require('lodash/without');
const path = require('path');
const webpack = require('webpack');
const WriteFileWebpackPlugin = require('write-file-webpack-plugin');
// const ExtractTextPlugin = require('extract-text-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
// const CSSSplitWebpackPlugin = require('css-split-webpack-plugin').default;
const ManifestPlugin = require('webpack-manifest-plugin');
// const InlineChunkWebpackPlugin = require('html-webpack-inline-chunk-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
// const HtmlWebpackPluginAddons = require('html-webpack-plugin-addons');
const nib = require('nib');
const stylusLoader = require('stylus-loader');
const babelConfig = require('./babel.config');

const languages = require('./webpack.config.app-i18n').languages;
const pkg = require('./package.json');

const { CLIENT_PORT, SERVER_PORT } = pkg.config;

module.exports = {
    mode: 'development',
    target: 'web',
    devtool: 'eval-source-map',
    cache: true,
    context: path.resolve(__dirname, 'src/app'),
    resolve: {
        modules: [
            path.resolve(__dirname, 'src/shared'),
            path.resolve(__dirname, 'src/app'),
            'node_modules'
        ],
        extensions: ['.js', '.json', '.jsx', '.styl', '.ts']
    },
    entry: {
        polyfill: [
            // https://github.com/Yaffle/EventSource
            'eventsource-polyfill',
            // https://github.com/glenjamin/webpack-hot-middleware
            // 'webpack-hot-middleware/client?reload=true',
            path.resolve(__dirname, 'src/app/polyfill/index.js')
        ],
        app: [
            // https://github.com/Yaffle/EventSource
            'eventsource-polyfill',
            // https://github.com/glenjamin/webpack-hot-middleware
            // 'webpack-hot-middleware/client?reload=true',
            path.resolve(__dirname, 'src/app/index.jsx')
        ],
        // 'Pool.worker': path.resolve(__dirname, 'src/app/lib/manager/Pool.worker.js')
    },
    output: {
        path: path.resolve(__dirname, 'output/app'),
        filename: '[name].[contenthash:10].bundle.js',
        publicPath: '',
        globalObject: 'this',
        libraryTarget: 'umd'
    },
    optimization: {
        minimize: false,
        splitChunks: {
            chunks: 'all',
            name: true,
            cacheGroups: {
                vendors: {
                    test: /[\\/]node_modules[\\/]/,
                    priority: -10
                }
            },
        }
    },
    plugins: [
        // new webpack.HotModuleReplacementPlugin(),
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
            /moment[/\\]locale$/,
            new RegExp(`^\\./(${without(languages, 'en').join('|')})$`)
        ),
        // Generates a manifest.json file in your root output directory with a mapping of all source file names to their corresponding output file.
        new ManifestPlugin(),
        new MiniCssExtractPlugin({
            filename: '[name].css',
            chunkFilename: '[id].css'
        }),
        new HtmlWebpackPlugin({
            filename: 'index.html',
            template: path.resolve(__dirname, 'src/app/resources/assets/index.html'),
            chunksSortMode: 'dependency' // Sort chunks by dependency
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
                include: [
                    path.resolve(__dirname, 'src/app/lib/manager/'),
                ],
                exclude: /node_modules/
            },
            {
                test: /\.ts$/,
                loader: 'ts-loader',
                exclude: /node_modules/,
                include: [
                    path.resolve(__dirname, 'src/app'),
                    path.resolve(__dirname, 'src/shared'),
                ]
            },
            {
                test: /\.jsx?$|\.ts$/,
                loader: 'eslint-loader',
                enforce: 'pre',
                exclude: /node_modules/,
                options: {
                    cache: true,
                    fix: true
                }
            },
            {
                test: /\.js(x)?$/,
                loader: 'babel-loader',
                exclude: /node_modules/,
                options: {
                    ...babelConfig,
                    cacheDirectory: true
                },
                include: [
                    path.resolve(__dirname, 'src/app'),
                    path.resolve(__dirname, 'src/shared'),
                ]
            },
            {
                oneOf: [
                    {
                        test: /\.styl$/,
                        oneOf: [
                            {
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
                                    path.resolve(__dirname, 'src/app/styles')
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
                                    path.resolve(__dirname, 'src/app/styles')
                                ]
                            }
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
            }
        ]
    },
    // Some libraries import Node modules but don't use them in the browser.
    // Tell Webpack to provide empty mocks for them so importing them works.
    node: {
        fs: 'empty',
        net: 'empty',
        tls: 'empty'
    },
    devServer: {
        port: CLIENT_PORT,
        contentBase: path.resolve(__dirname, 'output/app'),
        proxy: {
            '/api': `http://localhost:${SERVER_PORT}`,
            '/data': `http://localhost:${SERVER_PORT}`,
            '/resources': `http://localhost:${SERVER_PORT}`,
            '/socket.io': {
                target: `ws://localhost:${SERVER_PORT}`,
                ws: true
            }
        }
    },
};
