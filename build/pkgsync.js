#!/usr/bin/env node

const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const findImports = require('find-imports');

// Copy necessary properties from 'package.json' to 'src/package.json'
const pkg = require('../package.json');
const pkgApp = require('../src/package.json');

const files = [
    'src/*.{ts,js}',
    'src/server/**/*.{ts,js,jsx}',
    'src/shared/**/*.{ts,js,jsx}',
    'packages/**/*.ts',
];
const deps = [
    '@babel/runtime', // 'babel-runtime' is required for electron app
    'debug', // 'debug' is required for electron app
    '@electron/remote', // '@electron/remote/main' is required
].concat(findImports(files, { flatten: true })).sort();

pkgApp.name = pkg.name;
pkgApp.version = pkg.version;
pkgApp.homepage = pkg.homepage;
pkgApp.author = pkg.author;
pkgApp.license = pkg.license;
pkgApp.repository = pkg.repository;

// Copy only Node.js dependencies to application package.json
pkgApp.dependencies = _.pick(pkg.dependencies, deps);
pkgApp.config = pkg.config;

const target = path.resolve(__dirname, '../src/package.json');
const content = JSON.stringify(pkgApp, null, 2);
fs.writeFileSync(target, `${content}\n`, 'utf8');
