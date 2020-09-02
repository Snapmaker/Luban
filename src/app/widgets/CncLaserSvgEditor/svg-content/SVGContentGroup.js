import { createSVGElement, getBBox, setAttributes, toString } from '../element-utils';
import { NS } from '../lib/namespaces';
import SelectorManager from './SelectorManager';
import OperatorPoints from './OperatorPoints';
import { getTransformList } from '../element-transform';
import { recalculateDimensions } from '../element-recalculate';

class SVGContentGroup {
    counter = 0;

    selectedElements = [];

    constructor(options) {
        const { svgContent, scale } = options;

        this.svgContent = svgContent;
        this.scale = scale;

        this.backgroundGroup = document.createElementNS(NS.SVG, 'g');
        this.backgroundGroup.setAttribute('id', 'svg-data-background');

        this.group = document.createElementNS(NS.SVG, 'g');
        this.group.setAttribute('id', 'svg-data');

        this.svgContent.append(this.backgroundGroup);
        this.svgContent.append(this.group);
        this.selectorManager = new SelectorManager({
            getRoot: () => this.svgContent,
            scale: this.scale
        });
        this.operatorPoints = new OperatorPoints({
            getRoot: () => this.svgContent,
            scale: this.scale
        });
    }

    // for create new elem
    getId() {
        return `id${this.counter}`;
    }

    // for create new elem
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

    // todo getSelected will be instead
    updateTransform(elem, attributes) {
        setAttributes(elem, attributes);
        if (elem === this.getSelected()) {
            const selector = this.selectorManager.requestSelector(elem);
            selector.resize();
        }
    }

    addSVGBackgroundElement(data) {
        if (data.attr && data.attr.id) {
            const existingElement = this.backgroundGroup.querySelector(`#${data.attr.id}`);
            if (existingElement) {
                existingElement.remove();
            }
        }
        const element = createSVGElement(data);
        this.backgroundGroup.append(element);
        return element;
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

    requestSelectorByElements(elements) {
        return this.selectorManager.requestSelectorByElements(elements);
    }

    releaseSelector(elem) {
        return this.selectorManager.releaseSelector(elem);
    }

    clearSelection() {
        this.operatorPoints.showGrips(false);
        this.selectedElements = [];
    }

    addToSelection(elements) {
        for (const elem of elements) {
            if (!this.selectedElements.includes(elem)) {
                this.selectedElements.push(elem);
            }
        }
        this.operatorPoints.resizeGrips(this.selectedElements);
        this.operatorPoints.showGrips(true);
        const selectedElementsBBox = getBBox(this.operatorPoints.getSelectedElementsBox());
        const cx = selectedElementsBBox.x + selectedElementsBBox.width / 2;
        const cy = selectedElementsBBox.y + selectedElementsBBox.height / 2;
        console.log('----svg content group----', cx, cy);
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

    updateElementFlip(elem, flip) {
        const transformList = getTransformList(elem);
        const transformOrigin = this.svgContent.createSVGTransform();
        const transformScale = this.svgContent.createSVGTransform();
        const transformBack = this.svgContent.createSVGTransform();
        const bBox = getBBox(elem);
        transformOrigin.setTranslate(bBox.x + bBox.width, bBox.y + bBox.height);
        transformScale.setScale(((flip & 2) > 0 ? -1 : 1), ((flip & 1) > 0 ? -1 : 1));
        transformBack.setTranslate(-(bBox.x + ((flip & 2) > 0 ? 0 : bBox.width)), -(bBox.y + ((flip & 1) > 0 ? 0 : bBox.height)));

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

    removeAllElements() {
        while (this.group.firstChild) {
            this.deleteElement(this.group.lastChild);
        }
    }

    getSelectedElementVisible() {
        const selectedElement = this.getSelected();
        return selectedElement.visible;
    }

    setSelectedElementVisible(visible) {
        const selectedElement = this.getSelected();
        selectedElement.visible = visible;
    }

    getSelectedElementUniformScalingState() {
        const selectedElement = this.getSelected();
        if (selectedElement.uniformScalingState === undefined) {
            return true;
        }
        return selectedElement.uniformScalingState;
    }

    setSelectedElementUniformScalingState(uniformScalingState) {
        const selectedElement = this.getSelected();
        selectedElement.uniformScalingState = uniformScalingState;
    }
}

export default SVGContentGroup;
