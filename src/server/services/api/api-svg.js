import { convertRasterToSvg as convertRaster, convertTextToSvg as convertText, convertOneLineTextToSvg as convertOneLineText } from '../../lib/svg-convert';

export const convertRasterToSvg = async (req, res) => {
    // options: { filename, vectorThreshold, invert, turdSize }
    const options = req.body;
    const result = await convertRaster(options);
    res.send(result);
};

export const convertTextToSvg = async (req, res) => {
    // options: { text, font, size, lineHeight, alignment, pathType, fillDensity }
    const options = req.body;
    const result = await convertText(options);
    res.send(result);
};

export const convertOneLineTextToSvg = async (req, res) => {
    // options: { text, font, name, size, sourceWidth, sourceHeight }
    const options = req.body;
    const result = await convertOneLineText(options);
    res.send(result);
};
