import GridProjection from './GridProjection';
import { Nest, Part, Plate } from './Nest';


/**
 * faces [[{x:0,y:0},{x:0,y:0},{x:0,y:0}], [{x:0,y:0},{x:0,y:0},{x:0,y:0}]]
 * @param options
 * @param faces
 */
const generateSTLToPolygon = (faces, options) => {
    const {
        interval,
        boundingBox,
    } = options;

    const gridProjection = new GridProjection({
        interval: interval,
        min: boundingBox.min,
        max: boundingBox.max
    });

    for (let i = 0; i < faces.length; i++) {
        const face = faces[i];
        gridProjection.addTriangle(face);
    }

    return gridProjection.getOutlinePolygons();
};

export const nesting = (stls, options, onProgress) => {
    const { size, angle, offset } = options;
    const globalOptions = {
        interval: 2,
        rotate: angle,
        offset
    };

    const parts = [];
    const plates = [];

    for (let i = 0; i < stls.length; i++) {
        const part = new Part(generateSTLToPolygon(stls[i].faces, {
            interval: globalOptions.interval,
            boundingBox: stls[i].boundingBox
        }), stls[i].center, stls[i].modelID);
        parts.push(part);
    }

    const platePoly = [{
        x: 0,
        y: 0
    }, {
        x: size.x,
        y: 0
    }, {
        x: size.x,
        y: size.y
    }, {
        x: 0,
        y: size.y
    }, {
        x: 0,
        y: 0
    }];
    const plate = new Plate(platePoly);
    plates.push(plate);

    const nest = new Nest({
        parts,
        plates,
        limitEdge: globalOptions.interval,
        accuracy: globalOptions.accuracy,
        offset: globalOptions.offset,
        rotate: globalOptions.rotate
    });
    return nest.start(onProgress);
};
