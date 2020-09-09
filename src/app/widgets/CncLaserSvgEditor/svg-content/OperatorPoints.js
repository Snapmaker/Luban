import { createSVGElement, getBBox } from '../element-utils';
import { transformBox, transformListToTransform, getTransformList, getRotationAngle, transformPoint } from '../element-transform';

const GRIP_RADIUS = 8;

class OperatorPoints {
    constructor(svgFactory) {
        this.svgFactory = svgFactory;
        this.scale = svgFactory.scale;

        this.operatorPointsGroup = null;

        // big box cover all elements
        this.allSelectedElementsBox = createSVGElement({
            element: 'path',
            attr: {
                id: 'selected-elements-box',
                fill: 'none',
                stroke: '#00b7ee',
                'stroke-width': 1 / this.scale,
                'stroke-dasharray': '2, 1',
                style: 'pointer-events:none'
            }
        });

        // small box cover each elem
        this.selectedElements = [];

        // this holds a reference to the grip elements
        this.operatorGripCoords = {
            nw: null,
            n: null,
            ne: null,
            e: null,
            se: null,
            s: null,
            sw: null,
            w: null
        };

        this.operatorGrips = {
            nw: null,
            n: null,
            ne: null,
            e: null,
            se: null,
            s: null,
            sw: null,
            w: null
        };

        this.rotateGripConnector = null;
        this.rotateGrip = null;

        this.initGroup();
    }

    initGroup() {
        this.operatorPointsGroup = createSVGElement({
            element: 'g',
            attr: {
                id: 'operator-points-group'
            }
        });

        this.svgFactory.getRoot().append(this.operatorPointsGroup);
        this.operatorPointsGroup.append(this.allSelectedElementsBox);

        // grips
        for (const dir of Object.keys(this.operatorGrips)) {
            // TODO: cursor
            const grip = createSVGElement({
                element: 'circle',
                attr: {
                    id: `operator-grip-size-${dir}`,
                    fill: '#ffffff',
                    r: GRIP_RADIUS / this.scale,
                    'stroke-width': 2 / this.scale,
                    style: `cursor: ${dir}-resize`,
                    'pointer-events': 'all'
                }
            });
            grip.setAttribute('data-dir', dir);
            grip.setAttribute('data-type', 'resize');
            this.operatorGrips[dir] = grip;
            this.operatorPointsGroup.append(grip);
        }

        this.rotateGripConnector = createSVGElement({
            element: 'line',
            attr: {
                id: 'operator-grip-rotate-connector',
                stroke: '#00b7ee',
                'stroke-width': 1 / this.scale
            }
        });

        this.rotateGrip = createSVGElement({
            element: 'circle',
            attr: {
                id: 'operator-grip-rotate',
                fill: '#00b7ee',
                r: GRIP_RADIUS / this.scale,
                'stroke-width': 2 / this.scale,
                style: 'cursor:url(../../images/rotate.png) 12 12, auto;'
            }
        });
        this.rotateGrip.setAttribute('data-type', 'rotate');

        this.operatorPointsGroup.append(this.rotateGripConnector);
        this.operatorPointsGroup.append(this.rotateGrip);
    }

    updateScale(scale) { // just change the engineer scale
        this.scale = scale;
        this.rotateGripConnector.setAttribute('stroke-width', 1 / this.scale);
        const ny = this.rotateGripConnector.getAttribute('y1');
        this.rotateGripConnector.setAttribute('y2', ny - GRIP_RADIUS * 9.4 / this.scale);
        this.rotateGrip.setAttribute('cy', ny - GRIP_RADIUS * 9.4 / this.scale);
        this.rotateGrip.setAttribute('r', GRIP_RADIUS / this.scale);
        this.rotateGrip.setAttribute('stroke-width', 2 / this.scale);
        for (const dir of Object.keys(this.operatorGrips)) {
            const grip = this.operatorGrips[dir];
            grip.setAttribute('r', GRIP_RADIUS / this.scale);
            grip.setAttribute('stroke-width', 2 / this.scale);
        }
    }

