// import _ from 'lodash';
import gulp from 'gulp';
import clean from './gulp/tasks/clean';
import {
    serverCopyDevelopment,
    serverBuildDevelopment,
    serverStartDevelopment,
    serverCopyProduction,
    serverBuildProduction
} from './gulp/tasks/server';
import {
    appCopyDevelopment,
    appCopyProduction,
    appBuildProduction
} from './gulp/tasks/app';
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
    gulp.parallel(
        serverBuildDevelopment,
        serverCopyDevelopment,
        appCopyDevelopment
    )
);

const production = gulp.series(
    prepareProduction,
    clean,
    gulp.parallel(
        serverCopyProduction,
        serverBuildProduction,
        appCopyProduction,
        appBuildProduction
    )
);

export {
    i18nextServer,
    i18nextApp,
    development,
    serverBuildDevelopment,
    serverStartDevelopment,
    production
};
export default production;
