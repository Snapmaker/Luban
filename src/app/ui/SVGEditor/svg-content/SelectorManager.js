import uuid from 'uuid';
import { createSVGElement, getBBox } from '../element-utils';
import {
    transformBox,
    getTransformList,
    getRotationAngle, transformListToTransform, transformPoint
} from '../element-transform';

const GRIP_RADIUS = 8;

class Selector {
    constructor(manager, svgFactory, element, bbox) {
        // this.svgFactory = svgFactory;
        this.manager = manager;
        this.id = uuid.v4();

        this.element = element;

        this.selectorGroup = createSVGElement({
            element: 'g',
            attr: {
                id: `selector-group-${this.id}`
            }
        });

        this.selectorRect = createSVGElement({
            element: 'path',
            attr: {
                id: `selector-box-${this.id}`,
                fill: 'none',
                stroke: '#00b7ee',
                'stroke-width': 1 / this.manager.scale,
                'stroke-dasharray': '2, 1',
                style: 'pointer-events:none'
            }
        });
        this.selectorGroup.append(this.selectorRect);

        this.gripCoords = {
            nw: null,
            n: null,
            ne: null,
            e: null,
            se: null,
            s: null,
            sw: null,
            w: null
        };

        this.resize(bbox);
    }

    showGrips(show) {
        this.manager.selectorGripsGroup.setAttribute('display', show ? 'inline' : 'none');

        if (this.element && show) {
            this.selectorGroup.append(this.manager.selectorGripsGroup);
        }
    }

    updateScale(scale) {
        this.selectorRect.setAttribute('stroke-width', 1 / scale);
    }

