import { Observable } from 'rxjs';
import { Transfer } from 'threads';
import { BufferAttribute, DynamicDrawUsage } from 'three';
import * as ClipperLib from '../../shared/lib/clipper/clipper';
import { polyOffset } from '../../shared/lib/clipper/cLipper-adapter';

type TPoint = {
    x: number,
    y: number,
    z?: number
}

export type TPolygon = TPoint[][]

type IMessage = {
    polygons: TPolygon[],
    skirtBrimLineWidth: number,
    brimLineCount: number
}

const generateBrim = ({ polygons, skirtBrimLineWidth, brimLineCount }: IMessage) => {
    return new Observable((observer) => {
        // const initLength = polygons.reduce((p, c) => {
        //     return p + c.length * 3 * 2 * brimLineCount;
        // }, 0);
        const linePosAttr = new BufferAttribute(new Float32Array(30000000), 3, false);
        linePosAttr.setUsage(DynamicDrawUsage);

        let j = 0;
        const _polygons = polyOffset(
            polygons, skirtBrimLineWidth * 0.75, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon, 0, 0
        );
        const offset = skirtBrimLineWidth * 1.5;
        Array(brimLineCount).fill(0).forEach((_item, index) => {
            let skirtArea;
            if (index === 0) {
                skirtArea = _polygons;
            } else {
                skirtArea = polyOffset(
                    _polygons, offset * index, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon, 0, 0
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
    });
};

export default generateBrim;
