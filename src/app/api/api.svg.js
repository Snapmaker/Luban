import { convertRasterToSvg as convertRaster, convertTextToSvg as convertText } from '../lib/svg-convert';

export const convertRasterToSvg = (req, res) => {
    // options: { filename, vectorThreshold, isInvert, turdSize }
    const options = req.body;
    convertRaster(options)
        .then(result => {
            res.send(result);
        });
};

export const convertTextToSvg = (req, res) => {
    // options: { text, font, size, lineHeight, alignment, fillEnabled, fillDensity }
    const options = req.body;
    convertText(options)
        .then(result => {
            res.send(result);
        });
};
