/* eslint max-len: 0 */
/* eslint no-console: 0 */
import path from 'path';
import program from 'commander';
import isElectron from 'is-electron';
import pkg from './package.json';

const SERVER_DATA = 'serverData';
// Defaults to 'production'
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const increaseVerbosityLevel = (val, total) => {
    return total + 1;
};

const defaultHost = isElectron() ? '127.0.0.1' : '0.0.0.0';
const defaultPort = isElectron() ? 0 : 8000;

program
    .version(pkg.version)
    .usage('[options]')
    .option('-p, --port <port>', `Set listen port (default: ${defaultPort})`, defaultPort)
    .option('-H, --host <host>', `Set listen address or hostname (default: ${defaultHost})`, defaultHost)
    .option('-b, --backlog <backlog>', 'Set listen backlog (default: 511)', 511)
    .option('-v, --verbose', 'Increase the verbosity level (-v, -vv, -vvv)', increaseVerbosityLevel, 0)
    .option('-w, --watch-directory <path>', 'Watch a directory for changes')
    .option('--access-token-lifetime <lifetime>', 'Access token lifetime in seconds or a time span string (default: 30d)')
    .option('--allow-remote-access', 'Allow remote access to the server (default: false)');

// Commander assumes that the first two values in argv are 'node' and appname, and then followed by the args.
// This is not the case when running from a packaged Electron server. Here you have the first value appname and then args.
const normalizedArgv = (String(process.argv[0])).indexOf(pkg.name) >= 0
    ? ['node', pkg.name, ...process.argv.slice(1)]
    : process.argv;
if (normalizedArgv.length > 1) {
    program.parse(normalizedArgv);
}

const launchServer = () => new Promise((resolve, reject) => {
    // TODO: Refactor this
    global.luban = {
        userDataDir: process.env.USER_DATA_DIR
    };

    // Change working directory to 'server' before require('./server')
    process.chdir(path.resolve(__dirname, 'server'));

    require('./server').createServer({
        port: program.port,
        host: program.host,
        backlog: program.backlog,
        verbosity: program.verbose,
        watchDirectory: program.watchDirectory,
        accessTokenLifetime: program.accessTokenLifetime,
        allowRemoteAccess: !!program.allowRemoteAccess,
        controller: program.controller
    }, (err, data) => {
        if (err) {
            reject(err);
            return;
        }
        process.send({ type: SERVER_DATA, ...data });
        resolve(data);
    });
});

export default launchServer();
