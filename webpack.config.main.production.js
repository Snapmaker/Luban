const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const babelConfig = require('./babel.config');
const pkg = require('./package.json');

const NODE_MODULES = path.resolve(__dirname, 'node_modules');

// The Electron main process used to ship as babel-compiled files that loaded
// their dependencies one by one from node_modules at app-ready time: ~2k
// core-js polyfill modules, lodash, @babel/runtime, fs-extra... Like the
// server (webpack.config.server.production.js) it is now one bundle per entry,
// so a cold start reads two files instead of crawling thousands.
//
// Only what cannot live inside a bundle stays external. Mirror of
// mainExternals in build/pkgsync.js, which decides what the packaged app
// installs into node_modules.
const KEEP_EXTERNAL = [
    'electron', // provided by the runtime
    '@electron/remote', // main side of the renderer's remote bridge; both ends from one install
    '@sentry/electron', // lazily required on opt-in; a large tree that stays off the startup path
    'electron-store', // its conf dependency finds the caller through module.parent and require.cache
    'electron-updater', // lazily required on first update check; keep it off the startup path
    'node-fetch', // lazily required inside the update check; keep it off the startup path
    'font-scanner', // native
];

const externals = [
    (context, request, callback) => {
        // The server bundle is built separately (dist/Luban/src/server/index.js)
        // and required by path relative to the entry: in-process in development
        // (main.js), in the forked child otherwise (server-cli.js). Leave the
        // require in place so it resolves from the bundle's real location.
        if (request === './server') {
            return callback(null, 'commonjs ./server');
        }
        const external = KEEP_EXTERNAL.some((mod) => request === mod || request.startsWith(`${mod}/`));
        if (external) {
            return callback(null, `commonjs ${request}`);
        }
        return callback();
    },
];

// `import 'core-js'` at the top of main.js is expanded by preset-env
// (useBuiltIns: 'entry') into whatever the target runtime lacks. The shared
// babel config names no target, so the per-file build pulled in the whole
// library; the bundle targets the Electron this app ships with, which leaves
// only the proposals its Node is missing.
//
// That target also makes preset-env keep syntax Electron 15 understands, but
// webpack 4's parser stops at ES2019: optional chaining, nullish coalescing,
// class fields and numeric separators have to be compiled away regardless.
const electronVersion = pkg.devDependencies.electron.replace(/^[^\d]*/, '');
const presetEnvOptions = {
    targets: { electron: electronVersion },
    include: [
        'transform-optional-chaining',
        'transform-nullish-coalescing-operator',
        'transform-class-properties',
        'transform-private-methods',
        'transform-private-property-in-object',
        'transform-numeric-separator',
    ],
};
const babelOptions = {
    ...babelConfig,
    presets: babelConfig.presets.map((preset) => {
        if (Array.isArray(preset) && preset[0] === '@babel/preset-env') {
            return [preset[0], { ...preset[1], ...presetEnvOptions }];
        }
        return preset;
    }),
};

module.exports = {
    mode: 'production',
    target: 'electron-main',
    context: path.resolve(__dirname, 'src'),
    resolve: {
        modules: ['node_modules'],
        extensions: ['.js', '.json']
    },
    entry: {
        // The app entry (package.json "main").
        main: './main.js',
        // Forked by path from main.js, so it must stay a real file at
        // dist/Luban/src/server-cli.js.
        'server-cli': './server-cli.js'
    },
    output: {
        path: path.resolve(__dirname, 'dist/Luban/src'),
        filename: '[name].js',
        libraryTarget: 'commonjs2'
    },
    optimization: {
        minimize: true,
        minimizer: [new TerserPlugin()],
        // Leave process.env.NODE_ENV alone: server-cli.js assigns it, and
        // main.js reads it at runtime to pick the in-process server.
        nodeEnv: false,
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                loader: 'babel-loader',
                options: babelOptions
            }
        ]
    },
    externals: externals,
    resolveLoader: {
        modules: [NODE_MODULES]
    },
    node: {
        // The bundles live where the compiled files did (dist/Luban/src), and
        // main.js serves `${__dirname}/app/` over luban:// and forks
        // `${__dirname}/server-cli.js`, so keep Node's real values.
        __filename: false,
        __dirname: false,
    }
};
