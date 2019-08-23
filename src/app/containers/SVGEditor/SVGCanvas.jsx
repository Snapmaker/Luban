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
import SelectorManager from './element-select';


const STEP_COUNT = 10;
const THRESHOLD_DIST = 0.8;

function transformPoint(x, y, m) {
    return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}

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
        fill: '#FF0000',
        stroke: '#000000',
        strokeDashArray: 'none',
        strokeLineJoin: 'miter',
        strokeLineCap: 'butt',
        strokeWidth: 5,
        strokeOpacity: 1,
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
        // bSpline
        spX: 0,
        spY: 0,
        // next position
        npX: 0,
        npY: 0,
        // controll point 1
        cpX1: 0,
        cpY1: 0,
        // controll point 2
        cpX2: 0,
        cpY2: 0,
        parameter: null,
        nextParameter: null,
        sumDistance: 0,
        freeHand: {
            minX: null,
            minY: null,
            maxX: null,
            maxY: null
        }
    };

    currentText = {
        fill: '#FF0000',
        stroke: '#000000',
        strokeWidth: 5,
        fontSize: 12,
        fontFamily: ''
    };

    selectedElements = [];

    counter = 0;

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
        }).appendTo(this.svgContainer);

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
        const matrix = this.group.getScreenCTM().inverse();

        const pt = transformPoint(event.pageX, event.pageY, matrix);
        const x = pt.x;
        const y = pt.y;
        const mouseTarget = this.getMouseTarget(event);

        switch (this.mode) {
            case 'select': {
                if (mouseTarget !== this.svgContainer) {
                    if (!this.selectedElements.includes(mouseTarget)) {
                        // TODO: deal with shift key (multi-select)
                        this.clearSelection();
                        this.addToSelection([mouseTarget]);
                        console.log('selected', this.selectedElements);
                    }
                } else {
                    this.clearSelection();
                }
                break;
            }
            case 'line': {
                draw.started = true;
                const { stroke, strokeWidth, strokeDashArray, strokeLineJoin,
                    strokeLineCap, strokeOpacity, opacity } = this.currentProperties;
                this.addSVGElement({
                    element: 'line',
                    attr: {
                        x1: x,
                        y1: y,
                        x2: x,
                        y2: y,
                        id: this.getNextId(),
                        stroke,
                        'stroke-width': strokeWidth === 0 ? 1 : strokeWidth,
                        'stroke-dasharray': strokeDashArray,
                        'stroke-linejoin': strokeLineJoin,
                        'stroke-linecap': strokeLineCap,
                        'stroke-opacity': strokeOpacity,
                        fill: 'none',
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
                        opacity: this.currentProperties.opacity / 2
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
                        opacity: this.currentProperties.opacity / 2
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
                        opacity: this.currentProperties.opacity / 2
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
                        'stroke-linecap': 'round',
                        style: 'pointer-events:none',
                        opacity: this.currentProperties.opacity / 2
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
                const radius = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
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
                let sp = null;
                if (draw.cpX2 && draw.cpY2) {
                    for (let i = 0; i < STEP_COUNT - 1; i++) {
                        draw.parameter = i / STEP_COUNT;
                        draw.nextParameter = (i + 1) / STEP_COUNT;
                        sp = this.getBsplinePoint(draw.nextParameter);
                        draw.spX = sp.x;
                        draw.spY = sp.y;
                        draw.npX = sp.x;
                        draw.npY = sp.y;
                        sp = this.getBsplinePoint(draw.parameter);
                        draw.spX = sp.x;
                        draw.spY = sp.y;
                        draw.sumDistance += Math.sqrt((draw.npX - draw.spX) * (draw.npX - draw.spX)
                            + (draw.npY - draw.spY) * (draw.npY - draw.spY));
                        if (draw.sumDistance > THRESHOLD_DIST) {
                            draw.sumDistance -= THRESHOLD_DIST;
                            const point = this.svgContent.createSVGPoint();
                            point.x = draw.spX;
                            point.y = draw.spY;
                            element.points.appendItem(point);
                        }
                    }
                }
                draw.cpX2 = draw.cpX1;
                draw.cpY2 = draw.cpY1;
                draw.cpX1 = draw.startX;
                draw.cpY1 = draw.startY;
                draw.startX = draw.endX;
                draw.startY = draw.endY;
                break;
            }
            default:
                break;
        }
    };

    onMouseUp = () => {
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
                break;
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
                const width = element.getAttribute('width');
                const height = element.getAttribute('height');
                keep = (width && height);
                break;
            }
            case 'circle': {
                keep = (element.getAttribute('r') !== '0');
                break;
            }
            case 'ellipse': {
                const rx = element.getAttribute('rx');
                const ry = element.getAttribute('ry');
                keep = (rx || ry);
                break;
            }
            case 'fhpath': {
                draw.sumDistance = 0;
                draw.cpX1 = 0;
                draw.cpY1 = 0;
                draw.cpX2 = 0;
                draw.cpY2 = 0;
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

        if (keep) {
            element.setAttribute('opacity', this.currentProperties.opacity);

            cleanupAttributes(element);
            this.selectOnly([element]);
        } else {
            element.remove();
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
        const { startX, startY, endX, endY, cpX1, cpY1, cpX2, cpY2 } = this.currentDrawing;
        const spline = { x: 0, y: 0 };
        const p0 = { x: cpX2, y: cpY2 };
        const p1 = { x: cpX1, y: cpY1 };
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
            element = this.addSVGElement({
                element: 'path',
                attr: {
                    id: this.getId(),
                    d: d,
                    fill: 'none'
                }
            });
        }
        return element;
    }

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


    findSVGElement(id) {
        return this.svgContent.querySelector(`#${id}`);
    }

    addSVGElement(data) {
        const element = this.createSVGElement(data);
        this.group.append(element);
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
    }

    selectOnly(elements) {
        this.clearSelection();
        this.addToSelection(elements);
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

    render() {
        const { className = '' } = this.props;

        return (
            <div ref={this.node} className={className} />
        );
    }
}

export default SVGCanvas;