    getAllSelectedElementsBox() {
        return this.allSelectedElementsBox;
    }

    showGrips(show) {
        this.operatorPointsGroup.setAttribute('display', show ? 'inline' : 'none');
    }

    resetTransformList() {
        this.operatorPointsGroup.setAttribute('transform', 'translate(0,0)');
        this.operatorPointsGroup.transform.baseVal.clear();
    }

    // setTransformList(transform) {
    //     this.operatorPointsGroup.transform.baseVal = transform;
    // }

    // updateTransformByTransformation(transformation) {
    //     // const { positionX, positionY, rotationZ, scaleX, scaleY, flip } = this.relatedModel.transformation;
    //     const transformList = this.operatorPointsGroup.transform.baseVal;
    //     transformList.clear();
    //     const size = this.svgFactory.svgModelGroup.size;
    //     function pointModelToSvg({ x, y }) {
    //         return { x: size.x + x, y: size.y - y };
    //     }
    //     const { positionX, positionY, rotationZ, scaleX, scaleY, flip } = transformation;
    //     const center = pointModelToSvg({ x: positionX, y: positionY });
    //
    //     const translateOrigin = this.svgFactory.svgContent.createSVGTransform();
    //     translateOrigin.tag = 'translateOrigin';
    //     translateOrigin.setTranslate(-center.x, -center.y);
    //     transformList.insertItemBefore(translateOrigin, 0);
    //
    //     const scale = this.svgFactory.svgContent.createSVGTransform();
    //     scale.tag = 'scale';
    //     scale.setScale(scaleX * ((flip & 2) ? -1 : 1), scaleY * ((flip & 1) ? -1 : 1));
    //     transformList.insertItemBefore(scale, 0);
    //
    //     const rotate = this.svgFactory.svgContent.createSVGTransform();
    //     rotate.tag = 'rotate';
    //     rotate.setRotate(-rotationZ / Math.PI * 180, 0, 0);
    //     transformList.insertItemBefore(rotate, 0);
    //
    //     const translateBack = this.svgFactory.svgContent.createSVGTransform();
    //     translateBack.setTranslate(center.x, center.y);
    //     transformList.insertItemBefore(translateBack, 0);
    //     transformList.getItem(0).tag = 'translateBack';
    // }

    removeGrips() {
    }

    getCenterPoint() {
        return {
            x: this.operatorGripCoords.nw[0] + this.operatorGripCoords.se[0] / 2,
            y: this.operatorGripCoords.nw[1] + this.operatorGripCoords.se[1] / 2
        };
    }

