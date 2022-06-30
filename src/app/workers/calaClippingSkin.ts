import { Observable } from 'rxjs';
import { polyDiff, polyIntersection, polyOffset } from '../../shared/lib/clipper/cLipper-adapter';

type TPoint = { x: number, y: number, z?: number }

type TPolygon = TPoint[][]

const intersectionSkin = (subPaths, vectorsArray) => {
    if (!subPaths || subPaths.length === 0 || !vectorsArray || vectorsArray.length === 0) {
        return [];
    }
    return polyIntersection(subPaths, vectorsArray);
};

export type TMessage = {
    currentInnerWall: TPolygon[],
    otherLayers: TPolygon[][],
    lineWidth: number
}

export type TResult = {
    infill: TPolygon[],
    skin: TPolygon[]
}

const unionPolygons = (polygons: TPolygon[]): TPolygon => {
    return polygons.reduce((p, c) => {
        p.push(...c);
        return p;
    }, []);
};

const calaClippingSkin = ({ currentInnerWall, otherLayers, lineWidth }: TMessage) => {
    return new Observable((observer) => {
        try {
            const commonArea = otherLayers.reduce((p, c) => {
                return intersectionSkin(unionPolygons(c), p);
            }, otherLayers[0] ? unionPolygons(otherLayers[0]) : []);


            let skin;
            let infill;

            if (commonArea.length === 0) {
                skin = currentInnerWall;
                infill = [];
            } else {
                skin = polyDiff(unionPolygons(currentInnerWall), commonArea);
                infill = [commonArea];

                skin = [skin];
            }
            if (skin && skin.length > 0) {
                skin = polyOffset(unionPolygons(skin), -lineWidth);
                skin = [skin];
            }
            observer.next({
                infill,
                skin
            });
        } catch (error) {
            console.error('[web worker]: calaClippingSkin', error);
        } finally {
            observer.complete();
        }
    });
};

export default calaClippingSkin;
