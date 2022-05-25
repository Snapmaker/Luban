import { Vector2 } from './math/Vector2';
import { recursivePolyUnion } from './clipper/cLipper-adapter';

function isPointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, len = polygon.length - 1; i < len; i++) {
        const p = polygon[i];
        const q = polygon[i + 1];

        if ((p[1] > point[1]) !== (q[1] > point[1])
            && point[0] < p[0] + (q[0] - p[0]) * (point[1] - p[1]) / (q[1] - p[1])) {
            inside = !inside;
        }
    }
    return inside;
}

function unionShapes(shapes) {
    let areaCount = 0;
    shapes.forEach((shape) => {
        shape.paths.forEach((data) => {
            data.area = Vector2.areaForArray(data.points);
            areaCount += data.area;
        });
    });

    if (areaCount < 0) {
        shapes.forEach((shape) => {
            shape.paths.forEach((data) => {
                data.points.reverse();
                data.area = -data.area;
            });
        });
    }

    shapes.forEach((shape) => {
        const newArr = [];
        const allBelowPointsArrays = [];
        shape.paths.forEach((data) => {
            if (Array.isArray(data.points)) {
                const area = Vector2.areaForArray(data.points);
                if (area > 0) {
                    const arr = [];
                    arr.push([...data.points]);
                    newArr.push(arr);
                } else if (area < 0) {
                    allBelowPointsArrays.push(data.points);
                }
            }
        });

        allBelowPointsArrays.forEach((pointsArray) => {
            for (const newArrElement of newArr) {
                if (isPointInPolygon(pointsArray[0], newArrElement[0])) {
                    newArrElement.push([...pointsArray]);
                    break;
                }
            }
        });
        // newArr = newArr.map((eachPaths) => {
        //     return simplifyPolygons(eachPaths);
        // });
        const newSvg = recursivePolyUnion(newArr);
        const newPaths = [];
        shape.paths.forEach((shapePath, index) => {
            if (newSvg[index]) {
                shapePath.points = newSvg[index];
                newPaths.push(shapePath);
            }
        });
        shape.paths = newPaths;
    });
}

export {
    isPointInPolygon,
    unionShapes
};
