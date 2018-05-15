import fs from 'fs';
import path from 'path';
import xml2js from 'xml2js';
import store from '../store';
import {
    ERR_BAD_REQUEST,
    ERR_INTERNAL_SERVER_ERROR,
    APP_CACHE_IMAGE,
    CNC_GCODE_SUFFIX
} from '../constants';
import randomPrefix from '../lib/random-prefix';
import SvgReader from '../lib/svgreader';
import generateGcodeOld from '../lib/gcode-generate';
import ToolPathGenerator from '../lib/ToolPathGenerator';


export const set = (req, res) => {
    const { port, name, gcode, context = {} } = req.body;

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
    controller.command(null, 'gcode:load', name, gcode, context, (err, data) => {
        if (err) {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({
                msg: 'Failed to load G-code: ' + err
            });
            return;
        }

        const { name, gcode, context } = data;
        res.send({ name, gcode, context });
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
    const filenameParam = req.query.filename;

    if (!filenameParam) {
        res.status(ERR_BAD_REQUEST).send({
            msg: 'No filename specified'
        });
        return;
    }

    const content = fs.readFileSync(APP_CACHE_IMAGE + '/' + filenameParam, { encoding: 'UTF-8' });

    res.setHeader('Content-Disposition', 'attachment; filename=' + encodeURIComponent(filenameParam));
    res.setHeader('Connection', 'close');

    res.write(content);
    res.end();
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
    const { type, imageSrc, ...options } = req.body;

    if (type === 'laser') {
        // Back port to Laser G-code generate
        generateGcodeOld(req.body, (filename) => {
            res.send({
                gcodePath: filename
            });
        });

        return;
    }

    const filePath = path.basename(imageSrc);
    const filename = path.parse(filePath).name;
    const outputFilePath = `${randomPrefix()}_${filename}.${CNC_GCODE_SUFFIX}`;

    fs.readFile(`${APP_CACHE_IMAGE}/${filePath}`, 'utf8', (err, xml) => {
        if (err) {
            console.error(err);
            return;
        }

        xml2js.parseString(xml, (err, node) => {
            const svgReader = new SvgReader(0.08);
            svgReader.parse(node);

            const toolPathGenerator = new ToolPathGenerator(svgReader.boundaries, options);
            const gcode = toolPathGenerator.genGcode();

            fs.writeFile(`${APP_CACHE_IMAGE}/${outputFilePath}`, gcode, () => {
                res.send({
                    gcodePath: outputFilePath
                });
            });
        });
    });
};
