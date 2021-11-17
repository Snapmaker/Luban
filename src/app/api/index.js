import superagent from 'superagent';
import superagentUse from 'superagent-use';
import ensureArray from '../lib/ensure-array';
import { machineStore } from '../store/local-storage';

const bearer = (request) => {
    const token = machineStore.get('session.token');
    if (token) {
        request.set('Authorization', `Bearer ${token}`);
    }
};

const noCache = (request) => {
    const now = Date.now();
    request.set('Cache-Control', 'no-cache');
    request.set('X-Requested-With', 'XMLHttpRequest');

    if (request.method === 'GET' || request.method === 'HEAD') {
        request._query = ensureArray(request._query);
        request._query.push(`_=${now}`);
    }
};

const request = superagentUse(superagent);
request.use(bearer);
request.use(noCache);


// Default API factory that performs the request, and then convert its result to `Promise`.
const defaultAPIFactory = (genRequest) => {
    return (...args) => new Promise((resolve, reject) => {
        genRequest(...args)
            .end((err, res) => {
                if (err) {
                    reject(res);
                } else {
                    resolve(res);
                }
            });
    });
};

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

//
// Image
//

const uploadFile = defaultAPIFactory((formData) => request.post('/api/file').send(formData));
const uploadCaseFile = defaultAPIFactory((formData) => request.post('/api/file/uploadCaseFile').send(formData));
const uploadGcodeFile = defaultAPIFactory((formData) => request.post('/api/file/uploadGcodeFile').send(formData));
const uploadUpdateFile = defaultAPIFactory((formData) => request.post('/api/file/uploadUpdateFile').send(formData));
const buildFirmwareFile = defaultAPIFactory((formData) => request.post('/api/file/buildFirmwareFile').send(formData));
const saveEnv = defaultAPIFactory((data) => request.post('/api/file/saveEnv').send(data));
const getEnv = defaultAPIFactory((data) => request.post('/api/file/getEnv').send(data));
const recoverEnv = defaultAPIFactory((data) => request.post('/api/file/recoverEnv').send(data));
const removeEnv = defaultAPIFactory((data) => request.post('/api/file/removeEnv').send(data));
const packageEnv = defaultAPIFactory((data) => request.post('/api/file/packageEnv').send(data));
const recoverProjectFile = defaultAPIFactory((data) => request.post('/api/file/recoverProjectFile').send(data));


const uploadImage = defaultAPIFactory((formdata) => request.post('/api/image').send(formdata));


// Stock Remap
// options
//  - image
//  - targetWidth
//  - targetHeight
//  - p0, p1, p2, p3
//  - mm2pixelRatio
//  - height
const stockRemapProcess = defaultAPIFactory((options) => request.post('/api/image/stock', options));

const processImage = defaultAPIFactory((options) => request.post('/api/image/process', options));

const processTrace = defaultAPIFactory((options) => request.post('/api/image/trace', options));

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
// toolpath
//
const generateToolPath = defaultAPIFactory((options) => request.post('/api/toolpath/generate', options));


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

// Commands
/*
const commands = {};

commands.fetch = defaultAPIFactory((options) => request.get('/api/commands').query(options));

commands.create = defaultAPIFactory((options) => request.post('/api/commands').send(options));

commands.read = defaultAPIFactory((id) => request.get('/api/commands/' + id));

commands.update = defaultAPIFactory((id, options) => request.put('/api/commands/' + id).send(options));

commands.delete = defaultAPIFactory((id) => request.delete('/api/commands/' + id));

commands.run = defaultAPIFactory((id) => request.post('/api/commands/run/' + id));
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

profileDefinitions.getRawDefinition = defaultAPIFactory((headType, definitionId, series) => request.get(`/api/profileRawDefinition/${headType}/${definitionId}`).query({
    series
}));
profileDefinitions.getDefinition = defaultAPIFactory((headType, definitionId, series) => request.get(`/api/profileDefinition/${headType}/${definitionId}`).query({
    series
}));

profileDefinitions.getDefinitionsByPrefixName = defaultAPIFactory((headType, prefix, series) => request.get(`/api/getDefinitionsByPrefixName/${headType}/${prefix}/${series}`));
profileDefinitions.getDefaultDefinitions = defaultAPIFactory((headType, series) => request.get(`/api/profileDefaultDefinitions/${headType}/${series}`));
profileDefinitions.getConfigDefinitions = defaultAPIFactory((headType, series) => request.get(`/api/profileConfigDefinitions/${headType}/${series}`));


profileDefinitions.createDefinition = defaultAPIFactory((headType, definition, series) => request.post(`/api/profileDefinition/${headType}`).send({
    definition,
    series
}));

profileDefinitions.createTmpDefinition = defaultAPIFactory((definition, filename) => request.post('/api/profileTmpDefinition').send({
    definition,
    filename
}));

profileDefinitions.removeDefinition = defaultAPIFactory((headType, definitionId, series) => request.delete(`/api/profileDefinition/${headType}/${definitionId}`).send({ series }));

profileDefinitions.updateDefinition = defaultAPIFactory((headType, definitionId, definition, series) => request.put(`/api/profileDefinition/${headType}/${definitionId}`).send({
    definition,
    series
}));
profileDefinitions.uploadDefinition = defaultAPIFactory((headType, definitionId, uploadName, series) => request.post(`/api/profileDefinition/${headType}/upload`).send({
    definitionId,
    uploadName,
    series
}));

//
// Macros
//
const macros = {};

macros.fetch = defaultAPIFactory((options) => request.get('/api/macros').query(options));

macros.create = defaultAPIFactory((options) => request.post('/api/macros').send(options));

macros.read = defaultAPIFactory((id) => request.get(`/api/macros/${id}`));

macros.update = defaultAPIFactory((id, options) => request.put(`/api/macros/${id}`).send(options));

macros.delete = defaultAPIFactory((id) => request.delete(`/api/macros/${id}`));

export default {
    // version
    getLatestVersion,

    // utils
    utils,

    uploadFile,
    uploadCaseFile,
    uploadGcodeFile,
    uploadUpdateFile,
    buildFirmwareFile,
    saveEnv,
    getEnv,
    recoverEnv,
    removeEnv,
    packageEnv,
    recoverProjectFile,
    uploadImage,
    stockRemapProcess,
    processImage,
    processTrace,
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

    generateToolPath,

    profileDefinitions,

    // State
    getState,
    setState,
    unsetState,

    // G-code
    loadGCode,
    fetchGCode,

    signin,
    resetUserConfig,
    controllers, // Controllers
    // users, // Users
    macros,
    watch // Watch Directory
};
