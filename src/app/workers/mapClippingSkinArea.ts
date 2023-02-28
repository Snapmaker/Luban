import { Observable } from 'rxjs';
import { Transfer, TransferDescriptor } from 'threads';
import { Box3 } from 'three';
import { expandBuffer } from '../lib/buffer-utils';

type TPolygon = ArrayBuffer[]

export type TMessage = {
    innerWallMap: TransferDescriptor<Map<number, TPolygon[][]>>
    innerWallCount: number,
    lineWidth: number,
    bottomLayers: number,
    topLayers: number,
    modelBoundingBox: Box3,
    layerHeight: number
}

export type TResult = {
    layerTop: number,
    otherLayers: TransferDescriptor<TPolygon[][]>,
    innerWall: TransferDescriptor<TPolygon[]>
}


const mapClippingSkinArea = (
    { innerWallMap, innerWallCount, lineWidth, bottomLayers, modelBoundingBox, topLayers, layerHeight }: TMessage
) => {
    const bottomHeight = Number((bottomLayers * lineWidth + modelBoundingBox.min.z).toFixed(2));
    const topHeight = modelBoundingBox.max.z - Number((topLayers * lineWidth).toFixed(2));
    let otherLayers: TPolygon[][] = [];

    return new Observable<TResult>((observer) => {
        for (const [layerTop, innerWall] of innerWallMap.send.entries()) {
            otherLayers = [];
            if (layerTop <= bottomHeight || layerTop >= topHeight) {
                observer.next({
                    layerTop,
                    otherLayers: Transfer([] as unknown as ArrayBuffer),
                    innerWall: Transfer(innerWall, expandBuffer(innerWall))
                });
            } else {
                let i = topLayers;
                otherLayers = [];
                while (i) {
                    const topLayerWalls = innerWallMap.send.get(Number((layerTop + layerHeight * i).toFixed(2)));
                    if (topLayerWalls && topLayerWalls.length) {
                        otherLayers.push(topLayerWalls[innerWallCount - 1]);
                    } else {
                        otherLayers = [];
                        break;
                    }
                    i--;
                }
                if (otherLayers.length === 0) {
                    observer.next({
                        layerTop,
                        otherLayers: Transfer([] as unknown as ArrayBuffer),
                        innerWall: Transfer(innerWall, expandBuffer(innerWall))
                    });
                } else {
                    i++;
                    while (i <= bottomLayers) {
                        const bottomLayerWalls = innerWallMap.send.get(Number((layerTop - layerHeight * i).toFixed(2)));
                        if (bottomLayerWalls && bottomLayerWalls.length) {
                            otherLayers.push(bottomLayerWalls[innerWallCount - 1]);
                        } else {
                            otherLayers = [];
                            break;
                        }
                        i++;
                    }
                    otherLayers = otherLayers.map((j) => {
                        return j.map((k) => {
                            return k.slice(0);
                        });
                    });
                    observer.next({
                        layerTop,
                        otherLayers: Transfer(otherLayers, expandBuffer(otherLayers)),
                        innerWall: Transfer(innerWall, expandBuffer(innerWall))
                    });
                }
            }
        }
        observer.complete();
    });
};

export default mapClippingSkinArea;
