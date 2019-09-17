import gulp from 'gulp';
import nodemon from 'gulp-nodemon';
import log from 'fancy-log';
import PluginError from 'plugin-error';
import webpack from 'webpack';

export default () => {
    gulp.task('server:i18n', ['i18next:server']);

    //
    // Development Build
    //
    gulp.task('server:build-dev', (callback) => {
        if (process.env.NODE_ENV !== 'development') {
            const err = new Error('Set NODE_ENV to "development" for development build');
            throw new PluginError('server:build-dev', err);
        }

        const webpackConfig = require('../../webpack.config.server.development.js');
        webpack(webpackConfig, (err, stats) => {
            if (err) {
                throw new PluginError('server:build', err);
            }
            log('[server:build]', stats.toString({ colors: true }));
            callback();
        });
    });
    gulp.task('server:output', () => {
        const files = [
            'src/server/{i18n,views}/**/*'
        ];

        return gulp.src(files, { base: 'src/server' })
            .pipe(gulp.dest('output/server'));
    });

    gulp.task('server:start-dev', () => {
        if (process.env.NODE_ENV !== 'development') {
            const err = new Error('Set NODE_ENV to "development" for development build');
            throw new PluginError('server:build-dev', err);
        }
        const args = (process.env.ARGS && process.env.ARGS.split(' ')) || [];

        nodemon({
            restartable: 'rs',
            script: './bin/cli',
            args: args,
            ignore: [
                '.git',
                'node_modules/**/node_modules'
            ],
            verbose: true,
            execMap: {
                'js': 'node --harmony'
            },
            events: {
                'restart': "osascript -e 'display notification \"App restarted due to:\n'$FILENAME'\" with title \"nodemon\"'"
            },
            watch: [
                'src/server/'
            ],
            env: {
                'NODE_ENV': 'development'
            },
            ext: 'js json',
            tasks: ['server:build-dev']
        });
    });

    //
    // Production Build
    //
    gulp.task('server:build-prod', (callback) => {
        if (process.env.NODE_ENV !== 'production') {
            const err = new Error('Set NODE_ENV to "production" for production build');
            throw new PluginError('server:build', err);
        }

        const webpackConfig = require('../../webpack.config.server.production.js');
        webpack(webpackConfig, (err, stats) => {
            if (err) {
                throw new PluginError('server:build', err);
            }
            log('[server:build]', stats.toString({ colors: true }));
            callback();
        });
    });
    gulp.task('server:dist', () => {
        const files = [
            'src/server/{i18n,views}/**/*'
        ];

        return gulp.src(files, { base: 'src/server' })
            .pipe(gulp.dest('dist/Snapmakerjs/server'));
    });
};
