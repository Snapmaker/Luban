import gulp from 'gulp';
import nodemon from 'gulp-nodemon';
import log from 'fancy-log';
import PluginError from 'plugin-error';
import webpack from 'webpack';
import fs from 'fs';

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
    const webpackConfig = require('../../webpack.config.server.development');
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
        script: './output/main',
        // script: './bin/cli',
        args: args,
        ignore: [
            '.git',
            'node_modules/**/node_modules'
        ],
        verbose: true,
        exec: 'electron --inspect',
        // exec: 'electron --inspect-brk',
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
        ext: 'js json ts',
        tasks: ['serverBuildDevelopment'],
        done: cb,
        stdout: false
    }).on('readable', function () {
        this.stdout.pipe(process.stdout);
        this.stderr.pipe(process.stderr);
    });
}

function replace(path, flag, str) {
    const content = fs.readFileSync(path, 'utf-8');
    const eol = '\n';
    const data = content.replace(
        new RegExp(`(// LUBAN ${flag} BEGIN)[\\s\\S]*\\n(\\s*// LUBAN ${flag} END)`), `$1${eol}${str}$2`
    );
    fs.writeFile(path, data, { encoding: 'utf-8' }, () => { });
}

function generateWorkerMethods(path) {
    const dir = fs.readdirSync(path, { encoding: 'utf-8' });
    const workerFiles = dir.filter((name) => {
        const stat = fs.statSync(`${path}/${name}`);
        return stat.isFile();
    }).map((file) => {
        const [name] = file.split('.');
        return name;
    });
    const workerMethods = workerFiles.reduce((prev, file, index) => {
        prev += `    ${file} = '${file}'${index !== workerFiles.length - 1 ? ',' : ''}\n`;
        return prev;
    }, '');
    return workerMethods;
}

export function serverWatchDevelopment(cb) {
    const watch = require('gulp-watch');
    return watch(['./src/app/workers/*', './src/server/services/task-manager/workers/*'], () => {
        const workerMethods = generateWorkerMethods('./src/app/workers');
        replace('./src/app/lib/manager/workerManager.ts', 'worker methods', workerMethods);

        const ServerWorkerMethods = generateWorkerMethods('./src/server/services/task-manager/workers');
        replace('./src/server/services/task-manager/workerManager.ts', 'worker methods', ServerWorkerMethods);

        cb();
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
        .pipe(gulp.dest('dist/Luban/server'));
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
