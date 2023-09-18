import fs from 'fs';
import SVGParser from '../../../../shared/lib/SVGParser';
import {
    polyDiff,
    polyIntersection,
    polyOffset,
    recursivePolyUnion
} from '../../../../shared/lib/clipper/cLipper-adapter';
import { pathWithRandomSuffix } from '../../../../shared/lib/random-utils';
import { svgToString } from '../../../../shared/lib/SVGParser/SvgToString';
import sendMessage from '../utils/sendMessage';
import * as ClipperLib from '../../../../shared/lib/clipper/clipper';
import { EPSILON4 } from '../../../../shared/lib/utils';
import logger from '../../../lib/logger';

const log = logger('svgClippping');

enum SVGClippingType {
    Offset = 'offset',
    Background = 'background',
    Ringing = 'ringing',
    Union = 'union',
    Clip = 'clip'
}

export enum SVGClippingOperation {
    Separate = 'separate',
    Merged = 'merged'
}

export enum SVGClippingResultType {
    Add = 'add',
    Update = 'update',
    Delete = 'delete'
}

const pointsArea = (points) => {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        area += p1[0] * p2[1] - p1[1] * p2[0];
    }
    return area / 2;
};

// const polygonsScale = (polygons, x, y) => {
//     polygons.forEach(polygon => polygon.forEach(v => {
//         v[0] *= x;
//         v[1] *= y;
//     }));
// };
//
const polygonsMove = (polygons, x, y) => {
    polygons.forEach(polygon => polygon.forEach(v => {
        v[0] += x;
        v[1] += y;
    }));
};

const polygonsRotate = (polygons, rotate) => {
    // polygonsMove(polygons, -x, -y);
    const cos = Math.cos(rotate);
    const sin = Math.sin(rotate);
    polygons.forEach(polygon => polygon.forEach(v => {
        const vx = v[0] * cos - v[1] * sin;
        const vy = v[0] * sin + v[1] * cos;
        v[0] = vx;
        v[1] = vy;
    }));
    // polygonsMove(polygons, x, y);
};



const checkoutClosed = (path) => {
    if (path.length <= 2) {
        return false;
    }
    const p1 = path[0];
    const p2 = path[path.length - 1];
    const d = Math.sqrt((p1[0] - p2[0]) * (p1[0] - p2[0]) + (p1[1] - p2[1]) * (p1[1] - p2[1]));
    if (d <= EPSILON4) {
        return true;
    }
    return false;
};

const checkoutAndClosedSVG = (svg) => {
    for (let i = 0; i < svg.shapes.length; i++) {
        for (let j = 0; j < svg.shapes[i].paths.length; j++) {
            if (!svg.shapes[i].paths[j].closed) {
                svg.shapes[i].paths[j].closed = checkoutClosed(svg.shapes[i].paths[j].points);
            }
        }
    }
};

const standardizationSVG = (svg, modelInfo) => {
    const { width, height, scaleX, scaleY } = modelInfo.transformation;
    const svgWidth = svg.viewBox[2];
    const svgHeight = svg.viewBox[3];
    const nScaleX = width / svgWidth * scaleX;
    const nScaleY = height / svgHeight * scaleY;
    const moveX = svg.viewBox[0] + svgWidth / 2;
    const moveY = svg.viewBox[1] + svgHeight / 2;

    for (let i = 0; i < svg.shapes.length; i++) {
        for (let j = 0; j < svg.shapes[i].paths.length; j++) {
            for (let k = 0; k < svg.shapes[i].paths[j].points.length; k++) {
                const p = svg.shapes[i].paths[j].points[k];
                p[0] = (p[0] - moveX) * nScaleX;
                p[1] = (p[1] - moveY) * nScaleY;
            }
        }
    }
    svg.width = width;
    svg.height = height;
    svg.viewBox = [-width / 2, -height / 2, width, height];
};

const getSVG = async (modelInfo) => {
    const filename = modelInfo.processImageName || modelInfo.uploadName;
    const filePath = `${process.env.Tmpdir}/${filename}`;
    const svgParser = new SVGParser();
    const svg = await svgParser.parseFile(filePath);

    checkoutAndClosedSVG(svg);

    standardizationSVG(svg, modelInfo);

    return svg;
};


