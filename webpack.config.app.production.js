/* eslint no-var: 0 */
/* eslint prefer-arrow-callback: 0 */
const without = require('lodash/without');
// const crypto = require('crypto');
const path = require('path');
const findImports = require('find-imports');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const ManifestPlugin = require('webpack-manifest-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const nib = require('nib');
const stylusLoader = require('stylus-loader');

const babelConfig = require('./babel.config');
const languages = require('./webpack.config.app-i18n').languages;
// const pkg = require('./package.json');

// Use publicPath for production
// const publicPath = (function calculatePublicPath(payload) {
//     const algorithm = 'sha1';
//     const buf = String(payload);
//     const hash = crypto.createHash(algorithm).update(buf).digest('hex');
//     return `/${hash.substr(0, 8)}/`; // 8 digits
// }(pkg.version));
const publicPath = './';
const timestamp = new Date().getTime();

module.exports = {
    mode: 'production',
    target: 'web',
    cache: true,
    // devtool: 'source-map', // used in pre-production, comment this on production
    context: path.resolve(__dirname, 'src/app'),
    resolve: {
        modules: [
            path.resolve(__dirname, 'packages/*'),
            path.resolve(__dirname, 'src/shared'),
            path.resolve(__dirname, 'src/app'),
            'node_modules'
        ],
        extensions: ['.js', '.json', '.jsx', '.styl', '.ts', '.tsx']
    },
    entry: {
        polyfill: path.resolve(__dirname, 'src/app/polyfill/index.js'),
        vendor: findImports([
            'src/app/**/*.{js,jsx}',
            '!src/app/polyfill/**/*.js',
            '!src/app/**/*.development.js'
        ], { flatten: true }),
        app: path.resolve(__dirname, 'src/app/index.jsx')
    },
    output: {
        path: path.resolve(__dirname, 'dist/Luban/src/app'),
        chunkFilename: `[name].[chunkhash].bundle.js?_=${timestamp}`,
        filename: `[name].[chunkhash].bundle.js?_=${timestamp}`,
        publicPath: publicPath,
    },
    optimization: {
        minimize: true,
        minimizer: [new TerserPlugin()],
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
            /moment[/\\]locale$/,
            new RegExp(`^\\./(${without(languages, 'en').join('|')})$`)
        ),
        // Generates a manifest.json file in your root output directory with a mapping of all source file names to their corresponding output file.
        new ManifestPlugin({
            fileName: 'manifest.json'
        }),
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
                test: /\.(jsx?|tsx?)$/,
                loader: 'eslint-loader',
                exclude: /node_modules/,
                options: {
                    cache: false,
                    fix: true,
                    emitWarning: false,
                    quiet: true,
                    configFile: path.resolve(__dirname, '.eslintrc.js'),
                },
            },
            // workers
            {
                test: /\.worker\.(js|ts)$/,
                loader: 'worker-loader',
                options: {
                    filename: '[name].js',
                },
            },
            // TypeScript/TSX
            {
                test: /\.tsx?$/,
                use: [
                    {
                        loader: 'babel-loader',
                        options: {
                            presets: [
                                '@babel/preset-env',
                                [
                                    '@babel/preset-react',
                                    { pragma: 'createElement' },
                                ],
                            ],
                        },
                    },
                    {
                        loader: 'ts-loader',
                        options: {
                            transpileOnly: true
                        }
                    },
                ]
            },
            // JavaScript/JSX
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                loader: 'babel-loader',
                options: babelConfig,
            },
            // global styles
            {
                test: /\.styl$/,
                use: [
                    MiniCssExtractPlugin.loader,
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
                include: [
                    path.resolve(__dirname, 'src/app/styles'),
                ]
            },
            // Stylus
            {
                test: /\.styl$/,
                use: [
                    // 'style-loader',
                    MiniCssExtractPlugin.loader,
                    {
                        loader: 'css-loader',
                        options: {
                            importLoaders: 1,
                            modules: {
                                mode: 'local',
                                exportLocalsConvention: 'camelCase',
                                localIdentName: '[path][name]__[local]--[hash:base64:5]',
                            },
                            esModule: false,
                        }
                    },
                    'stylus-loader',
                ],
                exclude: [
                    path.resolve(__dirname, 'src/app/styles')
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
            }
        ]
    },
    // Some libraries import Node modules but don't use them in the browser.
    // Tell Webpack to provide empty mocks for them so importing them works.
    node: {
        fs: 'empty',
        net: 'empty',
        tls: 'empty',
    }
};
