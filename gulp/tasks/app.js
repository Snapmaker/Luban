import gulp from 'gulp';
import log from 'fancy-log';
import PluginError from 'plugin-error';
import webpack from 'webpack';

//
// Development Copy
//
export function appCopyDevelopment() {
    const files = [
        'src/app/*.{ico,png,html}',
        'src/app/resources/{images,textures}/**/*',
        'src/app/resources/i18n/**/*',
        'src/app/resources/print-board/*'
    ];

    return gulp.src(files, { base: 'src/app' })
        .pipe(gulp.dest('output/src/app'));
}

//
// Production Copy
//
export function appCopyProduction() {
    const files = [
        'src/app/*.{ico,png,html}',
        'src/app/resources/{images,textures}/**/*',
        'src/app/resources/i18n/**/*',
        'src/app/resources/print-board/*'
    ];

    return gulp.src(files, { base: 'src/app' })
        .pipe(gulp.dest('dist/Luban/src/app'));
}


//
// Production Build
//
export function appBuildProduction() {
    return new Promise((resolve) => {
        const webpackConfig = require('../../webpack.config.app.production');
        webpack(webpackConfig, (err, stats) => {
            if (err) {
                throw new PluginError('app:build-prod', err);
            }
            log('[app:build-prod]', stats.toString({ colors: true }));
            resolve();
        });
    });
}
