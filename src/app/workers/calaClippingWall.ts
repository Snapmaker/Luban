import { polyOffset } from '../../shared/lib/clipper/cLipper-adapter';
import sendMessage from './utils/sendMessage';

type TPoint = { x: number, y: number, z?: number }

const calaClippingWall = (clippingHeight: number, polygons: TPoint[][]) => {
    // let index = 0;
    // const ret = [];
    const res = polyOffset(polygons, -0.5);
    // res.forEach((vectors) => {
    //     for (let i = 0; i < vectors.length; i++) {
    //         const begin = vectors[i];
    //         const end = vectors[i + 1];
    //         if (end) {
    //             ret[index++] = { x: begin.x, y: begin.y, z: clippingHeight };
    //             ret[index++] = { x: end.x, y: end.y, z: clippingHeight };
    //         }
    //     }
    // });
    return sendMessage(res);
};

export default calaClippingWall;
