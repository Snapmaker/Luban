import fs from 'fs';
import path from 'path';
import store from '../store';
import {
    ERR_BAD_REQUEST,
    ERR_INTERNAL_SERVER_ERROR,
    APP_CACHE_IMAGE,
    LASER_GCODE_SUFFIX,
    CNC_GCODE_SUFFIX
} from '../constants';
import logger from '../lib/logger';
import { pathWithRandomSuffix } from '../lib/random-utils';
import SvgReader from '../lib/svgreader';
import {
    LaserToolPathGenerator,
    CncToolPathGenerator
} from '../lib/ToolPathGenerator';
import generateLaserFocusGcode from '../lib/GenerateLaserFocusGcode';

const log = logger('api.gcode');


export const set = (req, res) => {
    const { port, name, gcode } = req.body;

    if (!port) {
        res.status(ERR_BAD_REQUEST).send({
            msg: 'No port specified'
        });
        return;
    }
    if (!gcode) {
        res.status(ERR_BAD_REQUEST).send({
            msg: 'Empty G-code'
        });
        return;
    }

    const controller = store.get('controllers["' + port + '"]');
    if (!controller) {
        res.status(ERR_BAD_REQUEST).send({
            msg: 'Controller not found'
        });
        return;
    }

    // Load G-code
    controller.command(null, 'gcode:load', name, gcode, (err) => {
        if (err) {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({
                msg: 'Failed to load G-code: ' + err
            });
            return;
        }

        res.end();
    });
};

export const get = (req, res) => {
    const port = req.query.port;

    if (!port) {
        res.status(ERR_BAD_REQUEST).send({
            msg: 'No port specified'
        });
        return;
    }

    const controller = store.get('controllers["' + port + '"]');
    if (!controller) {
        res.status(ERR_BAD_REQUEST).send({
            msg: 'Controller not found'
        });
        return;
    }

    const { sender } = controller;

    res.send({
        ...sender.toJSON(),
        data: sender.state.gcode
    });
};

export const download = (req, res) => {
    const port = req.query.port;

    if (!port) {
        res.status(ERR_BAD_REQUEST).send({
            msg: 'No port specified'
        });
        return;
    }

    const controller = store.get('controllers["' + port + '"]');
    if (!controller) {
        res.status(ERR_BAD_REQUEST).send({
            msg: 'Controller not found'
        });
        return;
    }

    const { sender } = controller;

    const filename = sender.state.name || 'noname.txt';
    const content = sender.state.gcode || '';
    res.setHeader('Content-Disposition', 'attachment; filename=' + encodeURIComponent(filename));
    res.setHeader('Connection', 'close');

    res.write(content);
    res.end();
};


export const downloadFromCache = (req, res) => {
    const filename = req.query.filename;

    if (!filename) {
        res.status(ERR_BAD_REQUEST).send({
            msg: 'No filename specified'
        });
        return;
    }

    const filePath = `${APP_CACHE_IMAGE}/${filename}`;

    res.type('text/plain');
    const options = {
        cacheControl: false
    };
    res.download(filePath, filename, options, (err) => {
        if (err) {
            log.error('download file from cache failed.');
        }
    });
};


/**
 * Generate G-code from image & parameters.
 *
 * Currently this function only support
 *
 * @param req
 * @param res
 */
export const generate = (req, res) => {
    if (req.body.type === 'test-laser-focus') {
        const { power, workSpeed, jogSpeed } = req.body;
        const gcode = generateLaserFocusGcode(power, workSpeed, jogSpeed);
        res.send({
            gcode: gcode
        });
        return;
    }

    const { type, imageSrc, ...options } = req.body;

    // replace `imageSrc` from POV of app
    const pathInfo = path.parse(imageSrc);
    const inputFilePath = `${APP_CACHE_IMAGE}/${pathInfo.base}`;

    if (type === 'laser') {
        const options = {
            ...req.body,
            imageSrc: inputFilePath
        };
        const generator = new LaserToolPathGenerator(options);
        generator
            .generateGcode()
            .then((gcode) => {
                const outputFilename = pathWithRandomSuffix(`${pathInfo.name}.${LASER_GCODE_SUFFIX}`);
                const outputFilePath = `${APP_CACHE_IMAGE}/${outputFilename}`;

                fs.writeFile(outputFilePath, gcode, () => {
                    res.send({
                        gcodePath: outputFilename
                    });
                });
            })
            .catch((err) => log.error(err));
    } else if (type === 'cnc') {
        // TODO: change workflow of CncToolPathGenerator to be the same as Laser's
        const svgReader = new SvgReader(0.08);
        svgReader
            .parseFile(inputFilePath)
            .then((result) => {
                const outputFilename = pathWithRandomSuffix(`${pathInfo.name}.${CNC_GCODE_SUFFIX}`);
                const outputFilePath = `${APP_CACHE_IMAGE}/${outputFilename}`;

                const toolPathGenerator = new CncToolPathGenerator(result.boundaries, options);
                const gcode = toolPathGenerator.generateGcode();

                fs.writeFile(outputFilePath, gcode, () => {
                    res.send({
                        gcodePath: outputFilename
                    });
                });
            })
            .catch((err) => log.error(err));
    } else {
        throw new Error(`Unsupported type: ${type}`);
    }
};
