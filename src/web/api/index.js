import superagent from 'superagent';
import superagentUse from 'superagent-use';
import ensureArray from '../lib/ensure-array';
import store from '../store';

const bearer = (request) => {
    const token = store.get('session.token');
    if (token) {
        request.set('Authorization', 'Bearer ' + token);
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

//
// svg
//
const convertRasterToSvg = defaultAPIFactory((options) => request.post('/api/svg/convertRasterToSvg', options)
);

const convertTextToSvg = defaultAPIFactory((options) => request.post('/api/svg/convertTextToSvg', options));

//
// toolpath
//
const generateToolPath = defaultAPIFactory((options) => request.post('/api/toolpath/generate', options));

const commitTask = defaultAPIFactory((options) => request.post('/api/toolpath/commitTask', options));

const fetchTaskResults = defaultAPIFactory((options) => request.get('/api/toolpath/fetchTaskResults', options));

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

const unsetState = defaultAPIFactory(({ key }) => request.delete('/api/state').query({ key: key }));

//
// G-code
//
const loadGCode = defaultAPIFactory((options) => {
    const { port = '', name = '', gcode = '', context = {} } = { ...options };
    return request
        .post('/api/gcode')
        .send({ port, name, gcode, context });
});

const fetchGCode = defaultAPIFactory(({ port = '' }) => request.get('/api/gcode').query({ port: port }));

//
// Users
//
const users = {};

users.fetch = defaultAPIFactory((options) => request.get('/api/users').query(options));

users.create = defaultAPIFactory((options) => request.post('/api/users').send(options));

users.read = defaultAPIFactory((id) => request.get('/api/users/' + id));

users.delete = defaultAPIFactory((id) => request.delete('/api/users/' + id));

users.update = defaultAPIFactory((id, options) => request.put('/api/users/' + id).send(options));

//
// Events
//
const events = {};

events.fetch = defaultAPIFactory((options) => request.get('/api/events').query(options));

events.create = defaultAPIFactory((options) => request.post('/api/events').send(options));

events.read = defaultAPIFactory((id) => request.get('/api/events/' + id));

events.delete = defaultAPIFactory((id) => request.delete('/api/events/' + id));

events.update = defaultAPIFactory((id, options) => request.put('/api/events/' + id).send(options));

// Commands
const commands = {};

commands.fetch = defaultAPIFactory((options) => request.get('/api/commands').query(options));

commands.create = defaultAPIFactory((options) => request.post('/api/commands').send(options));

commands.read = defaultAPIFactory((id) => request.get('/api/commands/' + id));

commands.update = defaultAPIFactory((id, options) => request.put('/api/commands/' + id).send(options));

commands.delete = defaultAPIFactory((id) => request.delete('/api/commands/' + id));

commands.run = defaultAPIFactory((id) => request.post('/api/commands/run/' + id));

// Watch Directory
const watch = {};

watch.getFiles = defaultAPIFactory(({ path }) => request.post('/api/watch/files').send({ path }));

watch.readFile = defaultAPIFactory(({ file }) => request.post('/api/watch/file').send({ file }));

//
// print3dConfigs
//
const print3dConfigs = {};

print3dConfigs.fetch = defaultAPIFactory((type) => request.get('/api/print3dConfigs/' + type));

print3dConfigs.create = defaultAPIFactory((formdata) => request.post('/api/print3dConfigs').send(formdata));

print3dConfigs.update = defaultAPIFactory((formdata) => request.put('/api/print3dConfigs').send(formdata));

print3dConfigs.delete = defaultAPIFactory((options) => request.delete('/api/print3dConfigs').send(options));

export default {
    // version
    getLatestVersion,

    // utils
    utils,

    uploadFile,
    uploadImage,
    stockRemapProcess,
    processImage,

    // svg
    convertRasterToSvg,
    convertTextToSvg,

    generateToolPath,
    commitTask,
    fetchTaskResults,

    print3dConfigs,

    // State
    getState,
    setState,
    unsetState,

    // G-code
    loadGCode,
    fetchGCode,

    signin,
    controllers, // Controllers
    users, // Users
    events, // Events
    commands, // Commands
    watch // Watch Directory
};
