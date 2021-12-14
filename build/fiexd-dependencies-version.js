#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

const pkg = require('../package.json');

const getVersion = (dependencies = {}) => {
    Object.keys(dependencies).forEach((lib) => {
        const libPkg = fs.readFileSync(path.resolve(__dirname, `../node_modules/${lib}/package.json`), 'utf-8');
        if (libPkg) {
            dependencies[lib] = JSON.parse(libPkg).version;
        } else {
            console.error('Missing module source file, please reinstall dependencies');
            process.exit(-1);
        }
    });
};

getVersion(pkg.dependencies);
getVersion(pkg.devDependencies);
getVersion(pkg.peerDependencies);
getVersion(pkg.bundledDependencies);
getVersion(pkg.optionalDependencies);


const target = path.resolve(__dirname, '../package.json');
const content = JSON.stringify(pkg, null, 2);
fs.writeFileSync(target, `${content}\n`, 'utf8');
