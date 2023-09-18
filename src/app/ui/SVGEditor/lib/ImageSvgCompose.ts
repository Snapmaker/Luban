import { v4 as uuid } from 'uuid';
import Canvg from 'canvg';
import { createSVGElement, setAttributes } from '../element-utils';
import { NS } from './namespaces';
import SvgModel from '../../../models/SvgModel';

enum SvgImageCombineType {
    mask,
    clipPath
}

interface CombineResult {
    file: File
    viewboxX: number
    viewboxY: number
    viewWidth: number
    viewHeight: number
}

/**
 * Flattens nested <g> elements in an SVG by extracting and applying transformations to <path> elements.
 * @param {SVGSVGElement} svgRoot - The root SVG element to process.
 * @returns {SVGSVGElement} - The modified SVG root element without nested <g> elements.
 */
function flattenNestedGroups(svgRoot: SVGSVGElement | HTMLElement): SVGSVGElement {
    const paths = [];
    /**
     * Extracts <path> elements from a group (<g>) and applies transformation matrices recursively.
     * @param {SVGSVGElement} group - The SVG group element to process.
     * @param {DOMMatrix} currentMatrix - The current transformation matrix.
     */
    function extractPathsFromGroup(group: SVGElement, currentMatrix: DOMMatrix) {
        const children = group.childNodes;

        for (let i = 0; i < children.length; i++) {
            const child = children[i] as SVGAElement;

            if (!child.transform || typeof child.transform.baseVal.consolidate !== 'function') {
                // If it's an element like <text>, clone and add it to the paths array.
                const text = child.cloneNode(true);
                paths.push(text);
            } else if (child.tagName !== 'g') {
                // If it's a <path> element, clone it and apply the transformation matrix.
                const path = child.cloneNode(true);

                // Apply the matrix transformation
                if (currentMatrix) {
                    const childMatrix = child.transform.baseVal.consolidate() ? child.transform.baseVal.consolidate().matrix : document.createElementNS(NS.SVG, 'svg').createSVGMatrix();
                    const combinedMatrix = currentMatrix.multiply(childMatrix);
                    const transformString = `matrix(${combinedMatrix.a}, ${combinedMatrix.b}, ${combinedMatrix.c}, ${combinedMatrix.d}, ${combinedMatrix.e}, ${combinedMatrix.f})`;
                    path.setAttribute('transform', transformString);
                }

                paths.push(path);
            } else {
                // If it's a <g> element, recursively call the function to process its child elements, passing the current transformation matrix.
                const childMatrix = child.transform.baseVal.consolidate() ? child.transform.baseVal.consolidate().matrix : document.createElementNS(NS.SVG, 'svg').createSVGMatrix();
                const combinedMatrix = currentMatrix ? currentMatrix.multiply(childMatrix) : childMatrix;
                extractPathsFromGroup(child, combinedMatrix);
            }
        }
    }

    // Get the initial transformation matrix of the SVG root element.
    const rootMatrix = svgRoot.createSVGMatrix();

    // Extract path elements from the SVG root element.
    extractPathsFromGroup(svgRoot, rootMatrix);

    // Remove all <g> elements from the SVG root.
    const groups = svgRoot.getElementsByTagName('g');
    for (let i = groups.length - 1; i >= 0; i--) {
        const group = groups[i];
        group.parentNode.removeChild(group);
    }

    // Append all <path> elements to the svgRoot element.
    for (const path of paths) {
        svgRoot.appendChild(path);
    }

    return svgRoot;
}

