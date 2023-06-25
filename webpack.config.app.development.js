/* eslint no-var: 0 */
/* eslint prefer-arrow-callback: 0 */
const without = require('lodash/without');
const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const ManifestPlugin = require('webpack-manifest-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const nib = require('nib');
const stylusLoader = require('stylus-loader');
const babelConfig = require('./babel.config');

const languages = require('./webpack.config.app-i18n').languages;
const pkg = require('./package.json');

const { CLIENT_PORT, SERVER_PORT } = pkg.config;

const devServer = {
    hot: true,
    port: CLIENT_PORT,
    static: {
        directory: path.resolve(__dirname, 'output/src/app'),
    },
    proxy: {
        '/api': `http://localhost:${SERVER_PORT}`,
        '/data': `http://localhost:${SERVER_PORT}`,
        '/worker': `http://localhost:${SERVER_PORT}`,
        '/resources': `http://localhost:${SERVER_PORT}`,
        '/socket.io': {
            target: `ws://localhost:${SERVER_PORT}`,
            ws: true
        },
    },
    devMiddleware: {
        index: true,
        writeToDisk: true,
    }
};

module.exports = {
    mode: 'development',
    target: 'web',
    // devtool: 'eval',
    devtool: 'eval-cheap-source-map',
    context: path.resolve(__dirname, 'src/app'),
    resolve: {
        modules: [
            path.resolve(__dirname, 'packages/*'),
            path.resolve(__dirname, 'src/shared'),
            path.resolve(__dirname, 'src/app'),
            'node_modules',
        ],
        extensions: ['.js', '.json', '.jsx', '.styl', '.ts', '.tsx'],
    },
    entry: {
        app: path.resolve(__dirname, 'src/app/index.jsx'),
        polyfill: path.resolve(__dirname, 'src/app/polyfill/index.js'),
        // 'Pool.worker': path.resolve(__dirname, 'src/app/lib/manager/Pool.worker.js')
    },
    output: {
        path: path.resolve(__dirname, 'output/src/app'),
        filename: '[name].[hash].bundle.js',
        publicPath: '',
        globalObject: 'this',
        libraryTarget: 'umd',
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
        })
    ],
    module: {
        rules: [
            // ESLint
            {
                enforce: 'pre',
                test: /(\.jsx?|\.tsx?)$/,
                loader: 'eslint-loader',
                exclude: /node_modules/,
                options: {
                    cache: false,
                    fix: false,
                    emitWarning: false,
                    quiet: true,
                    configFile: path.resolve(__dirname, '.eslintrc.js'),
                },
            },
            // workers
            {
                test: /\.worker\.(js|ts)$/,
                include: [
                    path.resolve(__dirname, 'src/app/lib/manager/'),
                ],
                exclude: /node_modules/,
                loader: 'worker-loader',
                options: {
                    publicPath: '/worker/',
                    filename: '[name].js',
                },
            },
            // TypeScript/TSX
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                // exclude: /node_modules/,
                options: {
                    transpileOnly: true,
                },
            },
            // JavaScript/JSX
            {
                test: /\.jsx?$/,
                include: [
                    path.resolve(__dirname, 'packages/*'),
                    path.resolve(__dirname, 'src/app'),
                    path.resolve(__dirname, 'src/shared'),
                ],
                exclude: /node_modules/,
                loader: 'babel-loader',
                options: {
                    ...babelConfig,
                    cacheDirectory: true
                },
            },
            // Stylus
            {
                test: /\.styl$/,
                oneOf: [
                    // global styles
                    {
                        include: [
                            path.resolve(__dirname, 'src/app/styles')
                        ],
                        use: [
                            'style-loader',
                            {
                                loader: 'css-loader',
                                options: {
                                    importLoaders: 1,
                                    modules: {
                                        mode: 'global',
                                        exportLocalsConvention: 'camelCase',
                                    },
                                    esModule: false,
                                }
                            },
                            'stylus-loader',
                        ],
                    },
                    // module
                    {
                        exclude: [
                            path.resolve(__dirname, 'src/app/styles')
                        ],
                        use: [
                            'style-loader',
                            {
                                loader: 'css-loader',
                                options: {
                                    importLoaders: 1, // loaders applied before css loader
                                    modules: {
                                        mode: 'local',
                                        exportLocalsConvention: 'camelCase',
                                        localIdentName: '[path][name]__[local]--[hash:base64:5]',
                                    },
                                    esModule: false,
                                }
                            },
                            'stylus-loader',
                        ]
                    },
                ]
            },
            // CSS files
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            },
            // image files
            {
                test: /\.(png|jpg|svg)$/,
                loader: 'url-loader',
                options: {
                    limit: 8192
                }
            },
            // font files
            {
                test: /\.(ttf|woff|woff2|eot)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                loader: 'file-loader'
            },
        ]
    },
    // Some libraries import Node modules but don't use them in the browser.
    // Tell Webpack to provide empty mocks for them so importing them works.
    node: {
        fs: 'empty',
        net: 'empty',
        tls: 'empty',
    },
    devServer: devServer,
};
