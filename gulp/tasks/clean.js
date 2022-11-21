import del from 'del';

const list = [
    'dist/Luban/src/server',
    'dist/Luban/src/app',
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