// Helper function to multiply two 2D matrices
const multiplyMatrix = (matrix1, matrix2) => {
    const a = matrix1[0] * matrix2[0] + matrix1[2] * matrix2[1];
    const b = matrix1[1] * matrix2[0] + matrix1[3] * matrix2[1];
    const c = matrix1[0] * matrix2[2] + matrix1[2] * matrix2[3];
    const d = matrix1[1] * matrix2[2] + matrix1[3] * matrix2[3];
    const e = matrix1[0] * matrix2[4] + matrix1[2] * matrix2[5] + matrix1[4];
    const f = matrix1[1] * matrix2[4] + matrix1[3] * matrix2[5] + matrix1[5];

    return [a, b, c, d, e, f];
};
// Helper function to decompose a 2D transformation matrix
const decomposeMatrix = (matrix) => {
    const [a, b, c, d, e, f] = matrix;

    const translateX = e;
    const translateY = f;
    let scaleX, scaleY, skewX, skewY, angle;

    function radToDeg(radia) {
        // Radian to degree.
        return (180 * radia) / Math.PI;
    }
    const Delta = a * d - b * c;
    // Apply the QR-like decomposition.
    // https://frederic-wang.fr/decomposition-of-2d-transform-matrices.html
    if (a !== 0 || b !== 0) {
        const r = Math.sqrt(a * a + b * b);
        angle = radToDeg(b > 0 ? Math.acos(a / r) : -Math.acos(a / r));
        scaleX = r;
        scaleY = Delta / r;
        skewX = radToDeg(Math.atan((a * c + b * d) / (r * r)));
    } else if (c !== 0 || d !== 0) {
        const s = Math.sqrt(c * c + d * d);
        angle = radToDeg(
            Math.PI / 2 - (d > 0 ? Math.acos(-c / s) : -Math.acos(c / s))
        );
        scaleX = Delta / s;
        scaleY = s;
        skewY = radToDeg(Math.atan((a * c + b * d) / (s * s)));
    } else {
        // a = b = c = d = 0
        scaleX = 0;
        scaleY = 0;
    }

    return {
        translateX,
        translateY,
        scaleX,
        scaleY,
        skewX,
        skewY,
        angle,
    };
};
const parseTransform = (transformAttr) => {
    const transformValues = [];
    const regex = /(\w+)\(([^)]+)\)/g;
    let match = regex.exec(transformAttr);

    let matrix = [1, 0, 0, 1, 0, 0]; // Identity matrix

    while (match !== null) {
        const transformType = match[1];
        const transformParams = match[2].split(/[\s,]+/).map(parseFloat);

        if (transformType === 'matrix' && transformParams.length === 6) {
            matrix = multiplyMatrix(matrix, transformParams);
        } else {
            transformValues.push({
                type: transformType,
                params: transformParams,
            });
        }

        match = regex.exec(transformAttr);
    }

    // Convert the matrix back to individual transform attributes
    const { translateX, translateY, scaleX, scaleY, skewX, skewY, angle } = decomposeMatrix(matrix);

    if (translateX !== 0 || translateY !== 0) {
        transformValues.push({
            type: 'translate',
            params: [translateX, translateY],
        });
    }

    if (scaleX !== 1 || scaleY !== 1) {
        transformValues.push({
            type: 'scale',
            params: [scaleX, scaleY],
        });
    }

    if (skewX !== 0) {
        transformValues.push({
            type: 'skewX',
            params: [skewX],
        });
    }

    if (skewY !== 0) {
        transformValues.push({
            type: 'skewY',
            params: [skewY],
        });
    }

    if (angle !== 0) {
        transformValues.push({
            type: 'rotate',
            params: [angle],
        });
    }

    return transformValues;
};

/**
 * Determines whether the provided SVG element is a shape. like \<g\>, \<use\> are not a shape tag in svg
 * @param {Element} svg The SVG element to check.
 * @returns True if the SVG element is a shape, false otherwise.
 */
const isShapeSvg = (svg: Element): boolean => {
    if (!svg || !svg.tagName) return false;
    switch (svg.tagName) {
        case 'rect':
        case 'circle':
        case 'line':
        case 'polyline':
        case 'polygon':
        case 'path':
        case 'text':
        case 'image':
        case 'ellipse':
            return true;
        default:
            return false;
    }
};

/**
 * Converts a canvas element to an image file.
 * @param {HTMLCanvasElement} canvasElm The canvas element to convert.
 * @returns A Promise that resolves to the converted image file.
 */
const canvasToImage = async (canvasElm: HTMLCanvasElement): Promise<File> => {
    window.document.body.appendChild(canvasElm);
    const dataUrl = canvasElm.toDataURL('image/png');
    const p = fetch(dataUrl).then(async (response) => response.blob());
    const b = await p; // (canvasElm);
    const f = new File([b], `${canvasElm.id}.png`);
    window.document.body.removeChild(canvasElm);
    return f;
};

