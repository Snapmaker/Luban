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
        // this.selectedElementsBox = [];

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
        if (this.selectedElementsBox) {
            for (const elemRect of this.selectedElementsBox) {
                elemRect.remove();
            }
        }
        this.selectedElementsBox = [];

        this.operatorPointsGroup = createSVGElement({
            element: 'g',
            attr: {
                id: 'operator-points-group'
            }
        });
        this.resetTransformList();

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
        this.showGrips(false);
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
        this.showResizeAndRotateGripsAndBox(show);
    }

    showResizeGrips(show) {
        Object.entries(this.operatorGripCoords).forEach(([dir]) => {
            const grip = this.operatorGrips[dir];
            grip.setAttribute('display', show ? 'inline' : 'none');
        });
    }

    showRotateGrips(show) {
        this.rotateGripConnector.setAttribute('display', show ? 'inline' : 'none');
        this.rotateGrip.setAttribute('display', show ? 'inline' : 'none');
    }

    showBox(show) {
        this.allSelectedElementsBox.setAttribute('display', show ? 'inline' : 'none');
    }

    showResizeAndRotateGrips(show) {
        this.showResizeGrips(show);
        this.showRotateGrips(show);
    }

    showResizeAndRotateGripsAndBox(show) {
        this.showResizeGrips(show);
        this.showRotateGrips(show);
        this.showBox(show);
    }

    resetTransformList() {
        this.operatorPointsGroup.setAttribute('transform', 'translate(0,0)');
        this.operatorPointsGroup.transform.baseVal.clear();
    }

    getCenterPoint() {
        return {
            x: (this.operatorGripCoords.nw[0] + this.operatorGripCoords.se[0]) / 2,
            y: (this.operatorGripCoords.nw[1] + this.operatorGripCoords.se[1]) / 2
        };
    }

    _getElementBBoxAndRotation(element) {
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
        }
        return {
            nx, ny, nw, nh, angle, cx, cy
        };
    }

    resizeGrips(elements) {
        for (const elemRect of this.selectedElementsBox) {
            elemRect.remove();
        }
        this.selectedElementsBox = [];
        if (!elements || elements.length === 0) {
            this.showGrips(false);
            return {
                positionX: 0,
                positionY: 0,
                width: 0,
                height: 0
            };
        }

        const rect = this.allSelectedElementsBox;
        // todo add each selected element box

        let element = elements[0];
        let { nx, ny, nw, nh, angle, cx, cy } = this._getElementBBoxAndRotation(element);
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
                const boxAndRotation = this._getElementBBoxAndRotation(element);
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

                const elemRect = createSVGElement({
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
                const dstr = `M${nbox.tl.x},${nbox.tl.y}
                    L${nbox.tr.x},${nbox.tr.y}
                    L${nbox.br.x},${nbox.br.y}
                    L${nbox.bl.x},${nbox.bl.y} z`;
                elemRect.setAttribute('d', dstr);
                this.selectedElementsBox.push(elemRect);
                this.operatorPointsGroup.append(elemRect);
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
            grip.setAttribute('display', ((elements.length === 1) ? 'inline' : 'none'));
        });

        this.rotateGripConnector.setAttribute('x1', (minX + maxX) / 2);
        this.rotateGripConnector.setAttribute('y1', minY);
        this.rotateGripConnector.setAttribute('x2', (minX + maxX) / 2);
        this.rotateGripConnector.setAttribute('y2', minY - GRIP_RADIUS * 9.4 / this.scale);
        this.rotateGrip.setAttribute('cx', (minX + maxX) / 2);
        this.rotateGrip.setAttribute('cy', minY - GRIP_RADIUS * 9.4 / this.scale);

        // todo, save the infomation
        return {
            positionX: (minX + maxX) / 2,
            positionY: (minY + maxY) / 2,
            width: maxX - minX,
            height: maxY - minY
        };
    }
}

export default OperatorPoints;
