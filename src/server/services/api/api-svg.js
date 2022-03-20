import { ERR_INTERNAL_SERVER_ERROR } from '../../constants';
import logger from '../../lib/logger';
import { convertRasterToSvg as convertRaster, convertTextToSvg as convertText, convertOneLineTextToSvg as convertOneLineText } from '../../lib/svg-convert';

const log = logger('service:svg');

export const convertRasterToSvg = async (req, res) => {
    // options: { filename, vectorThreshold, invert, turdSize }
    const options = req.body;
    const result = await convertRaster(options);
    res.send(result);
};

export const convertTextToSvg = async (req, res) => {
    // options: { text, font, size, lineHeight, alignment, pathType, fillDensity }
    const options = req.body;
    try {
        const result = await convertText(options);
        res.send(result);
    } catch (e) {
        log.error(`Fail to convert text to SVG: ${e}`);
        res.status(ERR_INTERNAL_SERVER_ERROR).send({
            msg: 'Fail to convert text to SVG'
        });
    }
};

export const convertOneLineTextToSvg = async (req, res) => {
    // options: { text, font, name, size, sourceWidth, sourceHeight }
    const options = req.body;
    const result = await convertOneLineText(options);
    res.send(result);
};
