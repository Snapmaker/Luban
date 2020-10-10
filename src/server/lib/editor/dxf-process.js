import fs from 'fs';
import path from 'path';
import { pathWithRandomSuffix } from '../../../shared/lib/random-utils';
import { dxfToSvg, parseDxf, updateDxfBoundingBox } from '../../../shared/lib/DXFParser/Parser';
import DataStorage from '../../DataStorage';
import { svgInverse, svgToString } from '../../../shared/lib/SVGParser/SvgToString';

export const processDxf = (modelInfo) => {
    return new Promise(async (resolve) => {
        const { uploadName } = modelInfo;

        let outputFilename = pathWithRandomSuffix(uploadName);
        outputFilename = `${path.basename(outputFilename, '.dxf')}.svg`;

        const result = await parseDxf(`${DataStorage.tmpDir}/${uploadName}`);
        const svg = dxfToSvg(result.svg);
        updateDxfBoundingBox(svg);
        svgInverse(svg, 2);

        fs.writeFile(`${DataStorage.tmpDir}/${outputFilename}`, svgToString(svg), 'utf8', () => {
            resolve({
                filename: outputFilename
            });
        });
    });
};
