// import _ from 'lodash';
import gulp from 'gulp';
import clean from './gulp/tasks/clean';
import { serverBuildDevelopment, serverStartDevelopment, serverBuildProduction } from './gulp/tasks/server';
import { appBuildDevelopment, appBuildProduction } from './gulp/tasks/app';
import { i18nextServer, i18nextApp } from './gulp/tasks/i18next';

function prepareDevelopment() {
    process.env.NODE_ENV = 'development';
    return Promise.resolve();
}

function prepareProduction() {
    process.env.NODE_ENV = 'production';
    return Promise.resolve();
}

const development = gulp.series(
    prepareDevelopment,
    clean,
    gulp.parallel(serverBuildDevelopment, appBuildDevelopment),
    serverStartDevelopment
);

const production = gulp.series(
    prepareProduction,
    clean,
    gulp.parallel(serverBuildProduction, appBuildProduction)
);

export {
    production,
    development,
    i18nextServer,
    i18nextApp
};
export default production;
