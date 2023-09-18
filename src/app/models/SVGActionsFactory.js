import { isInside } from 'overlap-area';
import { DATA_PREFIX, MINIMUM_WIDTH_AND_HEIGHT } from '../constants';
import { coordGmSvgToModel } from '../ui/SVGEditor/element-utils';

// import { remapElement } from '../../widgets/SVGEditor/element-recalculate';
import { NS } from '../ui/SVGEditor/lib/namespaces';
import { isZero } from '../../shared/lib/utils';
import { generateModelDefaultConfigs, DEFAULT_TEXT_CONFIG } from './ModelInfoUtils';
import { computeTransformationSizeForTextVector } from '../flux/editor/actions-base';
import SvgModel from './SvgModel';
import api from '../api';
// import { DEFAULT_SCALE } from '../ui/SVGEditor/constants';
import { transformListToTransform, transformBox } from '../ui/SVGEditor/element-transform';

const coordGmModelToSvg = (size, transformation) => {
    // eslint-disable-next-line no-unused-vars
    const { width, height, positionX = 0, positionY = 0, rotationZ = 0 } = transformation;
    const x = positionX + size.x - width / 2;
    const y = size.y - positionY - height / 2;

    return {
        x,
        y,
        width,
        height,
        angle: -rotationZ / Math.PI * 180
    };
};


const svg = document.createElementNS(NS.SVG, 'svg');


// TODO: copied from element-transform, put it as util function
function getTransformList(elem) {
    const transform = elem.transform;
    if (!transform) {
        elem.setAttribute('transform', 'translate(0,0)');
    }
    return elem.transform.baseVal;
}

function genModelConfig(elem, size, materials = {}) {
    const coord = coordGmSvgToModel(size, elem);
    let deltaLeftX = 0, deltaRightX = 0, deltaTopY = 0, deltaBottomY = 0;
    if (elem.nodeName === 'text') {
        if (materials?.isRotate) {
            coord.positionY = materials.length / 2;
        } else {
            coord.positionY = 0;
        }
        coord.positionX = 0;
    }

    const isDraw = elem.getAttribute('id')?.includes('graph');
    if (elem.nodeName === 'path') {
        if (!isDraw) {
            coord.positionX = +elem.getAttribute('x') + coord.width / 2 * coord.scaleX - size.x;
            coord.positionY = size.y - (+elem.getAttribute('y')) - coord.height / 2 * coord.scaleY;
            deltaLeftX = 0.5;
            deltaRightX = 1;
            deltaTopY = 0.5;
            deltaBottomY = 1;
        }
    }

    // eslint-disable-next-line prefer-const
    let { x, y, width, height, positionX, positionY, scaleX, scaleY } = coord;
    if (!width) {
        width = MINIMUM_WIDTH_AND_HEIGHT;
    }
    if (!height) {
        height = MINIMUM_WIDTH_AND_HEIGHT;
    }
    // leave a little space for line width
    let vx = (x - deltaLeftX) * scaleX;
    let vy = (y - deltaTopY) * scaleY;
    let vwidth = (width + deltaRightX) * scaleX;
    let vheight = (height + deltaBottomY) * scaleY;

    width *= scaleX;
    height *= scaleY;

    let modelContent = '';
    if (elem instanceof SVGPathElement && isDraw) {
        const path = elem.getAttribute('d');
        const paths = SvgModel.calculationPath(path);
        const segments = paths.map(item => {
            const clone = elem.cloneNode(true);
            clone.setAttribute('d', item);
            clone.setAttribute('transform', 'scale(1 1)');
            clone.setAttribute('font-size', clone.getAttribute('font-size'));
            return new XMLSerializer().serializeToString(clone);
        });
        modelContent = segments.join('');
    } else {
        const clone = elem.cloneNode(true);
        clone.setAttribute('transform', `scale(${scaleX} ${scaleY})`);
        clone.setAttribute('font-size', clone.getAttribute('font-size'));
        modelContent = new XMLSerializer().serializeToString(clone);
    }

    if (scaleX < 0) {
        vx += vwidth;
        vwidth = -vwidth;
    }
    if (scaleY < 0) {
        vy += vheight;
        vheight = -vheight;
    }
    // Todo: need to optimize
    const content = `<svg x="0" y="0" width="${vwidth}mm" height="${vheight}mm" `
        + `viewBox="${vx} ${vy} ${vwidth} ${vheight}" `
        + `xmlns="http://www.w3.org/2000/svg">${modelContent}</svg>`;
    const model = {
        modelID: elem.getAttribute('id'),
        content: content,
        width: width,
        height: height,
        transformation: {
            positionX: positionX,
            positionY: positionY
        },
        config: {
            svgNodeName: elem.nodeName,
            text: elem.getAttribute('textContent'),
            alignment: 'left',
            'font-size': elem.getAttribute('font-size'),
            'font-family': elem.getAttribute('font-family')
        }
    };

    return model;
}

/*
// TODO: copied from element-transform, put it as util function
function transformBox(x, y, w, h, m) {
    const topLeft = transformPoint({ x, y }, m);
    const topRight = transformPoint({ x: x + w, y }, m);
    const bottomLeft = transformPoint({ x, y: y + h }, m);
    const bottomRight = transformPoint({ x: x + w, y: y + h }, m);

    const minX = Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x);
    const maxX = Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x);
    const minY = Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y);
    const maxY = Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y);

    return {
        tl: topLeft,
        tr: topRight,
        bl: bottomLeft,
        br: bottomRight,
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
    };
}
*/


