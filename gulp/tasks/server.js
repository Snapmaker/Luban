import gulp from 'gulp';
import nodemon from 'gulp-nodemon';
import log from 'fancy-log';
import PluginError from 'plugin-error';
import webpack from 'webpack';

//
// Development Copy
//
export function serverCopyDevelopment() {
    const files = [
        'src/server/{i18n,views}/**/*'
    ];
    return gulp.src(files, { base: 'src/server' })
        .pipe(gulp.dest('output/server'));
}

//
// Development Build
//
export function serverBuildDevelopment(cb) {
    const webpackConfig = require('../../webpack.config.server.development.js');
    webpack(webpackConfig, (err, stats) => {
        if (err) {
            throw new PluginError('server:build', err);
        }
        log('[server:build]', stats.toString({ colors: true }));
        cb();
    });
}

//
// Development Start
//
export function serverStartDevelopment(cb) {
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
            'src/server/',
            'src/shared/'
        ],
        env: {
            'NODE_ENV': 'development'
        },
        ext: 'js json',
        tasks: ['serverBuildDevelopment'],
        done: cb
    });
}

//
// Production Copy
//
export function serverCopyProduction() {
    const files = [
        'src/server/{i18n,views}/**/*'
    ];

    return gulp.src(files, { base: 'src/server' })
        .pipe(gulp.dest('dist/Snapmakerjs/server'));
}

//
// Production Build
//
export function serverBuildProduction() {
    return new Promise((resolve) => {
        const webpackConfig = require('../../webpack.config.server.production.js');
        webpack(webpackConfig, (err, stats) => {
            if (err) {
                throw new PluginError('server:build', err);
            }
            log('[server:build]', stats.toString({ colors: true }));
            resolve();
        });
    });
}