/**
 * Converts an SVG string to a canvas element.
 * @param svgTag The SVG string to convert.
 * @param width The width of the resulting canvas.
 * @param height The height of the resulting canvas.
 * @returns A Promise that resolves to the converted canvas element.
 */
const svgToCanvas = async (
    svgTag: string,
    width: number,
    height: number
): Promise<HTMLCanvasElement> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.id = uuid();
    canvas.style.backgroundColor = 'transparent';
    ctx.fillStyle = 'transparent';

    const v = await Canvg.fromString(ctx, svgTag);
    await v.render();
    return canvas;
};

/**
 * Calculates the bounding box of the given elements.
 * @param elems The elements to calculate the bounding box for.
 * @returns An object representing the bounding box with properties: viewboxX, viewboxY, viewWidth, viewHeight.
 */
const calculateElemsBoundingbox = (
    elems: SvgModel[]
): {
    viewboxX: number;
    viewboxY: number;
    viewWidth: number;
    viewHeight: number;
} => {
    // calculate viewbox value (boundingbox)
    const maxminXY = elems.reduce(
        (pre, curr) => {
            const rotationAngleRad = curr.angle * (Math.PI / 180) || 0;
            const bbox = curr.elem.getBBox();
            const currMaxX = bbox.x + bbox.width;
            const currMaxY = bbox.y + bbox.height;
            const centerX = bbox.x + bbox.width / 2;
            const centerY = bbox.y + bbox.height / 2;

            // 计算旋转后的四个顶点坐标
            const topLeftX = centerX
                + (bbox.x - centerX) * Math.cos(rotationAngleRad)
                - (bbox.y - centerY) * Math.sin(rotationAngleRad);
            const topLeftY = centerY
                + (bbox.x - centerX) * Math.sin(rotationAngleRad)
                + (bbox.y - centerY) * Math.cos(rotationAngleRad);

            const topRightX = centerX
                + (currMaxX - centerX) * Math.cos(rotationAngleRad)
                - (bbox.y - centerY) * Math.sin(rotationAngleRad);
            const topRightY = centerY
                + (currMaxX - centerX) * Math.sin(rotationAngleRad)
                + (bbox.y - centerY) * Math.cos(rotationAngleRad);

            const bottomLeftX = centerX
                + (bbox.x - centerX) * Math.cos(rotationAngleRad)
                - (currMaxY - centerY) * Math.sin(rotationAngleRad);
            const bottomLeftY = centerY
                + (bbox.x - centerX) * Math.sin(rotationAngleRad)
                + (currMaxY - centerY) * Math.cos(rotationAngleRad);

            const bottomRightX = centerX
                + (currMaxX - centerX) * Math.cos(rotationAngleRad)
                - (currMaxY - centerY) * Math.sin(rotationAngleRad);
            const bottomRightY = centerY
                + (currMaxX - centerX) * Math.sin(rotationAngleRad)
                + (currMaxY - centerY) * Math.cos(rotationAngleRad);

            const minX = Math.min(
                pre.min.x,
                topLeftX,
                topRightX,
                bottomLeftX,
                bottomRightX
            );
            const minY = Math.min(
                pre.min.y,
                topLeftY,
                topRightY,
                bottomLeftY,
                bottomRightY
            );
            const maxX = Math.max(
                pre.max.x,
                topLeftX,
                topRightX,
                bottomLeftX,
                bottomRightX
            );
            const maxY = Math.max(
                pre.max.y,
                topLeftY,
                topRightY,
                bottomLeftY,
                bottomRightY
            );
            return {
                max: { x: maxX, y: maxY },
                min: { x: minX, y: minY },
            };
        },
        {
            max: { x: -Infinity, y: -Infinity },
            min: { x: Infinity, y: Infinity },
        }
    );
    const viewboxX = maxminXY.min.x;
    const viewboxY = maxminXY.min.y;
    const viewWidth = maxminXY.max.x - maxminXY.min.x;
    const viewHeight = maxminXY.max.y - maxminXY.min.y;
    return { viewboxX, viewboxY, viewWidth, viewHeight };
};

