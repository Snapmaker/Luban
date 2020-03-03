import gulp from 'gulp';
import log from 'fancy-log';
import PluginError from 'plugin-error';
import webpack from 'webpack';

//
// Development Copy
//
export function appCopyDevelopment() {
    const files = [
        'src/app/*.{ico,png}',
        'src/app/{images,textures}/**/*',
        'src/app/i18n/**/*'
    ];

    return gulp.src(files, { base: 'src/app' })
        .pipe(gulp.dest('output/app'));
}

//
// Production Copy
//
export function appCopyProduction() {
    const files = [
        'src/app/*.{ico,png}',
        'src/app/{images,textures}/**/*',
        'src/app/i18n/**/*'
    ];

    return gulp.src(files, { base: 'src/app' })
        .pipe(gulp.dest('dist/Snapmakerjs/app'));
}


//
// Production Build
//
export function appBuildProduction() {
    return new Promise((resolve) => {
        const webpackConfig = require('../../webpack.config.app.production.js');
        webpack(webpackConfig, (err, stats) => {
            if (err) {
                throw new PluginError('app:build-prod', err);
            }
            log('[app:build-prod]', stats.toString({ colors: true }));
            resolve();
        });
    });
}
