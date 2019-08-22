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


function transformPoint(x, y, m) {
    return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
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
        startY: 0
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
            case 'circle': {
                this.currentDrawing.started = true;
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
            case 'rect': {
                this.currentDrawing.started = true;
                this.currentDrawing.startX = x;
                this.currentDrawing.startY = y;
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
            default:
                break;
        }
    };

    onMouseMove = (event) => {
        if (!this.currentDrawing.started) {
            return;
        }
        const matrix = this.group.getScreenCTM().inverse();
        const pt = transformPoint(event.pageX, event.pageY, matrix);
        const x = pt.x;
        const y = pt.y;
        const shape = this.findSVGElement(this.getId());

        switch (this.mode) {
            case 'select': {
                break;
            }
            case 'circle': {
                const cx = shape.getAttribute('cx');
                const cy = shape.getAttribute('cy');
                const radius = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
                shape.setAttribute('r', radius);
                break;
            }
            case 'rect': {
                const { startX, startY } = this.currentDrawing;

                const newX = Math.min(startX, x);
                const newY = Math.min(startY, y);
                const width = Math.abs(startX - x);
                const height = Math.abs(startY - y);

                setAttributes(shape, {
                    x: newX,
                    y: newY,
                    width,
                    height
                });
                break;
            }
            default:
                break;
        }
    };

    onMouseUp = () => {
        if (!this.currentDrawing.started) {
            return;
        }
        this.currentDrawing.started = false;
        const element = this.findSVGElement(this.getId());

        let keep = false;
        switch (this.mode) {
            case 'circle': {
                keep = (element.getAttribute('r') !== '0');
                break;
            }
            case 'rect': {
                const width = element.getAttribute('width');
                const height = element.getAttribute('height');
                keep = (width && height);
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
