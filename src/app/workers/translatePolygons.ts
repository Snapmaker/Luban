import { Observable } from 'rxjs';

type TPoint = { x: number, y: number, z?: number }

type TMessage = {
    polygons: TPoint[][],
    translate: {
        x: number,
        y: number,
        z?: number
    }
}

const translatePolygons = ({ polygons, translate }: TMessage) => {
    return new Observable((observer) => {
        const res = polygons.map((polygon) => {
            return polygon.map((point) => {
                point.x += translate.x;
                point.y += translate.y;
                (point.z && translate.z) && (point.z += translate.z);
                return point;
            });
        });
        observer.next(res);
        observer.complete();
    });
};

export default translatePolygons;
