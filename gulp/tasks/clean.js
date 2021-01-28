import del from 'del';

const list = [
    'dist/Luban/server',
    'dist/Luban/app',
    'src/app/**/*.css',
    'src/app/**/*.css.map',
    'src/app/**/*.js.map',
    // exclusion
    '!src/app/vendor/**'
];

/**
 * Clean
 */
function clean() {
    return del(list);
}

export default clean;
