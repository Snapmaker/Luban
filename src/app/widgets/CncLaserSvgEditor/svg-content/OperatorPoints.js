import { createSVGElement } from '../element-utils';
import { transformBox, transformListToTransform } from '../element-transform';

const GRIP_RADIUS = 8;

class OperatorPoints {
    constructor(svgFactory) {
        this.svgFactory = svgFactory;
        this.scale = svgFactory.scale;

        this.operatorPointsGroup = null;

        // copy from selector
        this.selectedElementsBox = createSVGElement({
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
        this.operatorPointsGroup.append(this.selectedElementsBox);

        // grips
        for (const dir of Object.keys(this.operatorGrips)) {
            // TODO: cursor
            const grip = createSVGElement({
                element: 'circle',
                attr: {
                    id: `operator-grip-size-${dir}`,
                    // fill: '#ffffff',
                    fill: '#ffff00',
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

    getSelectedElementsBox() {
        return this.selectedElementsBox;
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

    removeGrips() {}

    getCenterPoint() {
        return {
            x: this.operatorGripCoords.nw[0] + this.operatorGripCoords.se[0] / 2,
            y: this.operatorGripCoords.nw[1] + this.operatorGripCoords.se[1] / 2
        };
    }

    resizeGrips(elements) {
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
        this.selectedElementsBox.setAttribute('d', dstr);
    }

    getSelectedElementBBox() {
        return this.operatorPointsGroup.getBBox();
    }
}

export default OperatorPoints;