const svgShapeToPolygons = (shape) => {
    const closedPolygons = [];
    const openPolygons = [];
    for (let j = 0; j < shape.paths.length; j++) {
        if (shape.paths[j].closed) {
            closedPolygons.push(shape.paths[j].points);
        } else {
            openPolygons.push(shape.paths[j].points);
        }
    }
    return {
        closedPolygons,
        openPolygons
    };
};


const svgToPolygons = (svg) => {
    const allClosedPolygons = [];
    const allOpenPolygons = [];
    for (let i = 0; i < svg.shapes.length; i++) {
        const { closedPolygons, openPolygons } = svgShapeToPolygons(svg.shapes[i]);
        allClosedPolygons.push(...closedPolygons);
        allOpenPolygons.push(...openPolygons);
    }
    return {
        closedPolygons: allClosedPolygons,
        openPolygons: allOpenPolygons
    };
};
//
// const getBoundingBox = (polygons) => {
//     let minX = polygons[0][0][0];
//     let maxX = polygons[0][0][0];
//     let minY = polygons[0][0][1];
//     let maxY = polygons[0][0][1];
//     for (let i = 0; i < polygons.length; i++) {
//         for (let j = 0; j < polygons[i].length; j++) {
//             const p = polygons[i][j];
//             minX = Math.min(minX, p[0]);
//             minY = Math.min(minY, p[1]);
//             maxX = Math.max(maxX, p[0]);
//             maxY = Math.max(maxY, p[1]);
//         }
//     }
//     return {
//         minX, maxX, minY, maxY
//     };
// };

const getBoundingBoxBySVG = (svg) => {
    let minX = svg.shapes[0].paths[0].points[0][0];
    let maxX = svg.shapes[0].paths[0].points[0][0];
    let minY = svg.shapes[0].paths[0].points[0][1];
    let maxY = svg.shapes[0].paths[0].points[0][1];
    for (let i = 0; i < svg.shapes.length; i++) {
        for (let j = 0; j < svg.shapes[i].paths.length; j++) {
            for (let k = 0; k < svg.shapes[i].paths[j].points.length; k++) {
                const p = svg.shapes[i].paths[j].points[k];
                minX = Math.min(minX, p[0]);
                minY = Math.min(minY, p[1]);
                maxX = Math.max(maxX, p[0]);
                maxY = Math.max(maxY, p[1]);
            }
        }
    }
    return {
        minX, maxX, minY, maxY
    };
};

const writeSVG = async (svg, modelID, uploadName, type, transformation = {}) => {
    const outputFilename = pathWithRandomSuffix(`${uploadName}.svg`);
    const targetPath = `${process.env.Tmpdir}/${outputFilename}`;

    const newWidth = svg.viewBox[2];
    const newHeight = svg.viewBox[3];

    return new Promise((resolve) => {
        fs.writeFile(targetPath, svgToString(svg), () => {
            resolve({
                modelID,
                resultType: type,
                originalName: outputFilename,
                filename: outputFilename,
                sourceWidth: newWidth,
                sourceHeight: newHeight,
                baseWidth: newWidth,
                baseHeight: newHeight,
                transformation: {
                    ...transformation,
                    width: newWidth,
                    height: newHeight
                }
            });
        });
    });
};

const transforPolygonsStart = (polygons, modelInfo) => {
    const { positionX, positionY, rotationZ } = modelInfo.transformation;
    polygonsRotate(polygons, -rotationZ);
    polygonsMove(polygons, positionX, -positionY);
};

// const transforPolygonsEnd = (polygons, modelInfo) => {
//     const { positionX, positionY, rotationZ } = modelInfo.transformation;
//     polygonsMove(polygons, -positionX, positionY);
//     polygonsRotate(polygons, rotationZ);
// };

const calculateSVGViewBox = (svg, offset = 0) => {
    const { minX, maxX, minY, maxY } = getBoundingBoxBySVG(svg);
    svg.width = maxX - minX + offset * 2;
    svg.height = maxY - minY + offset * 2;
    svg.viewBox = [minX - offset, minY - offset, svg.width, svg.height];
};

