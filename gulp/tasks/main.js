import log from 'fancy-log';
import PluginError from 'plugin-error';
import webpack from 'webpack';

//
// Production Build
//
// Bundles the Electron main process (src/main.js) and the server child entry
// (src/server-cli.js) into dist/Luban/src, one file each.
//
export function mainBuildProduction() {
    return new Promise((resolve, reject) => {
        const webpackConfig = require('../../webpack.config.main.production');
        webpack(webpackConfig, (err, stats) => {
            if (err) {
                reject(new PluginError('main:build', err));
                return;
            }
            log('[main:build]', stats.toString({ colors: true }));
            if (stats.hasErrors()) {
                // Production mode emits nothing when a module fails to
                // compile, so a silent success here would ship no main.js.
                reject(new PluginError('main:build', 'webpack reported errors'));
                return;
            }
            resolve();
        });
    });
}
