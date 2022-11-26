import { v4 as uuid } from 'uuid';
import { noop } from 'lodash';
import { createSVGElement, getBBox, toString } from '../element-utils';
import { NS } from '../lib/namespaces';
// import SelectorManager from './SelectorManager';
import OperatorPoints from './OperatorPoints';
import DrawGroup from './DrawGroup';
import { getTransformList } from '../element-transform';
import { recalculateDimensions } from '../element-recalculate';
import SvgModel from '../../../models/SvgModel';

class SVGContentGroup {
    svgId = null;

    selectedElements = [];

    drawGroup = null;

    onChangeMode = noop;

    onDrawLine = noop;

    onDrawDelete = noop;

    onDrawTransform = noop;

    onDrawTransformComplete = noop;

    onDrawStart = noop;

    onDrawComplete = noop;

    onExitModelEditing = noop;

    preSelectionGroup = null;

    constructor(options) {
        const { svgContent, scale } = options;

        this.svgContent = svgContent;
        this.scale = scale;

        this.backgroundGroup = document.createElementNS(NS.SVG, 'g');
        this.backgroundGroup.setAttribute('id', 'svg-data-background');

        this.group = document.createElementNS(NS.SVG, 'g');
        this.group.setAttribute('id', 'svg-data');

        this.preSelectionGroup = document.createElementNS(NS.SVG, 'g');
        this.preSelectionGroup.setAttribute('id', 'svg-pre-selection');

        this.svgContent.append(this.backgroundGroup);
        this.svgContent.append(this.group);
        this.svgContent.append(this.preSelectionGroup);

        this.initFilter();
        // this.selectorManager = new SelectorManager({
        //     getRoot: () => this.svgContent,
        //     scale: this.scale
        // });
        this.operatorPoints = new OperatorPoints({
            getRoot: () => this.svgContent,
            scale: this.scale
        });
        this.operatorPoints.showOperator(true);

        this.drawGroup = new DrawGroup(this.group, this.scale);

        this.drawGroup.onDrawLine = (line, closedLoop) => {
            this.onDrawLine(line, closedLoop);
        };
        this.drawGroup.onDrawDelete = (lines) => {
            this.onDrawDelete(lines);
        };
        this.drawGroup.onDrawTransform = ({ before, after }) => {
            this.onDrawTransform({ before, after });
        };
        this.drawGroup.onDrawTransformComplete = ({ elem, before, after }) => {
            this.onDrawTransformComplete({ elem, before, after });
        };
        this.drawGroup.onDrawStart = (elem) => {
            this.onDrawStart(elem);
        };
        this.drawGroup.onDrawComplete = (svg) => {
            this.onDrawComplete(svg);
        };
    }

    exitModelEditing(exitCompletely) {
        return this.onExitModelEditing(exitCompletely);
    }

    // construct filter used in toolPath
    initFilter() {
        const filterText = document.createElementNS(NS.SVG, 'filter');
        filterText.setAttribute('id', 'inSelectedToolPathText');
        const filterElementText = document.createElementNS(NS.SVG, 'feColorMatrix');
        filterElementText.setAttribute('type', 'matrix');
        filterElementText.setAttribute('values', '0 0 0 0 0.01 0 0 0 0 0.25 0 0 0 0 1 0 0 0 1 0');
        filterText.append(filterElementText);

        const filterSVG = document.createElementNS(NS.SVG, 'filter');
        filterSVG.setAttribute('id', 'inSelectedToolPathSVG');
        const filterElementSVG = document.createElementNS(NS.SVG, 'feColorMatrix');
        filterElementSVG.setAttribute('type', 'matrix');
        filterElementSVG.setAttribute('values', '0 0 0 0 0.01 0 0 0 0 0.25 0 0 0 0 1 0 0 0 1 0');
        filterSVG.append(filterElementSVG);

        const filterImage = document.createElementNS(NS.SVG, 'filter');
        filterImage.setAttribute('id', 'inSelectedToolPathImage');
        const filterElementImage = document.createElementNS(NS.SVG, 'feColorMatrix');
        filterElementImage.setAttribute('type', 'matrix');
        filterElementImage.setAttribute('values', '0.99 0 0 0 0.01 0 0.7 0 0 0.3 0 0 0.05 0 0.95 0 0 0 1 0');
        filterImage.append(filterElementImage);

        this.svgContent.append(filterText);
        this.svgContent.append(filterSVG);
        this.svgContent.append(filterImage);
    }

