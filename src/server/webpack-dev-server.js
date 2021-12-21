import webpack from 'webpack';
import webpackDevMiddleware from 'webpack-dev-middleware';
import webpackHotMiddleware from 'webpack-hot-middleware';
import electron from 'electron';
import config from '../../webpack.config.app.development';

const webpackDevServer = (app) => {
    // https://github.com/webpack/webpack-dev-middleware
    const compiler = webpack(config);

    // https://github.com/webpack/webpack-dev-middleware
    // webpack-dev-middleware handle the files in memory.
    const devMiddleware = webpackDevMiddleware(compiler, {
        lazy: false,
        // https://webpack.github.io/docs/node.js-api.html#compiler
        watchOptions: {
            poll: true, // use polling instead of native watchers
            ignored: /node_modules/
        },
        publicPath: config.output.publicPath,
        stats: {
            colors: true
        }
    });
    devMiddleware.waitUntilValid(() => {
        electron.BrowserWindow.getAllWindows().forEach(window => {
            window.webContents.reload();
        });
    });
    app.use(devMiddleware);

    app.use(webpackHotMiddleware(compiler));
};

export default webpackDevServer;
