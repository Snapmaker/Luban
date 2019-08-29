import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import jQuery from 'jquery';

import {
    NAMESPACES,
    cleanupAttributes,
    setAttributes,
    getBBox,
    toString
} from './element-utils';
import { transformPoint, getTransformList } from './element-transform';
import SelectorManager from './element-select';
import { recalculateDimensions } from './element-recalculate';


const STEP_COUNT = 10;
const THRESHOLD_DIST = 0.8;


function toDecimal(num, d) {
    const pow = 10 ** d;
    return Math.round(num * pow) / pow;
}

// shift event of 'line', the angle is restricted to be 45 by N degree
function snapToAngle(x1, y1, x2, y2) {
    const snap = Math.PI / 4;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    const dist = Math.sqrt(dx * dx + dy * dy);
    const snapAngle = Math.round(angle / snap) * snap;
    return {
        x: x1 + dist * Math.cos(snapAngle),
        y: y1 + dist * Math.sin(snapAngle),
        a: snapAngle
    };
}

class SVGCanvas extends PureComponent {
    static propTypes = {
        className: PropTypes.string
    };

    node = React.createRef();

    mode = 'select';

    currentProperties = {
        fill: '#00B7E9',
        stroke: '#000000',
        strokeWidth: 1,
        opacity: 1
    };

    currentResolution = {
        width: 800,
        height: 600
    };

    // drawing variables
    currentDrawing = {
        started: false,
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 0,
        // control point 1
        controlPointX1: 0,
        controlPointY1: 0,
        // control point 2
        controlPointX2: 0,
        controlPointY2: 0,
        sumDistance: 0,
        freeHand: {
            minX: null,
            minY: null,
            maxX: null,
            maxY: null
        }
    };

    selectedElements = [];

    counter = 0;

    callbacks = {
        'selected': null
    };

    componentDidMount() {
        this.setupSVGContainer();
        this.setupSVGBackground();
        this.setupSVGContent();
        this.setupMouseEvents();
        this.setupSelectorManager();
        this.onResize();
    }

    setupSVGContainer() {
        this.svgContainer = document.createElementNS(NAMESPACES.SVG, 'svg');

        setAttributes(this.svgContainer, {
            width: 800,
            height: 600,
            x: 0,
            y: 0,
            overflow: 'visible',
            xmlns: NAMESPACES.SVG
        });

        this.node.current.append(this.svgContainer);
    }

    setupSVGBackground() {
        this.svgBackground = document.createElementNS(NAMESPACES.SVG, 'svg');

        setAttributes(this.svgBackground, {
            width: 800,
            height: 600,
            x: 0,
            y: 0,
            xmlns: NAMESPACES.SVG
        });

        const rect = document.createElementNS(NAMESPACES.SVG, 'rect');
        setAttributes(rect, {
            width: '100%',
            height: '100%',
            x: 0,
            y: 0,
            fill: '#FFF',
            stroke: '#000',
            'stroke-width': 1,
            style: 'pointer-events: none'
        });
        this.svgBackground.append(rect);

        this.svgContainer.append(this.svgBackground);
    }

    setupSVGContent() {
        // const width = jQuery(this.container).width();
        // const height = jQuery(this.container).height();

        this.svgContent = document.createElementNS(NAMESPACES.SVG, 'svg');

        jQuery(this.svgContent).attr({
            id: 'svg-content',
            width: 800,
            height: 600,
            x: 0,
            y: 0,
            overflow: 'visible',
            xmlns: NAMESPACES.SVG
        });

        this.svgContainer.append(this.svgContent);

        const comment = document.createComment('Created by Snapmakerjs');
        this.svgContent.append(comment);

        this.group = document.createElementNS(NAMESPACES.SVG, 'g');
        this.svgContent.append(this.group);
    }

    setupMouseEvents() {
        this.svgContainer.addEventListener('mousedown', this.onMouseDown, false);
        this.svgContainer.addEventListener('mousemove', this.onMouseMove, false);
        window.addEventListener('mouseup', this.onMouseUp, false);
        window.addEventListener('resize', this.onResize, false);
    }