const createNewSVG = (result) => {
    const resultSVG = {
        shapes: [{
            visibility: true,
            paths: []
        }],
        width: 0,
        height: 0,
        viewBox: [0, 0, 0, 0]
    };

    for (let i = 0; i < result.length; i++) {
        resultSVG.shapes[0].paths.push({
            closed: true,
            points: result[i]
        });
    }

    calculateSVGViewBox(resultSVG);

    return resultSVG;
};

const svgModelOffset = async (modelInfo, offset, onProgress) => {
    try {
        const svg = await getSVG(modelInfo);
        onProgress && onProgress(0.1);

        for (let i = 0; i < svg.shapes.length; i++) {
            const shape = svg.shapes[i];
            const { closedPolygons, openPolygons } = svgShapeToPolygons(shape);

            const closedResult = polyOffset(closedPolygons, offset, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon, 3, 0.0025);
            const openResult = polyOffset(openPolygons, offset, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etOpenSquare, 3, 0.0025);

            shape.paths = [];
            for (let j = 0; j < closedResult.length; j++) {
                shape.paths.push({
                    closed: true,
                    points: closedResult[j]
                });
            }
            for (let j = 0; j < openResult.length; j++) {
                shape.paths.push({
                    closed: true,
                    points: openResult[j]
                });
            }

            onProgress && onProgress(i / svg.shapes.length * 0.9 + 0.1);
        }

        calculateSVGViewBox(svg);

        onProgress && onProgress(1);
        return writeSVG(svg, modelInfo.modelID, modelInfo.uploadName, SVGClippingResultType.Add, {
            positionX: modelInfo.transformation.positionX,
            positionY: modelInfo.transformation.positionY,
            rotationZ: modelInfo.transformation.rotationZ
        });
    } catch (e) {
        log.error(e);
        throw new Error();
    }
};

const svgModelBackground = async (modelInfo, offset, onProgress) => {
    const svg = await getSVG(modelInfo);
    onProgress && onProgress(0.1);

    // const scaleX = svg.width / modelInfo.transformation.width;
    // const scaleY = svg.height / modelInfo.transformation.height;
    // const isEqualScaleRatio = modelInfo.transformation.scaleX === modelInfo.transformation.scaleY;

    for (let i = 0; i < svg.shapes.length; i++) {
        const shape = svg.shapes[i];
        const { closedPolygons, openPolygons } = svgShapeToPolygons(shape);
        const closedResult = polyOffset(closedPolygons, offset, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon, 3, 0.0025);
        const openResult = polyOffset(openPolygons, offset, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etOpenSquare, 3, 0.0025);
        shape.paths = [];
        for (let j = 0; j < closedResult.length; j++) {
            shape.paths.push({
                closed: true,
                points: closedResult[j]
            });
        }
        for (let j = 0; j < openResult.length; j++) {
            shape.paths.push({
                closed: true,
                points: openResult[j]
            });
        }
        onProgress && onProgress(i / svg.shapes.length * 0.8 + 0.1);
    }
    const polygonss = [];
    for (let i = 0; i < svg.shapes.length; i++) {
        const shape = svg.shapes[i];
        for (let j = 0; j < shape.paths.length; j++) {
            if (shape.paths[j].closed) {
                polygonss.push([shape.paths[j].points]);
            }
        }
    }
    const result = recursivePolyUnion(polygonss);
    onProgress && onProgress(0.9);
    svg.shapes.splice(1);
    svg.shapes[0].paths.splice(0);
    for (let i = 0; i < result.length; i++) {
        if (pointsArea(result[i]) > 0) {
            svg.shapes[0].paths.push({
                closed: true,
                points: result[i]
            });
        }
    }

    calculateSVGViewBox(svg);

    onProgress && onProgress(1);
    return writeSVG(svg, modelInfo.modelID, modelInfo.uploadName, SVGClippingResultType.Add, {
        positionX: modelInfo.transformation.positionX,
        positionY: modelInfo.transformation.positionY,
        rotationZ: modelInfo.transformation.rotationZ
    });
};

