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
// const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const AddAssetHtmlWebpackPlugin = require('add-asset-html-webpack-plugin');
const babelConfig = require('./babel.config');


const languages = require('./webpack.config.app-i18n').languages;
const pkg = require('./package.json');

// const timestamp = new Date().getTime();
const { clientPort, serverPort } = pkg.config;

// const smp = new SpeedMeasurePlugin();

// module.exports = smp.wrap({
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
        // chunkFilename: `[name].[hash].bundle.js?_=${timestamp}`,
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
            cacheGroups: { // 分割chunk的组
                vendors: {
                    // node_modules中的文件会被打包到vendors组的chunk中，--> vendors~xxx.js
                    // 满足上面的公共规则，大小超过30kb、至少被引用一次
                    test: /[\\/]node_modules[\\/]/,
                    // 优先级
                    priority: -10
                },
                default: {
                    // 要提取的chunk最少被引用2次
                    minChunks: 2,
                    priority: -20,
                    // 如果当前要打包的模块和之前已经被提取的模块是同一个，就会复用，而不是重新打包
                    reuseExistingChunk: true
                }
            },
        },

        runtimeChunk: {
            name: entrypoint => `runtime-${entrypoint.name}`,
        }
    },
    // scripts: ['https://unpkg.com/react@17.0.1/umd/react.production.min.js'],
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
        }),
        // 告诉webpack哪些库不参与打包，同时使用时的名称也得变
        new webpack.DllReferencePlugin({
            manifest: path.resolve(__dirname, 'dll/manifest.json')
        }),
        // 将某个文件打包输出到build目录下，并在html中自动引入该资源
        new AddAssetHtmlWebpackPlugin([
            { glob: path.resolve(__dirname, './dll/*.dll.js') },
        ]),
        new BundleAnalyzerPlugin()
    ],
    module: {
        rules: [
            {
                test: /\.worker\.(j|t)s$/,
                loader: 'worker-loader',
                options: {
                    filename: '[name].js',
                },
                enforce: 'pre', // 优先执行
                include: path.resolve(__dirname, 'src/app/lib/manager/'),
                exclude: /node_modules/
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
                test: /\.(t|j)s(x)?$/,
                loader: 'babel-loader',
                exclude: /node_modules/,
                options: {
                    ...babelConfig,
                    cacheDirectory: true
                }
            },
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
                // 以下配置只会生效一个
                oneOf: [
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
        port: clientPort,
        contentBase: path.resolve(__dirname, 'output/app'),
        proxy: {
            '/api': `http://localhost:${serverPort}`,
            '/data': `http://localhost:${serverPort}`,
            '/resources': `http://localhost:${serverPort}`,
            '/socket.io': {
                target: `ws://localhost:${serverPort}`,
                ws: true
            }
        }
    },
};
// });
