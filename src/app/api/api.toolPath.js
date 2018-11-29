import fs from 'fs';
import path from 'path';
import {
    APP_CACHE_IMAGE
} from '../constants';
import logger from '../lib/logger';
import { pathWithRandomSuffix } from '../lib/random-utils';
import SVGParser from '../lib/SVGParser';
import {
    LaserToolPathGenerator,
    CncToolPathGenerator
} from '../lib/ToolPathGenerator';

const log = logger('api.toolPath');


/**
 * Generate toolPath from image & preview parameters & generate gcode parameters placeholder.
 * @param req
 * @param res
 */
export const generate = async (req, res) => {
    const options = req.body;

    const type = options.type;
    const suffix = '.json';
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
        const outputFilename = pathWithRandomSuffix(`${pathName}.${suffix}`);
        const outputFilePath = `${APP_CACHE_IMAGE}/${outputFilename}`;
        const generator = new LaserToolPathGenerator(generatorOptions);
        try {
            const toolPathObject = await generator.generateToolPathObj();
            const toolPathStr = JSON.stringify(toolPathObject);
            fs.writeFile(outputFilePath, toolPathStr, () => {
                res.send({
                    toolPathFilename: outputFilename
                });
            });
        } catch (err) {
            log.error(err);
        }
    } else if (type === 'cnc') {
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
    } else {
        throw new Error(`Unsupported type: ${type}`);
    }
};
