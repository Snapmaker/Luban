import { Observable } from 'rxjs';
import { Transfer, TransferDescriptor } from 'threads';
import { polyDiff, polyIntersection, polyOffset } from '../../shared/lib/clipper/cLipper-adapter';
import { bufferToPoint, expandBuffer, pointToBuffer } from '../lib/buffer-utils';
import log from '../lib/log';

type TPoint = { x: number, y: number, z?: number }

type TPolygon = ArrayBuffer[]

const intersectionSkin = (subPaths, vectorsArray) => {
    if (!subPaths || subPaths.length === 0 || !vectorsArray || vectorsArray.length === 0) {
        return [];
    }
    return polyIntersection(subPaths, vectorsArray);
};

export type TMessage = {
    innerWall: TransferDescriptor<TPolygon[][]>,
    otherLayers: TransferDescriptor<TPolygon[][]>,
    lineWidth: number,
    innerWallCount: number
}

export type TResult = {
    infill: TransferDescriptor<TPolygon[]>,
    skin: TransferDescriptor<TPolygon[]>,
    innerWall: TransferDescriptor<TPolygon[][]>
}

const unionPolygons = (polygons: TPoint[][][]): TPoint[][] => {
    return polygons.reduce((p, c) => {
        p.push(...c);
        return p;
    }, []);
};

const calaClippingSkin = ({ innerWall, otherLayers: _otherLayers, lineWidth, innerWallCount }: TMessage) => {
    const currentInnerWall = (innerWall.send && innerWall.send[innerWallCount - 1])
        ? innerWall.send[innerWallCount - 1].map((polygon) => {
            return polygon.map((item) => {
                return bufferToPoint(item);
            });
        })
        : [];
    const otherLayers = _otherLayers.send.map((polygons) => {
        return polygons.map((polygon) => {
            return polygon.map((item) => {
                return bufferToPoint(item);
            });
        });
    });

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

            skin = skin.map((item: TPoint[][]) => {
                return item.map((j) => {
                    return pointToBuffer(j);
                });
            });
            infill = infill.map((item: TPoint[][]) => {
                return item.map((j) => {
                    return pointToBuffer(j);
                });
            });

            observer.next({
                infill: Transfer(infill, expandBuffer(infill)),
                skin: Transfer(skin, expandBuffer(skin)),
                innerWall: Transfer(innerWall.send, expandBuffer(innerWall.send))
            });
        } catch (error) {
            log.error('[web worker]: calaClippingSkin', error);
        } finally {
            observer.complete();
        }
    });
};

export default calaClippingSkin;
