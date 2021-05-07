import fs from 'fs';
import { ERR_INTERNAL_SERVER_ERROR } from '../../constants';
import logger from '../../lib/logger';
import { pathWithRandomSuffix } from '../../lib/random-utils';
import SVGParser from '../../../shared/lib/SVGParser';
import {
    CncToolPathGenerator, LaserToolPathGenerator, CncReliefToolPathGenerator
} from '../../lib/ToolPathGenerator';
import { editorProcess } from '../../lib/editor/process';
import DataStorage from '../../DataStorage';

const log = logger('api.toolPath');

export const generate = async (req, res) => {
    const modelInfo = req.body;
    const suffix = '.json';
    // const { type, mode, source } = modelInfo;
    const { headType, sourceType, uploadName, mode } = modelInfo;

    const outputFilename = pathWithRandomSuffix(`${uploadName}.${suffix}`);
    const outputFilePath = `${DataStorage.tmpDir}/${outputFilename}`;

    let modelPath = null;
    if (headType === 'laser') {
        // no need to process model
        if ((sourceType === 'svg' && mode === 'vector')
            || (sourceType === 'text' && mode === 'vector')) {
            modelPath = `${DataStorage.tmpDir}/${uploadName}`;
        } else {
            const result = await editorProcess(modelInfo);
            modelPath = `${DataStorage.tmpDir}/${result.filename}`;
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
    } else if (headType === 'cnc') {
        const inputFilePath = `${DataStorage.tmpDir}/${uploadName}`;
        if (sourceType === 'svg' && mode === 'vector') {
            const svgParser = new SVGParser();
            try {
                const svg = await svgParser.parseFile(inputFilePath);
                const toolPathGenerator = new CncToolPathGenerator(modelInfo);
                const toolPathObject = toolPathGenerator.generateToolPathObj(svg, modelInfo);
                fs.writeFile(outputFilePath, JSON.stringify(toolPathObject), () => {
                    res.send({
                        filename: outputFilename
                    });
                });
            } catch (err) {
                log.error(err);
            }
        } else if (sourceType === 'raster' && mode === 'greyscale') {
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
            msg: `Unsupported type: ${headType}`
        });
    }
};
