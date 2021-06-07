import includes from 'lodash/includes';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import jQuery from 'jquery';

import { NS } from './lib/namespaces';
import {
    cleanupAttributes,
    setAttributes,
    getBBox
} from './element-utils';
import {
    transformPoint,
    getTransformList
    // getRotationAngle, hasMatrixTransform
} from './element-transform';
import { recalculateDimensions } from './element-recalculate';
import sanitize from './lib/sanitize';
import PrintableArea from './PrintableArea';
import {
    DATA_PREFIX
} from '../../constants';
import SVGContentGroup from './svg-content/SVGContentGroup';
import { library } from './lib/ext-shapes';
import TextAction from './TextActions';
import { DEFAULT_FILL_COLOR, DEFAULT_SCALE, SCALE_RATE, SVG_EVENT_CONTEXTMENU, SVG_EVENT_MODE } from './constants';

const STEP_COUNT = 10;
const THRESHOLD_DIST = 0.8;
const ZOOM_RATE = 2.15;

const visElems = 'a,circle,ellipse,foreignObject,g,image,line,path,polygon,polyline,rect,svg,text,tspan,use'.split(',');

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

const CURRENTDRAWING_INIT = {
    started: false,
    startX: 0,
    startY: 0,
    scaleX: 0,
    scaleY: 0,
    endX: 0,
    endY: 0,
    bbox: {},
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

class SVGCanvas extends PureComponent {
    static propTypes = {
        className: PropTypes.string,
        size: PropTypes.object,
        coordinateMode: PropTypes.object.isRequired,
        coordinateSize: PropTypes.object.isRequired,

        onCreateElement: PropTypes.func.isRequired,
        onSelectElements: PropTypes.func.isRequired,
        onClearSelection: PropTypes.func.isRequired,
        onMoveSelectedElementsByKey: PropTypes.func.isRequired,
        getSelectedElementsUniformScalingState: PropTypes.func.isRequired,

        elementActions: PropTypes.shape({
            moveElementsStart: PropTypes.func.isRequired,
            moveElements: PropTypes.func.isRequired,
            moveElementsFinish: PropTypes.func.isRequired,
            resizeElementsStart: PropTypes.func.isRequired,
            resizeElements: PropTypes.func.isRequired,
            resizeElementsFinish: PropTypes.func.isRequired,
            rotateElementsStart: PropTypes.func.isRequired,
            rotateElements: PropTypes.func.isRequired,
            rotateElementsFinish: PropTypes.func.isRequired
        }).isRequired,

        // TODO: remove it, to flux (for textActions)
        SVGActions: PropTypes.object,

        scale: PropTypes.number.isRequired,
        minScale: PropTypes.number,
        maxScale: PropTypes.number,
        target: PropTypes.object,
        updateScale: PropTypes.func.isRequired,
        updateTarget: PropTypes.func.isRequired,
        materials: PropTypes.object,
        editable: PropTypes.bool.isRequired
    };

    updateTime = 0;

    // scale = DEFAULT_SCALE;

    target = null;

    offsetX = 0;

    offsetY = 0;

    printableArea = null;

    node = React.createRef();

    input = React.createRef();

    mode = 'select';

    extShape = null;

    currentProperties = {
        // fill: '#00B7E9',
        fill: DEFAULT_FILL_COLOR,
        stroke: '#000000',
        strokeWidth: 1 / this.scale,
        opacity: 1
    };

    // drawing variables
    currentDrawing = {};

    // selectedElements = [];

    counter = 0;

    callbacks = {};

    componentDidMount() {
        this.setupSVGContainer();
        this.setupSVGBackground();
        this.setupSVGContent();
        this.setupMouseEvents();
        this.setupKeyEvents();
        this.setupPrintableArea();
        this.onResize();
        this.setupTextActions();
        window.addEventListener('resize', this.onResize, false);
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.scale !== this.lastScale) {
            // Updates from outsider
            this.lastScale = nextProps.scale;
            this.updateCanvas();
        }

        if (nextProps.target && nextProps.target !== this.target) {
            this.offsetX = -nextProps.target.x;
            this.offsetY = nextProps.target.y;

            this.updateCanvas();
        }

        if (nextProps.size !== this.props.size) {
            this.updateCanvas(nextProps.size);
        }
        if (nextProps.materials !== this.props.materials) {
            this.updateCanvas(null, nextProps.materials);
        }
        if (nextProps.coordinateMode !== this.props.coordinateMode
            || nextProps.coordinateSize !== this.props.coordinateSize) {
            this.printableArea.updateCoordinateMode(nextProps.coordinateMode, nextProps.coordinateSize);

            const { coordinateSize, coordinateMode } = this.props;
            const coorDelta = {
                dx: 0,
                dy: 0
            };
            coorDelta.dx += coordinateSize.x / 2 * coordinateMode.setting.sizeMultiplyFactor.x;
            coorDelta.dy -= coordinateSize.y / 2 * coordinateMode.setting.sizeMultiplyFactor.y;

            coorDelta.dx -= nextProps.coordinateSize.x / 2 * nextProps.coordinateMode.setting.sizeMultiplyFactor.x;
            coorDelta.dy += nextProps.coordinateSize.y / 2 * nextProps.coordinateMode.setting.sizeMultiplyFactor.y;

            this.offsetX += coorDelta.dx / 1.5;
            this.offsetY += coorDelta.dy / 1.5;
            this.target = { x: -this.offsetX, y: this.offsetY };
            this.props.updateTarget(this.target);
            this.updateCanvas(null, nextProps.materials);
        }
    }


    get scale() {
        return (this.lastScale || this.props.scale) * DEFAULT_SCALE / ZOOM_RATE;
    }

    set scale(val) {
        this.lastScale = val / DEFAULT_SCALE * ZOOM_RATE;
        // Notify scale updates, this method should be named `onScaleUpdated`
        if (this.props.minScale && this.lastScale < this.props.minScale) {
            this.lastScale = this.props.minScale;
        }
        if (this.props.maxScale && this.lastScale > this.props.maxScale) {
            this.lastScale = this.props.maxScale;
        }
        this.props.updateScale(this.lastScale);
    }

    setupTextActions() {
        this.textActions = new TextAction(
            this.svgContentGroup, this.scale, jQuery, this.props.SVGActions
        );
        this.textActions.setInputElem(this.input.current);
    }

    setupSVGContainer() {
        this.svgContainer = document.createElementNS(NS.SVG, 'svg');
        setAttributes(this.svgContainer, {
            width: this.props.size.x * 2,
            height: this.props.size.y * 2,
            x: 0,
            y: 0,
            id: 'svg-container',
            overflow: 'visible',
            xmlns: NS.SVG
        });

        this.node.current.append(this.svgContainer);
    }

    setupSVGBackground() {
        this.svgBackground = document.createElementNS(NS.SVG, 'svg');

        setAttributes(this.svgBackground, {
            width: this.props.size.x * 2,
            height: this.props.size.y * 2,
            id: 'svg-background',
            x: 0,
            y: 0,
            xmlns: NS.SVG
        });

        jQuery(this.svgBackground).css('overflow', 'visible');


        const rect = document.createElementNS(NS.SVG, 'rect');
        setAttributes(rect, {
            width: '100%',
            height: '100%',
            x: 0,
            y: 0,
            fill: '#fafafa',
            stroke: '#000',
            'stroke-width': 0,
            style: 'pointer-events: none'
        });
        this.svgBackground.append(rect);

        this.svgContainer.append(this.svgBackground);
    }

    setupSVGContent() {
        // const width = jQuery(this.container).width();
        // const height = jQuery(this.container).height();

        this.svgContent = document.createElementNS(NS.SVG, 'svg');
        jQuery(this.svgContent).css('overflow', 'visible');

        jQuery(this.svgContent).attr({
            id: 'svg-content',
            width: this.props.size.x * 2,
            height: this.props.size.y * 2,
            x: 0,
            y: 0,
            overflow: 'visible',
            preserveAspectRatio: 'none',
            xmlns: NS.SVG
        });

        this.svgContainer.append(this.svgContent);

        const comment = document.createComment('Created by Snapmaker Luban');
        this.svgContent.append(comment);

        this.svgContentGroup = new SVGContentGroup({
            svgContent: this.svgContent,
            scale: this.scale
        });
    }

    setupMouseEvents() {
        this.svgContainer.addEventListener('mousedown', this.onMouseDown, false);
        this.svgContainer.addEventListener('mousemove', this.onMouseMove, false);
        this.svgContainer.addEventListener('wheel', this.onMouseWheel, false);
        // this.svgContainer.addEventListener('contextmenu', this.onContextmenu, false);
        window.addEventListener('mouseup', this.onMouseUp, false);
        window.addEventListener('resize', this.onResize, false);
        window.addEventListener('hashchange', this.onResize, false);
        window.addEventListener('dblclick', this.onDblClick, false);
    }

    setupKeyEvents() {
        window.addEventListener('keyup', this.onKeyUp, false);
    }

    setupPrintableArea() {
        const getRoot = () => this.svgBackground;

        this.printableArea = new PrintableArea({
            size: this.props.coordinateSize,
            scale: this.scale,
            getRoot,
            coordinateMode: this.props.coordinateMode
        });
    }

    setMode(mode, extShape) {
        this.mode = mode;

        if (extShape) {
            this.extShape = extShape;
        }

        if (this.mode === 'select') {
            jQuery(this.svgContainer).css('cursor', 'auto');
        } else {
            jQuery(this.svgContainer).css('cursor', 'crosshair');
        }

        if (!includes(['select', 'panMove', 'textedit'], this.mode)) {
            this.clearSelection();
        }

        this.trigger(SVG_EVENT_MODE, mode);
    }

    setSelectedAttribute(attr, newValue) {
        for (const element of this.svgContentGroup.selectedElements) {
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

        // If it's a selection grip, return the grip parent
        if (jQuery(target).closest('#selector-parent-group').length) {
            return this.svgContentGroup.selectorParentGroup;
        }

        while (target && target.parentNode && target.parentNode !== this.svgContentGroup.group && target.parentNode.nodeName !== 'svg') {
            target = target.parentNode;
        }
        return target;
    };

    onMouseDown = (event) => {
        event.preventDefault();

        const rightClick = event.button === 2;

        this.currentDrawing = Object.assign({}, CURRENTDRAWING_INIT);
        const draw = this.currentDrawing;
        const { stroke, strokeWidth, opacity } = this.currentProperties;

        const matrix = this.svgContentGroup.getScreenCTM().inverse();
        const pt = transformPoint({ x: event.pageX, y: event.pageY }, matrix);
        const x = pt.x;
        const y = pt.y;
        const mouseTarget = this.getMouseTarget(event);

        if (rightClick || event.ctrlKey || event.metaKey) {
            draw.mode = this.mode;
            this.setMode('panMove');
        } else if (this.svgContentGroup.isElementOperator(mouseTarget)) {
            const grip = event.target;
            const gripType = grip.getAttribute('data-type');
            if (gripType === 'resize') {
                this.mode = 'resize';
                draw.resizeMode = grip.getAttribute('data-dir');
            } else if (gripType === 'rotate') {
                this.mode = 'rotate';
            }
        }

        if (this.mode === 'select' && this.svgContentGroup.selectedElements.includes(mouseTarget)) {
            this.mode = 'move';
        }

        switch (this.mode) {
            case 'select': {
                if (mouseTarget && mouseTarget.parentNode.id === 'svg-data') {
                    if (!this.svgContentGroup.selectedElements.includes(mouseTarget)
                        && mouseTarget.id !== 'printable-area-group') {
                        // without shift key, we regard the action as new select
                        if (!event.shiftKey) {
                            this.clearSelection();
                        }

                        this.addToSelection([mouseTarget]);
                    }

                    /*
                    for (const elem of this.svgContentGroup.selectedElements) {
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
                    */
                } else {
                    this.clearSelection();
                }
                break;
            }
            case 'move': {
                draw.started = true;
                draw.startX = x;
                draw.startY = y;

                // draw.resizeMode = 'none';

                // TODO: add docs on right click handling, why set started = false
                if (rightClick) {
                    draw.started = false;
                }

                const elements = this.svgContentGroup.selectedElements;
                this.props.elementActions.moveElementsStart(elements);

                /* TODO: remove
                const transform = this.svgContainer.createSVGTransform();
                transform.setTranslate(0, 0);
                this.svgContentGroup.translateSelectedElementsOnMouseDown();
                this.svgContentGroup.translateSelectorOnMouseDown(transform);
                */

                break;
            }
            case 'resize': {
                draw.started = true;
                draw.startX = x;
                draw.startY = y;

                // TODO: resize multiple elements
                const elements = this.svgContentGroup.selectedElements;
                if (elements.length !== 1) {
                    break;
                }

                const element = elements[0];
                draw.uniformScale = this.props.getSelectedElementsUniformScalingState() ?? true;

                // TODO: Save [bbox, center, matrix, scale] on element
                draw.bbox = element.getBBox();
                draw.center = {
                    x: draw.bbox.x + draw.bbox.width / 2,
                    y: draw.bbox.y + draw.bbox.height / 2
                };
                draw.angle = this.svgContentGroup.getElementAngel();

                // Save scale ratio before scaling
                const transformList = element.transform.baseVal;
                const scale = transformList.getItem(2);
                draw.scaleX = scale.matrix.a;
                draw.scaleY = scale.matrix.d;

                this.props.elementActions.resizeElementsStart(elements);

                break;
            }
            case 'rotate': {
                draw.started = true;
                draw.startX = x;
                draw.startY = y;

                const bbox = this.svgContentGroup.getSelectedElementsBBox();
                draw.startAngle = this.svgContentGroup.getElementAngel(); // FIXME: angle

                const cx = bbox.x + bbox.width / 2;
                const cy = bbox.y + bbox.height / 2;
                draw.center = { x: cx, y: cy };

                const elements = this.svgContentGroup.selectedElements;
                this.props.elementActions.rotateElementsStart(elements, { cx, cy });

                break;
            }
            case 'panMove': {
                draw.started = true;
                draw.startX = x;
                draw.startY = y;

                draw.offsetX = this.offsetX;
                draw.offsetY = this.offsetY;
                draw.matrix = this.svgContentGroup.getScreenCTM().inverse();

                break;
            }
            case 'line': {
                draw.started = true;
                draw.startX = x;
                draw.startY = y;
                this.svgContentGroup.addSVGElement({
                    element: 'line',
                    attr: {
                        x1: x,
                        y1: y,
                        x2: x,
                        y2: y,
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
                this.svgContentGroup.addSVGElement({
                    element: 'rect',
                    attr: {
                        x,
                        y,
                        width: 0,
                        height: 0,
                        stroke,
                        'stroke-width': strokeWidth,
                        opacity: opacity / 2
                    }
                });
                break;
            }
            case 'circle': {
                draw.started = true;
                this.svgContentGroup.addSVGElement({
                    element: 'circle',
                    attr: {
                        cx: x,
                        cy: y,
                        r: 0,
                        stroke,
                        'stroke-width': strokeWidth,
                        opacity: opacity / 2
                    }
                });
                break;
            }
            case 'ellipse': {
                draw.started = true;
                this.svgContentGroup.addSVGElement({
                    element: 'ellipse',
                    attr: {
                        cx: x,
                        cy: y,
                        rx: 0,
                        ry: 0,
                        stroke,
                        'stroke-width': strokeWidth,
                        opacity: opacity / 2
                    }
                });
                break;
            }
            case 'text':
                draw.started = true;
                this.svgContentGroup.addSVGElement({
                    element: 'text',
                    curStyles: true,
                    attr: {
                        x,
                        y,
                        'stroke-width': 1,
                        'font-size': 20,
                        'font-family': '',
                        'text-anchor': 'middle',
                        'xml:space': 'preserve',
                        opacity: opacity / 2
                    }
                });
                // newText.textContent = 'text';
                break;
            case 'ext': {
                if (!this.extShape) {
                    return;
                }
                const d = library.data[this.extShape];
                draw.started = true;
                draw.startX = x;
                draw.startY = y;
                const elem = this.svgContentGroup.addSVGElement({
                    element: 'path',
                    curStyles: true,
                    attr: {
                        d: d,
                        opacity: opacity / 2,
                        stroke,
                        'stroke-width': strokeWidth
                    }
                });
                draw.bbox = getBBox(elem);

                const transform1 = this.svgContainer.createSVGTransform();
                const scale = this.svgContainer.createSVGTransform();
                const transform2 = this.svgContainer.createSVGTransform();
                transform1.setTranslate(0, 0);
                scale.setScale(0.0001, 0.0001);
                transform2.setTranslate(draw.startX, draw.startY);

                const transformList = getTransformList(elem);
                transformList.appendItem(transform2);
                transformList.appendItem(scale);
                transformList.appendItem(transform1);

                break;
            }
            case 'fhpath': {
                draw.started = true;
                draw.startX = x;
                draw.startY = y;
                this.svgContentGroup.addSVGElement({
                    element: 'polyline',
                    attr: {
                        points: `${x},${y} `,
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
            case 'textedit':
                draw.startX = x;
                draw.startY = y;
                this.textActions.mouseDown(event, mouseTarget, draw.startX, draw.startY);
                draw.started = true;
                break;
            default:
                break;
        }
    };

    onMouseMove = (event) => {
        const draw = this.currentDrawing;
        if (!draw.started) {
            return;
        }

        const matrix = this.svgContentGroup.getScreenCTM().inverse();
        const pt = transformPoint({ x: event.pageX, y: event.pageY }, matrix);
        const x = pt.x;
        const y = pt.y;
        const element = this.svgContentGroup.findSVGElement(this.svgContentGroup.getId());


        if (!this.props.editable && ['move', 'resize', 'rotate'].includes(this.mode)) {
            return;
        }
        switch (this.mode) {
            case 'move': {
                const dx = x - draw.startX;
                const dy = y - draw.startY;
                if (dx === 0 && dy === 0) {
                    break;
                }

                const elements = this.svgContentGroup.selectedElements;
                this.props.elementActions.moveElements(elements, { dx, dy });

                return;
            }
            case 'resize': {
                // TODO: resize multiple elements
                const elements = this.svgContentGroup.selectedElements;
                if (elements.length !== 1) {
                    break;
                }

                const startPoint = { x: draw.startX, y: draw.startY };
                const endPoint = { x: pt.x, y: pt.y };

                const centerPointOrigin = draw.center;
                const { width, height } = draw.bbox;

                // direction factor
                let widthFactor = 0;
                if (draw.resizeMode.includes('e')) {
                    widthFactor = 1;
                } else if (draw.resizeMode.includes('w')) {
                    widthFactor = -1;
                }

                let heightFactor = 0;
                if (draw.resizeMode.includes('s')) {
                    heightFactor = 1;
                } else if (draw.resizeMode.includes('n')) {
                    heightFactor = -1;
                }

                const angle = draw.angle * Math.PI / 180;
                // (x0, y0): vector startPoint->endPoint
                const x0 = endPoint.x - startPoint.x;
                const y0 = endPoint.y - startPoint.y;
                // (x1, y1): delta of (width, height)
                const x1 = (x0 * Math.cos(angle) + y0 * Math.sin(angle)) * widthFactor;
                const y1 = (-x0 * Math.sin(angle) + y0 * Math.cos(angle)) * heightFactor;

                const startWidth = width * Math.abs(draw.scaleX);
                const startHeight = height * Math.abs(draw.scaleY);
                const scaleX = (startWidth + x1) / startWidth;
                const scaleY = (startHeight + y1) / startHeight;
                let newScaleX, newScaleY;
                newScaleX = draw.scaleX * scaleX;
                newScaleY = draw.scaleY * scaleY;
                // calculate new center point
                let centerPointAfter;

                // uniform scale
                if (draw.uniformScale) {
                    if (x1 !== 0) {
                        newScaleY = draw.scaleY * scaleX;
                        const newY1 = startHeight * scaleX - startHeight;
                        centerPointAfter = {
                            x: centerPointOrigin.x + (x1 * Math.cos(angle) * widthFactor - newY1 * Math.sin(angle) * heightFactor) / 2,
                            y: centerPointOrigin.y + (x1 * Math.sin(angle) * widthFactor + newY1 * Math.cos(angle) * heightFactor) / 2
                        };
                    } else {
                        newScaleX = draw.scaleX * scaleY;
                        const newX1 = startWidth * scaleY - startHeight;
                        centerPointAfter = {
                            x: centerPointOrigin.x + (newX1 * Math.cos(angle) * widthFactor - y1 * Math.sin(angle) * heightFactor) / 2,
                            y: centerPointOrigin.y + (newX1 * Math.sin(angle) * widthFactor + y1 * Math.cos(angle) * heightFactor) / 2
                        };
                    }
                } else {
                    centerPointAfter = {
                        x: centerPointOrigin.x + (x1 * Math.cos(angle) * widthFactor - y1 * Math.sin(angle) * heightFactor) / 2,
                        y: centerPointOrigin.y + (x1 * Math.sin(angle) * widthFactor + y1 * Math.cos(angle) * heightFactor) / 2
                    };
                }

                this.props.elementActions.resizeElements(elements, {
                    scaleX: newScaleX,
                    scaleY: newScaleY,
                    centerX: centerPointAfter.x,
                    centerY: centerPointAfter.y
                });

                /*
                this.props.elementActions.resizeElements(elements, {
                    resizeDir: this.resizeMode,
                    resizeFrom: { x: draw.startX, y: draw.startY },
                    resizeTo: { x: pt.x, y: pt.y },
                    isUniformScaling: event.shiftKey
                });
                */

                return;
            }
            case 'rotate': {
                const center = draw.center;

                // calculate handle angle (in degree)
                const handleAngle = Math.atan2(y - center.y, x - center.x) / Math.PI * 180;

                // convert handle angle to SVG angle (X axis positive is 0°)
                const rotateAngle = (handleAngle + 90) % 360;
                const deltaAngle = (rotateAngle - draw.startAngle) % 360;

                const elements = this.svgContentGroup.selectedElements;
                this.props.elementActions.rotateElements(elements, { deltaAngle, cx: center.x, cy: center.y });

                return;
            }
            default:
                break;
        }

        switch (this.mode) {
            case 'select': {
                // TODO select with drawing box
                // const { startX, startY } = draw;
                // let width = Math.abs(startX - x);
                // let height = Math.abs(startY - y);
                // let newX = Math.min(startX, x);
                // let newY = Math.min(startY, y);
                // if (event.shiftKey) {
                //     width = Math.max(width, height);
                //     height = width;
                //     newX = startX < x ? startX : startX - width;
                //     newY = startY < y ? startY : startY - height;
                // }
                // setAttributes(element, {
                //     x: newX,
                //     y: newY,
                //     width,
                //     height
                // });
                break;
            }
            case 'panMove': {
                const panPoint = transformPoint({ x: event.pageX, y: event.pageY }, draw.matrix);
                this.offsetX = draw.offsetX + panPoint.x - draw.startX;
                this.offsetY = draw.offsetY + panPoint.y - draw.startY;
                this.target = { x: -this.offsetX, y: this.offsetY };
                this.updateCanvas();
                draw.moved = true;

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
            case 'ext': {
                if (!this.extShape) {
                    return;
                }

                const bbox = draw.bbox;

                draw.scaleX = (x - draw.startX) / bbox.width;
                draw.scaleY = (y - draw.startY) / bbox.height;

                const scale = this.svgContainer.createSVGTransform();
                scale.setScale(draw.scaleX, draw.scaleY);

                const transformList = getTransformList(element);
                transformList.replaceItem(scale, 1);

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
        let element = this.svgContentGroup.findSVGElement(this.svgContentGroup.getId());
        const matrix = this.svgContentGroup.getScreenCTM().inverse();
        const pt = transformPoint({ x: event.pageX, y: event.pageY }, matrix);
        const x = pt.x;
        const y = pt.y;

        // operations on selected elements
        switch (this.mode) {
            case 'select': {
                element.remove();
                return; // note this is not break
            }

            // being moved
            case 'move': {
                const elements = this.svgContentGroup.selectedElements;
                this.props.elementActions.moveElementsFinish(elements);

                // set back to select mode
                this.setMode('select');
                return; // note that this is return
            }

            // being resized
            case 'resize': {
                const elements = this.svgContentGroup.selectedElements;
                this.props.elementActions.resizeElementsFinish(elements);

                // set back to select mode
                this.setMode('select');
                return;
            }

            case 'rotate': {
                const elements = this.svgContentGroup.selectedElements;
                this.props.elementActions.rotateElementsFinish(elements);

                // TODO: Workaround here, reselect elements to avoid miscalculation of transformations
                // Re-select all elements to give items axis aligned selector
                this.selectOnly(elements);

                this.setMode('select');
                return;
            }

            case 'textedit': {
                // set cursor success
                const success = this.textActions.mouseUp(event, x, y);
                if (!success) {
                    this.setMode('select');
                }
                return;
            }

            case 'panMove': {
                if (!draw.moved) {
                    this.onContextmenu(event);
                }
                this.props.updateTarget(this.target);
                this.setMode(draw.mode);
                return;
            }

            default:
                break;
        }

        // create new element
        let keep = false;
        switch (this.mode) {
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
            case 'ext': {
                keep = (draw.scaleX > 0.01 || draw.scaleX < -0.01);
                if (keep) {
                    recalculateDimensions(this.svgContainer, element);
                }
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
                // recover opacity of element newly created
                element.setAttribute('opacity', this.currentProperties.opacity);
                cleanupAttributes(element);

                this.props.onCreateElement(element);

                // TODO: select model newly created
                // this.addToSelection([element]);
            } else {
                // in stead select another element or select nothing
                const target = this.getMouseTarget(event);
                if (target && target !== this.svgContainer) {
                    this.selectOnly([target]);
                } else {
                    this.clearSelection();
                }
                this.setMode('select');
            }
        }
    };

    onKeyUp = (event) => {
        switch (event.key) {
            case 'ArrowUp':
            case 'ArrowDown':
            case 'ArrowLeft':
            case 'ArrowRight':
                // use arrow keys to move models
                // key down listener is in flux/keyboardShortcut
                this.props.onMoveSelectedElementsByKey();
                break;
            default:
                break;
        }
    }

    onDblClick = (evt) => {
        const mouseTarget = this.getMouseTarget(evt);
        const { tagName } = mouseTarget;

        if (this.props.editable && tagName === 'text' && this.mode !== 'textedit') {
            const matrix = this.svgContentGroup.getScreenCTM().inverse();
            const pt = transformPoint({ x: evt.pageX, y: evt.pageY }, matrix);
            this.textActions.select(mouseTarget, pt.x, pt.y);
            this.setMode('textedit');
        }
    };

    onMouseWheel = (event) => {
        event.preventDefault();
        if (event.deltaY < 0) {
            this.scale = this.scale / SCALE_RATE;
            this.updateCanvas();
        } else {
            this.scale = this.scale * SCALE_RATE;
            this.updateCanvas();
        }
    };

    onContextmenu = (event) => {
        event.preventDefault();

        this.trigger(SVG_EVENT_CONTEXTMENU, event);
    };

    onResize = () => {
        this.updateCanvas();
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

    autoFocus = () => {
        this.scale = DEFAULT_SCALE;
        this.offsetX = 0;
        this.offsetY = 0;
        this.updateCanvas();
    };

    zoomIn = () => {
        this.scale = this.scale * 4 / 3;
        this.updateCanvas();
    };

    zoomOut = () => {
        this.scale = this.scale * 3 / 4;
        this.updateCanvas();
    };

    updateCanvas = (size, materials) => {
        size = size || this.props.size;
        materials = materials || this.props.materials;

        if (new Date().getTime() - this.updateTime < 20) {
            this.updateTime = new Date().getTime();
            return;
        }
        const $container = jQuery(this.node.current);
        const width = $container.width();
        const height = $container.height();
        const ratio = Math.min(width, height) / 900;
        this.svgContainer.setAttribute('width', width);
        this.svgContainer.setAttribute('height', height);


        const viewBoxWidth = size.x * 2;
        const viewBoxHeight = size.y * 2;

        const svgWidth = size.x * 2 * this.scale * ratio;
        const svgHeight = size.y * 2 * this.scale * ratio;

        const x = (width - svgWidth) / 2 + this.offsetX * this.scale;
        const y = (height - svgHeight) / 2 + this.offsetY * this.scale;

        setAttributes(this.svgContent, {
            width: svgWidth,
            height: svgHeight,
            x: x,
            y: y,
            viewBox: `0 0 ${viewBoxWidth} ${viewBoxHeight}`
        });
        setAttributes(this.svgBackground, {
            width: this.svgContent.getAttribute('width'),
            height: this.svgContent.getAttribute('height'),
            x: x,
            y: y,
            viewBox: `0 0 ${viewBoxWidth} ${viewBoxHeight}`
        });

        this.printableArea.updateScale({ size: size, materials: materials, scale: this.scale });
        this.svgContentGroup.updateScale(this.scale);
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
            return this.svgContentGroup.addSVGElement({
                element: 'path',
                attr: {
                    id: this.svgContentGroup.getId(),
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

    /*
    recalculateAllSelectedDimensions() {
        for (const elem of this.svgContentGroup.selectedElements) {
            recalculateDimensions(this.svgContainer, elem);
        }
    }
    */

    /**
     * Add elements to selection.
     *
     * @param {Array} elements
     */
    addToSelection(elements) {
        this.props.onSelectElements(elements);
    }

    /**
     * Clear selection of elements.
     */
    clearSelection() {
        this.props.onClearSelection();
    }

    /**
     * Only select elements in `elements` list.
     *
     * @param {Array} elements
     */
    selectOnly(elements) {
        this.clearSelection();
        this.addToSelection(elements);
    }

    loadImageFile(file) {
        const { width, height, uploadName } = file;
        const uploadPath = `${DATA_PREFIX}/${uploadName}`;
        this.svgContentGroup.addSVGElement({
            element: 'image',
            attr: {
                x: 0,
                y: 0,
                width: width,
                height: height,
                href: uploadPath,
                preserveAspectRatio: 'none'
            }
        });
    }

    loadSVGString(xmlString) {
        // create new document (text2xml)
        const parser = new DOMParser();
        parser.async = false;
        const newDoc = parser.parseFromString(xmlString, 'text/xml');

        sanitize(newDoc);

        // Remove old SVG content and append new
        this.svgContainer.removeChild(this.svgContent);

        this.svgContent = document.adoptNode(newDoc.documentElement);
        this.svgContainer.append(this.svgContent);

        // ignored: process <image>, <svg>, <use> children
        // ignored: convert linear gradient

        const attrs = {
            id: 'svgcontent',
            overflow: 'visible'
        };

        if (this.svgContent.getAttribute('viewBox')) {
            const vb = this.svgContent.getAttribute('viewBox').split(' ');
            attrs.width = vb[2];
            attrs.height = vb[3];
        } else {
            attrs.width = this.svgContent.getAttribute('width');
            attrs.height = this.svgContent.getAttribute('height');
        }

        this.identifyGroup();

        // Give id for any visible children
        for (const child of this.svgContentGroup.getChildNodes()) {
            if (visElems.includes(child.nodeName)) {
                if (!child.id) {
                    child.id = this.getNextId();
                }
            }
        }

        if (attrs.width <= 0) {
            attrs.width = 100;
        }
        if (attrs.height <= 0) {
            attrs.height = 199;
        }

        setAttributes(this.svgContent, attrs);

        this.clearSelection();

        this.onResize(); // update canvas
    }

    identifyGroup() {
        const len = this.svgContent.childNodes.length;

        let elementCount = 0;
        let groupCount = 0;
        for (let i = 0; i < len; i++) {
            const child = this.svgContent.childNodes.item(i);
            if (child && child.nodeType === 1) {
                elementCount++;
                if (child.tagName === 'g') {
                    groupCount++;
                }
            }
        }

        if (elementCount === 1 && groupCount === 1) {
            for (let i = 0; i < len; i++) {
                const child = this.svgContent.childNodes.item(i);
                if (child && child.nodeType === 1 && child.tagName === 'g') {
                    this.group = child;
                    break;
                }
            }
        } else {
            this.group = document.createElementNS(NS.SVG, 'g');

            for (let i = 0; i < len; i++) {
                const child = this.svgContent.childNodes.item(i);
                if (child && child.nodeType === 1) {
                    this.group.append(child);
                }
            }

            this.svgContent.append(this.group);
        }
    }

    on(event, callback) {
        if (this.callbacks[event] === undefined) {
            this.callbacks[event] = [];
        }
        this.callbacks[event].push(callback);
    }

    off(event, callback) {
        if (this.callbacks[event] === undefined) {
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
            <React.Fragment>
                <div ref={this.node} style={{ height: 'calc(100vh - 61px)' }} className={className} />
                <input ref={this.input} style={{ position: 'absolute', top: '-45px' }} type="text" size="35" autoComplete="off" />
            </React.Fragment>
        );
    }
}

export default SVGCanvas;
