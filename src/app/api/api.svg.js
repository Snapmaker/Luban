import { convertRasterToSvg as convertRaster, convertTextToSvg as convertText } from '../lib/svg-convert';

export const convertRasterToSvg = async (req, res) => {
    // options: { filename, vectorThreshold, isInvert, turdSize }
    const options = req.body;
    const result = await convertRaster(options);
    res.send(result);
};

export const convertTextToSvg = async (req, res) => {
    // options: { text, font, size, lineHeight, alignment, fillEnabled, fillDensity }
    const options = req.body;
    const result = await convertText(options);
    res.send(result);
};