    // for create new elem
    getNewId() {
        this.svgId = `id${uuid()}`;
        return this.svgId;
    }

    getId() {
        return this.svgId;
    }

    getScreenCTM() {
        return this.group.getScreenCTM();
    }

    getChildNodes() {
        return this.group.childNodes;
    }

    updateScale(scale) {
        this.operatorPoints.updateScale(scale);
        this.drawGroup.updateScale(scale);
        for (const childNode of this.getChildNodes()) {
            childNode.setAttribute('stroke-width', 1 / scale);
        }
        if (this.preSelectionGroup) {
            for (const childNode of this.preSelectionGroup.childNodes) {
                childNode.setAttribute('stroke-width', 1 / scale * 20);
            }
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
        // uuid() may generate id starts with digit, that will cause querySelector fail
        // https://stackoverflow.com/questions/37270787/uncaught-syntaxerror-failed-to-execute-queryselector-on-document
        return this.svgContent.getElementById(`${id}`);
    }

    insertAfter(element, index) {
        index = Math.floor(index);
        const childNodes = this.getChildNodes();
        const childNodesLength = childNodes.length;
        if (childNodesLength > 1 && index <= childNodesLength) {
            this.group.insertBefore(element, childNodes[index - 2].nextSibling);
        } else {
            this.group.append(element);
        }
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
            this.deletePreseleElement(elem);
            elem.remove();
        }
    }

    deleteElement(elem) {
        if (elem) {
            this.showSelectorGrips(false);
            this.selectedElements = this.selectedElements.filter(v => v !== elem);
            this.deletePreseleElement(elem);
            elem.remove();
        }
    }

