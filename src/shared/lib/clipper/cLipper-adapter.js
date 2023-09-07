import _ from 'lodash';
import * as ClipperLib from './clipper';

const SCALE = 1000000;

const PATHS_TYPE_ARRAY = 'array'; // [0,0]
const PATHS_TYPE_CLIPPER = 'clipper'; // {X:0, Y:0}
const PATHS_TYPE_JS = 'js'; // {x:0, y:0}

const checkPathsType = (paths) => {
    if (!paths || !paths[0] || !paths[0][0]) {
        return null;
    }
    if (_.isArray(paths[0][0])) {
        return PATHS_TYPE_ARRAY;
    } else if (paths[0][0].X !== undefined && paths[0][0].Y !== undefined) {
        return PATHS_TYPE_CLIPPER;
    } else if (paths[0][0].x !== undefined && paths[0][0].y !== undefined) {
        return PATHS_TYPE_JS;
    }
    return null;
};

const preClipperPaths = (paths, type = PATHS_TYPE_CLIPPER) => {
    let result = null;

    if (type === PATHS_TYPE_CLIPPER) {
        result = paths.map(v => v.map(v1 => { return { X: v1.X * SCALE, Y: v1.Y * SCALE }; }));
    } else if (type === PATHS_TYPE_ARRAY) {
        result = paths.map(v => v.map(v1 => { return { X: v1[0] * SCALE, Y: v1[1] * SCALE }; }));
    } else {
        result = paths.map(v => v.map(v1 => { return { X: v1.x * SCALE, Y: v1.y * SCALE }; }));
    }

    return result;
};

const closed = (solution) => {
    for (const path of solution) {
        if (path[0].X !== path[path.length - 1].X || path[0].Y !== path[path.length - 1].Y) {
            path.push(path[0]);
        }
    }
};

const toResult = (solution, type) => {
    closed(solution);

    if (type === PATHS_TYPE_CLIPPER) {
        return solution.map(v => v.map(v1 => { return { X: v1.X / SCALE, Y: v1.Y / SCALE }; }));
    } else if (type === PATHS_TYPE_ARRAY) {
        return solution.map(v => v.map(v1 => [v1.X / SCALE, v1.Y / SCALE]));
    } else {
        return solution.map(v => v.map(v1 => { return { x: v1.X / SCALE, y: v1.Y / SCALE }; }));
    }
};

const polyOffset = (paths, offset, joinType = ClipperLib.JoinType.jtSquare, EndType = ClipperLib.EndType.etClosedPolygon, miterLimit, roundPrecision) => {
    const type = checkPathsType(paths);

    if (!type) {
        return [];
    }

    const cPaths = preClipperPaths(paths, type);

    const clipperOffset = new ClipperLib.ClipperOffset(
        (miterLimit !== undefined ? miterLimit : 3) * SCALE,
        (roundPrecision !== undefined ? roundPrecision : 0.25) * SCALE
    );

    clipperOffset.AddPaths(cPaths, joinType, EndType);

    const solution = new ClipperLib.Paths();

    clipperOffset.Execute(solution, offset * SCALE);

    return toResult(solution, type);
};

const _polyClipper = (cSubPaths, cClipPaths, ClipType = ClipperLib.ClipType.ctUnion) => {
    const solution = new ClipperLib.Paths();

    const clipper = new ClipperLib.Clipper();
    clipper.AddPaths(cSubPaths, ClipperLib.PolyType.ptSubject, true);
    clipper.AddPaths(cClipPaths, ClipperLib.PolyType.ptClip, true);
    clipper.Execute(ClipType, solution);

    return solution;
};

const polyUnion = (subPaths, clipPaths) => {
    if (!subPaths || !subPaths[0] || !clipPaths || !clipPaths[0]) {
        return [];
    }

    const type = checkPathsType(subPaths);

    const cSubPaths = preClipperPaths(subPaths, type);
    const cClipPaths = preClipperPaths(clipPaths, type);

    const solution = _polyClipper(cSubPaths, cClipPaths, ClipperLib.ClipType.ctUnion);

    return toResult(solution, type);
};


const polyDiff = (subPaths, clipPaths) => {
    if (!subPaths || !subPaths[0]) {
        return [];
    }
    if (!clipPaths || !clipPaths[0]) {
        return subPaths;
    }

    const type = checkPathsType(subPaths);

    const cSubPaths = preClipperPaths(subPaths, type);
    const cClipPaths = preClipperPaths(clipPaths, type);

    const solution = _polyClipper(cSubPaths, cClipPaths, ClipperLib.ClipType.ctDifference);

    return toResult(solution, type);
};

const polyIntersection = (subPaths, clipPaths) => {
    if (!subPaths || !subPaths[0] || !clipPaths || !clipPaths[0]) {
        return [];
    }

    const type = checkPathsType(subPaths);

    const cSubPaths = preClipperPaths(subPaths, type);
    const cClipPaths = preClipperPaths(clipPaths, type);

    const solution = _polyClipper(cSubPaths, cClipPaths, ClipperLib.ClipType.ctIntersection);

    return toResult(solution, type);
};

const _recursivePolyUnion = (cPathss) => {
    if (cPathss.length === 1) {
        return cPathss[0];
    }
    const nCPathss = [];
    for (let i = 0; i < cPathss.length; i += 2) {
        if (i + 1 === cPathss.length) {
            nCPathss.push(cPathss[i]);
        } else {
            nCPathss.push(_polyClipper(cPathss[i], cPathss[i + 1], ClipperLib.ClipType.ctUnion));
        }
    }
    return _recursivePolyUnion(nCPathss);
};

const recursivePolyUnion = (pathss) => {
    if (!pathss || pathss.length < 1) {
        return [];
    }
    const type = checkPathsType(pathss[0]);

    if (!type) {
        return [];
    }

    const cPathss = pathss.map(v => preClipperPaths(v, type));

    const solution = _recursivePolyUnion(cPathss);

    return toResult(solution, type);
};

const simplifyPolygons = (subPaths) => {
    if (!subPaths || !subPaths[0]) {
        return [];
    }

    const type = checkPathsType(subPaths);

    let cSubPaths = preClipperPaths(subPaths, type);
    cSubPaths = ClipperLib.Clipper.SimplifyPolygons(cSubPaths, ClipperLib.PolyFillType.pftNonZero);

    return toResult(cSubPaths, type);
};


export {
    polyOffset,
    polyUnion,
    polyDiff,
    polyIntersection,
    recursivePolyUnion,
    simplifyPolygons
};