class SVGActionsFactory {
    selectedSvgModels = [];

    drawModel = null;

    selectedElementsTransformation = {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        scaleX: 1,
        scaleY: 1,
        angle: 0
    };

    // deviation of moving with arrow keys
    onKeyMovingValue = {
        x: 0,
        y: 0
    };

    constructor(modelGroup) {
        this.modelGroup = modelGroup;

        this.size = {};
        this.svgContentGroup = null;
    }

    init(svgContentGroup) {
        this.svgContentGroup = svgContentGroup;
    }

    updateSize(size) {
        const data = [];
        if (this.svgContentGroup) {
            for (const node of this.svgContentGroup.getChildNodes()) {
                const transform = coordGmSvgToModel(this.size, node);
                data.push([node, transform]);
            }
        }
        this.size = {
            ...size
        };

        for (const svgModel of this.modelGroup.models) {
            svgModel.updateSize(this.size);
        }
        if (this.svgContentGroup) {
            for (const datum of data) {
                this.updateTransformation({
                    positionX: datum[1].positionX,
                    positionY: datum[1].positionY
                }, datum[0]);
            }
        }
    }

    addImageBackgroundToSVG(options) {
        const { x, y, width, height } = coordGmModelToSvg(this.size, options.transformation);
        const uploadPath = /^blob:/.test(options.uploadName) ? options.uploadName : `${DATA_PREFIX}/${options.uploadName}`;
        const elem = this.svgContentGroup.addSVGBackgroundElement({
            element: 'image',
            attr: {
                x: x,
                y: y,
                width: width,
                height: height,
                href: uploadPath,
                id: options.modelID,
                preserveAspectRatio: 'none'
            }
        });
        return {
            modelID: elem.getAttribute('id')
        };
    }

    updateElementImage(iamgeName) {
        const selected = this.svgContentGroup.getSelected();
        if (!selected) {
            return;
        }
        const imagePath = `${DATA_PREFIX}/${iamgeName}`;
        selected.setAttribute('href', imagePath);
    }

    updateSelectedElementsUniformScalingState(uniformScalingState) {
        const selectedSVGModels = this.selectedSvgModels;
        if (selectedSVGModels.length === 1) {
            selectedSVGModels[0].updateTransformation({ uniformScalingState });
        }
    }

    updateSvgModelImage(svgModel, imageName) {
        const imagePath = `${DATA_PREFIX}/${imageName}`;
        svgModel.elem.setAttribute('href', imagePath);
    }

    deleteSelectedElements() {
        const selectedElements = this.svgContentGroup.getSelectedElements();
        if (!selectedElements) {
            return;
        }
        this.svgContentGroup.deleteElements(selectedElements);
    }

    bringElementToFront(model) {
        const selected = model || this.svgContentGroup.getSelected();
        if (!selected) {
            return;
        }
        const childNodes = this.svgContentGroup.getChildNodes();
        let index;
        for (let i = 0; i < childNodes.length; i++) {
            const child = childNodes[i];
            if (child === selected) {
                index = i;
                break;
            }
        }
        if (childNodes[index] && childNodes[index + 1]) {
            const item = childNodes[index];
            this.svgContentGroup.group.appendChild(item);
        }
    }

    sendElementToBack() {
        const selected = this.svgContentGroup.getSelected();
        if (!selected) {
            return;
        }
        const childNodes = this.svgContentGroup.getChildNodes();
        let index;
        for (let i = 0; i < childNodes.length; i++) {
            const child = childNodes[i];
            if (child === selected) {
                index = i;
                break;
            }
        }
        if (childNodes[index] && childNodes[index - 1]) {
            const item = childNodes[index];
            this.svgContentGroup.group.insertBefore(item, childNodes[0]);
        }
    }

    // when single select
    updateTransformation(transformation, elem) {
        elem = elem || this.svgContentGroup.getSelected();
        if (!elem) {
            return;
        }
        if (!elem.visible) {
            return;
        }
        const bbox = coordGmSvgToModel(this.size, elem);
        const nbbox = coordGmModelToSvg(this.size, {
            ...bbox,
            ...transformation
        });
        if (transformation.positionX !== undefined || transformation.positionY !== undefined) {
            this.svgContentGroup.updateElementTranslate(elem, {
                translateX: nbbox.x - bbox.x,
                translateY: nbbox.y - bbox.y
            });
        }
        if ((transformation.width !== undefined || transformation.height !== undefined)
            && (!isZero(bbox.width) && !isZero(bbox.height))) {
            this.svgContentGroup.updateElementScale(elem, {
                x: nbbox.x,
                y: nbbox.y,
                scaleX: nbbox.width / bbox.width,
                scaleY: nbbox.height / bbox.height
            });
        }
        if (transformation.rotationZ !== undefined) {
            this.svgContentGroup.updateElementRotate(elem, {
                ...nbbox,
                angle: nbbox.angle
            });
        }
        if (transformation.uniformScalingState !== undefined) {
            this.svgContentGroup.setSelectedElementUniformScalingState(transformation.uniformScalingState);
        }
        // todo
        const posAndSize = this.svgContentGroup.selectOnly([elem]);
        this.modelGroup.updateSelectedGroupTransformation({
            positionX: posAndSize.positionX - this.size.x,
            positionY: this.size.y - posAndSize.positionY,
            width: posAndSize.width,
            height: posAndSize.height
        });
    }