/**
 * Calculates the scaled bounding box based on the target SVG models and the corresponding images.
 * @param imgs - An array of SVG models representing images.
 * @param targetArr - An array of SVG models representing the target elements.
 * @returns The scaled bounding box dimensions as [x, y, width, height].
 */
const getScaledBoundingBox = (imgs: SvgModel[], targetArr: SvgModel[]) => {
    let { viewboxX, viewboxY, viewWidth, viewHeight } = calculateElemsBoundingbox(targetArr);
    const widthRatio = imgs[0].sourceWidth / imgs[0].width;
    const heightRatio = imgs[0].sourceHeight / imgs[0].height;
    viewboxX *= widthRatio;
    viewboxY *= heightRatio;
    viewWidth *= widthRatio;
    viewHeight *= heightRatio;
    return [viewboxX, viewboxY, viewWidth, viewHeight];
};

/**
* Calculates the combined bounding box based on the SVG models and images, considering the specified combination type.
* @param svgs - An array of SVG models representing elements.
* @param imgs - An array of SVG models representing images.
* @param type - The type of SVG image combination.
* @returns The combined bounding box dimensions as [x, y, width, height].
*/
const getCombineBoundingBox = (svgs: SvgModel[], imgs: SvgModel[], type: SvgImageCombineType) => {
    const [svgsViewboxX, svgsViewboxY, svgsViewWidth, svgsViewHeight] = getScaledBoundingBox(imgs, svgs);
    const [imgsViewboxX, imgsViewboxY, imgsViewWidth, imgsViewHeight] = getScaledBoundingBox(imgs, imgs);
    const [svgsMinX, svgsMinY, svgsMaxX, svgsMaxY] = [svgsViewboxX, svgsViewboxY, svgsViewboxX + svgsViewWidth, svgsViewboxY + svgsViewHeight];
    const [imgsMinX, imgsMinY, imgsMaxX, imgsMaxY] = [imgsViewboxX, imgsViewboxY, imgsViewboxX + imgsViewWidth, imgsViewboxY + imgsViewHeight];

    if (type === SvgImageCombineType.mask) {
        return [imgsViewboxX, imgsViewboxY, imgsViewWidth, imgsViewHeight];
    } else {
        // when use svgs bounding
        // return [svgsViewboxX, svgsViewboxY, svgsViewWidth, svgsViewHeight]
        const targetMinX = Math.max(svgsMinX, imgsMinX);
        const targetMinY = Math.max(svgsMinY, imgsMinY);
        const targetMaxX = Math.min(svgsMaxX, imgsMaxX);
        const targetMaxY = Math.min(svgsMaxY, imgsMaxY);
        return [targetMinX, targetMinY, targetMaxX - targetMinX, targetMaxY - targetMinY];
    }
};

/**
 * Retrieves the scale value based on the element's attribute or bounding box.
 * @param elem The element to retrieve the scale value from.
 * @param type The attribute type to retrieve the scale from (e.g., 'width', 'height').
 * @param ratio The ratio to apply to the scale.
 * @param viewValue The value of current viewbox size.
 * @param originalViewValue The original viewbox size value.
 * @returns The calculated scale value.
 */
const getScale = (
    elem: SVGGraphicsElement,
    type: 'width' | 'height',
    ratio: number,
    viewValue: number,
    originalViewValue: number = 1
): number => {
    if (elem.getAttribute(type)) {
        return (
            (parseFloat(elem.getAttribute(type)) * ratio) / originalViewValue
        );
    } else if (typeof elem.getBBox === 'function') {
        return (elem.getBBox()[type] * ratio) / originalViewValue;
    } else {
        return viewValue / originalViewValue;
    }
};

/**
 * Rotates the given SVG path element by the specified angle around its own center.
 * @param elem The SVG path element to rotate.
 * @param angle The angle (in degrees) to rotate the element.
 */
