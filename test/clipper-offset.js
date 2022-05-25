import { polyOffset } from '../src/shared/lib/clipper/cLipper-adapter';
import { Polygon } from '../src/shared/lib/clipper/clipper';

const path = [-111, 0, -111, -111, -111, -111, 0, -111, 0, -111, 111, -111, 111, -111, 111, 0, 111, 0, 111, 111, 111, 111, 0, 111, 0, 111, -111, 111, -111, 111, -111, 0];

const polygon = new Polygon();
for (let index = 0; index < path.length; index += 2) {
    polygon.add({
        x: path[index],
        y: path[index + 1]
    });
}
const paths = polyOffset([polygon.path], 10);
console.log(paths);

