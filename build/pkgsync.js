#!/usr/bin/env node

const _ = require('lodash');
const fs = require('fs');
const path = require('path');

// Copy necessary properties from 'package.json' to 'src/package.json'
const pkg = require('../package.json');
const pkgApp = require('../src/package.json');

// Both the main process (src/main.js + src/electron-app/*, and the server
// child entry src/server-cli.js) and the server ship as webpack bundles with
// their dependencies compiled in, so the packaged app only installs what the
// bundles leave external: packages that cannot live inside a bundle (native
// addons, packages that load files out of their own directory) and the
// Electron glue that is required lazily to stay off the startup path.
//
// Mirror of KEEP_EXTERNAL in webpack.config.main.production.js.
const mainExternals = [
    '@electron/remote',
    '@sentry/electron',
    'electron-store',
    'electron-updater',
    'node-fetch',
    'font-scanner',
];
// Mirror of KEEP_EXTERNAL in webpack.config.server.production.js.
const serverExternals = [
    'serialport',
    'font-scanner',
    '@snapmaker/snapmaker-lunar',
    'snapmaker-luban-engine',
    'opencv-wasm',
    'consolidate',
    'hogan.js',
    'errorhandler',
    'socket.io',
];
const deps = [...new Set([...mainExternals, ...serverExternals])].sort();

pkgApp.name = pkg.name;
pkgApp.version = pkg.version;
pkgApp.homepage = pkg.homepage;
pkgApp.author = pkg.author;
pkgApp.license = pkg.license;
pkgApp.repository = pkg.repository;

// Copy only Node.js dependencies to application package.json
pkgApp.dependencies = _.pick(pkg.dependencies, deps);
// Runtime externals of the server bundle whose former parents (superagent,
// node-fetch) are now bundled, so they are not root dependencies: pin them
// to the versions the parents resolve today.
pkgApp.dependencies.formidable = '2.1.2';
pkgApp.dependencies.encoding = '0.1.13';
pkgApp.config = pkg.config;

const target = path.resolve(__dirname, '../src/package.json');
const content = JSON.stringify(pkgApp, null, 2);
fs.writeFileSync(target, `${content}\n`, 'utf8');