const svgModelRinging = async (modelInfo, offset, onProgress) => {
    const svg = await getSVG(modelInfo);

    onProgress && onProgress(0.1);

    for (let i = 0; i < svg.shapes.length; i++) {
        const shape = svg.shapes[i];
        const { closedPolygons, openPolygons } = svgShapeToPolygons(shape);
        const closedResultExpand = polyOffset(closedPolygons, offset, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon, 3, 0.0025);
        const closedResultShrink = polyOffset(closedPolygons, -offset, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon, 3, 0.0025);
        const closedResult = polyDiff(closedResultExpand, closedResultShrink);

        const openResult = polyOffset(openPolygons, offset, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etOpenSquare, 3, 0.0025);
        shape.paths = [];
        for (let j = 0; j < closedResult.length; j++) {
            shape.paths.push({
                closed: true,
                points: closedResult[j]
            });
        }
        for (let j = 0; j < openResult.length; j++) {
            shape.paths.push({
                closed: true,
                points: openResult[j]
            });
        }
        onProgress && onProgress(i / svg.shapes.length * 0.9 + 0.1);
    }

    calculateSVGViewBox(svg);

    onProgress && onProgress(1);

    return writeSVG(svg, modelInfo.modelID, modelInfo.uploadName, SVGClippingResultType.Add, {
        positionX: modelInfo.transformation.positionX,
        positionY: modelInfo.transformation.positionY,
        rotationZ: modelInfo.transformation.rotationZ
    });
};

const svgModelUnion = async (modelInfo, onProgress) => {
    const svg = await getSVG(modelInfo);

    onProgress && onProgress(0.1);

    const polygonss = [];
    for (let i = 0; i < svg.shapes.length; i++) {
        const shape = svg.shapes[i];
        const { closedPolygons } = svgShapeToPolygons(shape);
        polygonss.push(closedPolygons);
    }
    onProgress && onProgress(0.2);
    const result = recursivePolyUnion(polygonss);
    onProgress && onProgress(0.8);
    svg.shapes.splice(1);
    svg.shapes[0].paths.splice(0);
    for (let i = 0; i < result.length; i++) {
        svg.shapes[0].paths.push({
            closed: true,
            points: result[i]
        });
    }

    calculateSVGViewBox(svg);

    console.log('svg.shapes', svg.shapes);

    onProgress && onProgress(1);
    return writeSVG(svg, modelInfo.modelID, modelInfo.uploadName, SVGClippingResultType.Add, {
        positionX: modelInfo.transformation.positionX,
        positionY: modelInfo.transformation.positionY,
        rotationZ: modelInfo.transformation.rotationZ
    });
};


const svgModelsUnion = async (modelInfos, onProgress) => {
    if (modelInfos.length < 2) {
        throw new Error('SVG Union model infos length < 2');
    }

    onProgress && onProgress(0.1);

    const polygonss = [];

    for (let i = 0; i < modelInfos.length; i++) {
        const clipSVG = await getSVG(modelInfos[i]);

        const clipClosedPolygons = svgToPolygons(clipSVG).closedPolygons;

        transforPolygonsStart(clipClosedPolygons, modelInfos[i]);

        if (clipClosedPolygons.length !== 0) {
            polygonss.push(clipClosedPolygons);
        }
    }
    onProgress && onProgress(0.4);
    const result = recursivePolyUnion(polygonss);
    onProgress && onProgress(0.8);

    if (result.length === 0) {
        throw new Error('SVG Union model result is null');
    }

    const resultSVG = createNewSVG(result);

    onProgress && onProgress(1);
    return writeSVG(resultSVG, '', modelInfos[0].uploadName, SVGClippingResultType.Add, {
        positionX: resultSVG.viewBox[0] + resultSVG.viewBox[2] / 2,
        positionY: -(resultSVG.viewBox[1] + resultSVG.viewBox[3] / 2)
    });
};


