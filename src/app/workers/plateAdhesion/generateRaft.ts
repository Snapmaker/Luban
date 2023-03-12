import { Observable } from 'rxjs';
import { Transfer, TransferDescriptor } from 'threads';
import { Shape, ShapeGeometry, Vector2 } from 'three';
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
    raftMargin: number,
    skirtBrimLineWidth: number,
}

export type IResult = TransferDescriptor<TPoint[][]>

const generateRaft = ({ polygons, raftMargin, skirtBrimLineWidth }: IMessage) => {
    return new Observable<IResult>((observer) => {
        try {
            const _polygons = polyOffset(
                polygons, raftMargin - skirtBrimLineWidth * 0.5, ClipperLib.JoinType.jtRound,
                ClipperLib.EndType.etClosedPolygon, 0.12, 0.1
            );
            const arr = [];
            _polygons.forEach((vectors) => {
                const points = [];
                for (let i = 0; i < vectors.length; i++) {
                    points.push(new Vector2(vectors[i].x, vectors[i].y));
                }
                const RaftShape = new Shape(points);
                const geometry = new ShapeGeometry(RaftShape);
                arr.push(geometry);
            });

            observer.next(Transfer(_polygons as unknown as ArrayBuffer));
        } catch (error) {
            log.error('[web worker]: generateRaft', error);
        } finally {
            observer.complete();
        }
    });
};

export default generateRaft;
