import { Observable } from 'rxjs';
import { polyOffset } from '../../shared/lib/clipper/cLipper-adapter';

type TPoint = { x: number, y: number, z?: number }

type TMessage = {
    polygons: TPoint[][], innerWallCount: number, lineWidth: number
}

const calaClippingWall = ({ polygons, innerWallCount, lineWidth }: TMessage) => {
    return new Observable((observer) => {
        // let index = 0;
        // const ret = [];
        const res = Array(innerWallCount).fill('').map((_, index) => {
            return polygons.map((polygon) => {
                return polyOffset(polygon, -lineWidth * (index + 1));
            });
        });

        observer.next(res);
        observer.complete();
    });
};

export default calaClippingWall;