const rotatePath = (elem: SVGGraphicsElement, angle: number): void => {
    // Helper function for creating a rotation transformation matrix
    function createRotationMatrix(cx: number, cy: number, radianAngle: number) {
        const cos = Math.cos(radianAngle);
        const sin = Math.sin(radianAngle);
        const matrix = elem.ownerSVGElement.createSVGMatrix();
        matrix.a = cos;
        matrix.b = sin;
        matrix.c = -sin;
        matrix.d = cos;
        matrix.e = (1 - cos) * cx + sin * cy;
        matrix.f = -sin * cx + (1 - cos) * cy;
        return matrix;
    }

    // Get the current transformation matrix of the path element
    let currentMatrix;
    if (elem.transform && elem.transform.baseVal.consolidate()) {
        currentMatrix = elem.transform && elem.transform.baseVal.consolidate().matrix;
    } else {
        currentMatrix = (
            createSVGElement({ element: 'svg', attr: {} }) as SVGSVGElement
        ).createSVGMatrix();
    }

    // Calculate the center coordinates of the path element
    const bbox = elem.getBBox();
    const centerX = bbox.x + bbox.width / 2;
    const centerY = bbox.y + bbox.height / 2;

    // Create a rotation transformation matrix
    const rotationMatrix = createRotationMatrix(
        centerX,
        centerY,
        (angle * Math.PI) / 180
    );

    // Multiply the rotation transformation matrix with the current transformation matrix
    const newMatrix = currentMatrix.multiply(rotationMatrix);

    // Apply the new transformation matrix to the path element's transform attribute
    elem.transform.baseVal.initialize(
        elem.ownerSVGElement.createSVGTransformFromMatrix(newMatrix)
    );
};

/**
 * Creates an SVG element from the SVG string and applies transformations.
 * @param svgString The SVG string to create the SVG element from.
 * @param svg The original SVG element information.
 * @param viewboxX The X-coordinate of the viewbox.
 * @param viewboxY The Y-coordinate of the viewbox.
 * @param viewWidth The width of the viewbox.
 * @param viewHeight The height of the viewbox.
 * @param widthRatio The width ratio for scaling.
 * @param heightRatio The height ratio for scaling.
 * @returns An array of transformed child elements of the created SVG element.
 */
const createSvg = (
    svgString: string,
    svg: SvgModel,
    viewboxX: number,
    viewboxY: number,
    viewWidth: number,
    viewHeight: number,
    widthRatio: number,
    heightRatio: number
): Element[] => {
    const x = (parseFloat(svg.elem.getAttribute('x')) || ((svg.elem.getBBox() && svg.elem.getBBox().x) || 0)) * widthRatio;
    const y = (parseFloat(svg.elem.getAttribute('y')) || ((svg.elem.getBBox() && svg.elem.getBBox().y) || 0)) * heightRatio;
    const svgTransforms = parseTransform(svg.elem.getAttribute('transform'));
    const svgRotate = svgTransforms.find((attr) => attr.type === 'rotate');

    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgElement = svgDoc.documentElement;
    document.body.appendChild(svgElement);

    // create svg
    const g = createSVGElement({
        element: 'g',
        attr: {
            id: `${uuid()}`,
            transform: '',
        },
    }) as SVGGElement;
    let children = Array.from(svgElement.children);
    children.forEach((v) => g.appendChild(v));
    svgElement.appendChild(g);

    rotatePath(g, svgRotate.params[0] || 0);
    flattenNestedGroups(svgElement);
    const [
        originalViewX,
        originalViewY,
        originalViewWidth,
        originalViewHeight,
    ] = svgElement.getAttribute('viewBox').split(/[ ,]+/).map(parseFloat);
    viewWidth = viewWidth || originalViewWidth;
    viewHeight = viewHeight || originalViewHeight;

    const attributes: { transform?: string } = {};
    const scaleWidth = getScale(
        svg.elem,
        'width',
        widthRatio,
        viewWidth,
        originalViewWidth
    );
    const scaleHeight = getScale(
        svg.elem,
        'height',
        heightRatio,
        viewHeight,
        originalViewHeight
    );

    children = Array.from(svgElement.children);
    const combineTranslate = (
        translateValue = 0,
        originalViewBoxValue = 0,
        svgScaleValue = 1,
        currXorYValue = 0
    ) => {
        return (
            (translateValue - originalViewBoxValue) * svgScaleValue
            + currXorYValue
            + 0
        );
    };
    for (let i = 0; i < children.length; i++) {
        const curr = children[i];
        const transformAttrs = parseTransform(curr.getAttribute('transform'));
        // TODO: handle have multi same transforms like "translate(10, 10) rotate(45) translate(20, 20)"
        const translate = transformAttrs.find(
            (attr) => attr.type === 'translate'
        );
        const scale = transformAttrs.find((attr) => attr.type === 'scale');
        const rotate = transformAttrs.find((attr) => attr.type === 'rotate');
        const skewX = transformAttrs.find((attr) => attr.type === 'skewX');
        const skewY = transformAttrs.find((attr) => attr.type === 'skewY');

        // caculate tag finally transform
        const currX = combineTranslate(
            translate && translate.params[0],
            originalViewX,
            scaleWidth,
            x
        );
        const currY = combineTranslate(
            translate && translate.params[1],
            originalViewY,
            scaleHeight,
            y
        );
        const currScaleWidth = scale
            ? scale.params[0] * scaleWidth
            : scaleWidth;
        const currScaleHeight = scale
            ? scale.params[1] * scaleHeight
            : scaleHeight;
        const currRotate = (rotate
                && (currScaleWidth < 0 || currScaleHeight < 0
                    ? -rotate.params[0]
                    : rotate.params[0]))
            || 0;
        const currSkewX = (skewX && skewX.params[0]) || 0;
        const currSkewY = (skewY && skewY.params[0]) || 0;
        attributes.transform = `translate(${currX - viewboxX} ${
            currY - viewboxY
        }) rotate(${currRotate}) scale(${currScaleWidth} ${currScaleHeight}) skewX(${currSkewX}) skewY(${currSkewY})`;
        setAttributes(curr, attributes);
    }
    document.body.removeChild(svgElement);
    return children;
};

