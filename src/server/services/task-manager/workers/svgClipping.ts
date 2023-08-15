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
    const { width, height } = modelInfo.transformation;
    const scaleX = width / svg.width;
    const scaleY = height / svg.height;
    const moveX = svg.viewBox[0] + svg.width / 2;
    const moveY = svg.viewBox[1] + svg.height / 2;

    for (let i = 0; i < svg.shapes.length; i++) {
        for (let j = 0; j < svg.shapes[i].paths.length; j++) {
            for (let k = 0; k < svg.shapes[i].paths[j].points.length; k++) {
                const p = svg.shapes[i].paths[j].points[k];
                p[0] = (p[0] - moveX) * scaleX;
                p[1] = (p[1] - moveY) * scaleY;
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

const writeSVG = async (svg, modelID, uploadName, type, offset = 0) => {
    const outputFilename = pathWithRandomSuffix(`${uploadName}.svg`);
    const targetPath = `${process.env.Tmpdir}/${outputFilename}`;

    const newWidth = svg.width + 2 * offset;
    const newHeight = svg.height + 2 * offset;

    svg.viewBox = [svg.viewBox[0] - offset, svg.viewBox[1] - offset, newWidth, newHeight];
    svg.width = newWidth;
    svg.height = newHeight;

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
                width: newWidth,
                height: newHeight
            });
        });
    });
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

const getBoundingBox = (polygons) => {
    let minX = polygons[0][0][0];
    let maxX = polygons[0][0][0];
    let minY = polygons[0][0][1];
    let maxY = polygons[0][0][1];
    for (let i = 0; i < polygons.length; i++) {
        for (let j = 0; j < polygons[i].length; j++) {
            const p = polygons[i][j];
            minX = Math.min(minX, p[0]);
            minY = Math.min(minY, p[1]);
            maxX = Math.max(maxX, p[0]);
            maxY = Math.max(maxY, p[1]);
        }
    }
    return {
        minX, maxX, minY, maxY
    };
};

const transforPolygonsStart = (polygons, modelInfo) => {
    const { positionX, positionY, rotationZ } = modelInfo.transformation;
    polygonsRotate(polygons, -rotationZ);
    polygonsMove(polygons, positionX, -positionY);
};

const transforPolygonsEnd = (polygons, modelInfo) => {
    const { positionX, positionY, rotationZ } = modelInfo.transformation;
    polygonsMove(polygons, -positionX, positionY);
    polygonsRotate(polygons, rotationZ);
};

const createNewSVG = (result) => {
    const { minX, maxX, minY, maxY } = getBoundingBox(result);

    const resultSVG = {
        shapes: [{
            visibility: true,
            paths: []
        }],
        width: maxX - minX,
        height: maxY - minY,
        viewBox: [minX, minY, maxX - minX, maxY - minY]
    };

    for (let i = 0; i < result.length; i++) {
        resultSVG.shapes[0].paths.push({
            closed: true,
            points: result[i]
        });
    }
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

        onProgress && onProgress(1);
        return writeSVG(svg, modelInfo.modelID, modelInfo.uploadName, SVGClippingResultType.Update, offset);
    } catch (e) {
        console.log(e);
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
    onProgress && onProgress(1);
    return writeSVG(svg, modelInfo.modelID, modelInfo.uploadName, SVGClippingResultType.Update, offset);
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

    onProgress && onProgress(1);

    return writeSVG(svg, modelInfo.modelID, modelInfo.uploadName, SVGClippingResultType.Update, offset);
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

    onProgress && onProgress(1);
    return writeSVG(svg, modelInfo.modelID, modelInfo.uploadName, SVGClippingResultType.Update, 0);
};


