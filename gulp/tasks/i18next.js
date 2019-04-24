import fs from 'fs';
import path from 'path';
import includes from 'lodash/includes';
import gulp from 'gulp';
import sort from 'gulp-sort';
import i18nextScanner from 'i18next-scanner';

const appConfig = {
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
            'resource' // default
        ],
        defaultNs: 'resource',
        resource: {
            loadPath: 'src/server/i18n/{{lng}}/{{ns}}.json',
            savePath: 'src/server/i18n/{{lng}}/{{ns}}.json', // or 'src/server/i18n/${lng}/${ns}.saveAll.json'
            jsonIndent: 4
        }
    }
};

const webConfig = {
    src: [
        'CuraEngine/Config/*.json',
        'src/web/**/*.js',
        'src/web/**/*.jsx',
        // Use ! to filter out files or directories
        '!src/web/{vendor,i18n}/**',
        '!test/**',
        '!**/node_modules/**'
    ],
    dest: './',
    options: {
        sort: false,

        attr: {},

        func: {
            list: ['i18n._'],
            extensions: ['.js', '.jsx']
        },

        trans: {},

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
            'zh-cn', // Simplified Chinese
            'zh-tw' // Traditional Chinese
        ],
        defaultValue: (lng, ns, key) => {
            if (lng === 'en') {
                return key; // Use key as value for base language
            }
            return ''; // Return empty string for other languages
        },
        ns: [
            'controller', // Grbl|Smoothie|TinyG
            'gcode', // G-code
            'resource' // default
        ],
        defaultNs: 'resource',
        resource: {
            loadPath: 'src/web/i18n/{{lng}}/{{ns}}.json',
            savePath: 'src/web/i18n/{{lng}}/{{ns}}.json', // or 'src/web/i18n/${lng}/${ns}.saveAll.json'
            jsonIndent: 4
        },

        keySeparator: false,
        nsSeparator: false,

        removeUnusedKeys: true
    }
};

const curaFields = [
    'material_diameter',
    'material_flow',
    'material_print_temperature',
    'material_print_temperature_layer_0',
    'material_final_print_temperature',
    'machine_heated_bed',
    'material_bed_temperature',
    'material_bed_temperature_layer_0',
    'adhesion_type',
    'support_enable',
    'layer_height',
    'layer_height_0',
    'initial_layer_line_width_factor',
    'wall_thickness',
    'top_thickness',
    'bottom_thickness',
    'infill_sparse_density',
    'speed_print',
    'speed_print_layer_0',
    'speed_infill',
    'speed_wall_0',
    'speed_wall_x',
    'speed_topbottom',
    'speed_travel',
    'speed_travel_layer_0',
    'retraction_enable',
    'retract_at_layer_change',
    'retraction_amount',
    'retraction_speed',
    'retraction_hop_enabled',
    'retraction_hop',
    'magic_spiralize',
    'magic_mesh_surface_mode'
];

function customTransform(file, enc, done) {
    const parser = this.parser;
    const content = fs.readFileSync(file.path, enc);
    const extname = path.extname(file.path);

    // Extract descriptions from Cura config file
    if (extname === '.json') {
        const curaConfig = JSON.parse(content);

        const walk = (name, node) => {
            if (includes(curaFields, name)) {
                node.label && parser.set(node.label);
                node.description && parser.set(node.description);
                if (node.options) {
                    Object.values(node.options).forEach((value) => parser.set(value));
                }
            }
            Object.keys(node).forEach((key) => {
                if (typeof node[key] === 'object') {
                    walk(key, node[key]);
                }
            });
        };

        walk('root', curaConfig);
    }

    done();
}

export default (options) => {
    gulp.task('i18next:server', () => {
        return gulp.src(appConfig.src)
            .pipe(i18nextScanner(appConfig.options, customTransform))
            .pipe(gulp.dest(appConfig.dest));
    });
    gulp.task('i18next:web', () => {
        return gulp.src(webConfig.src)
            .pipe(sort()) // Sort files in stream by path
            .pipe(i18nextScanner(webConfig.options, customTransform))
            .pipe(gulp.dest(webConfig.dest));
    });
};
