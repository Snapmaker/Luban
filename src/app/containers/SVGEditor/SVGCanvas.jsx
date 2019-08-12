import isNumber from 'lodash/isNumber';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import jQuery from 'jquery';


const NAMESPACES = {
    SVG: 'http://www.w3.org/2000/svg'
};

const shortFloat = (val) => {
    const digits = 5;
    if (!Number.isNaN(val)) {
        return Number(Number(val).toFixed(digits));
    }
    if (Array.isArray(val)) {
        return `${shortFloat(val[0])},${shortFloat(val[1])}`;
    }
    return parseFloat(val).toFixed(digits) - 0;
};

const toXml = function (str) {
    // &apos; is ok in XML, but not HTML
    // &gt; does not normally need escaping, though it can if within a CDATA expression (and preceded by "]]")
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;'); // Note: `&apos;` is XML only
};

const transformPoint = function (x, y, m) {
    return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
};

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

    counter = 0;

    drawing = false;

    componentDidMount() {
        this.setupSVGContainer();
        this.setupSVGBackground();
        this.setupSVGContent();
        this.setupMouseEvents();
        this.onResize();
    }

    setupSVGContainer() {
        this.svgContainer = document.createElementNS(NAMESPACES.SVG, 'svg');

        this.elementSetAttributes(this.svgContainer, {
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

        this.elementSetAttributes(this.svgBackground, {
            width: 800,
            height: 600,
            x: 0,
            y: 0,
            xmlns: NAMESPACES.SVG
        });

        const rect = document.createElementNS(NAMESPACES.SVG, 'rect');
        this.elementSetAttributes(rect, {
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

    setMode(mode) {
        this.mode = mode;
    }

    getSVGContent() {
        return this.svgContent;
    }

    getMouseTarget = (event) => {
        let target = event.target;

        if (target === this.svgContainer) {
            return this.svgContainer;
        }
        if (target === this.svgContent) {
            return this.svgContent;
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
                if (mouseTarget !== this.svgContent) {
                    // addToSelection()
                }
                break;
            }
            case 'circle': {
                this.drawing = true;
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
            default:
                break;
        }
    };

    onMouseMove = (event) => {
        if (!this.drawing) {
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
            default:
                break;
        }
    };

    onMouseUp = () => {
        if (!this.drawing) {
            return;
        }
        this.drawing = false;
        const shape = this.findSVGElement(this.getId());

        let keep = false;
        switch (this.mode) {
            case 'circle':
                keep = (shape.getAttribute('r') !== '0');
                break;
            default:
                break;
        }

        if (keep) {
            shape.setAttribute('opacity', this.currentProperties.opacity);

            this.elementCleanupAttributes(shape);
        } else {
            shape.remove();
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

        this.elementSetAttributes(this.svgContent, {
            width: this.currentResolution.width,
            height: this.currentResolution.height,
            x,
            y,
            viewBox: `0 0 ${this.currentResolution.width} ${this.currentResolution.height}`
        });

        this.elementSetAttributes(this.svgBackground, {
            width: this.svgContent.getAttribute('width'),
            height: this.svgContent.getAttribute('height'),
            x,
            y
        });
    };

    findSVGElement(id) {
        return this.svgContent.querySelector(`#${id}`);
    }

    addSVGElement(data) {
        const shape = document.createElementNS(NAMESPACES.SVG, data.element);

        this.group.append(shape);

        // set attribute
        this.elementSetAttributes(shape, {
            fill: this.currentProperties.fill,
            stroke: this.currentProperties.stroke
        });
        this.elementSetAttributes(shape, data.attr);
        this.elementCleanupAttributes(shape);

        // add children?

        return shape;
    }

    elementSetAttributes(element, attrs) {
        for (const [key, value] of Object.entries(attrs)) {
            element.setAttribute(key, value);
        }
    }

    elementCleanupAttributes(element) {
        const defaults = {
            opacity: 1,
            stroke: 'none',
            rx: 0,
            ry: 0
        };

        if (element.nodeName === 'ellipse') {
            // Ellipse elements require rx and ry attributes
            delete defaults.rx;
            delete defaults.ry;
        }

        Object.entries(defaults).forEach(([attr, val]) => {
            if (element.getAttribute(attr) === String(val)) {
                element.removeAttribute(attr);
            }
        });
    }

    // Export SVG
    svgToString(elem, indent) {
        const out = [];

        this.elementCleanupAttributes(elem);

        const attrs = Object.values(elem.attributes);
        attrs.sort((a, b) => {
            return a.name > b.name ? -1 : 1;
        });

        out.push(new Array(indent).join(' '));

        out.push('<');
        out.push(elem.nodeName);

        if (elem === this.svgContent) {
            // root element
            const resolution = this.currentResolution;

            out.push(` width="${resolution.width}" height="${resolution.height}" xmlns="${NAMESPACES.SVG}"`);
            // skip other namespaces && other attributes
        } else {
            for (let i = attrs.length - 1; i >= 0; i--) {
                const attr = attrs[i];
                let attrVal = toXml(attr.value);
                if (attrVal !== '') {
                    if (attrVal.startsWith('pointer-events')) {
                        continue;
                    }
                    out.push(' ');

                    if (isNumber(attrVal)) {
                        attrVal = shortFloat(attrVal);
                    }

                    out.push(`${attr.nodeName}="${attrVal}"`);
                }
            }
        }

        if (elem.hasChildNodes()) {
            out.push('>');
            const childIndent = indent + 1;
            let bOneLine = false;

            for (let i = 0; i < elem.childNodes.length; i++) {
                const child = elem.childNodes.item(i);

                switch (child.nodeType) {
                    case 1: {
                        // element node
                        out.push('\n');
                        out.push(this.svgToString(child, childIndent));
                        break;
                    }
                    case 3: {
                        // text
                        const str = child.nodeValue.replace(/^\s+|\s+$/g, '');
                        if (str !== '') {
                            bOneLine = true;
                            out.push(String(toXml(str)));
                        }
                        break;
                    }
                    case 4: {
                        // CDATA
                        out.push('\n');
                        out.push(new Array(childIndent).join(' '));
                        out.push(`<![CDATA[${child.nodeValue}]]>`);
                        break;
                    }
                    case 8: {
                        // comment
                        out.push('\n');
                        out.push(new Array(childIndent).join(' '));
                        out.push(`<!--${child.data}-->`);
                        break;
                    }
                    default:
                        break;
                }
            }

            if (!bOneLine) {
                out.push('\n');
                out.push(new Array(indent).join(' '));
            }

            out.push(`</${elem.nodeName}>`);
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