    resize(bbox) {
        const rect = this.selectorRect;
        let offset = 0 / this.manager.scale;
        if (this.element.getAttribute('stroke') !== 'none') {
            const strokeWidth = parseFloat(this.element.getAttribute('stroke-width')) || 0;
            offset += strokeWidth / 2;
        }

        if (!bbox) {
            bbox = getBBox(this.element);
        }

        // (x,y) = topLeft, before matrix, before offset
        const x = bbox.x, y = bbox.y, w = bbox.width, h = bbox.height;

        const transformList = getTransformList(this.element);

        const transform = transformListToTransform(transformList);

        // four points of conner, after matrix, before offset
        const transformedBox = transformBox(x, y, w, h, transform.matrix);

        let nx = transformedBox.x - offset;
        let ny = transformedBox.y - offset;
        let nw = transformedBox.width + offset * 2;
        let nh = transformedBox.height + offset * 2;

        const angle = getRotationAngle(this.element);
        const cx = nx + nw / 2, cy = ny + nh / 2;
        if (angle) {
            const rotate = this.manager.svgFactory.getRoot().createSVGTransform();
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

        const dstr = `M${nx},${ny}
            L${nx + nw},${ny}
            L${nx + nw},${ny + nh}
            L${nx},${ny + nh} z`;

        rect.setAttribute('d', dstr);

        const xform = angle ? `rotate(${[angle, cx, cy].join(',')})` : '';
        this.selectorGroup.setAttribute('transform', xform);

        // recalculate grip coordinates
        this.gripCoords = {
            nw: [nx, ny],
            ne: [nx + nw, ny],
            sw: [nx, ny + nh],
            se: [nx + nw, ny + nh],
            n: [nx + (nw) / 2, ny],
            w: [nx, ny + (nh) / 2],
            e: [nx + nw, ny + (nh) / 2],
            s: [nx + (nw) / 2, ny + nh]
        };

        Object.entries(this.gripCoords).forEach(([dir, coords]) => {
            const grip = this.manager.selectorGrips[dir];
            grip.setAttribute('cx', coords[0]);
            grip.setAttribute('cy', coords[1]);
        });
        this.manager.rotateGripConnector.setAttribute('x1', nx + nw / 2);
        this.manager.rotateGripConnector.setAttribute('y1', ny);
        this.manager.rotateGripConnector.setAttribute('x2', nx + nw / 2);
        this.manager.rotateGripConnector.setAttribute('y2', ny - GRIP_RADIUS * 9.4 / this.manager.scale);
        this.manager.rotateGrip.setAttribute('cx', nx + nw / 2);
        this.manager.rotateGrip.setAttribute('cy', ny - GRIP_RADIUS * 9.4 / this.manager.scale);
    }
}

class SelectorManager {
    constructor(svgFactory) {
        this.svgFactory = svgFactory;
        this.scale = svgFactory.scale;

        this.selectorParentGroup = null;

        // this will hold objects of type Selector (see above)
        this.selectors = [];

        // this holds a map of SVG elements to their Selector object
        this.selectorMap = {};

        // copy from selector
        this.selectorRect = createSVGElement({
            element: 'path',
            attr: {
                id: `selector-box-${this.id}`,
                fill: 'none',
                stroke: '#00b7ee',
                'stroke-width': 1 / this.scale,
                'stroke-dasharray': '2, 1',
                style: 'pointer-events:none'
            }
        });

        // this holds a reference to the grip elements
        this.selectorGrips = {
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
        // selectors
        this.selectorParentGroup = createSVGElement({
            element: 'g',
            attr: {
                id: 'selector-parent-group'
            }
        });

        this.svgFactory.getRoot().append(this.selectorParentGroup);

        // grips
        this.selectorGripsGroup = createSVGElement({
            element: 'g',
            attr: {
                display: 'none'
            }
        });
        for (const dir of Object.keys(this.selectorGrips)) {
            // TODO: cursor
            const grip = createSVGElement({
                element: 'circle',
                attr: {
                    id: `selector-grip-size-${dir}`,
                    fill: '#ffffff',
                    r: GRIP_RADIUS / this.scale,
                    'stroke-width': 2 / this.scale,
                    style: `cursor: ${dir}-resize`,
                    'pointer-events': 'all'
                }
            });
            grip.setAttribute('data-dir', dir);
            grip.setAttribute('data-type', 'resize');
            this.selectorGrips[dir] = grip;
            this.selectorGripsGroup.appendChild(grip);
        }

        this.rotateGripConnector = createSVGElement({
            element: 'line',
            attr: {
                id: 'selector-grip-rotate-connector',
                stroke: '#00b7ee',
                'stroke-width': 1 / this.scale
            }
        });

        this.rotateGrip = createSVGElement({
            element: 'circle',
            attr: {
                id: 'selector-grip-rotate',
                fill: '#00b7ee',
                r: GRIP_RADIUS / this.scale,
                'stroke-width': 2 / this.scale,
                style: 'cursor:url(../../images/rotate.png) 12 12, auto;'
            }
        });
        this.rotateGrip.setAttribute('data-type', 'rotate');

        this.selectorGripsGroup.append(this.rotateGripConnector);
        this.selectorGripsGroup.append(this.rotateGrip);
    }

    updateScale(scale) { // just change the engineer scale
        this.scale = scale;
        this.rotateGripConnector.setAttribute('stroke-width', 1 / this.scale);
        const ny = this.rotateGripConnector.getAttribute('y1');
        this.rotateGripConnector.setAttribute('y2', ny - GRIP_RADIUS * 9.4 / this.scale);
        this.rotateGrip.setAttribute('cy', ny - GRIP_RADIUS * 9.4 / this.scale);
        this.rotateGrip.setAttribute('r', GRIP_RADIUS / this.scale);
        this.rotateGrip.setAttribute('stroke-width', 2 / this.scale);
        for (const dir of Object.keys(this.selectorGrips)) {
            const grip = this.selectorGrips[dir];
            grip.setAttribute('r', GRIP_RADIUS / this.scale);
            grip.setAttribute('stroke-width', 2 / this.scale);
        }
        for (const selector of this.selectors) {
            selector.updateScale(scale);
        }
    }

    // todo
    requestSelector(elem, bbox) { // maybe used in text action and svgContent
        if (this.selectorMap[elem.id]) {
            return this.selectorMap[elem.id];
        }

        const selector = new Selector(this, this.svgFactory, elem, bbox);
        this.selectors.push(selector);
        this.selectorMap[elem.id] = selector;
        this.selectorParentGroup.prepend(selector.selectorGroup);
        return selector;
    }

    // todo
    requestSelectorByElements(elements) {
        this.resize(elements);
    }

    release() {
        for (const selector of this.selectors) {
            selector.showGrips(false);
            selector.selectorGroup.remove();
            this.selectors.splice(this.selectors.indexOf(selector), 1);
        }
    }

    // todo
    releaseSelector(elem) {
        const selector = this.selectorMap[elem.id];
        if (!selector) return;
        selector.showGrips(false);

        delete this.selectorMap[elem.id];

        selector.selectorGroup.remove();

        this.selectors.splice(this.selectors.indexOf(selector), 1);
    }

    // todo
    clearSelectors() {
        for (const selector of this.selectors) {
            selector.selectorGroup.remove();
        }
        this.selectors.splice(0);
    }

    // todo resize for all elements
    // resize(matrix)? resize(transformList)?
    resize(elements) {
        if (elements.length === 1 && this.selectorMap[elements[0].id]) {
            const selector = this.selectorMap[elements[0].id];
            selector.resize();
            return;
        }
        this.selectors = [];
        for (const elem of elements) {
            const selector = new Selector(this, this.svgFactory, elem);
            this.selectors.push(selector);
            this.selectorMap[elem.id] = selector;
            this.selectorParentGroup.prepend(selector.selectorGroup);
        }
    }

    resizeGrips() {
        const bbox = this.getSelectedElementBBox();
        const rect = this.selectorRect;

        const offset = 0 / this.scale;
        // if (this.element.getAttribute('stroke') !== 'none') {
        //     const strokeWidth = parseFloat(this.element.getAttribute('stroke-width')) || 0;
        //     offset += strokeWidth / 2;
        // }

        // (x,y) = topLeft, before matrix, before offset
        const x = bbox.x, y = bbox.y, w = bbox.width, h = bbox.height;

        const transformList = getTransformList(this.selectorParentGroup);

        const transform = transformListToTransform(transformList);

        // four points of conner, after matrix, before offset
        const transformedBox = transformBox(x, y, w, h, transform.matrix);

        let nx = transformedBox.x - offset;
        let ny = transformedBox.y - offset;
        let nw = transformedBox.width + offset * 2;
        let nh = transformedBox.height + offset * 2;

        const angle = getRotationAngle(this.selectorParentGroup);
        const cx = nx + nw / 2, cy = ny + nh / 2;
        if (angle) {
            const rotate = this.manager.svgFactory.getRoot().createSVGTransform();
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

        const dstr = `M${nx},${ny}
            L${nx + nw},${ny}
            L${nx + nw},${ny + nh}
            L${nx},${ny + nh} z`;

        rect.setAttribute('d', dstr);

        const xform = angle ? `rotate(${[angle, cx, cy].join(',')})` : '';
        this.setAttribute('transform', xform);

        // recalculate grip coordinates
        this.gripCoords = {
            nw: [nx, ny],
            ne: [nx + nw, ny],
            sw: [nx, ny + nh],
            se: [nx + nw, ny + nh],
            n: [nx + (nw) / 2, ny],
            w: [nx, ny + (nh) / 2],
            e: [nx + nw, ny + (nh) / 2],
            s: [nx + (nw) / 2, ny + nh]
        };

        Object.entries(this.gripCoords).forEach(([dir, coords]) => {
            const grip = this.selectorGrips[dir];
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
        return this.selectorParentGroup.getBBox();
    }
}

export default SelectorManager;
