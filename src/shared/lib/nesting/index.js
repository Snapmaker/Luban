import GridProjection from './GridProjection';
import { Nest, Part, Plate } from './Nest';


/**
 * faces [[{x:0,y:0},{x:0,y:0},{x:0,y:0}], [{x:0,y:0},{x:0,y:0},{x:0,y:0}]]
 * @param options
 * @param faces
 */
const generateSTLToPolygon = (faces, options) => {
    const {
        interval = 2,
        min
    } = options;

    const gridProjection = new GridProjection({
        interval: interval,
        min
    });

    for (let i = 0; i < faces.length; i++) {
        const face = faces[i];
        gridProjection.addTriangle(face);
    }

    return gridProjection.getOutlinePolygons();
};

export const nesting = (stls, size) => {
    const globalOptions = {
        interval: 2,
        rotate: 45
    };

    const parts = [];
    const plates = [];

    for (let i = 0; i < stls.length; i++) {
        const part = new Part(generateSTLToPolygon(stls[i].faces), {
            interval: globalOptions.interval,
            min: stls[i].boundingBox.min
        });
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
        rotate: globalOptions.rotate,
        interval: globalOptions.interval
    });
    nest.start();

    return parts;
};
