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

//
// Image
//

const uploadFile = defaultAPIFactory((formData) => request.post('/api/file').send(formData));
const uploadCaseFile = defaultAPIFactory((formData) => request.post('/api/file/uploadCaseFile').send(formData));
const uploadGcodeFile = defaultAPIFactory((formData) => request.post('/api/file/uploadGcodeFile').send(formData));
const uploadUpdateFile = defaultAPIFactory((formData) => request.post('/api/file/uploadUpdateFile').send(formData));

const uploadImage = defaultAPIFactory((formdata) => request.post('/api/image').send(formdata));
const uploadLaserCaseImage = defaultAPIFactory((formdata) => request.post('/api/image/laserCaseImage').send(formdata));


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
const printingConfigs = {};

printingConfigs.fetch = defaultAPIFactory((type) => request.get(`/api/printingConfigs/${type}`));

printingConfigs.create = defaultAPIFactory((formdata) => request.post('/api/printingConfigs').send(formdata));

printingConfigs.update = defaultAPIFactory((formdata) => request.put('/api/printingConfigs').send(formdata));

printingConfigs.delete = defaultAPIFactory((options) => request.delete('/api/printingConfigs').send(options));

printingConfigs.getDefinition = defaultAPIFactory((definitionId, series) => request.get(`/api/printingDefinition/${definitionId}`).send({ series }));

printingConfigs.getQualityDefinitions = defaultAPIFactory((series) => request.get(`/api/printingQualityDefinitions/${series}`));
printingConfigs.getMaterialDefinitions = defaultAPIFactory(() => request.get('/api/printingMaterialDefinitions'));

printingConfigs.createDefinition = defaultAPIFactory((definition, series) => request.post('/api/printingDefinition').send({
    definition,
    series
}));

printingConfigs.removeDefinition = defaultAPIFactory((definitionId, series) => request.delete(`/api/printingDefinition/${definitionId}`).send({ series }));

printingConfigs.updateDefinition = defaultAPIFactory((definitionId, definition, series) => request.put(`/api/printingDefinition/${definitionId}`).send({
    definition,
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
    uploadImage,
    uploadLaserCaseImage,
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

    generateToolPath,

    printingConfigs,

    // State
    getState,
    setState,
    unsetState,

    // G-code
    loadGCode,
    fetchGCode,

    signin,
    controllers, // Controllers
    // users, // Users
    macros,
    watch // Watch Directory
};
