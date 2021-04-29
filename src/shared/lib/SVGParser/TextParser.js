import _ from 'lodash';
// import fs from 'fs';
import * as opentype from 'opentype.js';
import BaseTagParser from './BaseTagParser';
import fontManager from '../FontManager';
import SVGParser from './Parser';

// const TEMPLATE = `<?xml version="1.0" encoding="utf-8"?>
// <svg
//     version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0" y="0" width="<%= width %>" height="<%= height %>"
//     viewBox="<%= x0 %> <%= y0 %> <%= width %> <%= height %>"
// >
//   <%= path %>
// </svg>
// `;
class textParser extends BaseTagParser {
    async parse(node, attributes, previousElementAttributes) {
        this.initialize(attributes);
        const font = attributes.fontFamily || 'Arial';
        const size = attributes.fontSize;
        const text = attributes._;
        const actualX = _.isUndefined(attributes.actualX) ? 0 : attributes.actualX;
        const actualY = _.isUndefined(attributes.actualY) ? 0 : attributes.actualY;
        const dx = _.isUndefined(attributes.dx) ? 0 : attributes.dx;
        const dy = _.isUndefined(attributes.dy) ? 0 : attributes.dy;
        const x = attributes.x;
        const y = attributes.y;
        const boundingBox = _.isUndefined(previousElementAttributes.textBoundingBox)
            ? {
                'minX': 0,
                'maxX': 0,
                'minY': 0,
                'maxY': 0
            } : previousElementAttributes.textBoundingBox;
        let positionX = 0;
        let positionY = 0;

        if (_.isUndefined(x)) {
            positionX = boundingBox.maxX - boundingBox.minX + dx;
        } else if (!_.isUndefined(x)) {
            positionX = actualX + dx;
        }

        if (_.isUndefined(y)) {
            positionY = boundingBox.maxY - boundingBox.minY + dy;
        } else {
            positionY = actualY + dy;
        }

        let result = {};
        if (!_.isUndefined(text)) {
            const fontObj = await fontManager.getFont(font);

            const fullPath = new opentype.Path();
            // Calculate size and render SVG template
            const p = fontObj.getPath(text, positionX, positionY, Math.floor(size));
            fullPath.extend(p);
            fullPath.stroke = 'black';

            // const boundingBox = fullPath.getBoundingBox();
            const svgParser = new SVGParser();

            const svgString = fullPath.toSVG();
            result = await svgParser.parse(svgString, 'path');
        }
        return result;
    }
}

export default textParser;
