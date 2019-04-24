import gulp from 'gulp';
import del from 'del';

const list = [
    'dist/Snapmakerjs/server',
    'dist/Snapmakerjs/app',
    'src/app/**/*.css',
    'src/app/**/*.css.map',
    'src/app/**/*.js.map',
    // exclusion
    '!src/app/vendor/**'
];

export default (options) => {
    gulp.task('clean', (callback) => {
        del(list).then(() => {
            callback();
        });
    });
};
