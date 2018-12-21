import fs from 'fs';
import path from 'path';
import {
    APP_CACHE_IMAGE, ERR_INTERNAL_SERVER_ERROR
} from '../constants';
import logger from '../lib/logger';
import { pathWithRandomSuffix } from '../lib/random-utils';
import SVGParser from '../lib/SVGParser';
import {
    CncToolPathGenerator, LaserToolPathGenerator
} from '../lib/ToolPathGenerator';
import processImage from '../lib/image-process';

const log = logger('api.toolPath');

export const generateCnc = async (req, res) => {
    const options = req.body;

    const type = options.type;
    const suffix = '.json';
    if (type === 'cnc') {
        const { imageSrc } = req.body;
        const pathInfo = path.parse(imageSrc);
        const inputFilePath = `${APP_CACHE_IMAGE}/${pathInfo.base}`;

        const svgParser = new SVGParser();
        try {
            const svg = await svgParser.parseFile(inputFilePath);

            const outputFilename = pathWithRandomSuffix(`${pathInfo.name}.${suffix}`);
            const outputFilePath = `${APP_CACHE_IMAGE}/${outputFilename}`;

            const toolPathGenerator = new CncToolPathGenerator(svg, options);
            const toolPathObject = toolPathGenerator.generateToolPathObj();
            const toolPathStr = JSON.stringify(toolPathObject);
            fs.writeFile(outputFilePath, toolPathStr, () => {
                res.send({
                    toolPathFilename: outputFilename
                });
            });
        } catch (err) {
            log.error(err);
        }
    }
};

export const generateLaser = async (req, res) => {
    const modelInfo = req.body;
    const suffix = '.json';
    const { type, modelType, processMode, origin } = modelInfo;
    const originFilename = origin.filename;
    const outputFilename = pathWithRandomSuffix(`${originFilename}.${suffix}`);
    const outputFilePath = `${APP_CACHE_IMAGE}/${outputFilename}`;

    let modelPath = null;
    if (type === 'laser') {
        // no need to process model only when (modelType === 'vector' && processMode === 'vector')
        if (modelType === 'vector' && processMode === 'vector') {
            modelPath = `${APP_CACHE_IMAGE}/${originFilename}`;
        } else {
            // process model then generate tool path
            const result = await processImage(modelInfo);
            modelPath = `${APP_CACHE_IMAGE}/${result.filename}`;
        }
    }
    if (modelPath) {
        const generator = new LaserToolPathGenerator();
        generator.generateToolPathObj(modelInfo, modelPath)
            .then(toolPathObj => {
                const toolPathStr = JSON.stringify(toolPathObj);
                fs.writeFile(outputFilePath, toolPathStr, 'utf8', (err) => {
                    if (err) {
                        log.error(err);
                    } else {
                        res.send({
                            toolPathFilename: outputFilename
                        });
                    }
                });
            });
    } else {
        res.status(ERR_INTERNAL_SERVER_ERROR).send({
            msg: 'Internal server error'
        });
    }
};

