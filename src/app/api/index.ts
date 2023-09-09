import { defaultAPIFactory, request } from './base';

import * as env from './api-environment';


//
// Authentication
//
const signin = defaultAPIFactory((options) => {
    const { token, name, password } = { ...options };

    return request
        .post('/api/signin')
        .send({ token, name, password });
});
const resetUserConfig = defaultAPIFactory(() => {
    return request.delete('/api/user/resetConfig');
});

const resetPrintConfig = defaultAPIFactory(() => {
    return request.delete('/api/user/resetConfig/printing');
});

const longTermBackupConfig = defaultAPIFactory(() => request.put('/api/user/backup'));
const checkNewUser = defaultAPIFactory(() => request.get('/api/checkNewUser'));

//
// File
//

const uploadFile = defaultAPIFactory((formData, headType = '') => request.post('/api/file').query({ headType: headType }).send(formData));
const uploadCaseFile = defaultAPIFactory((formData) => request.post('/api/file/uploadCaseFile').send(formData));
const uploadGcodeFile = defaultAPIFactory((formData) => request.post('/api/file/uploadGcodeFile').send(formData));
const uploadUpdateFile = defaultAPIFactory((formData) => request.post('/api/file/uploadUpdateFile').send(formData));
const buildFirmwareFile = defaultAPIFactory((formData) => request.post('/api/file/buildFirmwareFile').send(formData));
const uploadImage = defaultAPIFactory((formdata) => request.post('/api/image').send(formdata));

//
// Env
//
/*
const saveEnv = defaultAPIFactory((data) => request.post('/api/file/saveEnv').send(data));
const getEnv = defaultAPIFactory((data) => request.get('/api/file/getEnv').send(data));
const recoverEnv = defaultAPIFactory((data) => request.post('/api/file/recoverEnv').send(data));
const removeEnv = defaultAPIFactory((data) => request.post('/api/file/removeEnv').send(data));
const packageEnv = defaultAPIFactory((data) => request.post('/api/file/packageEnv').send(data));
const recoverProjectFile = defaultAPIFactory((data) => request.post('/api/file/recoverProjectFile').send(data));
*/

// Stock Remap
// options
//  - image
//  - targetWidth
//  - targetHeight
//  - p0, p1, p2, p3
//  - mm2pixelRatio
//  - height
const stockRemapProcess = defaultAPIFactory((options) => request.post('/api/image/stock', options));

const processStitch = defaultAPIFactory((options) => request.post('/api/image/stitch', options));

const processStitchEach = defaultAPIFactory((options) => request.post('/api/image/stitchEach', options));

const processGetPhoto = defaultAPIFactory((options) => request.post('/api/image/getPhoto', options));

const processTakePhoto = defaultAPIFactory((options) => request.post('/api/image/takePhoto', options));

const getCameraCalibration = defaultAPIFactory((options) => request.post('/api/image/getCameraCalibration', options));

const cameraCalibrationPhoto = defaultAPIFactory((options) => request.post('/api/image/cameraCalibrationPhoto', options));

const setCameraCalibrationMatrix = defaultAPIFactory((options) => request.post('/api/image/setCameraCalibrationMatrix', options));

//
// svg
//
const convertRasterToSvg = defaultAPIFactory((options) => request.post('/api/svg/convertRasterToSvg', options));

const convertTextToSvg = defaultAPIFactory((options) => request.post('/api/svg/convertTextToSvg', options));

const convertOneLineTextToSvg = defaultAPIFactory((options) => request.post('/api/svg/convertOneLineTextToSvg', options));


//
// Latest Version
//
const getLatestVersion = defaultAPIFactory(() => request.get('/api/version/latest'));

//
// Utils - Platform
//

const utils = {};

utils.getPlatform = defaultAPIFactory(() => request.get('/api/utils/platform'));

utils.getFonts = defaultAPIFactory(() => request.get('/api/utils/fonts'));

