const { resolve } = require('path');
const webpack = require('webpack');

module.exports = {
    entry: {
        dohard: [
            'react', 'redux', 'react-router', 'react-dom', 'react-reconciler',
            'antd', 'moment', 'bootstrap', 'react-bootstrap',
            'three', 'lodash', 'xterm', 'canvg',
            'snapmaker-react-icon',
            'jquery'
        ]
    },
    output: {
        filename: '[name].dll.js',
        path: resolve(__dirname, 'dll'),
        library: '[name]_[hash]'
    },
    plugins: [
        new webpack.DllPlugin({
            name: '[name]_[hash]',
            path: resolve(__dirname, 'dll/manifest.json')
        })
    ],
    mode: 'production'
};