    setupSelectorManager() {
        const createSVGElement = (data) => this.createSVGElement(data);
        const getRoot = () => this.svgContainer;

        this.selectorManager = new SelectorManager({
            createSVGElement,
            getRoot
        });
    }

    setMode(mode) {
        this.mode = mode;
    }

    setSelectedAttribute(attr, newValue) {
        for (const element of this.selectedElements) {
            element.setAttribute(attr, newValue);
        }
    }

    getMouseTarget = (event) => {
        let target = event.target;

        if (target === this.svgContainer) {
            return this.svgContainer;
        }
        if (target === this.svgContent) {
            return this.svgContainer;
        }
        // TODO: target outside of SVG content

        while (target.parentNode !== this.group) {
            target = target.parentNode;
        }

        return target;
    };

    onMouseDown = (event) => {
        // event.preventDefault();
        const draw = this.currentDrawing;
        const { stroke, strokeWidth, opacity } = this.currentProperties;

        const matrix = this.group.getScreenCTM().inverse();
        const pt = transformPoint(event.pageX, event.pageY, matrix);
        const x = pt.x;
        const y = pt.y;
        const mouseTarget = this.getMouseTarget(event);

        switch (this.mode) {
            case 'select': {
                draw.started = true;
                draw.startX = x;
                draw.startY = y;
                if (mouseTarget !== this.svgContainer) {
                    if (!this.selectedElements.includes(mouseTarget)) {
                        // TODO: deal with shift key (multi-select)
                        this.clearSelection();
                        this.addToSelection([mouseTarget]);
                    }

                    for (const elem of this.selectedElements) {
                        const transformList = getTransformList(elem);

                        // insert a dummy transform so if the element(s) are moved it will have
                        // a transform to use for its translate.
                        const transform = this.svgContainer.createSVGTransform();
                        if (transformList.numberOfItems) {
                            transformList.insertItemBefore(transform, 0);
                        } else {
                            transformList.appendItem(transform);
                        }
                    }
                } else {
                    this.clearSelection();
                }
                break;
            }
            case 'line': {
                draw.started = true;
                draw.startX = x;
                draw.startY = y;
                this.addSVGElement({
                    element: 'line',
                    attr: {
                        x1: x,
                        y1: y,
                        x2: x,
                        y2: y,
                        id: this.getNextId(),
                        stroke,
                        fill: 'none',
                        'stroke-width': strokeWidth,
                        opacity: opacity / 2
                    }
                });
                break;
            }
            case 'rect': {
                draw.started = true;
                draw.startX = x;
                draw.startY = y;
                this.addSVGElement({
                    element: 'rect',
                    attr: {
                        x,
                        y,
                        width: 0,
                        height: 0,
                        id: this.getNextId(),
                        stroke,
                        'stroke-width': strokeWidth,
                        opacity: opacity / 2
                    }
                });
                break;
            }
            case 'circle': {
                draw.started = true;
                this.addSVGElement({
                    element: 'circle',
                    attr: {
                        cx: x,
                        cy: y,
                        r: 0,
                        id: this.getNextId(),
                        stroke,
                        'stroke-width': strokeWidth,
                        opacity: opacity / 2
                    }
                });
                break;
            }
            case 'ellipse': {
                draw.started = true;
                this.addSVGElement({
                    element: 'ellipse',
                    attr: {
                        cx: x,
                        cy: y,
                        rx: 0,
                        ry: 0,
                        id: this.getNextId(),
                        stroke,
                        'stroke-width': strokeWidth,
                        opacity: opacity / 2
                    }
                });
                break;
            }
            case 'fhpath': {
                draw.started = true;
                draw.startX = x;
                draw.startY = y;
                this.addSVGElement({
                    element: 'polyline',
                    attr: {
                        points: `${x},${y} `,
                        id: this.getNextId(),
                        fill: 'none',
                        stroke,
                        'stroke-linecap': 'round',
                        'stroke-width': strokeWidth,
                        style: 'pointer-events:none',
                        opacity: opacity / 2
                    }
                });
                draw.freeHand.minX = x;
                draw.freeHand.minY = y;
                draw.freeHand.maxX = x;
                draw.freeHand.maxY = y;
                break;
            }
            default:
                break;
        }
    };

