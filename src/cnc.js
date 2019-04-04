/* eslint max-len: 0 */
/* eslint no-console: 0 */
import fs from 'fs';
import path from 'path';
import program from 'commander';
import isElectron from 'is-electron';
import pkg from './package.json';

// Defaults to 'production'
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const increaseVerbosityLevel = (val, total) => {
    return total + 1;
};

const parseMountPoint = (val) => {
    val = val || '';

    if (val.indexOf(':') >= 0) {
        let r = val.match(/(?:([^:]*)(?::(.*)))/);
        return {
            url: r[1] || '/static',
            path: r[2]
        };
    }

    return {
        url: '/static',
        path: val
    };
};

const defaultHost = isElectron() ? '127.0.0.1' : '0.0.0.0';
const defaultPort = isElectron() ? 0 : 8000;

program
    .version(pkg.version)
    .usage('[options]')
    .option('-p, --port <port>', `Set listen port (default: ${defaultPort})`, defaultPort)
    .option('-H, --host <host>', `Set listen address or hostname (default: ${defaultHost})`, defaultHost)
    .option('-b, --backlog <backlog>', 'Set listen backlog (default: 511)', 511)
    .option('-c, --config <filename>', 'Set config file (default: ~/.cncrc)')
    .option('-v, --verbose', 'Increase the verbosity level (-v, -vv, -vvv)', increaseVerbosityLevel, 0)
    .option('-m, --mount [<url>:]<path>', 'Set the mount point for serving static files (default: /static:static)', parseMountPoint, { url: '/static', path: 'static' })
    .option('-w, --watch-directory <path>', 'Watch a directory for changes')
    .option('--access-token-lifetime <lifetime>', 'Access token lifetime in seconds or a time span string (default: 30d)')
    .option('--allow-remote-access', 'Allow remote access to the server (default: false)');

program.on('--help', () => {
    console.log('  Examples:');
    console.log('');
    console.log('    $ cnc -vv');
    console.log('    $ cnc --mount /pendant:/home/pi/tinyweb');
    console.log('    $ cnc --watch-directory /home/pi/watch');
    console.log('    $ cnc --access-token-lifetime 60d  # e.g. 3600, 30m, 12h, 30d');
    console.log('    $ cnc --allow-remote-access');
    console.log('    $ cnc --controller Grbl');
    console.log('');
});

// Commander assumes that the first two values in argv are 'node' and appname, and then followed by the args.
// This is not the case when running from a packaged Electron app. Here you have the first value appname and then args.
const normalizedArgv = ('' + process.argv[0]).indexOf(pkg.name) >= 0
    ? ['node', pkg.name, ...process.argv.slice(1)]
    : process.argv;
if (normalizedArgv.length > 1) {
    program.parse(normalizedArgv);
}

const rmDir = (dirPath, removeSelf) => {
    console.log(`del folder ${dirPath}`);
    if (removeSelf === undefined) {
        removeSelf = true;
    }

    let files;
    try {
        files = fs.readdirSync(dirPath);
        console.log(files);
    } catch (e) {
        return;
    }

    if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
            const filePath = dirPath + '/' + files[i];
            if (fs.statSync(filePath).isFile()) {
                fs.unlinkSync(filePath);
            } else {
                rmDir(filePath);
            }
        }
    }
    if (removeSelf) {
        fs.rmdirSync(dirPath);
    }
};

const cnc = () => new Promise((resolve, reject) => {
    // Change working directory to 'app' before require('./app')
    process.chdir(path.resolve(__dirname, 'app'));

    // clear _cahce folder
    // https://gist.github.com/liangzan/807712
    rmDir(`${__dirname}/web/images/_cache`, false);

    require('./app').createServer({
        port: program.port,
        host: program.host,
        backlog: program.backlog,
        configFile: program.config,
        verbosity: program.verbose,
        mount: program.mount,
        watchDirectory: program.watchDirectory,
        accessTokenLifetime: program.accessTokenLifetime,
        allowRemoteAccess: !!program.allowRemoteAccess,
        controller: program.controller
    }, (err, data) => {
        if (err) {
            reject(err);
            return;
        }
        resolve(data);
    });
});

export default cnc;