    resizeGrips2(elements) {
        if (!elements || elements.length === 0) {
            return;
        }

        let bBox, box, minX, maxX, minY, maxY;
        // Calculate the bounding
        if (elements.length === 1) {
            bBox = elements[0].getBBox();
            box = bBox;
            minX = box.x;
            maxX = box.x + box.width;
            minY = box.y;
            maxY = box.y + box.height;
            // todo set transform list from the only selected element
            // this.setTransformList(getTransformList(elements[0]));
        } else {
            bBox = elements[0].getBBox();
            box = transformBox(bBox.x, bBox.y, bBox.width, bBox.height, transformListToTransform(elements[0].transform.baseVal).matrix);
            minX = box.x;
            maxX = box.x + box.width;
            minY = box.y;
            maxY = box.y + box.height;
            for (const element of elements) {
                bBox = element.getBBox();
                box = transformBox(bBox.x, bBox.y, bBox.width, bBox.height, transformListToTransform(element.transform.baseVal).matrix);
                minX = Math.min(minX, box.x);
                maxX = Math.max(maxX, box.x + box.width);
                minY = Math.min(minY, box.y);
                maxY = Math.max(maxY, box.y + box.height);

                // set small box cover each elem
                // const elemDstr = `M${box.x},${box.y}
                //     L${box.x + box.width},${box.y}
                //     L${box.x + box.width},${box.y + box.height}
                //     L${box},${box.y + box.height} z`;
                // const elemBox = createSVGElement({
                //     element: 'path',
                //     attr: {
                //         id: 'selected-elements-box',
                //         fill: 'none',
                //         stroke: '#00b7ee',
                //         'stroke-width': 1 / this.scale,
                //         'stroke-dasharray': '2, 1',
                //         style: 'pointer-events:none'
                //     }
                // });
                // elemBox.setAttribute('d', elemDstr);
                // this.operatorPointsGroup.append(elemBox);
            }
            this.resetTransformList();
            this.operatorPointsGroup.setAttribute('transform', 'translate(0,0)');
        }


        // set 8 points for resize
        this.operatorGripCoords = {
            nw: [minX, minY],
            ne: [maxX, minY],
            sw: [minX, maxY],
            se: [maxX, maxY],
            n: [(minX + maxX) / 2, minY],
            s: [(minX + maxX) / 2, maxY],
            w: [minX, (minY + maxY) / 2],
            e: [maxX, (minY + maxY) / 2]
        };
        Object.entries(this.operatorGripCoords).forEach(([dir, coords]) => {
            const grip = this.operatorGrips[dir];
            grip.setAttribute('cx', coords[0]);
            grip.setAttribute('cy', coords[1]);
        });
        // set rotation point
        this.rotateGripConnector.setAttribute('x1', (minX + maxX) / 2);
        this.rotateGripConnector.setAttribute('y1', minY);
        this.rotateGripConnector.setAttribute('x2', (minX + maxX) / 2);
        this.rotateGripConnector.setAttribute('y2', minY - GRIP_RADIUS * 9.4 / this.scale);
        this.rotateGrip.setAttribute('cx', (minX + maxX) / 2);
        this.rotateGrip.setAttribute('cy', minY - GRIP_RADIUS * 9.4 / this.scale);
        // resize line box
        const dstr = `M${minX},${minY}
        L${maxX},${minY}
        L${maxX},${maxY}
        L${minX},${maxY} z`;
        this.allSelectedElementsBox.setAttribute('d', dstr);
    }

    getElementBBoxAndRotation(element) {
        let offset = 0 / this.scale;
        if (element.getAttribute('stroke') !== 'none') {
            const strokeWidth = parseFloat(element.getAttribute('stroke-width')) || 0;
            offset += strokeWidth / 2;
        }
        const bbox = getBBox(element);
        const x = bbox.x, y = bbox.y, w = bbox.width, h = bbox.height;
        const transformList = getTransformList(element);
        const transform = transformListToTransform(transformList);
        const transformedBox = transformBox(x, y, w, h, transform.matrix);
        let nx = transformedBox.x - offset;
        let ny = transformedBox.y - offset;
        let nw = transformedBox.width + offset * 2;
        let nh = transformedBox.height + offset * 2;
        const angle = getRotationAngle(element);
        const cx = nx + nw / 2, cy = ny + nh / 2;
        // rotate back to angle = 0
        // then rotate to element's rotation angle
        // because it show calculate for the offset
        if (angle) {
            const rotate = this.svgFactory.getRoot().createSVGTransform();
            rotate.setRotate(-angle, cx, cy);
            const rm = rotate.matrix;
            const { tl, tr, bl, br } = transformedBox;
            const nbox = {};
            nbox.tl = transformPoint(tl, rm);
            nbox.tr = transformPoint(tr, rm);
            nbox.bl = transformPoint(bl, rm);
            nbox.br = transformPoint(br, rm);
            const minx = Math.min(nbox.tl.x, Math.min(nbox.tr.x, Math.min(nbox.bl.x, nbox.br.x))) - offset;
            const miny = Math.min(nbox.tl.y, Math.min(nbox.tr.y, Math.min(nbox.bl.y, nbox.br.y))) - offset;
            const maxx = Math.max(nbox.tl.x, Math.max(nbox.tr.x, Math.max(nbox.bl.x, nbox.br.x))) + offset;
            const maxy = Math.max(nbox.tl.y, Math.max(nbox.tr.y, Math.max(nbox.bl.y, nbox.br.y))) + offset;
            nx = minx;
            ny = miny;
            nw = (maxx - minx);
            nh = (maxy - miny);

            // todo draw each element box
            // console.log('resize', nx, ny, nx + nw, ny + nh);
            // const dstr = `M${nx},${ny}
            // L${nx + nw},${ny}
            // L${nx + nw},${ny + nh}
            // L${nx},${ny + nh} z`;
            // rect.setAttribute('d', dstr);
            //
            // const xform = angle ? `rotate(${[angle, cx, cy].join(',')})` : '';
            // this.operatorPointsGroup.setAttribute('transform', xform);
        }
        return {
            nx, ny, nw, nh, angle, cx, cy
        };
    }

