import { Observable } from 'rxjs';
import { Transfer, TransferDescriptor } from 'threads';
import { Box3 } from 'three';

type TPoint = { x: number, y: number, z?: number }

type TPolygon = TPoint[][]

export type TMessage = {
    innerWallMap: Map<number, TPolygon[][]>,
    innerWallCount: number,
    lineWidth: number,
    bottomLayers: number,
    topLayers: number,
    modelBoundingBox: Box3,
    layerHeight: number
}

export type TResult = {
    layerTop: number,
    otherLayers: TransferDescriptor<TPolygon[][]>
}


const calaClippingSkin = ({ innerWallMap, innerWallCount, lineWidth, bottomLayers, modelBoundingBox, topLayers, layerHeight }: TMessage) => {
    const bottomHeight = Number((bottomLayers * lineWidth + modelBoundingBox.min.z).toFixed(2));
    const topHeight = modelBoundingBox.max.z - Number((topLayers * lineWidth).toFixed(2));
    let otherLayers = [];

    return new Observable<TResult>((observer) => {
        for (const [layerTop] of innerWallMap.entries()) {
            otherLayers = [];
            if (layerTop <= bottomHeight || layerTop >= topHeight) {
                observer.next({ layerTop, otherLayers: Transfer([] as unknown as ArrayBuffer) });
            } else {
                let i = topLayers;
                otherLayers = [];
                while (i) {
                    const topLayerWalls = innerWallMap.get(Number((layerTop + layerHeight * i).toFixed(2)));
                    if (topLayerWalls && topLayerWalls.length) {
                        otherLayers.push(topLayerWalls[innerWallCount - 1]);
                    } else {
                        otherLayers = [];
                        break;
                    }
                    i--;
                }
                if (otherLayers.length === 0) {
                    observer.next({ layerTop, otherLayers: Transfer([] as unknown as ArrayBuffer) });
                } else {
                    i++;
                    while (i <= bottomLayers) {
                        const bottomLayerWalls = innerWallMap.get(Number((layerTop - layerHeight * i).toFixed(2)));
                        if (bottomLayerWalls && bottomLayerWalls.length) {
                            otherLayers.push(bottomLayerWalls[innerWallCount - 1]);
                        } else {
                            otherLayers = [];
                            break;
                        }
                        i++;
                    }
                    observer.next({ layerTop, otherLayers: Transfer(otherLayers as unknown as ArrayBuffer) });
                }
            }
        }
        observer.complete();
    });
};

export default calaClippingSkin;