    deletePreseleElement(elem) {
        const id = elem.getAttribute('id');
        const pathPreSelectionArea = document.querySelector(`[target-id="${id}"]`);
        if (pathPreSelectionArea) {
            pathPreSelectionArea.remove();
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
        } else {
            if (data.attr) {
                data.attr = {
                    ...data.attr,
                    id: this.getNewId()
                };
            } else {
                data.attr = {
                    id: this.getNewId()
                };
            }
        }
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

    addToSelection(elements, isSelectedRotate3D = false) {
        for (const elem of elements) {
            if (!this.selectedElements.includes(elem)) {
                this.selectedElements.push(elem);
            }
        }
        const hasHideElem = this.selectedElements.some(elem => elem.getAttribute('display') === 'none');
        this.showSelectorGrips(true);
        const posAndsize = this.operatorPoints.resizeGrips(this.selectedElements);

        if (hasHideElem) {
            this.showSelectorResizeAndRotateGrips(!hasHideElem);
        }
        if (isSelectedRotate3D) {
            this.operatorPoints.showRotateGrips(false);
        }
        return posAndsize;
    }

    setSelection(elements) {
        this.selectedElements = elements;
        this.resetSelector(elements);
        this.showSelectorGrips(true);
    }

    /**
     * Reset selection.
     *
     * TODO: remove
     */
    // after element transform
    resetSelection(size, transformation) {
        // Resize grip of each selected element, and get their whole position and size
        const posAndSize = this.operatorPoints.resizeGrips(this.selectedElements);

        // Update operator points
        this.setSelectorTransformList(size, transformation);

        return posAndSize;
    }

    /**
     * Reset selector of elements.
     * Re-create grips based on selected elements.
     *
     * TODO: refactor this method to distinguish two different reset strategies.
     */
    resetSelector(elements) {
        if (elements.length === 1) {
            // keep rotation if only one element selected
            const { positionX, positionY } = this.operatorPoints.resizeGrips(elements);

            const selectorElement = this.operatorPoints.operatorPointsGroup;
            const element = elements[0];
            const transformList = getTransformList(element);
            const rotate = transformList.getItem(1);
            SvgModel.recalculateElementTransformList(selectorElement, {
                x: positionX,
                y: positionY,
                scaleX: 1,
                scaleY: 1,
                angle: rotate.angle
            });
        } else if (elements.length > 1) {
            // re-create axis-aligned selector if multiple elements are selected
            const { positionX, positionY } = this.operatorPoints.resizeGrips(elements);

            const selectorElement = this.operatorPoints.operatorPointsGroup;
            SvgModel.recalculateElementTransformList(selectorElement, {
                x: positionX,
                y: positionY,
                scaleX: 1,
                scaleY: 1,
                angle: 0
            });
        }
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

    /**
     * Move selector start.
     */
    moveSelectorStart() {
        const transformList = getTransformList(this.operatorPoints.operatorPointsGroup);

        const transform = this.svgContent.createSVGTransform();
        transform.setTranslate(0, 0);

        transformList.insertItemBefore(transform, 0);
    }

    moveSelector(elements, { dx, dy }) { // change the new transform
        // TODO
        const transformList = getTransformList(this.operatorPoints.operatorPointsGroup);

        const transform = this.svgContent.createSVGTransform();
        transform.setTranslate(dx, dy);
        transformList.replaceItem(transform, 0);
    }

    /**
     * Move selector finish.
     *
     * Re-construct selector based on elements.
     */
    moveSelectorFinish(elements) {
        // SvgModel.completeElementTransform(this.operatorPoints.operatorPointsGroup);
        // reset selector
        this.resetSelector(elements);
    }

    resizeSelectorStart() {
        // Do nothing
    }

    // resizeSelector(elements, { scaleX, scaleY, centerX, centerY }) {
    resizeSelector(elements) {
        /*
        const transformList = getTransformList(this.operatorPoints.operatorPointsGroup);

        const scale = transformList.getItem(2);
        scale.setScale(scaleX, scaleY);

        const translate = transformList.getItem(0);
        translate.setTranslate(centerX, centerY);
        */

        // Reset selector on every mouse move to ensure handle size unchanged.
        this.resetSelector(elements);
    }

    resizeSelectorFinish(elements) {
        this.resetSelector(elements);
    }

    /**
     * Rotate selector start.
     */
    rotateSelectorStart() {
        const transformList = getTransformList(this.operatorPoints.operatorPointsGroup);

        const transform = this.svgContent.createSVGTransform();
        transform.setRotate(0, 0, 0);

        transformList.insertItemBefore(transform, 0);
    }

    rotateSelector(elements, { deltaAngle, cx, cy }) {
        const transformList = getTransformList(this.operatorPoints.operatorPointsGroup);

        const transform = transformList.getItem(0);
        transform.setRotate(deltaAngle, cx, cy);
    }

    rotateSelectorFinish(elements) {
        this.resetSelector(elements);
    }

    getElementAngle(element) { // get angleOld for elements rotation
        if (!element) {
            if (this.selectedElements.length !== 1) {
                // TODO: for multi-rotate, angleOld maybe not 0
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
        this.showSelectorResizeAndRotateGripsAndBox(show);
    }

    showSelectorResizeAndRotateGripsAndBox(show) {
        this.operatorPoints.showResizeGrips(show);
        this.operatorPoints.showRotateGrips(show);
        this.operatorPoints.showBox(show);
    }

    showSelectorResizeAndRotateGrips(show) {
        this.operatorPoints.showResizeGrips(show);
        this.operatorPoints.showRotateGrips(show);
    }

    appendTextCursor(cursor) {
        this.operatorPoints.operatorPointsGroup.appendChild(cursor);
    }
}

export default SVGContentGroup;