    resizeGrips(elements) {
        if (!elements || elements.length === 0) {
            return;
        }

        const rect = this.allSelectedElementsBox;
        // todo add each selected element box

        let element = elements[0];
        let { nx, ny, nw, nh, angle, cx, cy } = this.getElementBBoxAndRotation(element);
        let minX, minY, maxX, maxY;
        if (elements.length === 1) {
            minX = nx;
            minY = ny;
            maxX = nx + nw;
            maxY = ny + nh;
        } else {
            let rotate = this.svgFactory.getRoot().createSVGTransform();
            rotate.setRotate(angle, cx, cy);
            let rm = rotate.matrix;
            let tl = { x: nx, y: ny };
            let tr = { x: nx + nw, y: ny };
            let bl = { x: nx, y: ny + nh };
            let br = { x: nx + nw, y: ny + nh };
            const nbox = {};
            nbox.tl = transformPoint(tl, rm);
            nbox.tr = transformPoint(tr, rm);
            nbox.bl = transformPoint(bl, rm);
            nbox.br = transformPoint(br, rm);
            minX = Math.min(nbox.tl.x, Math.min(nbox.tr.x, Math.min(nbox.bl.x, nbox.br.x)));
            minY = Math.min(nbox.tl.y, Math.min(nbox.tr.y, Math.min(nbox.bl.y, nbox.br.y)));
            maxX = Math.max(nbox.tl.x, Math.max(nbox.tr.x, Math.max(nbox.bl.x, nbox.br.x)));
            maxY = Math.max(nbox.tl.y, Math.max(nbox.tr.y, Math.max(nbox.bl.y, nbox.br.y)));
            for (element of elements) {
                const boxAndRotation = this.getElementBBoxAndRotation(element);
                nx = boxAndRotation.nx;
                ny = boxAndRotation.ny;
                nw = boxAndRotation.nw;
                nh = boxAndRotation.nh;
                angle = boxAndRotation.angle;
                cx = boxAndRotation.cx;
                cy = boxAndRotation.cy;
                rotate = this.svgFactory.getRoot().createSVGTransform();
                rotate.setRotate(angle, cx, cy);
                rm = rotate.matrix;
                tl = { x: nx, y: ny };
                tr = { x: nx + nw, y: ny };
                bl = { x: nx, y: ny + nh };
                br = { x: nx + nw, y: ny + nh };
                nbox.tl = transformPoint(tl, rm);
                nbox.tr = transformPoint(tr, rm);
                nbox.bl = transformPoint(bl, rm);
                nbox.br = transformPoint(br, rm);
                minX = Math.min(minX, Math.min(nbox.tl.x, Math.min(nbox.tr.x, Math.min(nbox.bl.x, nbox.br.x))));
                minY = Math.min(minY, Math.min(nbox.tl.y, Math.min(nbox.tr.y, Math.min(nbox.bl.y, nbox.br.y))));
                maxX = Math.max(maxX, Math.max(nbox.tl.x, Math.max(nbox.tr.x, Math.max(nbox.bl.x, nbox.br.x))));
                maxY = Math.max(maxY, Math.max(nbox.tl.y, Math.max(nbox.tr.y, Math.max(nbox.bl.y, nbox.br.y))));
            }
        }

        const dstr = `M${minX},${minY}
            L${maxX},${minY}
            L${maxX},${maxY}
            L${minX},${maxY} z`;
        rect.setAttribute('d', dstr);
        // todo it will be rotated after resize
        const xform = angle ? `rotate(${[angle, cx, cy].join(',')})` : '';
        this.operatorPointsGroup.setAttribute('transform', xform);

        // recalculate grip coordinates
        this.operatorGripCoords = {
            nw: [minX, minY],
            ne: [maxX, minY],
            sw: [minX, maxY],
            se: [maxX, maxY],
            n: [(minX + maxX) / 2, minY],
            w: [minX, (minY + maxY) / 2],
            e: [maxX, (minY + maxY) / 2],
            s: [(minX + maxX) / 2, maxY]
        };

        Object.entries(this.operatorGripCoords).forEach(([dir, coords]) => {
            const grip = this.operatorGrips[dir];
            grip.setAttribute('cx', coords[0]);
            grip.setAttribute('cy', coords[1]);
        });
        this.rotateGripConnector.setAttribute('x1', (minX + maxX) / 2);
        this.rotateGripConnector.setAttribute('y1', minY);
        this.rotateGripConnector.setAttribute('x2', (minX + maxX) / 2);
        this.rotateGripConnector.setAttribute('y2', minY - GRIP_RADIUS * 9.4 / this.scale);
        this.rotateGrip.setAttribute('cx', (minX + maxX) / 2);
        this.rotateGrip.setAttribute('cy', minY - GRIP_RADIUS * 9.4 / this.scale);
    }