/**
 * Retrieves the SVG string for the specified SVG element and converts it to a transformed SVG element.
 * @param svg The SVG element information.
 * @param viewboxX The X-coordinate of the viewbox.
 * @param viewboxY The Y-coordinate of the viewbox.
 * @param viewWidth The width of the viewbox.
 * @param viewHeight The height of the viewbox.
 * @param widthRatio The width ratio for scaling.
 * @param heightRatio The height ratio for scaling.
 * @returns A Promise that resolves to an array of transformed child elements of the created SVG element.
 */
const getSvgString = async (
    svg: any,
    viewboxX: number,
    viewboxY: number,
    viewWidth: number,
    viewHeight: number,
    widthRatio: number,
    heightRatio: number
): Promise<Element[] | void> => {
    const url = svg.resource.originalFile.path;
    return fetch(`${url}`)
        .then(async (response) => response.text())
        .then((svgString) => {
            return createSvg(
                svgString,
                svg,
                viewboxX,
                viewboxY,
                viewWidth,
                viewHeight,
                widthRatio,
                heightRatio
            );
        })
        .catch((error) => {
            console.error('Error:', error);
        });
};

/**
 * Creates an SVG string with the provided elements, masks, and clip paths.
 * @param wrapperElem The wrapper SVG element.
 * @param othersElem Other SVG elements.
 * @param imgsSvgModel The SVG models for the images.
 * @param viewboxX The x-coordinate of the viewbox.
 * @param viewboxY The y-coordinate of the viewbox.
 * @param viewWidth The width of the viewbox.
 * @param viewHeight The height of the viewbox.
 * @param gElem The <g> SVG element.
 * @returns The SVG string.
 */