    onMouseMove = (event) => {
        const draw = this.currentDrawing;
        if (!draw.started) {
            return;
        }

        const matrix = this.group.getScreenCTM().inverse();
        const pt = transformPoint(event.pageX, event.pageY, matrix);
        const x = pt.x;
        const y = pt.y;
        const element = this.findSVGElement(this.getId());

        switch (this.mode) {
            case 'select': {
                if (this.selectedElements.length > 0) {
                    const dx = x - draw.startX;
                    const dy = y - draw.startY;

                    if (dx !== 0 || dy !== 0) {
                        //
                        const elem = this.selectedElements[0];
                        const transformList = getTransformList(elem);

                        const transform = this.svgContainer.createSVGTransform();
                        transform.setTranslate(dx, dy);

                        if (transformList.numberOfItems) {
                            transformList.replaceItem(transform, 0);
                        } else {
                            transformList.appendItem(transform);
                        }
                    }
                }
                break;
            }
            case 'line': {
                const { startX, startY } = draw;

                let x2 = x;
                let y2 = y;
                if (event.shiftKey) {
                    const xya = snapToAngle(startX, startY, x2, y2);
                    x2 = xya.x;
                    y2 = xya.y;
                }
                element.setAttribute('x2', x2);
                element.setAttribute('y2', y2);
                break;
            }
            case 'rect': {
                const { startX, startY } = draw;
                let width = Math.abs(startX - x);
                let height = Math.abs(startY - y);
                let newX = Math.min(startX, x);
                let newY = Math.min(startY, y);
                if (event.shiftKey) {
                    width = Math.max(width, height);
                    height = width;
                    newX = startX < x ? startX : startX - width;
                    newY = startY < y ? startY : startY - height;
                }
                setAttributes(element, {
                    x: newX,
                    y: newY,
                    width,
                    height
                });
                break;
            }
            case 'circle': {
                const cx = element.getAttribute('cx');
                const cy = element.getAttribute('cy');
                const radius = toDecimal(Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)), 2);
                element.setAttribute('r', radius);
                break;
            }
            case 'ellipse': {
                const cx = element.getAttribute('cx');
                const cy = element.getAttribute('cy');
                element.setAttribute('rx', Math.abs(x - cx));
                const ry = Math.abs(event.shiftKey ? (x - cx) : (y - cy));
                element.setAttribute('ry', ry);
                break;
            }
            case 'text': {
                setAttributes(element, {
                    x,
                    y
                }, 1000);
                break;
            }
            case 'fhpath': {
                draw.endX = x;
                draw.endY = y;
                if (draw.controlPointX2 && draw.controlPointY2) {
                    let spline = null;
                    for (let i = 0; i < STEP_COUNT - 1; i++) {
                        spline = this.getBsplinePoint(i / STEP_COUNT);
                        const curX = spline.x;
                        const curY = spline.y;

                        spline = this.getBsplinePoint((i + 1) / STEP_COUNT);
                        const nextX = spline.x;
                        const nextY = spline.y;

                        draw.sumDistance += Math.sqrt((nextX - curX) * (nextX - curX) + (nextY - curY) * (nextY - curY));
                        if (draw.sumDistance > THRESHOLD_DIST) {
                            draw.sumDistance -= THRESHOLD_DIST;
                            const point = this.svgContent.createSVGPoint();
                            point.x = curX;
                            point.y = curY;
                            element.points.appendItem(point);
                        }
                    }
                }
                draw.controlPointX2 = draw.controlPointX1;
                draw.controlPointY2 = draw.controlPointY1;

                draw.controlPointX1 = draw.startX;
                draw.controlPointY1 = draw.startY;

                draw.startX = draw.endX;
                draw.startY = draw.endY;
                break;
            }
            default:
                break;
        }
    };

    onMouseUp = (event) => {
        const draw = this.currentDrawing;
        if (!draw.started) {
            return;
        }
        draw.started = false;
        let element = this.findSVGElement(this.getId());

        let keep = false;
        switch (this.mode) {
            case 'select': {
                if (this.selectedElements.length === 1) {
                    const selectedElement = this.selectedElements[0];
                    this.currentProperties.fill = selectedElement.getAttribute('fill');
                    this.currentProperties.stroke = selectedElement.getAttribute('stroke');
                    this.currentProperties.opacity = selectedElement.getAttribute('opacity');
                }

                // always recalculate dimensions to strip off stray identity transforms
                this.recalculateAllSelectedDimensions();
                return;
            }
            case 'line': {
                const x1 = element.getAttribute('x1');
                const y1 = element.getAttribute('y1');
                const x2 = element.getAttribute('x2');
                const y2 = element.getAttribute('y2');
                keep = (x1 !== x2 || y1 !== y2);
                break;
            }
            case 'rect': {
                const width = Number(element.getAttribute('width'));
                const height = Number(element.getAttribute('height'));
                keep = (width !== 0 && height !== 0);
                break;
            }
            case 'circle': {
                keep = (element.getAttribute('r') !== '0');
                break;
            }
            case 'ellipse': {
                const rx = Number(element.getAttribute('rx'));
                const ry = Number(element.getAttribute('ry'));
                keep = (rx !== 0 && ry !== 0);
                break;
            }
            case 'fhpath': {
                draw.sumDistance = 0;
                draw.controlPointX1 = 0;
                draw.controlPointY1 = 0;
                draw.controlPointX2 = 0;
                draw.controlPointY2 = 0;
                draw.startX = 0;
                draw.startY = 0;
                draw.endX = 0;
                draw.endY = 0;
                const points = (element.getAttribute('points'));
                const commaIndex = points.indexOf(',');
                if (commaIndex >= 0) {
                    keep = points.includes(',', commaIndex + 1);
                } else {
                    keep = points.includes(' ', points.indexOf(' ') + 1);
                }
                if (keep) {
                    element = this.smoothPolylineIntoPath(element);
                }
                break;
            }
            default:
                break;
        }

        if (element) {
            if (keep) {
                element.setAttribute('opacity', this.currentProperties.opacity);

                cleanupAttributes(element);
                this.selectOnly([element]);
            } else {
                element.remove();

                const target = this.getMouseTarget(event);
                if (target !== this.svgContainer) {
                    this.setMode('select');
                    this.selectOnly([target]);
                }
            }
        }
    };

    onResize = () => {
        const $container = jQuery(this.node.current);

        const width = $container.width();
        const height = $container.height();

        this.updateCanvas(width, height);
    };

    getId() {
        return `id${this.counter}`;
    }

    getNextId() {
        this.counter++;
        return `id${this.counter}`;
    }

    getBsplinePoint(t) {
        const { startX, startY, endX, endY, controlPointX1, controlPointY1, controlPointX2, controlPointY2 } = this.currentDrawing;
        const spline = { x: 0, y: 0 };
        const p0 = { x: controlPointX2, y: controlPointY2 };
        const p1 = { x: controlPointX1, y: controlPointY1 };
        const p2 = { x: startX, y: startY };
        const p3 = { x: endX, y: endY };
        const S = 1.0 / 6.0;
        const t2 = t * t;
        const t3 = t2 * t;
        const m = [
            [-1, 3, -3, 1],
            [3, -6, 3, 0],
            [-3, 0, 3, 0],
            [1, 4, 1, 0]
        ];

        spline.x = S * (
            (p0.x * m[0][0] + p1.x * m[0][1] + p2.x * m[0][2] + p3.x * m[0][3]) * t3
            + (p0.x * m[1][0] + p1.x * m[1][1] + p2.x * m[1][2] + p3.x * m[1][3]) * t2
            + (p0.x * m[2][0] + p1.x * m[2][1] + p2.x * m[2][2] + p3.x * m[2][3]) * t
            + (p0.x * m[3][0] + p1.x * m[3][1] + p2.x * m[3][2] + p3.x * m[3][3])
        );

        spline.y = S * (
            (p0.y * m[0][0] + p1.y * m[0][1] + p2.y * m[0][2] + p3.y * m[0][3]) * t3
            + (p0.y * m[1][0] + p1.y * m[1][1] + p2.y * m[1][2] + p3.y * m[1][3]) * t2
            + (p0.y * m[2][0] + p1.y * m[2][1] + p2.y * m[2][2] + p3.y * m[2][3]) * t
            + (p0.y * m[3][0] + p1.y * m[3][1] + p2.y * m[3][2] + p3.y * m[3][3])
        );

        return {
            x: spline.x,
            y: spline.y
        };
    }

    updateCanvas = (width, height) => {
        this.svgContainer.setAttribute('width', width);
        this.svgContainer.setAttribute('height', height);

        const x = (width - this.currentResolution.width) / 2;
        const y = (height - this.currentResolution.height) / 2;

        setAttributes(this.svgContent, {
            width: this.currentResolution.width,
            height: this.currentResolution.height,
            x,
            y,
            viewBox: `0 0 ${this.currentResolution.width} ${this.currentResolution.height}`
        });

        setAttributes(this.svgBackground, {
            width: this.svgContent.getAttribute('width'),
            height: this.svgContent.getAttribute('height'),
            x,
            y
        });

        this.selectorManager.selectorParentGroup.setAttribute('transform', `translate(${x},${y})`);
    };

    // TODO: need refactor and be moved out to a separate module
    smoothPolylineIntoPath(element) {
        let i = 0;
        const points = element.points;
        const N = points.numberOfItems;

        if (N >= 4) {
            // loop through every 3 points and convert to a cubic bezier curve segment
            // NOTE: this is cheating, it means that every 3 points has the potential to
            // be a corner instead of treating each point in an equal manner. In general,
            // this technique does not look that good.
            // Reading:
            // - http://www.efg2.com/Lab/Graphics/Jean-YvesQueinecBezierCurves.htm
            // - https://www.codeproject.com/KB/graphics/BezierSpline.aspx?msg=2956963
            // - https://www.ian-ko.com/ET_GeoWizards/UserGuide/smooth.htm
            // - https://www.cs.mtu.edu/~shene/COURSES/cs3621/NOTES/spline/Bezier/bezier-der.html
            let d = [];
            let curpos = points.getItem(0);
            let prevCtlPt = null;
            d.push(['M', curpos.x, ',', curpos.y, ' C'].join(''));

            for (i = 1; i <= N - 4; i += 3) {
                let ct1 = points.getItem(i);
                const ct2 = points.getItem(i + 1);
                const end = points.getItem(i + 2); // if the previous segment had a control point, we want to smooth out
                // the control points on both sides

                if (prevCtlPt) {
                    const newpts = this.smoothControlPoints(prevCtlPt, ct1, curpos);
                    if (newpts && newpts.length === 2) {
                        const prevArr = d[d.length - 1].split(',');
                        prevArr[2] = newpts[0].x;
                        prevArr[3] = newpts[0].y;
                        d[d.length - 1] = prevArr.join(',');
                        ct1 = newpts[1];
                    }
                }
                d.push([ct1.x, ct1.y, ct2.x, ct2.y, end.x, end.y].join(','));
                curpos = end;
                prevCtlPt = ct2;
            } // handle remaining line segments
            d.push('L');
            while (i < N) {
                const pt = points.getItem(i);
                d.push([pt.x, pt.y].join(','));
                i++;
            }
            d = d.join(' '); // create new path element
            return this.addSVGElement({
                element: 'path',
                attr: {
                    id: this.getId(),
                    d: d,
                    fill: 'none'
                }
            });
        }
        return null;
    }

    // TODO: need refactor and be moved out to a separate module
    smoothControlPoints(ct1, ct2, pt) {
        // each point must not be the origin
        const x1 = ct1.x - pt.x;
        const y1 = ct1.y - pt.y;
        const x2 = ct2.x - pt.x;
        const y2 = ct2.y - pt.y;

        if ((x1 !== 0 || y1 !== 0) && (x2 !== 0 || y2 !== 0)) {
            const r1 = Math.sqrt(x1 * x1 + y1 * y1);
            const r2 = Math.sqrt(x2 * x2 + y2 * y2);
            const nct1 = this.svgContainer.createSVGPoint();
            const nct2 = this.svgContainer.createSVGPoint();
            let anglea = Math.atan2(y1, x1);
            let angleb = Math.atan2(y2, x2);

            if (anglea < 0) {
                anglea += 2 * Math.PI;
            }

            if (angleb < 0) {
                angleb += 2 * Math.PI;
            }

            const angleBetween = Math.abs(anglea - angleb);
            const angleDiff = Math.abs(Math.PI - angleBetween) / 2;
            let newAnglea = null;
            let newAngleb = null;

            if (anglea - angleb > 0) {
                newAnglea = angleBetween < Math.PI ? anglea + angleDiff : anglea - angleDiff;
                newAngleb = angleBetween < Math.PI ? angleb - angleDiff : angleb + angleDiff;
            } else {
                newAnglea = angleBetween < Math.PI ? anglea - angleDiff : anglea + angleDiff;
                newAngleb = angleBetween < Math.PI ? angleb + angleDiff : angleb - angleDiff;
            } // rotate the points


            nct1.x = r1 * Math.cos(newAnglea) + pt.x;
            nct1.y = r1 * Math.sin(newAnglea) + pt.y;
            nct2.x = r2 * Math.cos(newAngleb) + pt.x;
            nct2.y = r2 * Math.sin(newAngleb) + pt.y;
            return [nct1, nct2];
        }

        return undefined;
    }

    recalculateAllSelectedDimensions() {
        for (const elem of this.selectedElements) {
            recalculateDimensions(this.svgContainer, elem);
        }
    }

    findSVGElement(id) {
        return this.svgContent.querySelector(`#${id}`);
    }

    addSVGElement(data) {
        if (data.attr && data.attr.id) {
            const existingElement = this.findSVGElement(data.attr.id);
            if (existingElement && data.element !== existingElement.tagName) {
                existingElement.remove();
            }
        }
        const element = this.createSVGElement(data);
        this.group.append(element);
        return element;
    }

    createSVGElement(data) {
        const element = document.createElementNS(NAMESPACES.SVG, data.element);

        // set attribute
        setAttributes(element, {
            fill: this.currentProperties.fill,
            stroke: this.currentProperties.stroke
        });
        setAttributes(element, data.attr);
        cleanupAttributes(element);

        // add children?
        return element;
    }

    clearSelection() {
        // release selectors
        for (const elem of this.selectedElements) {
            this.selectorManager.releaseSelector(elem);
        }

        this.selectedElements = [];
    }

    addToSelection(elements) {
        for (const elem of elements) {
            const bbox = getBBox(elem);
            if (!bbox) {
                continue;
            }
            if (!this.selectedElements.includes(elem)) {
                this.selectedElements.push(elem);

                this.selectorManager.requestSelector(elem, bbox);
            }
        }
        this.trigger('selected', this.selectedElements);
    }

    selectOnly(elements) {
        this.clearSelection();
        this.addToSelection(elements);
    }

    loadSVGString(xmlString) {
        console.log('load SVG', xmlString);

        // create new document (text2xml)
        // prepare svg
        // remove old svg document
        // set new document
        // re-init drawing
        //
    }

    // convert svg element to string
    svgToString() {
        const out = [];

        const resolution = this.currentResolution;
        out.push('<svg');
        out.push(` width="${resolution.width}" height="${resolution.height}" xmlns="${NAMESPACES.SVG}"`);
        if (this.svgContent.hasChildNodes()) {
            out.push('>');

            for (let i = 0; i < this.svgContent.childNodes.length; i++) {
                const child = this.svgContent.childNodes.item(i);

                const childOutput = toString(child, 1);
                if (childOutput) {
                    out.push('\n');
                    out.push(childOutput);
                }
            }

            out.push('\n');
            out.push('</svg>');
        } else {
            out.push('/>');
        }

        return out.join('');
    }

    on(event, callback) {
        if (['selected'].includes(event)) {
            if (this.callbacks[event] === null) {
                this.callbacks[event] = [];
            }
            this.callbacks[event].push(callback);
        }
    }

    off(event, callback) {
        if (this.callbacks[event] === null) {
            return;
        }

        const index = this.callbacks[event].indexOf(callback);
        if (index !== -1) {
            this.callbacks[event].splice(index, 1);
        }
    }

    trigger(event, ...args) {
        const callbacks = this.callbacks[event];
        if (callbacks && callbacks.length > 0) {
            for (const cb of callbacks) {
                cb(...args);
            }
        }
    }

    render() {
        const { className = '' } = this.props;

        return (
            <div ref={this.node} className={className} />
        );
    }
}

export default SVGCanvas;
