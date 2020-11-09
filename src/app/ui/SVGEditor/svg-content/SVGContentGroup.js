import { createSVGElement, getBBox, toString } from '../element-utils';
import { NS } from '../lib/namespaces';
// import SelectorManager from './SelectorManager';
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
        // this.selectorManager = new SelectorManager({
        //     getRoot: () => this.svgContent,
        //     scale: this.scale
        // });
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
        this.operatorPoints.updateScale(scale);
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

    getSelectedElements() {
        return this.selectedElements;
    }

    deleteElements(elems) {
        this.showSelectorGrips(false);
        for (const elem of elems) {
            this.selectedElements = this.selectedElements.filter(v => v !== elem);
            elem.remove();
        }
    }

    deleteElement(elem) {
        if (elem) {
            this.showSelectorGrips(false);
            this.selectedElements = this.selectedElements.filter(v => v !== elem);
            elem.remove();
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

    /**
     * Clear selection of elements.
     */
    clearSelection() {
        this.showSelectorGrips(false);
        this.selectedElements = [];
    }

    addToSelection(elements) {
        for (const elem of elements) {
            if (!this.selectedElements.includes(elem)) {
                this.selectedElements.push(elem);
            }
        }
        const posAndsize = this.operatorPoints.resizeGrips(this.selectedElements);
        this.showSelectorGrips(true);
        // todo
        return posAndsize;
    }

    // after element transform
    resetSelection(size, transformation) {
        // Resize grip of each selected element, and get their whole position and size
        const posAndSize = this.operatorPoints.resizeGrips(this.selectedElements);

        // Update operator points
        this.setSelectorTransformList(size, transformation);

        return posAndSize;
    }

    isElementOperator(elem) {
        return elem === this.operatorPoints.operatorPointsGroup;
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

    selectOnly(elems) {
        this.clearSelection();
        const posAndSize = elems && this.addToSelection(elems);
        return posAndSize;
    }

    /**
     * Remove all elements from group.
     */
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

    /**
     * Set element transform list from (size, modelGroupTransformation).
     *
     * TODO: refactor this function.
     */
    setSelectorTransformList(size, transformation) {
        const selector = this.operatorPoints.operatorPointsGroup;

        selector.transform.baseVal.clear();
        const transformList = selector.transform.baseVal;

        // let { positionX, positionY, rotationZ, scaleX, scaleY } = transformation;
        const { positionX = 0, positionY = 0, rotationZ = 0 } = transformation;
        // rotationZ = rotationZ ?? 0;
        // scaleX = scaleX ?? 1;
        // scaleY = scaleY ?? 1;
        // todo, flip instead of negative scale
        // flip = flip ?? 0;
        // todo move to svgModelGroup, size need
        const center = { x: size.x + positionX, y: size.y - positionY };

        // [T]
        const translateBack = this.svgContent.createSVGTransform();
        // translateBack.setTranslate(center.x, center.y);
        translateBack.tag = 'translateBack';
        translateBack.setTranslate(0, 0);
        transformList.insertItemBefore(translateBack, 0);

        // [R][T]
        if (this.selectedElements.length === 1) {
            const rotate = this.svgContent.createSVGTransform();
            rotate.tag = 'rotate';
            rotate.setRotate(-rotationZ / Math.PI * 180, center.x, center.y);
            transformList.insertItemBefore(rotate, 0);
        } else {
            // TODO: Rotate the selector as well
            const rotate = this.svgContent.createSVGTransform();
            rotate.tag = 'rotate';
            rotate.setRotate(0, center.x, center.y);
            transformList.insertItemBefore(rotate, 0);
        }

        // [S][R][T]
        const scale = this.svgContent.createSVGTransform();
        scale.tag = 'scale';
        // scale.setScale(scaleX * ((flip & 2) ? -1 : 1) / Math.abs(scaleX), scaleY * ((flip & 1) ? -1 : 1) / Math.abs(scaleY));
        // scale.setScale(scaleX / scaleX, scaleY / scaleY);
        scale.setScale(1, 1);
        transformList.insertItemBefore(scale, 0);

        // [T][S][R][T]
        const translateOrigin = this.svgContent.createSVGTransform();
        translateOrigin.tag = 'translateOrigin';
        translateOrigin.setTranslate(0, 0);
        transformList.insertItemBefore(translateOrigin, 0);
    }

    getSelectedElementsBBox() {
        const allSelectedElementsBox = this.operatorPoints.getAllSelectedElementsBox();
        return getBBox(allSelectedElementsBox);
    }

    getSelectedElementsCenterPoint() {
        return this.operatorPoints.getCenterPoint();
    }

    translateSelectedElementsOnMouseDown() {
        for (const elem of this.selectedElements) {
            const transformList = getTransformList(elem);
            const transform = this.svgContent.createSVGTransform();
            transform.setTranslate(0, 0);
            transformList.insertItemBefore(transform, 0);
        }
    }

    translateSelectedElementsOnMouseMove(transform) {
        for (const elem of this.selectedElements) {
            const transformList = getTransformList(elem);
            transformList.replaceItem(transform, 0);
        }
    }

    // [T][R][S][T] -> [R][T][R][S][T]
    rotateSelectedElementsOnMouseDown() {
        for (const elem of this.selectedElements) {
            const transformList = getTransformList(elem);
            const transform = this.svgContent.createSVGTransform();
            transform.setRotate(0, 0, 0);
            transformList.insertItemBefore(transform, 0);
        }
    }

    rotateSelectedElementsOnMouseMove(transform) {
        for (const elem of this.selectedElements) {
            const transformList = getTransformList(elem);
            transformList.replaceItem(transform, 0);
        }
    }

    translateSelectorOnMouseDown(transform) { // add a new transform to list
        const transformList = getTransformList(this.operatorPoints.operatorPointsGroup);
        transformList.insertItemBefore(transform, 0);
    }

    translateSelectorOnMouseMove(transform) { // change the new transform
        const transformList = getTransformList(this.operatorPoints.operatorPointsGroup);
        transformList.replaceItem(transform, 0);
    }

    rotateSelectorOnMouseDown() {
        const transformList = getTransformList(this.operatorPoints.operatorPointsGroup);
        const transform = this.svgContent.createSVGTransform();
        transform.setRotate(0, 0, 0);
        transformList.insertItemBefore(transform, 0);
    }

    rotateSelectorOnMouseMove(transform) {
        const transformList = getTransformList(this.operatorPoints.operatorPointsGroup);
        transformList.replaceItem(transform, 0);
    }

    transformSelectorOnMouseup() {
    }


    rotateSelectedElements(rotate) {
        for (const elem of this.selectedElements) {
            const transformList = getTransformList(elem);
            const findIndex = (list, type) => {
                for (let k = 0; k < list.length; k++) {
                    if (list.getItem(k).type === type) {
                        return k;
                    }
                }
                return -1;
            };
            let idx = findIndex(transformList, 4);
            if (idx === -1) idx = transformList.numberOfItems - 1;
            transformList.replaceItem(rotate, idx);
        }
    }

    getElementAngel(element) { // get angleOld for elements rotation
        if (!element) {
            if (this.selectedElements.length !== 1) {
                //TODO: for multi-rotate, angleOld maybe not 0
                return 0;
            }
            element = this.selectedElements[0];
        }
        const transformList = getTransformList(element);
        const findIndex = (list, type) => {
            for (let k = 0; k < list.length; k++) {
                if (list.getItem(k).type === type) {
                    return k;
                }
            }
            return -1;
        };
        const idx = findIndex(transformList, 4);
        if (idx === -1) {
            return 0;
        }
        return transformList[idx].angle;
    }

    showSelectorGrips(show) {
        this.operatorPoints.showGrips(show);
    }

    showSelectorResizeAndRotateGripsAndBox(show) {
        this.operatorPoints.showResizeAndRotateGripsAndBox(show);
    }

    showSelectorResizeAndRotateGrips(show) {
        this.operatorPoints.showResizeAndRotateGrips(show);
    }

    appendTextCursor(cursor) {
        this.operatorPoints.operatorPointsGroup.appendChild(cursor);
    }
}

export default SVGContentGroup;