const svgModelsClip = async (modelInfos, onProgress) => {
    if (modelInfos.length !== 2) {
        throw new Error('SVG Clip model infos length !== 2');
    }

    onProgress && onProgress(0.1);

    const svg0 = await getSVG(modelInfos[0]);
    const svg1 = await getSVG(modelInfos[1]);
    const polygons0 = svgToPolygons(svg0).closedPolygons;
    const polygons1 = svgToPolygons(svg1).closedPolygons;
    transforPolygonsStart(polygons0, modelInfos[0]);
    transforPolygonsStart(polygons1, modelInfos[1]);

    onProgress && onProgress(0.4);

    const result0 = polyDiff(polygons0, polygons1);
    const result1 = polyDiff(polygons1, polygons0);
    const result2 = polyIntersection(polygons0, polygons1);

    // transforPolygonsEnd(result0, modelInfos[0]);
    // transforPolygonsEnd(result1, modelInfos[1]);

    onProgress && onProgress(0.8);

    const results = [];

    if (result0.length > 0) {
        const resSVG0 = createNewSVG(result0);
        results.push(await writeSVG(resSVG0, modelInfos[0].modelID, modelInfos[0].uploadName, SVGClippingResultType.Add, {
            positionX: resSVG0.viewBox[0] + resSVG0.viewBox[2] / 2,
            positionY: -(resSVG0.viewBox[1] + resSVG0.viewBox[3] / 2)
        }));
    }
    if (result1.length > 0) {
        const resSVG1 = createNewSVG(result1);
        results.push(await writeSVG(resSVG1, modelInfos[1].modelID, modelInfos[1].uploadName, SVGClippingResultType.Add, {
            positionX: resSVG1.viewBox[0] + resSVG1.viewBox[2] / 2,
            positionY: -(resSVG1.viewBox[1] + resSVG1.viewBox[3] / 2)
        }));
    }
    if (result2.length > 0) {
        const resSVG2 = createNewSVG(result2);
        results.push(await writeSVG(resSVG2, modelInfos[1].modelID, modelInfos[1].uploadName, SVGClippingResultType.Add, {
            positionX: resSVG2.viewBox[0] + resSVG2.viewBox[2] / 2,
            positionY: -(resSVG2.viewBox[1] + resSVG2.viewBox[3] / 2)
        }));
    }

    onProgress && onProgress(1);
    return results;
};

const svgClipping = async (taskInfo) => {
    const createOnProgress = (i, len) => {
        const onProgress = (num) => {
            sendMessage({ status: 'progress', value: num / len + i / len });
        };
        return onProgress;
    };

    const { config, modelInfos } = taskInfo;
    const { offset } = config;

    const results = [];
    try {
        if (config.type === SVGClippingType.Offset) {
            for (let i = 0; i < modelInfos.length; i++) {
                const result = await svgModelOffset(modelInfos[i], offset, createOnProgress(i, modelInfos.length));
                results.push(result);
            }
        } else if (config.type === SVGClippingType.Background) {
            for (let i = 0; i < modelInfos.length; i++) {
                const result = await svgModelBackground(modelInfos[i], offset, createOnProgress(i, modelInfos.length));
                results.push(result);
            }
        } else if (config.type === SVGClippingType.Ringing) {
            for (let i = 0; i < modelInfos.length; i++) {
                const result = await svgModelRinging(modelInfos[i], offset, createOnProgress(i, modelInfos.length));
                results.push(result);
            }
        } else if (config.type === SVGClippingType.Union) {
            if (config.operation === SVGClippingOperation.Separate) {
                for (let i = 0; i < modelInfos.length; i++) {
                    const result = await svgModelUnion(modelInfos[i], createOnProgress(i, modelInfos.length));
                    results.push(result);
                }
            } else {
                const result = await svgModelsUnion(modelInfos, createOnProgress(0, 1));
                results.push(result);
            }
        } else if (config.type === SVGClippingType.Clip) {
            const clipResults = await svgModelsClip(modelInfos, createOnProgress(0, 1));
            results.push(...clipResults);
        }
        sendMessage({ status: 'complete', value: results });
    } catch (e) {
        sendMessage({ status: 'fail', value: e });
        throw e;
    }
};



export default svgClipping;
