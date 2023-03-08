import { Observable } from 'rxjs';
import { Transfer, TransferDescriptor } from 'threads';
import { BufferAttribute, DynamicDrawUsage } from 'three';
import * as ClipperLib from '../../../shared/lib/clipper/clipper';
import { polyOffset } from '../../../shared/lib/clipper/cLipper-adapter';
import log from '../../lib/log';

type TPoint = {
    x: number,
    y: number,
    z?: number
}

export type TPolygon = TPoint[][]

export type IMessage = {
    polygons: {
        send: TPolygon[]
    },
    skirtGap: number,
    skirtBrimLineWidth: number,
    skirtLineCount: number
}

export type IResult = TransferDescriptor<{
    array: number[],
    itemSize: number,
    normalized: boolean
}>

const generateSkirt = ({ polygons, skirtGap, skirtBrimLineWidth, skirtLineCount }: IMessage) => {
    return new Observable<IResult>((observer) => {
        try {
            polygons = polyOffset(
                polygons.send, 100, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon, 0.12, 0.1
            );
            polygons = polyOffset(
                polygons, -100, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon, 0.12, 0.1
            );

            const linePosAttr = new BufferAttribute(new Float32Array(300000), 3, false);
            linePosAttr.setUsage(DynamicDrawUsage);
            const offset = skirtBrimLineWidth * 1.5;

            const _polygons = polyOffset(
                polygons,
                skirtGap + skirtBrimLineWidth * 0.75,
                ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon, 0.12, 0.1
            );


            let j = 0;
            Array(skirtLineCount).fill(0).forEach((_item, index) => {
                let skirtArea;
                if (index === 0) {
                    skirtArea = _polygons;
                } else {
                    skirtArea = polyOffset(
                        _polygons, offset * index, ClipperLib.JoinType.jtRound,
                        ClipperLib.EndType.etClosedPolygon, 0.12, 0.1
                    );
                }
                skirtArea.forEach((vectors) => {
                    for (let i = 0; i < vectors.length; i++) {
                        const begin = vectors[i];
                        const end = vectors[i + 1];
                        if (end) {
                            linePosAttr.setXYZ(j++, begin.x, begin.y, 0.001);
                            linePosAttr.setXYZ(j++, end.x, end.y, 0.001);
                        }
                    }
                });
            });

            observer.next(Transfer(linePosAttr as unknown as ArrayBuffer));
        } catch (error) {
            log.error('[web worker]: generateSkirt', error);
        } finally {
            observer.complete();
        }
    });
};

export default generateSkirt;
