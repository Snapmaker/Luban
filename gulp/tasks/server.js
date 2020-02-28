import gulp from 'gulp';
import nodemon from 'gulp-nodemon';
import log from 'fancy-log';
import PluginError from 'plugin-error';
import webpack from 'webpack';

//
// Development Build
//
export async function serverBuildDevelopment() {
    await new Promise((resolve) => {
        const webpackConfig = require('../../webpack.config.server.development.js');
        webpack(webpackConfig, (err, stats) => {
            if (err) {
                throw new PluginError('server:build', err);
            }
            log('[server:build]', stats.toString({ colors: true }));
            resolve();
        });
    });

    const files = [
        'src/server/{i18n,views}/**/*'
    ];
    return gulp.src(files, { base: 'src/server' })
        .pipe(gulp.dest('output/server'));
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
            'src/server/'
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
// Production Build
//
export async function serverBuildProduction() {
    await new Promise((resolve) => {
        const webpackConfig = require('../../webpack.config.server.production.js');
        webpack(webpackConfig, (err, stats) => {
            if (err) {
                throw new PluginError('server:build', err);
            }
            log('[server:build]', stats.toString({ colors: true }));
            resolve();
        });
    });

    const files = [
        'src/server/{i18n,views}/**/*'
    ];

    return gulp.src(files, { base: 'src/server' })
        .pipe(gulp.dest('dist/Snapmakerjs/server'));
}