    hideSelectedElement() {
        const selectedElement = this.svgContentGroup.getSelected();
        selectedElement.visible = false;
        // Set display=none will result in getbbox.width equal to 0, So use the visibility property to control the display state
        selectedElement.setAttribute('visibility', 'hidden');
        this.svgContentGroup.showSelectorGrips(false);
    }

    showSelectedElement() {
        const selectedElement = this.svgContentGroup.getSelected();
        selectedElement.visible = true;
        selectedElement.setAttribute('visibility', 'visible');
        this.svgContentGroup.showSelectorGrips(true);

        const t = SVGActionsFactory.calculateElementsTransformation(this.getSelectedElements());
        this._setSelectedElementsTransformation(t);
    }

    // createFromModel(relatedModel) {
    //     const { config } = relatedModel;
    //     const elem = this.svgContentGroup.addSVGElement({
    //         element: config.svgNodeName || 'image',
    //         attr: { id: relatedModel.modelID }
    //     });

    //     const svgModel = new SvgModel(elem, this.size);
    //     svgModel.setParent(this.svgContentGroup.group);

    //     relatedModel.relatedModels.svgModel = svgModel;
    //     svgModel.relatedModel = relatedModel;
    //     svgModel.refresh();
    // }

    getSVGModelByElement(elem) {
        for (const svgModel of this.modelGroup.models) {
            if (svgModel.elem === elem) {
                return svgModel;
            }
        }
        return null;
    }

    getModelsByElements(elems) {
        const svgModels = [];
        for (const svgModel of this.modelGroup.models) {
            if (elems.includes(svgModel.elem)) {
                svgModels.push(svgModel);
            }
        }
        return svgModels;
    }

    // TODO: move out as a helper function.



    addSelectedSvgModelsByModels(models, isRotate = false) {
        this.modelGroup.addSelectedModels(models);

        const isSelectedRotate3D = isRotate && models.find((model) => {
            return model.sourceType === 'image3d';
        });

        // Add each model to selected models, and recalculate selected group's transformation
        for (const model of models) {
            if (!this.selectedSvgModels.includes(model)) {
                this.selectedSvgModels.push(model);
                // todo
                const posAndSize = this.svgContentGroup.addToSelection([model.elem], isSelectedRotate3D);
                this.modelGroup.updateSelectedGroupTransformation({
                    positionX: posAndSize.positionX - this.size.x,
                    positionY: this.size.y - posAndSize.positionY,
                    width: posAndSize.width,
                    height: posAndSize.height
                });
            }
        }

        const t = SVGActionsFactory.calculateElementsTransformation(this.getSelectedElements());
        this._setSelectedElementsTransformation(t);
    }

    setSelectedSvgModelsByModels(models) {
        this.modelGroup.selectedModelArray = models;
        this.selectedSvgModels = models;
        const elems = models.map(model => model.elem);
        this.svgContentGroup.setSelection(elems);
    }

    resetSelection() {
        const transformation = this.modelGroup.getSelectedModelTransformation();

        const posAndSize = this.svgContentGroup.resetSelection(this.size, transformation);
        this.modelGroup.updateSelectedGroupTransformation({
            positionX: posAndSize.positionX - this.size.x,
            positionY: this.size.y - posAndSize.positionY,
            width: posAndSize.width,
            height: posAndSize.height
        });

        // hide operator when model hide
        const selectedModels = this.modelGroup.getSelectedModelArray();
        if (selectedModels && selectedModels.length === 1 && !selectedModels[0].visible) {
            this.svgContentGroup.showSelectorResizeAndRotateGrips(false);
        }
    }

    resetSelectionNotResetList(elements) {
        const posAndSize = this.svgContentGroup.operatorPoints.resizeGrips(elements);
        const model = this.getModelsByElements(elements)[0];
        model.updateTransformation({
            positionX: posAndSize.positionX - this.size.x,
            positionY: this.size.y - posAndSize.positionY,
            width: posAndSize.width,
            height: posAndSize.height
        });
    }

    _pasteFrom(models) {
        this.clearSelection();
        const newSVGModels = [];
        models.forEach((clonedSVGModel) => {
            clonedSVGModel.transformation.positionX += 5;
            clonedSVGModel.transformation.positionY -= 5;
            clonedSVGModel.setParent(this.svgContentGroup.group);
            const svgModel = clonedSVGModel.clone(this.modelGroup);
            clonedSVGModel.elem.remove();

            const INDEXMARGIN = 0.02;
            svgModel.elem.id = svgModel.modelID;
            svgModel.setParent(this.svgContentGroup.group);
            svgModel.setPreSelection(this.svgContentGroup.preSelectionGroup);
            const modelNameObj = this.modelGroup._createNewModelName(svgModel);
            svgModel.modelName = modelNameObj.name;
            svgModel.baseName = modelNameObj.baseName;
            this.modelGroup.resetModelsPositionZByOrder();
            svgModel.transformation.positionZ = (this.modelGroup.models.length + 1) * INDEXMARGIN;
            svgModel.onTransform();
            this.modelGroup.models.push(svgModel);
            newSVGModels.push(svgModel);
        });
        this.addSelectedSvgModelsByModels(newSVGModels);
        this.svgContentGroup.resetSelector(newSVGModels.map(model => model.elem));
        this.modelGroup.models = [...this.modelGroup.models];
        this.modelGroup.modelChanged();
    }

    copy() {
        this.modelGroup.clipboard = this.modelGroup.getSelectedModelArray().map(item => item.clone(this.modelGroup));
    }

    paste() {
        this._pasteFrom(this.modelGroup.clipboard);
    }

