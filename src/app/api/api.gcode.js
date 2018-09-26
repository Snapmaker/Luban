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
import SVGParser from '../lib/SVGParser';
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
export const generate = async (req, res) => {
    const options = req.body;
    if (options.type === 'test-laser-focus') {
        const { power, workSpeed, jogSpeed } = options;
        const gcode = generateLaserFocusGcode(power, workSpeed, jogSpeed);
        res.send({
            gcode: gcode
        });
        return;
    }

    const type = options.type;

    if (type === 'laser') {
        // replace source
        const { source } = options;
        const generatorOptions = {
            ...options,
            source: {
                ...options.source,
                image: `${APP_CACHE_IMAGE}/${path.parse(source.image).base}`,
                processed: `${APP_CACHE_IMAGE}/${path.parse(source.processed).base}`
            }
        };

        const pathName = path.parse(source.image).name;
        const outputFilename = pathWithRandomSuffix(`${pathName}.${LASER_GCODE_SUFFIX}`);
        const outputFilePath = `${APP_CACHE_IMAGE}/${outputFilename}`;
        const generator = new LaserToolPathGenerator(generatorOptions);
        try {
            let gcode = await generator.generateGcode();

            // process multi pass
            const multiPass = options.multiPass;
            if (multiPass && multiPass.enabled) {
                gcode = getGcodeForMultiPass(gcode, multiPass.passes, multiPass.depth);
            }

            fs.writeFile(outputFilePath, gcode, () => {
                res.send({
                    gcodePath: outputFilename
                });
            });
        } catch (err) {
            log.error(err);
        }
    } else if (type === 'cnc') {
        const { imageSrc } = req.body;
        const pathInfo = path.parse(imageSrc);
        const inputFilePath = `${APP_CACHE_IMAGE}/${pathInfo.base}`;

        // TODO: change workflow of CncToolPathGenerator to be the same as Laser's
        const svgParser = new SVGParser();
        try {
            const svg = await svgParser.parseFile(inputFilePath);

            const outputFilename = pathWithRandomSuffix(`${pathInfo.name}.${CNC_GCODE_SUFFIX}`);
            const outputFilePath = `${APP_CACHE_IMAGE}/${outputFilename}`;

            const toolPathGenerator = new CncToolPathGenerator(svg, options);
            const gcode = toolPathGenerator.generateGcode();

            fs.writeFile(outputFilePath, gcode, () => {
                res.send({
                    gcodePath: outputFilename
                });
            });
        } catch (err) {
            log.error(err);
        }
    } else {
        throw new Error(`Unsupported type: ${type}`);
    }
};

const getGcodeForMultiPass = (gcode, passes, depth) => {
    let result = gcode + '\n';
    for (let i = 0; i < passes - 1; i++) {
        result += ';start: for laser multi-pass, pass index is ' + (i + 2) + '\n';
        result += 'G0 F150\n';
        // todo: switch G21/G20, inch or mm
        result += 'G91\n'; // relative positioning
        result += 'G0 Z-' + depth + '\n';
        result += 'G90\n'; // absolute positioning
        result += 'G92 Z0\n'; // set position z to 0
        result += ';end\n\n';
        result += gcode + '\n';
    }
    return result;
};