utils.uploadFont = defaultAPIFactory((formData) => request.post('/api/utils/font').send(formData));

//
// Controllers
//
const controllers = {};

controllers.get = defaultAPIFactory(() => request.get('/api/controllers'));

//
// State
//
const getState = defaultAPIFactory((options) => {
    const { key } = { ...options };

    return request
        .get('/api/state')
        .query({ key: key });
});

const setState = defaultAPIFactory((options) => {
    const data = { ...options };

    return request
        .post('/api/state')
        .send(data);
});

const unsetState = defaultAPIFactory(({ key }) => request.delete('/api/state').query({ key }));

/**
 * Load G-code
 *
 * options:
 *  - port
 *  - dataSource
 *  - uploadName
 *
 * Tell controler (MarlinController) to load G-code.
 */
const loadGCode = defaultAPIFactory((options) => {
    const { port = '', dataSource = '', uploadName = '' } = { ...options };
    return request
        .post('/api/gcode')
        .send({ port, dataSource, uploadName });
});

const fetchGCode = defaultAPIFactory(({ port = '', dataSource = '' }) => request.get('/api/gcode').query({
    port,
    dataSource
}));

const getParameterDocument = defaultAPIFactory(
    ({ lang, category, key }) => request.get(`/api/parameter-document/${category}/${key}`).query({ lang })
);

//
// Users
//
/*
const users = {};

users.fetch = defaultAPIFactory((options) => request.get('/api/users').query(options));

users.create = defaultAPIFactory((options) => request.post('/api/users').send(options));

users.read = defaultAPIFactory((id) => request.get('/api/users/' + id));

users.delete = defaultAPIFactory((id) => request.delete('/api/users/' + id));

users.update = defaultAPIFactory((id, options) => request.put('/api/users/' + id).send(options));
*/

//
// Events
//
/*
TODO: to be removed
const events = {};

events.fetch = defaultAPIFactory((options) => request.get('/api/events').query(options));

events.create = defaultAPIFactory((options) => request.post('/api/events').send(options));

events.read = defaultAPIFactory((id) => request.get('/api/events/' + id));

events.delete = defaultAPIFactory((id) => request.delete('/api/events/' + id));

events.update = defaultAPIFactory((id, options) => request.put('/api/events/' + id).send(options));
*/

// Watch Directory
const watch = {};

watch.getFiles = defaultAPIFactory(({ path }) => request.post('/api/watch/files').send({ path }));

watch.readFile = defaultAPIFactory(({ file }) => request.post('/api/watch/file').send({ file }));

//
// print3dConfigs
//
const profileDefinitions = {};

profileDefinitions.fetch = defaultAPIFactory((type) => request.get(`/api/profileDefinition/${type}`));

profileDefinitions.create = defaultAPIFactory((formdata) => request.post('/api/profileDefinition').send(formdata));

profileDefinitions.update = defaultAPIFactory((formdata) => request.put('/api/profileDefinition').send(formdata));

profileDefinitions.delete = defaultAPIFactory((options) => request.delete('/api/profileDefinition').send(options));

profileDefinitions.getRawDefinition = defaultAPIFactory((headType, definitionId, configPath) => request.get(`/api/profileRawDefinition/${headType}/${definitionId}`).query({
    configPath,
}));
profileDefinitions.getDefinition = defaultAPIFactory(
    (headType, definitionId, configPath) => request.get(`/api/profileDefinition/${headType}/${definitionId}`).query({ configPath })
);

profileDefinitions.getDefinitionsByPrefixName = defaultAPIFactory(
    (headType, prefix, configPath) => request.get(`/api/getDefinitionsByPrefixName/${headType}/${prefix}`)
        .query({ configPath })
);
profileDefinitions.getDefaultDefinitions = defaultAPIFactory((headType, configPath) => request.get(`/api/profileDefaultDefinitions/${headType}`).query({ configPath }));
profileDefinitions.getConfigDefinitions = defaultAPIFactory((headType, configPath) => request.get(`/api/profileConfigDefinitions/${headType}`).query({ configPath }));


