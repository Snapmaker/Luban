import gulp from 'gulp';
import nodemon from 'gulp-nodemon';
import log from 'fancy-log';
import PluginError from 'plugin-error';
import webpack from 'webpack';

//
// Development Copy
//
export function serverCopyDevelopment() {
    const files = ['src/server/{i18n,views}/**/*'];
    return gulp
        .src(files, { base: 'src/server' })
        .pipe(gulp.dest('output/src/server'));
}

//
// Development Build
//
export function serverBuildDevelopment(cb) {
    const exec = require('child_process').exec;
    exec('npm run build:server', () => {
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
        script: './output/src/main',
        // script: './bin/cli',
        args: args,
        ignore: ['.git', 'node_modules/**/node_modules'],
        delay: 8000,
        verbose: true,
        exec: 'electron --inspect --trace-warnings',
        // exec: 'electron --inspect-brk',
        execMap: {
            js: 'node --harmony',
        },
        events: {
            restart:
                "osascript -e 'display notification \"App restarted due to:\n'$FILENAME'\" with title \"nodemon\"'",
        },
        watch: [
            'packages/luban-platform/',
            'src/shared/',
            'src/server/',
        ],
        env: {
            NODE_ENV: 'development',
        },
        ext: 'js json ts',
        // tasks: ['serverBuildDevelopment'],
        tasks: [],
        done: cb,
        stdout: false,
    })
        .once('quit', (code) => {
            log('nodedmon has quit with code', code);
            process.exit();
        })
        .on('restart', (files) => {
            log('App restarted due to: ', files);
        })
        .on('readable', function handleReadable() {
            this.stdout.pipe(process.stdout);
            this.stderr.pipe(process.stderr);
        });
}

//
// Production Copy
//
export function serverCopyProduction() {
    const files = ['src/server/{i18n,views}/**/*'];

    return gulp
        .src(files, { base: 'src/server' })
        .pipe(gulp.dest('dist/Luban/src/server'));
}

//
// Production Build
//
export function serverBuildProduction() {
    return new Promise((resolve) => {
        const webpackConfig = require('../../webpack.config.server.production');
        webpack(webpackConfig, (err, stats) => {
            if (err) {
                throw new PluginError('server:build', err);
            }
            log('[server:build]', stats.toString({ colors: true }));
            resolve();
        });
    });
}
