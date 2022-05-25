import { polyDiff, polyIntersection } from '../../shared/lib/clipper/cLipper-adapter';
import sendMessage from './utils/sendMessage';

type TPoint = { x: number, y: number, z?: number }

const intersectionSkin = (subPaths, vectorsArray) => {
    if (!subPaths || subPaths.length === 0 || !vectorsArray || vectorsArray.length === 0) {
        return [];
    }
    return polyIntersection(subPaths, vectorsArray);

    // if (subPaths && vectorsArray) {
    //     return polyIntersection(subPaths, vectorsArray);
    // }
    // if (!vectorsArray && subPaths) {
    //     return subPaths;
    // }
    // if (vectorsArray && !subPaths) {
    //     return vectorsArray;
    // }
    // return [];
};

const calaClippingSkin = (index: string, currentInnerWall:TPoint[], otherLayers: TPoint[][]) => {
    const commonArea = otherLayers.reduce((p, c) => {
        return intersectionSkin(c, p);
    }, otherLayers[0]);

    let skin;
    let infill;

    console.log('-----------------', `${index}: `, commonArea.length);

    if (commonArea.length === 0) {
        skin = currentInnerWall;
        infill = [];
    } else {
        skin = polyDiff(currentInnerWall, commonArea);
        infill = commonArea;
    }


    return sendMessage({
        infill,
        skin
    });
};

export default calaClippingSkin;
