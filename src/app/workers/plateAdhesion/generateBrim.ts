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
    polygons: TPolygon[],
    skirtBrimLineWidth: number,
    brimLineCount: number
}

export type IResult = {
    linePosAttr: TransferDescriptor<{
        array: number[],
        itemSize: number,
        normalized: boolean
    }>
    length: number
}

const generateBrim = ({ polygons, skirtBrimLineWidth, brimLineCount }: IMessage) => {
    return new Observable<IResult>((observer) => {
        try {
            const linePosAttr = new BufferAttribute(new Float32Array(30000000), 3, false);
            linePosAttr.setUsage(DynamicDrawUsage);

            let j = 0;
            const offset = skirtBrimLineWidth;
            Array(brimLineCount).fill(0).forEach((_item, index) => {
                let skirtArea;
                if (index === 0) {
                    skirtArea = polygons;
                } else {
                    skirtArea = polyOffset(
                        polygons,
                        offset * index,
                        ClipperLib.JoinType.jtRound,
                        ClipperLib.EndType.etClosedPolygon,
                        0.12,
                        0.1
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

            observer.next({
                linePosAttr: Transfer(linePosAttr as unknown as ArrayBuffer),
                length: j
            });
        } catch (error) {
            log.error('[web worker]: generateBrim', error);
        } finally {
            observer.complete();
        }
    });
};

export default generateBrim;