    duplicateSelectedModel() {
        const selectedModels = this.modelGroup.getSelectedModelArray().map(item => item.clone(this.modelGroup));
        this._pasteFrom(selectedModels);
    }

    /**
     * Create model (SVGModel, Model, etc) from element.
     *
     * @returns {Promise<void>}
     */
    async createModelFromElement(element) {
        const headType = this.modelGroup.headType;
        const isRotate = this.modelGroup.materials && this.modelGroup.materials.isRotate;

        const data = genModelConfig(element, this.size, this.modelGroup.materials);
        const { modelID, content, width: dataWidth, height: dataHeight, transformation, config: elemConfig } = data;
        let res, textSize;
        try {
            const isText = element.nodeName === 'text';
            if (isText) {
                const newConfig = {
                    ...DEFAULT_TEXT_CONFIG,
                    ...elemConfig
                };
                res = await api.convertTextToSvg(newConfig);
                if (res.body.family !== elemConfig['font-family']) {
                    elemConfig['font-family'] = res.body.family;
                }
                textSize = computeTransformationSizeForTextVector(newConfig.text, newConfig['font-size'], newConfig['line-height'], {
                    width: res.body?.sourceWidth,
                    height: res.body?.sourceHeight
                });
            } else {
                const blob = new Blob([content], { type: 'image/svg+xml' });
                const file = new File([blob], `${modelID}.svg`);

                const formData = new FormData();
                formData.append('image', file);
                res = await api.uploadImage(formData);
            }
            const { originalName, uploadName, sourceWidth, sourceHeight } = res.body;
            const sourceType = 'svg';
            const mode = 'vector';
            let { config, gcodeConfig } = generateModelDefaultConfigs(headType, sourceType, mode, isRotate);
            config = { ...config, ...elemConfig };
            gcodeConfig = { ...gcodeConfig };

            const options = {
                modelID,
                limitSize: this.size,
                headType,
                sourceType,
                mode,
                originalName,
                uploadName,
                sourceWidth: sourceWidth,
                sourceHeight: sourceHeight,
                width: isText ? textSize.width : dataWidth,
                height: isText ? textSize.height : dataHeight,
                transformation,
                config,
                gcodeConfig,
                elem: element,
                size: this.size
            };
            const svgModel = this.modelGroup.addModel(options);
            svgModel.setParent(this.svgContentGroup.group);
            svgModel.setPreSelection(this.svgContentGroup.preSelectionGroup);
            return svgModel;
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    updateElementToImage(element, options) {
        if (element.nodeName === 'image') {
            return;
        }
        const model = this.getSVGModelByElement(element);

        const transformList = SvgModel.getTransformList(element);
        const scaleX = transformList.getItem(2).matrix.a;
        const scaleY = transformList.getItem(2).matrix.d;
        const angle = transformList.getItem(1).angle;

        this.svgContentGroup.deleteElement(element);
        const { x, y, width, height } = coordGmModelToSvg(this.size, options.transformation);
        const newElement = this.svgContentGroup.addSVGElement({
            element: 'image',
            attr: {
                id: model.modelID,
                x: x,
                y: y,
                width: width,
                height: height,
                href: `${DATA_PREFIX}/${options.processImageName}`,
            }
        });

        SvgModel.recalculateElementTransformList(newElement, {
            x: 0,
            y: 0,
            scaleX,
            scaleY,
            angle
        });

        model.elem = newElement;
    }

    selectAllElements(isRotate = false) {
        this.clearSelection();
        const childNodes = this.svgContentGroup.group.children;
        const nodes = [];
        for (const node of childNodes) {
            const svgModel = this.getSVGModelByElement(node);
            if (svgModel !== null && svgModel?.visible) {
                // this.selectElements([node]);
                nodes.push(node);
            }
        }
        // this.svgContentGroup.addToSelection(nodes);
        this.selectElements(nodes, isRotate);
    }

    /**
     * Select elements.
     *
     * @param elements
     */
    selectElements(elements, isRotate = false) {
        const svgModels = [];
        for (const svgModel of this.modelGroup.models) {
            if (elements.includes(svgModel.elem)) {
                this.selectedSvgModels.push(svgModel);
                // todo, not modelGroup here, use flux/editor
                if (this.modelGroup) {
                    svgModels.push(svgModel);
                }
            }
        }
        const isSelectedRotate3D = isRotate && this.selectedSvgModels.find((model) => {
            return model.sourceType === 'image3d';
        });
        this.svgContentGroup.addToSelection(elements, isSelectedRotate3D);
        this.modelGroup.addSelectedModels(svgModels);

        const selectedElements = this.svgContentGroup.selectedElements;
        this.modelGroup.selectedModelArray = [...this.modelGroup.selectedModelArray];
        // update selector
        this._resetSelector(selectedElements);

        // update t
        const t = SVGActionsFactory.calculateElementsTransformation(selectedElements);
        this._setSelectedElementsTransformation(t);
    }

    /**
     * Get all elements.
     */
    getAllModelElements() {
        const elements = [];
        for (const model of this.modelGroup.models) {
            elements.push(model.elem);
        }
        return elements;
    }

    /**
     * Get <path id='selected-elements-box'></path> SVGElement boundingBox, which contains all the selected visible children SVGElements
     * @returns {SVGRect} {x, y, width, height}
     */
    getSelectedElementsBoundingBox() {
        return document.querySelector('#selected-elements-box').getBBox();
    }

    /**
     * Get selected elements.
     *
     * @returns {SVGElement[]} - returns list of selected elements.
     */
    getSelectedElements() {
        if (this.svgContentGroup) {
            return this.svgContentGroup.getSelectedElements();
        } else {
            return [];
        }
    }

    /**
     * Get selected SVG models.
     *
     * @returns {SvgModel[]} - returns list of selected SVG models.
     */
    getSelectedSVGModels() {
        return this.selectedSvgModels;
    }

    /**
     * Get selected elements transformation.
     * This is readonly from outside of the class.
     *
     * @returns {{scaleX: number, scaleY: number, x: number, width: number, y: number, angle: number, height: number}}
     */
    getSelectedElementsTransformation() {
        if (this.selectedSvgModels.length === 0) {
            return {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                scaleX: 1,
                scaleY: 1,
                angle: 0
            };
        }
        return this.selectedElementsTransformation;
    }

    isPointInSelectArea(point) {
        if (this.selectedSvgModels.length === 0) {
            return false;
        }
        return this.selectedSvgModels.some((model) => {
            return isInside(point, model.vertexPoints);
        });
    }

    /**
     * Update internal cached variable `selectedElementsTransformation` to `t`.
     *
     * @param t
     * @private
     */
    _setSelectedElementsTransformation(t = {}) {
        this.selectedElementsTransformation = {
            ...this.selectedElementsTransformation,
            ...t
        };
    }

    static calculateElementsTransformation(elements) {
        if (elements.length === 0) {
            return {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                scaleX: 1,
                scaleY: 1,
                angle: 0
            };
        }

        if (elements.length === 1) {
            const element = elements[0];

            const { x, y, width, height } = element.getBBox();
            const center = {
                x: x + width / 2,
                y: y + height / 2
            };

            const transformList = SvgModel.getTransformList(element);

            // const transform = transformList.getItem(0);
            const scaleX = transformList.getItem(2).matrix.a;
            const scaleY = transformList.getItem(2).matrix.d;
            const angle = transformList.getItem(1).angle;

            return {
                x: center.x,
                y: center.y,
                width,
                height,
                scaleX,
                scaleY,
                angle
            };
        } else {
            // Note: old transformation calculation is in method OperatorPoints.resizeGrips(), it uses
            //   four corners (control points) to calculate bounding box of selected elements. it's
            //   AABB of OBBs, not AABB of contents.
            // TODO: duplicate work of OBB calculation.

            // calculate AABB
            let minX = Number.MAX_VALUE;
            let minY = Number.MAX_VALUE;
            let maxX = -Number.MAX_VALUE;
            let maxY = -Number.MAX_VALUE;

            for (const element of elements) {
                const { x, y, width, height } = element.getBBox();

                const transformList = getTransformList(element);
                const transform = transformListToTransform(transformList);

                const box = transformBox(x, y, width, height, transform.matrix); // OBB

                minX = Math.min(minX, box.tl.x, box.tr.x, box.bl.x, box.br.x);
                maxX = Math.max(maxX, box.tl.x, box.tr.x, box.bl.x, box.br.x);

                minY = Math.min(minY, box.tl.y, box.tr.y, box.bl.y, box.br.y);
                maxY = Math.max(maxY, box.tl.y, box.tr.y, box.bl.y, box.br.y);
            }

            // calculate combined t (AABB)
            const center = {
                x: (minX + maxX) / 2,
                y: (minY + maxY) / 2
            };
            const combinedWidth = maxX - minX;
            const combinedHeight = maxY - minY;

            return {
                x: center.x,
                y: center.y,
                width: combinedWidth,
                height: combinedHeight,
                scaleX: 1,
                scaleY: 1,
                angle: 0
            };
        }
    }

    _resetSelector(elements) {
        this.svgContentGroup.resetSelector(elements);
    }

    /**
     * Clear selection of elements.
     */
    clearSelection() {
        this.svgContentGroup.clearSelection();

        this.selectedSvgModels = [];

        // FIXME: this will call render eventually.
        this.modelGroup.emptySelectedModelArray();

        // update t
        const t = SVGActionsFactory.calculateElementsTransformation([]);
        this._setSelectedElementsTransformation(t);
    }

    /**
     * Move elements start.
     *
     * Prepend [T = (0, 0)] to transform list, make transform list [T][T][R][S][T].
     *
     * @param elements - List of SVGElement
     */
    moveElementsStart(elements) {
        // Prepend [T] to transform list
        for (const element of elements) {
            const transformList = getTransformList(element);

            const transform = svg.createSVGTransform();
            transform.setTranslate(0, 0);

            transformList.insertItemBefore(transform, 0);
        }
        // link to 4-asix from homepage, this.svgContentGroup is null
        !!this.svgContentGroup && this.svgContentGroup.moveSelectorStart();
    }

    /**
     * Move elements (moving).
     *
     * Modify the first [T] of transform list.
     *
     * @param elements - TODO
     * @param dx - delta X since move start
     * @param dy - delta Y since move start
     */
    moveElements(elements, { dx = 0, dy = 0 }) {
        for (const element of elements) {
            const transformList = getTransformList(element);

            const transform = transformList.getItem(0);
            transform.setTranslate(dx, dy);
        }

        // TODO: refactor this
        // const transform = svg.createSVGTransform();
        // transform.setTranslate(dx, dy);
        !!this.svgContentGroup && this.svgContentGroup.moveSelector(elements, { dx, dy });
    }

    /**
     * After Move elements.
     */
    moveElementsFinish(elements) {
        for (const element of elements) {
            SvgModel.completeElementTransform(element);
            this.getSVGModelByElement(element).onTransform();
        }

        // update selector
        !!this.svgContentGroup && this.svgContentGroup.moveSelectorFinish(elements);

        // update t
        const t = SVGActionsFactory.calculateElementsTransformation(elements);
        this._setSelectedElementsTransformation(t);
    }

    /**
     * Move selected elements by arrow key on key down.
     */
    moveElementsOnArrowKeyDown(elements, { dx, dy }) {
        // Key move start
        if (this.onKeyMovingValue.x === 0 && this.onKeyMovingValue.y === 0) {
            if (elements === null) {
                this.moveElementsStart(this.getSelectedElements());
            } else {
                this.moveElementsStart(elements);
            }
        }

        // replace key move
        this.onKeyMovingValue.x += dx;
        this.onKeyMovingValue.y += dy;
        if (elements === null) {
            this.moveElements(this.getSelectedElements(), {
                dx: this.onKeyMovingValue.x,
                dy: this.onKeyMovingValue.y
            });
        } else {
            this.moveElements(elements, { dx, dy });
        }
    }

    /**
     * Move selected elements by arrow key on key up.
     */
    moveElementsOnArrowKeyUp() {
        const elements = this.getSelectedElements();
        this.moveElementsFinish(elements);

        this.onKeyMovingValue.x = 0;
        this.onKeyMovingValue.y = 0;
    }

    /**
     * Move selected elements by writing variable in Transformation.
     */
    moveElementsImmediately(elements, { newX, newY }) {
        if (!elements || elements.length === 0) {
            return;
        }

        if (elements.length === 1) {
            const element = elements[0];
            const { x, y, width, height } = element.getBBox();

            newX = newX === undefined ? x + width / 2 : newX;
            newY = newY === undefined ? y + height / 2 : newY;

            const transformList = SvgModel.getTransformList(element);

            const angle = transformList.getItem(1).angle;
            const scaleX = transformList.getItem(2).matrix.a;
            const scaleY = transformList.getItem(2).matrix.d;

            SvgModel.recalculateElementAttributes(element, {
                x: newX,
                y: newY,
                width,
                height,
                scaleX,
                scaleY,
                angle
            });
            this.getSVGModelByElement(element).onTransform();
        } else {
            const t = SVGActionsFactory.calculateElementsTransformation(elements);

            // new center
            newX = newX === undefined ? t.x : newX;
            newY = newY === undefined ? t.y : newY;

            // Move each element by (new center - old center)
            // Note that multi-model can be unified with
            for (const element of elements) {
                const { width, height } = element.getBBox();

                const transformList = SvgModel.getTransformList(element);

                const moveX = transformList.getItem(0).matrix.e;
                const moveY = transformList.getItem(0).matrix.f;
                const angle = transformList.getItem(1).angle;
                const scaleX = transformList.getItem(2).matrix.a;
                const scaleY = transformList.getItem(2).matrix.d;

                SvgModel.recalculateElementAttributes(element, {
                    x: moveX + (newX - t.x),
                    y: moveY + (newY - t.y),
                    width,
                    height,
                    scaleX,
                    scaleY,
                    angle
                });
                this.getSVGModelByElement(element).onTransform();
            }
        }

        // update selector
        this._resetSelector(elements);

        // update t
        const t = SVGActionsFactory.calculateElementsTransformation(elements);
        this._setSelectedElementsTransformation(t);
    }


    /**
     * Get selected element's uniform scaling state for resizing.
     */

    getSelectedElementsUniformScalingState() {
        if (this.selectedSvgModels.length !== 1) {
            return false;
        }
        const model = this.selectedSvgModels[0];
        return model.transformation.uniformScalingState;
    }

    /**
     * Resize elements start.
     *
     * Note that we only support resize on single element.
     *
     * @param elements - List of SVGElement
     */
    // resizeElementsStart(elements) {
    resizeElementsStart() {
        // Do nothing
        this.svgContentGroup.resizeSelectorStart();
    }

    /**
     * Resize elements (resizing).
     *
     * Modify scale ratio and center point.
     *
     * @param elements - List of SVGElement
     * @param scaleX
     * @param scaleY
     * @param centerX
     * @param centerY
     */
    resizeElements(elements, { scaleX, scaleY, centerX, centerY }) {
        if (elements.length !== 1) {
            return;
        }

        // TODO: Do scale on multiple models
        const element = elements[0];

        // Set scale and translate on transformList
        // [T][R][S][T]
        const transformList = getTransformList(element);

        const scale = transformList.getItem(2);
        scale.setScale(scaleX, scaleY);

        const translate = transformList.getItem(0);
        translate.setTranslate(centerX, centerY);

        this.svgContentGroup.resizeSelector(elements, { scaleX, scaleY, centerX, centerY });

        // const posAndSize = this.svgContentGroup.operatorPoints.resizeGrips(this.svgContentGroup.selectedElements);
        /*
        // TODO: refactor
        this.modelGroup.updateSelectedGroupTransformation({
            positionX: posAndSize.positionX - this.size.x,
            positionY: this.size.y - posAndSize.positionY,
            width: posAndSize.width,
            height: posAndSize.height
        });
        */
    }

    /**
     * Resize elements finish.
     *
     * Normalize transform list (and element attributes).
     *
     * @param elements
     */
    resizeElementsFinish(elements) {
        if (elements.length !== 1) {
            return;
        }

        const element = elements[0];

        SvgModel.completeElementTransform(element);
        this.getSVGModelByElement(element).onTransform();

        // update selector
        this.svgContentGroup.resizeSelectorFinish(elements);

        // update t
        const t = SVGActionsFactory.calculateElementsTransformation(elements);
        this._setSelectedElementsTransformation(t);
    }

    /**
     * Resize elements immediately.
     *
     * @param elements
     * @param newWidth
     * @param newHeight
     */
    resizeElementsImmediately(elements, { newWidth, newHeight, imageWidth, imageHeight }) {
        if (!elements || elements.length === 0) {
            return;
        }

        if (elements.length === 1) {
            const element = elements[0];

            const transformList = SvgModel.getTransformList(element);
            const angle = transformList.getItem(1).angle;
            const scaleX = transformList.getItem(2).matrix.a;
            const scaleY = transformList.getItem(2).matrix.d;

            const { x, y, width, height } = element.getBBox();

            newWidth = newWidth === undefined ? width * Math.abs(scaleX) : newWidth;
            newHeight = newHeight === undefined ? height * Math.abs(scaleY) : newHeight;

            const signScaleX = scaleX > 0 ? 1 : -1;
            const signScaleY = scaleY > 0 ? 1 : -1;

            SvgModel.recalculateElementAttributes(element, {
                x: x + width / 2,
                y: y + height / 2,
                width: imageWidth || width,
                height: imageHeight || height,
                scaleX: newWidth / width * signScaleX,
                scaleY: newHeight / height * signScaleY,
                angle
            });
            this.getSVGModelByElement(element).onTransform();
        } else {
            // not supported
        }

        // update selector
        this._resetSelector(elements);

        // update t
        const t = SVGActionsFactory.calculateElementsTransformation(elements);
        this._setSelectedElementsTransformation(t);
    }

    /**
     * Flip elements horizontally.
     *
     * @param elements
     */
    flipElementsHorizontally(elements) {
        if (elements.length !== 1) {
            return;
        }

        for (const element of elements) {
            const transformList = SvgModel.getTransformList(element);

            const scaleTransform = transformList.getItem(2);
            const scaleX = scaleTransform.matrix.a;
            const scaleY = scaleTransform.matrix.d;

            scaleTransform.setScale(-scaleX, scaleY);
            this.getSVGModelByElement(element).onTransform();
        }

        // update selector
        this._resetSelector(elements);

        // update t
        const t = SVGActionsFactory.calculateElementsTransformation(elements);
        this._setSelectedElementsTransformation(t);
    }

    /**
     * Flip elements vertically.
     *
     * @param elements
     */
    flipElementsVertically(elements) {
        if (elements.length !== 1) {
            return;
        }

        for (const element of elements) {
            const transformList = SvgModel.getTransformList(element);

            const scaleTransform = transformList.getItem(2);
            const scaleX = scaleTransform.matrix.a;
            const scaleY = scaleTransform.matrix.d;

            scaleTransform.setScale(scaleX, -scaleY);
            this.getSVGModelByElement(element).onTransform();
        }

        // update selector
        this._resetSelector(elements);

        // update t
        const t = SVGActionsFactory.calculateElementsTransformation(elements);
        this._setSelectedElementsTransformation(t);
    }

    /**
     * Reset Flip elements.
     *
     * @param elements
     */
    resetFlipElements(elements, newScale = {}) {
        if (elements.length !== 1) {
            return;
        }

        for (const element of elements) {
            const transformList = SvgModel.getTransformList(element);

            const scaleTransform = transformList.getItem(2);
            const scaleX = newScale.x === undefined ? Math.abs(scaleTransform.matrix.a) : newScale.x;
            const scaleY = newScale.y === undefined ? Math.abs(scaleTransform.matrix.d) : newScale.y;

            scaleTransform.setScale(scaleX, scaleY);
            this.getSVGModelByElement(element).onTransform();
        }

        // update selector
        this._resetSelector(elements);

        // update t
        const t = SVGActionsFactory.calculateElementsTransformation(elements);
        this._setSelectedElementsTransformation(t);
    }

    /**
     * Rotate elements start.
     *
     * Prepend [R = (0, 0, 0)] to transform list, make transform list [R][T][R][S][T].
     *
     */
    rotateElementsStart(elements, { cx, cy }) {
        for (const element of elements) {
            const transformList = getTransformList(element);

            const transform = svg.createSVGTransform();
            transform.setRotate(0, cx, cy);

            transformList.insertItemBefore(transform, 0);
        }

        this.svgContentGroup.rotateSelectorStart();
    }

    /**
     * Rotate element.
     */
    // rotateElement(element, { angle, cx, cy }) {
    // }

    /**
     * Rotate elements (rotating).
     *
     * Modify rotate angle and center point.
     *
     * @param elements
     * @param angle
     * @param cx
     * @param cy
     */
    rotateElements(elements, { deltaAngle, cx, cy }) {
        for (const element of elements) {
            const transformList = getTransformList(element);

            const transform = transformList.getItem(0);
            transform.setRotate(deltaAngle, cx, cy);
        }

        this.svgContentGroup.rotateSelector(elements, { deltaAngle, cx, cy });
    }

    /**
     * Rotate elements finish.
     */
    rotateElementsFinish(elements) {
        for (const element of elements) {
            SvgModel.completeElementTransform(element);
            this.getSVGModelByElement(element).onTransform();
        }

        // update selector
        this.svgContentGroup.rotateSelectorFinish(elements);

        // update t
        const t = SVGActionsFactory.calculateElementsTransformation(elements);
        this._setSelectedElementsTransformation(t);
        /*
        for (const svgModel of selectedModels) {
            const elem = svgModel.elem;

            const rotateBox = svg.createSVGTransform();
            rotateBox.setRotate(deviation.deltaAngle, deviation.cx, deviation.cy);

            const startBbox = getBBox(elem);
            const startCenter = svg.createSVGPoint();
            startCenter.x = startBbox.x + startBbox.width / 2;
            startCenter.y = startBbox.y + startBbox.height / 2;

            const endCenter = startCenter.matrixTransform(rotateBox.matrix);
            // why model new center?
            const modelNewCenter = svgModel.pointSvgToModel(endCenter);

            const model = svgModel.relatedModel;
            const rotationZ = ((model.transformation.rotationZ * 180 / Math.PI - deviation.deltaAngle + 540) % 360 - 180) * Math.PI / 180;
            const positionX = modelNewCenter.x;
            const positionY = modelNewCenter.y;

            // <path> cannot use this
            // because it has no xy
            if (svgModel.type !== 'path') {
                model.updateAndRefresh({
                    transformation: {
                        positionX: positionX,
                        positionY: positionY,
                        rotationZ: rotationZ
                    }
                });
            } else {
                // TODO: sometimes cannot move right position
                model.updateAndRefresh({
                    transformation: {
                        rotationZ: rotationZ
                    }
                });

                const transform = svg.createSVGTransform();
                transform.setTranslate(modelNewCenter.x - model.transformation.positionX, -(modelNewCenter.y - model.transformation.positionY));
                const transformList = elem.transform.baseVal;
                transformList.insertItemBefore(transform, 0);
                svgModel.onUpdate();
            }
        }
        */
    }

    /**
     * Rotate elements immediately.
     *
     * @param elements
     * @param newAngle
     */
    rotateElementsImmediately(elements, { newAngle }) {
        if (!elements || elements.length === 0) {
            return;
        }

        if (elements.length === 1) {
            const element = elements[0];

            const transformList = SvgModel.getTransformList(element);

            // const angle = transformList.getItem(1).angle;
            const scaleX = transformList.getItem(2).matrix.a;
            const scaleY = transformList.getItem(2).matrix.d;

            const { x, y, width, height } = element.getBBox();

            SvgModel.recalculateElementAttributes(element, {
                x: x + width / 2,
                y: y + height / 2,
                width,
                height,
                scaleX,
                scaleY,
                angle: newAngle
            });
            this.getSVGModelByElement(element).onTransform();
        } else {
            // not supported yet
        }

        // update selector
        this._resetSelector(elements);

        // update t
        const t = SVGActionsFactory.calculateElementsTransformation(elements);
        this._setSelectedElementsTransformation(t);
    }

    /**
     * Create text.
     *
     * @param {string} content
     */
    createText(content, position) {
        return this.svgContentGroup.addSVGElement({
            element: 'text',
            attr: {
                x: this.size.x + position.x,
                y: this.size.y + position.y,
                'font-size': 24,
                'font-family': 'Arial Black',
                style: 'Regular',
                alignment: 'left',
                textContent: content
            }
        });
    }

    /**
     * Modify text element.
     *
     * Note: lineHeight and Alignment are not supported in current version.
     *
     * @param element
     * @param options
     *        - text: new text content
     *        - fontFamily
     *        - fontSize
     */
    modifyText(element, options) {
        // only support single selected text element
        if (!element && this.selectedSvgModels.length > 1) return;
        const model = element ? this.getSVGModelByElement(element) : this.selectedSvgModels[0];

        // Update model
        const { logicalX, logicalY, scaleX, scaleY, angle } = model;
        const newConfig = {
            ...DEFAULT_TEXT_CONFIG,
            ...model.config
        };

        if (options.text !== undefined) {
            newConfig.text = options.text;
        }
        if (options.alignment !== undefined) {
            newConfig.alignment = options.alignment;
        }

        if (options.fontFamily !== undefined) {
            newConfig['font-family'] = options.fontFamily;
        }

        if (options.fontSize !== undefined) {
            newConfig['font-size'] = options.fontSize;
        }
        if (options.style !== undefined) {
            newConfig.style = options.style;
        }

        api.convertTextToSvg(newConfig)
            .then(async (res) => {
                const { originalName, uploadName, sourceWidth, sourceHeight } = res.body;
                const textSize = computeTransformationSizeForTextVector(newConfig.text, newConfig['font-size'], newConfig['line-height'], {
                    width: sourceWidth,
                    height: sourceHeight
                });

                const baseUpdateData = {
                    sourceWidth: sourceWidth,
                    sourceHeight: sourceHeight,
                    width: textSize.width,
                    height: textSize.height,
                    originalName,
                    uploadName,
                    transformation: {
                        positionX: logicalX,
                        positionY: logicalY,
                        width: model.transformation.width / model.width * textSize.width,
                        height: model.transformation.height / model.height * textSize.height,
                        scaleX,
                        scaleY,
                        rotationZ: -angle * Math.PI / 180
                    }
                };
                this.updateElementImage(uploadName);
                model.updateAndRefresh({
                    ...baseUpdateData,
                    config: newConfig
                });
                this._setSelectedElementsTransformation({
                    width: baseUpdateData.transformation.width,
                    height: baseUpdateData.transformation.height,
                });

                this.resetSelection();
            });
    }
}

export default SVGActionsFactory;
