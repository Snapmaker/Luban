import { createSVGElement, getBBox, setAttributes, toString } from '../element-utils';
import { NS } from '../lib/namespaces';
import SelectorManager from './SelectorManager';
import { getTransformList } from '../element-transform';
import { recalculateDimensions } from '../element-recalculate';

class SVGContentGroup {
    counter = 0;

    selectedElements = [];

    constructor(options) {
        const { svgContent, scale } = options;

        this.svgContent = svgContent;
        this.scale = scale;

        this.group = document.createElementNS(NS.SVG, 'g');
        this.group.setAttribute('id', 'svg-data');

        this.svgContent.append(this.group);
        this.selectorManager = new SelectorManager({
            getRoot: () => this.svgContent,
            scale: this.scale
        });
    }

    getId() {
        return `id${this.counter}`;
    }

    getNextId() {
        this.counter++;
        return `id${this.counter}`;
    }

    getScreenCTM() {
        return this.group.getScreenCTM();
    }

    getChildNodes() {
        return this.group.childNodes;
    }

    updateScale(scale) {
        this.selectorManager.updateScale(scale);
        for (const childNode of this.getChildNodes()) {
            childNode.setAttribute('stroke-width', 1 / scale);
        }
    }

    svgToString() {
        const out = [];

        for (const childNode of this.group.childNodes) {
            const width = Number(childNode.getAttribute('width'));
            const height = Number(childNode.getAttribute('height'));

            const svgs = [];
            svgs.push('<svg');
            svgs.push(` width="${width}" height="${height}" xmlns="${NS.SVG}"`);
            svgs.push('>');
            const childOutput = toString(childNode, 1);
            if (childOutput) {
                svgs.push('\n');
                svgs.push(childOutput);
            }
            svgs.push('\n');
            svgs.push('</svg>');
            out.push(svgs.join(''));
        }

        return out;
    }

    findSVGElement(id) {
        return this.group.querySelector(`#${id}`);
    }

    getSelected() {
        return this.selectedElements[0];
    }

    deleteElement(elem) {
        if (elem) {
            this.selectorManager.releaseSelector(elem);
            this.selectedElements = this.selectedElements.filter(v => v !== elem);
            elem.remove();
        }
    }

    updateTransform(elem, attributes) {
        setAttributes(elem, attributes);
        if (elem === this.getSelected()) {
            const selector = this.selectorManager.requestSelector(elem);
            selector.resize();
        }
    }

    addSVGElement(data) {
        if (data.attr && data.attr.id) {
            const existingElement = this.findSVGElement(data.attr.id);
            if (existingElement && data.element !== existingElement.tagName) {
                existingElement.remove();
            }
        }
        data.attr = Object.assign({
            id: this.getNextId()
        }, data.attr);
        const element = createSVGElement(data);
        this.group.append(element);
        return element;
    }

    requestSelector(elem, bbox) {
        return this.selectorManager.requestSelector(elem, bbox);
    }

    releaseSelector(elem) {
        return this.selectorManager.releaseSelector(elem);
    }

    clearSelection() {
        for (const elem of this.selectedElements) {
            this.releaseSelector(elem);
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

                this.requestSelector(elem, bbox);
            }
        }
        // If only one element is selected right now, then show grips.
        if (this.selectedElements.length === 1) {
            const elem = this.selectedElements[0];
            const selector = this.requestSelector(elem);
            if (!elem.hideFlag) {
                selector.showGrips(true);
            }
        }
    }

    updateElementRotate(elem, rotate) {
        const transformList = getTransformList(elem);
        let transformRotate = null;
        let index = 0;
        for (let i = 0; i < transformList.numberOfItems; i++) {
            if (transformList.getItem(i).type === 4) {
                index = i;
                transformRotate = transformList.getItem(i);
            }
        }
        if (!transformRotate) {
            transformRotate = this.svgContent.createSVGTransform();
            transformList.appendItem(transformRotate);
        }
        transformRotate.setRotate(rotate.angle, rotate.x + rotate.width / 2, rotate.y + rotate.height / 2);
        transformList.replaceItem(transformRotate, index);

        recalculateDimensions(this.svgContent, elem);
    }

    updateElementScale(elem, scale) {
        const transformList = getTransformList(elem);
        const transformOrigin = this.svgContent.createSVGTransform();
        const transformScale = this.svgContent.createSVGTransform();
        const transformBack = this.svgContent.createSVGTransform();
        const bBox = getBBox(elem);
        transformOrigin.setTranslate(scale.x, scale.y);
        transformScale.setScale(scale.scaleX, scale.scaleY);
        transformBack.setTranslate(-bBox.x, -bBox.y);

        transformList.appendItem(transformOrigin);
        transformList.appendItem(transformScale);
        transformList.appendItem(transformBack);

        recalculateDimensions(this.svgContent, elem);
    }

    updateElementTranslate(elem, translate) {
        const transformList = getTransformList(elem);
        const transform = this.svgContent.createSVGTransform();
        transform.setTranslate(translate.translateX, translate.translateY);
        transformList.insertItemBefore(transform, 0);
        recalculateDimensions(this.svgContent, elem);
    }

    selectOnly(elem) {
        this.clearSelection();
        elem && this.addToSelection([elem]);
    }
}

export default SVGContentGroup;
