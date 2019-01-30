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
const signin = (options) => new Promise((resolve, reject) => {
    const { token, name, password } = { ...options };

    request
        .post('/api/signin')
        .send({ token, name, password })
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
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
const convertRasterToSvg = (options) => new Promise((resolve, reject) => {
    request
        .post('/api/svg/convertRasterToSvg', options)
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

const convertTextToSvg = (options) => new Promise((resolve, reject) => {
    request
        .post('/api/svg/convertTextToSvg', options)
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

//
// toolpath
//
const generateToolPath = (options) => new Promise((resolve, reject) => {
    request
        .post('/api/toolpath/generate', options)
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

const commitTask = (options) => new Promise((resolve, reject) => {
    request
        .post('/api/toolpath/commitTask', options)
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

const fetchTaskResults = (options) => new Promise((resolve, reject) => {
    request
        .get('/api/toolpath/fetchTaskResults', options)
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

//
// Latest Version
//
const getLatestVersion = () => new Promise((resolve, reject) => {
    request
        .get('/api/version/latest')
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

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

controllers.get = () => new Promise((resolve, reject) => {
    request
        .get('/api/controllers')
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

//
// State
//
const getState = (options) => new Promise((resolve, reject) => {
    const { key } = { ...options };

    request
        .get('/api/state')
        .query({ key: key })
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

const setState = (options) => new Promise((resolve, reject) => {
    const data = { ...options };

    request
        .post('/api/state')
        .send(data)
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

const unsetState = (options) => new Promise((resolve, reject) => {
    const { key } = { ...options };

    request
        .delete('/api/state')
        .query({ key: key })
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

//
// G-code
//
const loadGCode = (options) => new Promise((resolve, reject) => {
    const { port = '', name = '', gcode = '', context = {} } = { ...options };

    request
        .post('/api/gcode')
        .send({ port, name, gcode, context })
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

const fetchGCode = (options) => new Promise((resolve, reject) => {
    const { port = '' } = { ...options };

    request
        .get('/api/gcode')
        .query({ port: port })
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

//
// Users
//
const users = {};

users.fetch = (options) => new Promise((resolve, reject) => {
    request
        .get('/api/users')
        .query(options)
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

users.create = (options) => new Promise((resolve, reject) => {
    request
        .post('/api/users')
        .send(options)
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

users.read = (id) => new Promise((resolve, reject) => {
    request
        .get('/api/users/' + id)
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

users.delete = (id) => new Promise((resolve, reject) => {
    request
        .delete('/api/users/' + id)
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

users.update = (id, options) => new Promise((resolve, reject) => {
    request
        .put('/api/users/' + id)
        .send(options)
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

//
// Events
//
const events = {};

events.fetch = (options) => new Promise((resolve, reject) => {
    request
        .get('/api/events')
        .query(options)
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

events.create = (options) => new Promise((resolve, reject) => {
    request
        .post('/api/events')
        .send(options)
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

events.read = (id) => new Promise((resolve, reject) => {
    request
        .get('/api/events/' + id)
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

events.delete = (id) => new Promise((resolve, reject) => {
    request
        .delete('/api/events/' + id)
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

events.update = (id, options) => new Promise((resolve, reject) => {
    request
        .put('/api/events/' + id)
        .send(options)
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

// Commands
const commands = {};

commands.fetch = (options) => new Promise((resolve, reject) => {
    request
        .get('/api/commands')
        .query(options)
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

commands.create = (options) => new Promise((resolve, reject) => {
    request
        .post('/api/commands')
        .send(options)
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

commands.read = (id) => new Promise((resolve, reject) => {
    request
        .get('/api/commands/' + id)
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

commands.update = (id, options) => new Promise((resolve, reject) => {
    request
        .put('/api/commands/' + id)
        .send(options)
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

commands.delete = (id) => new Promise((resolve, reject) => {
    request
        .delete('/api/commands/' + id)
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

commands.run = (id) => new Promise((resolve, reject) => {
    request
        .post('/api/commands/run/' + id)
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

// Watch Directory
const watch = {};

watch.getFiles = (options) => new Promise((resolve, reject) => {
    const { path } = { ...options };

    request
        .post('/api/watch/files')
        .send({ path })
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

watch.readFile = (options) => new Promise((resolve, reject) => {
    const { file } = { ...options };

    request
        .post('/api/watch/file')
        .send({ file })
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

//
// print3dConfigs
//
const print3dConfigs = {};

print3dConfigs.fetch = (type) => new Promise((resolve, reject) => {
    request
        .get('/api/print3dConfigs/' + type)
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

print3dConfigs.create = (formdata) => new Promise((resolve, reject) => {
    request
        .post('/api/print3dConfigs')
        .send(formdata)
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

print3dConfigs.update = (formdata) => new Promise((resolve, reject) => {
    request
        .put('/api/print3dConfigs')
        .send(formdata)
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

print3dConfigs.delete = (options) => new Promise((resolve, reject) => {
    request
        .delete('/api/print3dConfigs')
        .send(options)
        .end((err, res) => {
            if (err) {
                reject(res);
            } else {
                resolve(res);
            }
        });
});

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