profileDefinitions.createDefinition = defaultAPIFactory((headType, definition, configPath) => request.post(`/api/profileDefinition/${headType}`).send({
    definition,
    configPath,
}));

profileDefinitions.createTmpDefinition = defaultAPIFactory((definition, filename) => request.post('/api/profileTmpDefinition').send({
    definition,
    filename
}));

profileDefinitions.removeDefinition = defaultAPIFactory((headType, definitionId, configPath) => request.delete(`/api/profileDefinition/${headType}/${definitionId}`).send({ configPath }));

profileDefinitions.updateDefinition = defaultAPIFactory((headType, definitionId, definition, configPath) => request.put(`/api/profileDefinition/${headType}/${definitionId}`).send({
    definition,
    configPath
}));
profileDefinitions.updateDefaultDefinition = defaultAPIFactory((headType, definitionId, definition, configPath) => request.put(`/api/profileDefaultDefinition/${headType}/${definitionId}`).send({
    definition,
    configPath
}));
profileDefinitions.uploadDefinition = defaultAPIFactory((headType, definitionId, uploadName, configPath) => request.post(`/api/profileDefinition/${headType}/upload`).send({
    definitionId,
    uploadName,
    configPath
}));

/**
 * Get keys of parameters.
 */
profileDefinitions.getPresetParameterKeys = defaultAPIFactory(() => request.get('/api/preset/parameter_keys'));

//
// Macros
//
const macros = {};

macros.fetch = defaultAPIFactory((options) => request.get('/api/macros').query(options));

macros.create = defaultAPIFactory((options) => request.post('/api/macros').send(options));

macros.read = defaultAPIFactory((id) => request.get(`/api/macros/${id}`));

macros.update = defaultAPIFactory((id, options) => request.put(`/api/macros/${id}`).send(options));

macros.delete = defaultAPIFactory((id) => request.delete(`/api/macros/${id}`));

// Case Resource
const getCaseResourcesList = (() => {
    // cache CaseResources data for once load
    let data;
    return async () => {
        const getData = defaultAPIFactory(() => request.get('/api/case-resources/case-list'));
        if (!data) {
            data = getData();
        }
        return data;
    };
})();


const getInformationFlow = (() => {
    // cache CaseResources data for once load
    let data;
    return async (lang) => {
        const getData = defaultAPIFactory(() => request.get('/api/information-flow').query({ lang }));
        if (!data) {
            data = getData();
        }
        return data;
    };
})();
const getSvgShapeList = defaultAPIFactory((options) => request.get('/api/svg-shape/list').query(options));
const getSvgShapeLabelList = defaultAPIFactory((options) => request.get('/api/svg-shape-label/list').query(options));

export default {
    // version
    getLatestVersion,

    // utils
    utils,

    // Environment / Project
    env,

    uploadFile,
    uploadCaseFile,
    uploadGcodeFile,
    uploadUpdateFile,
    buildFirmwareFile,

    uploadImage,
    stockRemapProcess,
    processStitch,
    processStitchEach,
    processGetPhoto,
    processTakePhoto,
    getCameraCalibration,
    cameraCalibrationPhoto,
    setCameraCalibrationMatrix,

    // svg
    convertRasterToSvg,
    convertTextToSvg,
    convertOneLineTextToSvg,

    profileDefinitions,

    // parameters
    getParameterDocument,

    // State
    getState,
    setState,
    unsetState,

    // G-code
    loadGCode,
    fetchGCode,

    signin,
    resetUserConfig,
    resetPrintConfig,

    longTermBackupConfig,
    checkNewUser,

    // controllers, // Controllers
    // users, // Users
    macros,
    watch, // Watch Directory

    // online-service
    getCaseResourcesList,
    getInformationFlow,
    getSvgShapeList,
    getSvgShapeLabelList
};