const createSvgStr = (
    wrapperElem: SVGElement,
    othersElem: Element[],
    imgsSvgModel: SvgModel[],
    viewboxX: number,
    viewboxY: number,
    viewWidth: number,
    viewHeight: number,
    widthRatio: number,
    heightRatio: number,
    gElem?: SVGElement
): string => {
    const wrapperClone = wrapperElem.cloneNode(true);
    const imgsClones = [];
    imgsSvgModel.forEach((img) => {
        const cloneImgElem = img.elem.cloneNode(true) as SVGElement;
        imgsClones.push(cloneImgElem);

        // img's position(left-top) and dimensions, before the img scale
        const originalX = parseFloat(cloneImgElem.getAttribute('x'));
        const originalY = parseFloat(cloneImgElem.getAttribute('y'));
        const originalWidth = parseFloat(cloneImgElem.getAttribute('width'));
        const originalHeight = parseFloat(cloneImgElem.getAttribute('height'));
        const originalTransform = cloneImgElem.getAttribute('transform');

        // img's position(left-top) and dimensions and center position, before the img scale
        const transformedX = originalX * widthRatio;
        const transformedY = originalY * heightRatio;
        const transformedWidth = originalWidth * widthRatio;
        const transformedHeight = originalHeight * heightRatio;
        const transformXCenter = transformedX + transformedWidth / 2;
        const transformYCenter = transformedY + transformedHeight / 2;

        // scale image for keeping img dimensions of pixel.
        cloneImgElem.setAttribute('x', (transformedX - viewboxX).toString());
        cloneImgElem.setAttribute('y', (transformedY - viewboxY).toString());
        cloneImgElem.setAttribute('width', (transformedWidth).toString());
        cloneImgElem.setAttribute('height', (transformedHeight).toString());
        cloneImgElem.removeAttribute('filter');

        // because we will scale img for keeping img dimensions of pixel.
        // so we need to handle img rotate after img scaled.
        // here we remove rotate first and add a rotate, which center is the center after img scale
        cloneImgElem.setAttribute(
            'transform',
            `${originalTransform.replace(/rotate\((.*?)\)/gi, '')} rotate(${
                img.angle
            }, ${transformXCenter - viewboxX} ${transformYCenter - viewboxY})`
        );

        // counteract rotate of image (beacuse the <mask> or <clipPath> will transform base it's host)
        if (img.angle === 0) return;
        const wrapperChildren = Array.from(wrapperClone.children);
        wrapperChildren.forEach((wrapperChildElem, index) => {
            // the firt child of mask elem is a rect as mask layer(a different color background for show specify svg graph)
            if (
                wrapperClone.tagName === 'mask'
                && index === 0
                && wrapperChildElem.tagName === 'rect'
            ) { return; }
            wrapperChildElem.setAttribute(
                'transform',
                `rotate(${-img.angle}, ${transformXCenter - viewboxX} ${
                    transformYCenter - viewboxY
                }) ${wrapperChildElem.getAttribute('transform') || ''}`
            );
        });
    });

    const wrapperSvgContent = new XMLSerializer().serializeToString(
        wrapperClone
    );
    const imgsSvgContent = imgsClones
        .map((imgsClone) => new XMLSerializer().serializeToString(imgsClone))
        .map((v, index) => v.replace(
            /href="(.*?)"/,
            `href="${imgsSvgModel[index].resource.originalFile.path}"`
        ))
        .reduce((pre, curr) => pre + curr, '');
    const otherSvgsContent = othersElem
        .map((el) => new XMLSerializer().serializeToString(el))
        .reduce((pre, curr) => pre + curr, '');

    let gSvgContent = '';
    if (gElem) {
        gSvgContent = new XMLSerializer().serializeToString(gElem);
    }



    // canvgjs need a integer (don't know why)
    const svgTag = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.floor(viewWidth)}" height="${Math.floor(viewHeight)}" viewBox="${0} ${0} ${Math.floor(viewWidth)} ${Math.floor(viewHeight)}">
        ${wrapperSvgContent + gSvgContent + imgsSvgContent + otherSvgsContent}
        </svg>
        `;
    return svgTag;
};

/**
 * Handles the creation of a clip path for SVGs and images.
 * @param svgs The SVGs to handle.
 * @param imgs The images to handle.
 * @param holeSvg default false, finall result need holeSvg or just the part of svgs inside images
 * @returns The SVG string with the clip path applied.
 */
const handleClipPath = async (svgs: SvgModel[], imgs: SvgModel[], holeSvg: boolean = false): Promise<CombineResult> => {
    const [viewboxX, viewboxY, viewWidth, viewHeight] = getCombineBoundingBox(svgs, imgs, SvgImageCombineType.clipPath);
    const widthRatio = imgs[0].sourceWidth / imgs[0].width;
    const heightRatio = imgs[0].sourceHeight / imgs[0].height;
    const elem = createSVGElement({
        element: 'clipPath',
        attr: {
            id: `${uuid()}`,
        },
    }) as SVGClipPathElement;
    const gElem = createSVGElement({
        element: 'g',
        attr: {
            id: `${uuid()}`,
        },
    }) as SVGGElement;
    const othersElem = [];
    for (let i = 0; i < svgs.length; i++) {
        const svgShapeTags = await getSvgString(
            svgs[i],
            viewboxX,
            viewboxY,
            viewWidth,
            viewHeight,
            widthRatio,
            heightRatio
        );
        if (!svgShapeTags) continue;
        svgShapeTags.forEach((svgShapeTag) => {
            !svgShapeTag.hasAttribute('fill')
                && svgShapeTag.setAttribute('fill', 'black');
            !svgShapeTag.hasAttribute('fill-opacity')
                && svgShapeTag.setAttribute('fill-opacity', '0');
            if (isShapeSvg(svgShapeTag)) {
                elem.append(svgShapeTag);
                svgShapeTag.setAttribute('fill-opacity', '1');
                holeSvg && gElem.append(svgShapeTag.cloneNode(true));
            } else {
                othersElem.push(svgShapeTag);
            }
        });
    }
    imgs.forEach((img) => {
        img.elem.removeAttribute('mask');
        img.elem.setAttribute('clip-path', `url(#${elem.id})`);
    });
    // create new Image
    const svgTag = createSvgStr(
        elem,
        othersElem,
        imgs,
        viewboxX,
        viewboxY,
        viewWidth,
        viewHeight,
        widthRatio,
        heightRatio,
        holeSvg ? gElem : undefined // if we need the hole svg
    );

    const canvas = await svgToCanvas(svgTag, viewWidth, viewHeight);
    const img = await canvasToImage(canvas);
    return { file: img, viewboxX, viewboxY, viewWidth, viewHeight };
};