    // todo merge into resize grips
    resizeGripsOnElementResize(element) {
        const rect = this.allSelectedElementsBox;

        const { nx, ny, nw, nh, angle, cx, cy } = this.getElementBBoxAndRotation(element);

        const dstr = `M${nx},${ny}
            L${nx + nw},${ny}
            L${nx + nw},${ny + nh}
            L${nx},${ny + nh} z`;

        rect.setAttribute('d', dstr);

        const xform = angle ? `rotate(${[angle, cx, cy].join(',')})` : '';
        this.operatorPointsGroup.setAttribute('transform', xform);

        // recalculate grip coordinates
        this.operatorGripCoords = {
            nw: [nx, ny],
            ne: [nx + nw, ny],
            sw: [nx, ny + nh],
            se: [nx + nw, ny + nh],
            n: [nx + (nw) / 2, ny],
            w: [nx, ny + (nh) / 2],
            e: [nx + nw, ny + (nh) / 2],
            s: [nx + (nw) / 2, ny + nh]
        };

        Object.entries(this.operatorGripCoords).forEach(([dir, coords]) => {
            const grip = this.operatorGrips[dir];
            grip.setAttribute('cx', coords[0]);
            grip.setAttribute('cy', coords[1]);
        });
        this.rotateGripConnector.setAttribute('x1', nx + nw / 2);
        this.rotateGripConnector.setAttribute('y1', ny);
        this.rotateGripConnector.setAttribute('x2', nx + nw / 2);
        this.rotateGripConnector.setAttribute('y2', ny - GRIP_RADIUS * 9.4 / this.scale);
        this.rotateGrip.setAttribute('cx', nx + nw / 2);
        this.rotateGrip.setAttribute('cy', ny - GRIP_RADIUS * 9.4 / this.scale);
    }

    getSelectedElementBBox() {
        return this.operatorPointsGroup.getBBox();
    }
}

export default OperatorPoints;
