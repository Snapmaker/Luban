import gulp from 'gulp';
import log from 'fancy-log';
import PluginError from 'plugin-error';
import webpack from 'webpack';

export default (options) => {
    gulp.task('app:i18n', ['i18next:app']);

    //
    // Development Build
    //
    gulp.task('app:build-dev', (callback) => {
        if (process.env.NODE_ENV !== 'development') {
            const err = new Error('Set NODE_ENV to "development" for development build');
            throw new PluginError('app:build-dev', err);
        }

        const webpackConfig = require('../../webpack.config.app.development.js');
        webpack(webpackConfig, (err, stats) => {
            if (err) {
                throw new PluginError('app:build-dev', err);
            }
            log('[app:build-dev]', stats.toString({ colors: true }));
            callback();
        });
    });
    gulp.task('app:output', () => {
        const files = [
            'src/app/*.{ico,png}',
            'src/app/{images,textures}/**/*',
            'src/app/i18n/**/*'
        ];

        return gulp.src(files, { base: 'src/app' })
            .pipe(gulp.dest('output/app'));
    });

    //
    // Production Build
    //
    gulp.task('app:build-prod', (callback) => {
        if (process.env.NODE_ENV !== 'production') {
            const err = new Error('Set NODE_ENV to "production" for production build');
            throw new PluginError('app:build-prod', err);
        }

        const webpackConfig = require('../../webpack.config.app.production.js');
        webpack(webpackConfig, (err, stats) => {
            if (err) {
                throw new PluginError('app:build-prod', err);
            }
            log('[app:build-prod]', stats.toString({ colors: true }));
            callback();
        });
    });
    gulp.task('app:dist', () => {
        const files = [
            'src/app/*.{ico,png}',
            'src/app/{images,textures}/**/*',
            'src/app/i18n/**/*'
        ];

        return gulp.src(files, { base: 'src/app' })
            .pipe(gulp.dest('dist/Snapmakerjs/app'));
    });
};
