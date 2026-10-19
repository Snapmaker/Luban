const crypto = require('crypto');
const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const { execFileSync } = require('child_process');
const babelConfig = require('./babel.config');
const pkg = require('./package.json');

let connectionRevision = 'unknown';
try {
    connectionRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: __dirname, encoding: 'utf8' }).trim();
    if (execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: __dirname, encoding: 'utf8' }).trim()) {
        connectionRevision += '-dirty';
    }
} catch { /* Release archives may not contain .git; the build timestamp still distinguishes builds. */ }
const connectionBuild = `${connectionRevision}@${new Date().toISOString()}`;

const NODE_MODULES = path.resolve(__dirname, 'node_modules');
const REPLACE_LOADER = path.resolve(__dirname, 'build/webpack-replace-loader.js');
const SERVER_PATHS = path.resolve(__dirname, 'src/server/lib/paths.ts');

// Bundle dependencies into the server bundle instead of externalizing all of
// node_modules: a cold start used to crawl thousands of small files (each
// scanned by antivirus on first open, ~10s+ after a rebuild or reboot before
// the backend answered), whereas one bundle is a single read. Only packages
// that cannot live inside a bundle stay external; everything listed here is
// installed into the packaged app's node_modules (mirror the list in
// build/pkgsync.js).
//
// Formerly external, now compiled in (how each one's blocker was resolved):
//   consolidate   required forty template engines by name at render time;
//                 replaced by src/server/lib/hoganEngine.js, Luban only
//                 renders Hogan templates.
//   hogan.js      only external because consolidate loaded it by name.
//   errorhandler  read its stylesheet and template from its own directory
//                 at load; it is development-only and src/server/app.js now
//                 requires it inside that branch, which this production
//                 build compiles out, so it is not in the bundle at all.
//   socket.io     streamed the browser client out of its package directory
//                 (serveClient); the renderer bundles socket.io-client itself,
//                 so the server no longer serves it (lib/SocketManager).
//   formidable    its constructor requires plugins by a path built with
//                 __dirname; rewritten below to a relative request webpack
//                 resolves as a context over its plugins directory.
//   opencv-wasm   its Emscripten glue reads opencv.wasm from __dirname; the
//                 .wasm is emitted beside the bundles (file-loader) and the
//                 glue is rewritten below to read it from SERVER_DIR.
//   encoding      node-fetch's ES module build (the one webpack bundles)
//                 leaves its optional `require('encoding')` to Node at run
//                 time, inside a try; it only serves textConverted(), which
//                 nothing in Luban calls, so the package is not installed.
const KEEP_EXTERNAL = [
    'serialport', // native (@serialport/bindings-cpp)
    'font-scanner', // native
    'lzma-native', // native
    '@snapmaker/snapmaker-lunar', // spawns LunarTPP binaries from its package dir (requireUnpacked, lib/paths.ts)
    'snapmaker-luban-engine', // spawns CuraEngine binaries from its package dir (requireUnpacked, lib/paths.ts)
];
const externals = [
    (context, request, callback) => {
        const external = request.startsWith('@serialport/')
            || KEEP_EXTERNAL.some((mod) => request === mod || request.startsWith(`${mod}/`));
        if (external) {
            return callback(null, `commonjs ${request}`);
        }
        return callback();
    },
];

// Use publicPath for production
// const payload = pkg.version;
const publicPath = (function calculatePublicPath(payload) {
    const algorithm = 'sha1';
    const buf = String(payload);
    const hash = crypto.createHash(algorithm).update(buf).digest('hex');
    return `/${hash.substr(0, 8)}/`; // 8 digits
}(pkg.version));

module.exports = {
    mode: 'production',
    target: 'node',
    context: path.resolve(__dirname, 'src/server'),
    resolve: {
        modules: ['node_modules'],
        extensions: ['.js', '.json', '.jsx', '.ts'],
        alias: {
            // hexoid (formidable's id generator) also publishes an ES module
            // build with a default export, which webpack prefers over the
            // CommonJS one (`module` before `main`); formidable `require()`s
            // it and calls the result, so give it the build Node would load.
            hexoid$: require.resolve('hexoid'),
        },
    },
    entry: {
        index: './index.js'
    },
    output: {
        path: path.resolve(__dirname, 'dist/Luban/src/server'),
        filename: '[name].js',
        libraryTarget: 'commonjs2'
    },
    optimization: {
        minimize: true,
        minimizer: [new TerserPlugin()],
    },
    plugins: [
        new webpack.DefinePlugin({
            'global.PUBLIC_PATH': JSON.stringify(publicPath),
            LUBAN_CONNECTION_BUILD: JSON.stringify(connectionBuild)
        })
    ],
    module: {
        rules: [
            {
                test: /\.worker\.(j|t)s$/,
                loader: 'worker-loader',
                options: {
                    filename: '[name].js',
                },
            },
            {
                test: /\.ts$/,
                loader: 'ts-loader',
                options: {
                    transpileOnly: true
                }
            },
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                loader: 'babel-loader',
                options: babelConfig
            },
            {
                // formidable loads its request-body plugins in the constructor
                // with require(path.join(__dirname, 'plugins', `${name}.js`)),
                // a request webpack cannot resolve. As a relative template
                // request webpack bundles the plugins directory as a context
                // and resolves the name at runtime, as Node did from disk.
                test: /[\\/]node_modules[\\/]formidable[\\/]src[\\/]Formidable\.js$/,
                loader: REPLACE_LOADER,
                options: {
                    replacements: [{
                        from: 'this.use(require(path.join(__dirname, \'plugins\', `${plgName}.js`)));',
                        to: 'this.use(require(`./plugins/${plgName}.js`));',
                    }],
                },
            },
            {
                // opencv-wasm's Emscripten glue reads opencv.wasm from next to
                // itself (__dirname, which webpack rewrites to a relative
                // path). The .wasm is emitted beside the bundles by the rule
                // below; point the glue at it through SERVER_DIR, which the
                // server and its forked worker both resolve their own files
                // from, and make locateFile() pass that absolute path through.
                test: /[\\/]node_modules[\\/]opencv-wasm[\\/]opencv\.js$/,
                loader: REPLACE_LOADER,
                options: {
                    replacements: [{
                        from: 'let Module = {};',
                        to: 'let Module = { locateFile: (file) => file };',
                    }, {
                        from: 'let opencvWasmBinaryFile = \'./opencv.wasm\';',
                        to: `let opencvWasmBinaryFile = require('path').join(require(${JSON.stringify(SERVER_PATHS)}).SERVER_DIR, require('./opencv.wasm'));`,
                    }],
                },
            },
            {
                // Emit the OpenCV binary as a plain file next to the server
                // bundle and the worker (both read it at runtime) instead of
                // letting webpack treat it as a WebAssembly module.
                test: /[\\/]node_modules[\\/]opencv-wasm[\\/]opencv\.wasm$/,
                type: 'javascript/auto',
                loader: 'file-loader',
                options: {
                    name: '[name].[ext]',
                    esModule: false,
                },
            },
        ]
    },
    externals: externals,
    resolveLoader: {
        modules: [NODE_MODULES]
    },
    node: {
        console: true,
        global: true,
        process: true,
        Buffer: true,
        __filename: true, // Use relative path
        __dirname: true, // Use relative path
        setImmediate: true
    }
};
