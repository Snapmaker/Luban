import array from 'ensure-array';
import { logger } from './logger';
import { TagReader } from './svg_tag_reader';
import { MatrixApply, ParseFloats, ParseScalar } from './utility';


class SvgReader {

    constructor(tolerance, targetSize) {
        this.tolerance = tolerance;
        this.targetSize = targetSize;
        this.px2mm = null;
        this.boundaries = {};
    }

    static validate(xmlRoot) {
        return !!xmlRoot.svg;
    }

    parse(xmlRoot) {
        if (!SvgReader.validate(xmlRoot)) {
            logger.error('Invalid file, no <svg> tag found');
            return;
        }

        const svgRoot = xmlRoot.svg;
        const svgAttributes = this.parseSvgAttributes(svgRoot);
        this.px2mm = svgAttributes.px2mm;

        // adjust tolerances to px units
        const tolerancePx2 = Math.pow(this.tolerance / svgAttributes.px2mm, 2);
        const tagReader = TagReader(tolerancePx2);

        const tx = svgAttributes.viewBox.x, ty = svgAttributes.viewBox.y;
        const attributes = {
            'xformToWorld': [1, 0, 0, 1, tx, ty],
            'display': 'visible',
            'visibility': 'visible',
            'fill': '#000000',
            'stroke': '#000000',
            'color': '#000000',
            'fill-opacity': 1.0,
            'stroke-opacity': 1.0,
            'opacity': 1.0
        };

        this.boundaries = {};
        this.parseChildren(tagReader, svgRoot, attributes);
    }

    parseSvgAttributes(svgRoot) {
        let originalSize = null;
        let viewBox = null;
        let unit = '';
        let px2mm = 0;

        if (svgRoot.$.width && svgRoot.$.height) {
            const [width, unit] = ParseScalar(svgRoot.$.width);
            const [height, unit2] = ParseScalar(svgRoot.$.height);
            if (unit !== unit2) {
                logger.error(`Conflicting units found: ${unit} and ${unit2}.`);
            }
            if (width && height) {
                originalSize = { width: width, height: height };
            }
        }

        if (svgRoot.$.viewBox) {
            const [x, y, w, h] = ParseFloats(svgRoot.$.viewBox);
            logger.info(`SVG viewBox (${x}, ${y}, ${w}, ${h})`);
            viewBox = { x: x, y: y, width: w, height: h };
        }

        // Infer viewBox and originalSize from each other
        if (originalSize && (!viewBox || !viewBox.w || !viewBox.h)) {
            viewBox = { x: 0, y: 0, ...originalSize };
        }
        if (!originalSize && viewBox) {
            originalSize = { width: viewBox.width, height: viewBox.height };
        }

        // Get px2mm by ratio of size and view box
        if (originalSize || viewBox) {
            px2mm = originalSize.width / viewBox.width;
            if (unit === 'mm') {
                logger.info('px2mm by mm unit');
            } else if (unit === 'in') {
                px2mm *= 25.4;
                logger.info('px2mm by inch unit');
            } else if (unit === 'cm') {
                px2mm *= 10;
                logger.info('px2m by cm unit');
            } else if (unit === 'px' || unit === '') {
                // No physical units in file here, we have to interpret user(px) units,
                // for some apps we can make a good guess.
                // TODO
                // Unknown unit, setting back to 0
                px2mm = 0;
            } else {
                logger.error('SVG with unsupported unit.');
                px2mm = 0;
            }
        }

        // Get px2mm by the ratio of svg size to target size
        if (!px2mm && this.targetSize && originalSize) {
            px2mm = this.targetSize[0] / originalSize.width;
            logger.info('px2mm by targetSize - pageSize ratio');
        }

        // Fall back on px unit DPIs, default value
        if (!px2mm) {
            logger.warn('Failed to determine physical dimensions -> defaulting to 96dpi.');
            px2mm = 25.4 / 96.0;
        }

        return {
            originalSize, viewBox, px2mm
        };
    }

    parseChildren(tagReader, node, parentAttributes) {
        for (let field of tagReader.fields) {
            if (node[field]) {
                array(node[field]).forEach((child) => {
                    // 1. setup a new node and inherit from parent
                    const attributes = {
                        ...parentAttributes, paths: [], xform: [1, 0, 0, 1, 0, 0]
                    };

                    // 2. parse child with current attributes and transformation
                    tagReader.readTag(field, child, attributes);

                    // 3. compile boundaries + unit conversions
                    if (attributes.paths) {
                        for (let path of attributes.paths) {
                            // 3a. convert to world coordinates and them to mm unit
                            for (let vertex of path) {
                                MatrixApply(attributes.xformToWorld, vertex);
                                // leave it here
                                // VertexScale(vertex, this.px2mm);
                            }

                            // 3b. sort output by color
                            const hexColor = attributes.stroke;
                            if (hexColor in this.boundaries) {
                                this.boundaries[hexColor].push(path);
                            } else {
                                this.boundaries[hexColor] = [path];
                            }
                        }
                    }

                    this.parseChildren(tagReader, child, attributes);
                });
            }
        }
    }
}

export default SvgReader;
