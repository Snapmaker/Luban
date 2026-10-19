// The tape suite imports TypeScript: server modules (logger, DataStorage,
// machine definitions) and @snapmaker/luban-platform, whose entry is an
// index.ts inside a "type": "module" package. Plain @babel/register only
// compiles .js. Newer Node also loads .ts itself and, for a "type": "module"
// package, hands Babel's CommonJS output to the ESM loader. Read .ts/.tsx as
// CommonJS so Babel's compile hook owns every file.
const fs = require('fs');
const Module = require('module');

const TS_FILE = /\.tsx?$/;

for (const ext of ['.ts', '.tsx']) {
    Module._extensions[ext] = (module, filename) => {
        module._compile(fs.readFileSync(filename, 'utf8'), filename);
    };
}

const compile = Module.prototype._compile;
Module.prototype._compile = function compileTypeScriptAsCommonJs(content, filename, format) {
    return compile.call(this, content, filename, TS_FILE.test(filename) ? 'commonjs' : format);
};

require('@babel/register')({
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    presets: ['@babel/preset-typescript'],
});
