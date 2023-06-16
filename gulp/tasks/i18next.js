import fs from 'fs';
import path from 'path';

import includes from 'lodash/includes';
import typescript from 'typescript';

import gulp from 'gulp';
import sort from 'gulp-sort';

import i18nextScanner from 'i18next-scanner';


const serverConfig = {
    src: [
        'src/server/**/*.html',
        'src/server/**/*.hbs',
        'src/server/**/*.js',
        'src/server/**/*.jsx',
        // Use ! to filter out files or directories
        '!src/server/i18n/**',
        '!**/node_modules/**'
    ],
    dest: './',
    options: {
        sort: true,
        lngs: ['en'],
        defaultValue: '__L10N__', // to indicate that a default value has not been defined for the key
        ns: [
            'config',
            'resource', // default
        ],
        defaultNs: 'resource',
        resource: {
            loadPath: 'src/server/i18n/{{lng}}/{{ns}}.json',
            savePath: 'src/server/i18n/{{lng}}/{{ns}}.json', // or 'src/server/i18n/${lng}/${ns}.saveAll.json'
            jsonIndent: 4
        }
    }
};

export function i18nextServer() {
    return gulp.src(serverConfig.src)
        .pipe(i18nextScanner(serverConfig.options))
        .pipe(gulp.dest(serverConfig.dest));
}

// configuration fields that are displayed in config panel
const keysNeedDescription = [
    // Laser
    'path_type',
    'movement_mode',
    'direction',
    'fill_interval',
    'jog_speed',
    'work_speed',
    'dwell_time',
    'multi_passes',
    'multi_pass_depth',
    'fixed_power',
    // CNC
    'tool_type',
    'diameter',
    'angle',
    'shaft_diameter',
    'jog_speed',
    'work_speed',
    'plunge_speed',
    'step_down',
    'step_over',
    'tool_extension_enabled'
];

const CURA_CATEGORIES = [
    'Quality',
    'Shell',
    'Infill',
    'Speed',
    'Retract & Z Hop',
    'Surface',
    'Build Plate Adhesion Type',
    'Support'
];

function customTransform(file, enc, done) {
    const parser = this.parser;
    const basename = path.basename(file.path);
    const { base, ext } = path.parse(file.path);

    // Extract copy from definition files
    if (basename.indexOf('.def.json') !== -1) {
        const content = fs.readFileSync(file.path, enc);
        const curaConfig = JSON.parse(content);

        const walk = (name, node) => {
            // add label
            node.label && parser.set(node.label);

            // add description
            if (includes(keysNeedDescription, name)) {
                node.description && parser.set(node.description);
            }

            // add options
            if (node.options) {
                Object.values(node.options).forEach((value) => parser.set(value));
            }
            Object.keys(node).forEach((key) => {
                if (typeof node[key] === 'object') {
                    walk(key, node[key]);
                }
            });
        };

        walk('root', curaConfig);

        for (const word of CURA_CATEGORIES) {
            parser.set(word);
        }
    }

    // Extract i18n function calls / Trans from ts files
    const extensions = ['.ts', '.tsx'];
    if (extensions.includes(ext) && !base.includes('.d.ts')) {
        const content = fs.readFileSync(file.path, enc);

        const { outputText } = typescript.transpileModule(content, {
            compilerOptions: {
                target: 'es2020',
            },
            fileName: path.basename(file.path),
        });

        this.parser.parseTransFromString(outputText);
        this.parser.parseFuncFromString(outputText);
    }

    done();
}

const appConfig = {
    options: {
        sort: true,

        attr: {},

        func: {
            list: ['i18n._'],
            extensions: ['.js', '.jsx'],
        },

        trans: {
            component: 'Trans',
            i18nKey: 'i18nKey',
            extensions: ['.js', '.jsx'],
            fallbackKey: function fallbackKey(ns, value) {
                return value;
            }
        },

        lngs: [
            'en', // English (default)
            'cs', // Czech
            'de', // German
            'es', // Spanish
            'fr', // French
            'hu', // Hungarian
            'it', // Italian
            'ja', // Japanese
            'ko', // Korean
            'pt-br', // Portuguese (Brazil)
            'ru', // Russian
            'uk', // Ukrainian
            'zh-CN', // Simplified Chinese
            'zh-tw' // Traditional Chinese
        ],
        defaultValue: (lng, ns, key) => {
            if (lng === 'en') {
                return key; // Use key as value for base language
            }
            return ''; // Return empty string for other languages
        },
        ns: [
            'gcode', // G-code
            'resource', // default
        ],
        defaultNs: 'resource',
        resource: {
            loadPath: 'src/app/resources/i18n/{{lng}}/{{ns}}.json',
            savePath: 'src/app/resources/i18n/{{lng}}/{{ns}}.json', // or 'src/app/resources/i18n/${lng}/${ns}.saveAll.json'
            jsonIndent: 4
        },

        keySeparator: false,
        nsSeparator: false,

        removeUnusedKeys: true
    },
};

export function i18nextApp() {
    const sources = [
        'src/app/**/*.js',
        'src/app/**/*.jsx',
        'src/app/**/*.ts',
        'src/app/**/*.tsx',
        'packages/luban-print-settings/resources/*/*.json',
    ];
    return gulp.src(sources)
        .pipe(sort()) // Sort files in stream by path
        .pipe(i18nextScanner(appConfig.options, customTransform))
        .pipe(gulp.dest('./'));
}


