import fs from 'fs';
import {
    SERVER_DATA_CACHE, ERR_INTERNAL_SERVER_ERROR
} from '../constants';
import logger from '../lib/logger';
import { pathWithRandomSuffix } from '../lib/random-utils';
import SVGParser from '../lib/SVGParser';
import {
    CncToolPathGenerator, LaserToolPathGenerator, CncReliefToolPathGenerator
} from '../lib/ToolPathGenerator';
import processImage from '../lib/image-process';

const log = logger('api.toolPath');

export const generate = async (req, res) => {
    const modelInfo = req.body;
    const suffix = '.json';
    const { type, mode, source } = modelInfo;

    const filename = source.filename;
    const outputFilename = pathWithRandomSuffix(`${filename}.${suffix}`);
    const outputFilePath = `${SERVER_DATA_CACHE}/${outputFilename}`;

    let modelPath = null;
    if (type === 'laser') {
        // no need to process model
        if ((source.type === 'svg' && mode === 'vector') ||
            (source.type === 'text' && mode === 'vector')) {
            modelPath = `${SERVER_DATA_CACHE}/${filename}`;
        } else {
            const result = await processImage(modelInfo);
            modelPath = `${SERVER_DATA_CACHE}/${result.filename}`;
        }

        if (modelPath) {
            const generator = new LaserToolPathGenerator();
            generator.generateToolPathObj(modelInfo, modelPath)
                .then(toolPath => {
                    fs.writeFile(outputFilePath, JSON.stringify(toolPath), 'utf8', (err) => {
                        if (err) {
                            log.error(err);
                        } else {
                            res.send({
                                filename: outputFilename
                            });
                        }
                    });
                });
        } else {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({
                msg: 'Internal server error'
            });
        }
    } else if (type === 'cnc') {
        const inputFilePath = `${SERVER_DATA_CACHE}/${filename}`;
        if (source.type === 'svg' && mode === 'vector') {
            const svgParser = new SVGParser();
            try {
                const svg = await svgParser.parseFile(inputFilePath);
                const toolPathGenerator = new CncToolPathGenerator();
                const toolPathObject = toolPathGenerator.generateToolPathObj(svg, modelInfo);
                fs.writeFile(outputFilePath, JSON.stringify(toolPathObject), () => {
                    res.send({
                        filename: outputFilename
                    });
                });
            } catch (err) {
                log.error(err);
            }
        } else if (source.type === 'raster' && mode === 'greyscale') {
            const inputFilePath = `${SERVER_DATA_CACHE}/${filename}`;
            const generator = new CncReliefToolPathGenerator(modelInfo, inputFilePath);
            generator.generateToolPathObj().then(toolPathObj => {
                fs.writeFile(outputFilePath, JSON.stringify(toolPathObj), () => {
                    res.send({
                        filename: outputFilename
                    });
                });
            });
        }
    } else {
        res.status(ERR_INTERNAL_SERVER_ERROR).send({
            msg: 'Unsupported type: ' + type
        });
    }
};