const svgModelsUnion = async (modelInfos, onProgress) => {
    if (modelInfos.length < 2) {
        throw new Error('SVG Clip model infos length < 2');
    }

    onProgress && onProgress(0.1);

    const polygonss = [];

    for (let i = 0; i < modelInfos.length; i++) {
        const clipSVG = await getSVG(modelInfos[i]);

        const clipClosedPolygons = svgToPolygons(clipSVG).closedPolygons;

        transforPolygonsStart(clipClosedPolygons, modelInfos[i]);

        polygonss.push(clipClosedPolygons);
    }
    onProgress && onProgress(0.4);
    const result = recursivePolyUnion(polygonss);
    onProgress && onProgress(0.8);

    const resultSVG = createNewSVG(result);

    onProgress && onProgress(1);
    return writeSVG(resultSVG, '', modelInfos[0].uploadName, SVGClippingResultType.Add, 0);
};
//
// const svgModelsClip = async (modelInfos) => {
//     if (modelInfos.length !== 2) {
//         throw new Error('SVG Clip model infos length < 2');
//     }
//
//     const subSVG = await getSVG(modelInfos[0]);
//     const subPolygons = svgToPolygons(subSVG);
//     const subClosedPolygons = subPolygons.closedPolygons;
//
//     transforPolygonsStart(subClosedPolygons, modelInfos[0]);
//
//     const subOpenPolygons = subPolygons.openPolygons;
//     const allClipClosedPolygons = [];
//
//     for (let i = 1; i < modelInfos.length; i++) {
//         const clipSVG = await getSVG(modelInfos[i]);
//         const clipClosedPolygons = svgToPolygons(clipSVG).closedPolygons;
//
//         transforPolygonsStart(clipClosedPolygons, modelInfos[i]);
//
//         allClipClosedPolygons.push(...clipClosedPolygons);
//     }
//     const result = polyDiff(subClosedPolygons, allClipClosedPolygons);
//
//     transforPolygonsEnd(result, modelInfos[0]);
//
//     subSVG.shapes.splice(1);
//     subSVG.shapes[0].paths.splice(0);
//     for (let i = 0; i < result.length; i++) {
//         subSVG.shapes[0].paths.push({
//             closed: true,
//             points: result[i]
//         });
//     }
//     for (let i = 0; i < subOpenPolygons.length; i++) {
//         subSVG.shapes[0].paths.push({
//             closed: false,
//             points: subOpenPolygons[i]
//         });
//     }
//
//     return writeSVG(subSVG, modelInfos[0].uploadName, 0);
// };

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

    transforPolygonsEnd(result0, modelInfos[0]);
    transforPolygonsEnd(result1, modelInfos[1]);

    onProgress && onProgress(0.8);

    svg0.shapes.splice(1);
    svg0.shapes[0].paths.splice(0);
    svg1.shapes.splice(1);
    svg1.shapes[0].paths.splice(0);

    const results = [];

    // if (result0.length > 0) {
    for (let i = 0; i < result0.length; i++) {
        svg0.shapes[0].paths.push({
            closed: true,
            points: result0[i]
        });
    }
    results.push(await writeSVG(svg0, modelInfos[0].modelID, modelInfos[0].uploadName, SVGClippingResultType.Update, 0));
    // } else {
    //     results.push({
    //         modelID: modelInfos[0].modelID,
    //         type: SVGClippingResultType.Delete,
    //     });
    // }

    // if (result1.length > 0) {
    for (let i = 0; i < result1.length; i++) {
        svg1.shapes[0].paths.push({
            closed: true,
            points: result1[i]
        });
    }
    results.push(await writeSVG(svg1, modelInfos[1].modelID, modelInfos[1].uploadName, SVGClippingResultType.Update, 0));
    // } else {
    //     results.push({
    //         modelID: modelInfos[1].modelID,
    //         type: SVGClippingResultType.Delete,
    //     });
    // }

    if (result2.length > 0) {
        const svg2 = createNewSVG(result2);
        results.push(await writeSVG(svg2, '', modelInfos[0].uploadName, SVGClippingResultType.Add, 0));
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