/**
 * Handles the creation of a mask for SVGs and images.
 * @param svgs The SVGs to handle.
 * @param imgs The images to handle.
 * @returns The SVG string with the mask applied.
 */
const handleMask = async (svgs: SvgModel[], imgs: SvgModel[]): Promise<CombineResult> => {
    const [viewboxX, viewboxY, viewWidth, viewHeight] = getCombineBoundingBox(svgs, imgs, SvgImageCombineType.mask);
    const widthRatio = imgs[0].sourceWidth / imgs[0].width;
    const heightRatio = imgs[0].sourceHeight / imgs[0].height;

    // create svg
    const maskElem = createSVGElement({
        element: 'mask',
        attr: {
            id: `${uuid()}`,
            // width: viewWidth,
            // height: viewHeight
        },
    }) as SVGMaskElement;
    const rect = createSVGElement({
        element: 'rect',
        attr: {
            width: '100%',
            height: '100%',
            fill: 'white',
            'fill-opacity': 1,
        },
    });
    const othersElem = [];
    setAttributes(rect, { x: 0, y: 0 });
    maskElem.append(rect);
    for (let i = 0; i < svgs.length; i++) {
        const svgShapeTags = await getSvgString(
            svgs[i],
            viewboxX,
            viewboxY,
            viewWidth,
            viewHeight,
            widthRatio,
            heightRatio
        );
        if (!svgShapeTags) continue;
        svgShapeTags.forEach((svgShapeTag) => {
            // !svgShapeTag.hasAttribute('fill') &&
            svgShapeTag.setAttribute('fill', 'black');
            (!svgShapeTag.hasAttribute('fill-opacity') || svgShapeTag.getAttribute('fill-opacity') === '0')
                && svgShapeTag.setAttribute('fill-opacity', '1');
            if (isShapeSvg(svgShapeTag)) {
                maskElem.append(svgShapeTag);
            } else {
                othersElem.push(svgShapeTag);
            }
        });
    }
    imgs.forEach((img) => {
        img.elem.removeAttribute('clip-path');
        img.elem.setAttribute('mask', `url(#${maskElem.id})`);
    });

    const svgTag = createSvgStr(
        maskElem,
        othersElem,
        imgs,
        viewboxX,
        viewboxY,
        viewWidth,
        viewHeight,
        widthRatio,
        heightRatio,
    );
    const canvas = await svgToCanvas(svgTag, viewWidth, viewHeight);
    const img = await canvasToImage(canvas);
    return { file: img, viewboxX, viewboxY, viewWidth, viewHeight };
};

export {
    handleClipPath,
    handleMask,
    calculateElemsBoundingbox
};
