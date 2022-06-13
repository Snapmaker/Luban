import { Observable } from 'rxjs';
import { Transfer } from 'threads';
import { Shape, ShapeGeometry, Vector2 } from 'three';
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
    raftMargin: number,
    skirtBrimLineWidth: number,
}

const generateRaft = ({ polygons, raftMargin, skirtBrimLineWidth }: IMessage) => {
    return new Observable((observer) => {
        const _polygons = polyOffset(
            polygons, raftMargin - skirtBrimLineWidth * 0.5, ClipperLib.JoinType.jtRound,
            ClipperLib.EndType.etClosedPolygon, 0, 0
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
    });
};

export default generateRaft;
