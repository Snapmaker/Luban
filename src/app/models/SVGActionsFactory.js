import { DATA_PREFIX } from '../constants';
import { coordGmSvgToModel, getBBox } from '../ui/SVGEditor/element-utils';

// import { remapElement } from '../../widgets/SVGEditor/element-recalculate';
import { NS } from '../ui/SVGEditor/lib/namespaces';
import { isZero } from '../../shared/lib/utils';
import { generateModelDefaultConfigs } from './ModelInfoUtils';
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

function genModelConfig(elem, size) {
    const coord = coordGmSvgToModel(size, elem);

    // eslint-disable-next-line prefer-const
    let { x, y, width, height, positionX, positionY, scaleX, scaleY } = coord;
    width *= scaleX;
    height *= scaleY;

    const clone = elem.cloneNode(true);
    clone.setAttribute('transform', `scale(${scaleX} ${scaleY})`);
    clone.setAttribute('font-size', clone.getAttribute('font-size'));

    let vx = x * scaleX;
    let vy = y * scaleY;
    let vwidth = width;
    let vheight = height;

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
        + `xmlns="http://www.w3.org/2000/svg">${new XMLSerializer().serializeToString(clone)}</svg>`;
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
            text: elem.textContent,
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
        const uploadPath = `${DATA_PREFIX}/${options.uploadName}`;
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

    bringElementToFront() {
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

    // multi select
    /**
     *
     * @param transformation
     *
     *      - uniformScalingState
     *      - positionX, positionY,
     *      - rotationZ
     *      - scaleX, scaleY, width, height
     */
    updateSelectedElementsTransformation(transformation) {
        const selectedSVGModels = this.selectedSvgModels;
        const elements = this.svgContentGroup.selectedElements;
        if (elements.length === 0) {
            return;
        }

        const { uniformScalingState, rotationZ, scaleX, scaleY, width, height } = transformation;
        let { positionX, positionY } = transformation;

        // Update uniform scaling state
        if (uniformScalingState !== undefined) {
            if (selectedSVGModels.length === 1) {
                const model = selectedSVGModels[0];
                model.updateTransformation({ uniformScalingState: transformation.uniformScalingState });
            }
        }

        // Update Position X, Y
        if (positionX !== undefined || positionY !== undefined) {
            const transformationOld = this.modelGroup.getSelectedModelTransformation();
            if (positionX === undefined) {
                positionX = transformationOld.positionX;
            }
            if (positionY === undefined) {
                positionY = transformationOld.positionY;
            }

            const dx = positionX - transformationOld.positionX;
            const dy = -(positionY - transformationOld.positionY);

            // Modifications on SVG Element
            // mouse down (create createSVGTransform = translate(0, 0))
            this.svgContentGroup.translateSelectedElementsOnMouseDown();
            const transform = svg.createSVGTransform();
            transform.setTranslate(dx, dy);

            // mouse move (replace SVGTransform)
            this.svgContentGroup.translateSelectedElementsOnMouseMove(transform);

            this.updateSelectedModelsByTransformation({ dx, dy });
        }

        // Update rotation
        if (rotationZ !== undefined) {
            // mouse up
            const { x: cx, y: cy } = this.svgContentGroup.operatorPoints.getCenterPoint();

            // calculate delta angle from rotationZ
            const angle = -rotationZ * 180 / Math.PI;
            const angleOld = -this.modelGroup.getSelectedModelTransformation().rotationZ * 180 / Math.PI; // always 0
            const deltaAngle = (angle - angleOld + 540) % 360 - 180;

            //
            this.updateSelectedModelsByTransformation({ cx, cy, deltaAngle });
        }

        // Update scale
        if ((scaleX !== undefined || scaleY !== undefined)) {
            this.updateSelectedModelsByTransformation({
                scaleX, width, scaleY, height
            });
        }

        for (const model of selectedSVGModels) {
            model.onTransform();
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
        selectedElement.setAttribute('display', 'none');
        this.svgContentGroup.showSelectorGrips(false);
    }

    showSelectedElement() {
        const selectedElement = this.svgContentGroup.getSelected();
        selectedElement.visible = true;
        selectedElement.setAttribute('display', 'inherit');
        this.svgContentGroup.showSelectorGrips(true);
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


    /**
     *
     * @param deviation
     *      - dx, dy
     *      - cx, cy, deltaAngle
     *      - scaleX
     *      - scaleY
     */
    updateSelectedModelsByTransformation(deviation) { // todo, just after move now
        const elements = this.svgContentGroup.selectedElements;

        const selectedModels = this.selectedSvgModels;
        const selectedModelsTransformation = this.modelGroup.getSelectedModelTransformation();
        const transformation = {
            positionX: selectedModelsTransformation.positionX,
            positionY: selectedModelsTransformation.positionY,
            rotationZ: selectedModelsTransformation.rotationZ,
            scaleX: selectedModelsTransformation.scaleX,
            scaleY: selectedModelsTransformation.scaleY
        };

        // comeback to transform before mouse down
        // for (const svgModel of selectedModels) {
        //     this.setElementTransformToList(this.svgContentGroup.operatorPoints.operatorPointsGroup.transform.baseVal, svgModel.relatedModel.transformation);
        // }

        // translate after mouseup
        if (deviation.dx || deviation.dy) {
            // translate models
            for (const svgModel of selectedModels) {
                svgModel.onUpdate();
            }

            // translate operationGrips
            transformation.positionX = selectedModelsTransformation.positionX + deviation.dx;
            transformation.positionY = selectedModelsTransformation.positionY - deviation.dy;
        }

        // rotate after mouseup
        if (deviation.deltaAngle) {
            // translate and rotate models

            // FIXME
            for (const model of selectedModels) {
                const elem = model.elem;

                const rotateBox = svg.createSVGTransform();
                rotateBox.setRotate(deviation.deltaAngle, deviation.cx, deviation.cy);

                const startBbox = getBBox(elem);
                const startCenter = svg.createSVGPoint();
                startCenter.x = startBbox.x + startBbox.width / 2;
                startCenter.y = startBbox.y + startBbox.height / 2;

                const endCenter = startCenter.matrixTransform(rotateBox.matrix);
                // why model new center?
                const modelNewCenter = model.pointSvgToModel(endCenter);

                const rotationZ = ((model.transformation.rotationZ * 180 / Math.PI - deviation.deltaAngle + 540) % 360 - 180) * Math.PI / 180;
                const positionX = modelNewCenter.x;
                const positionY = modelNewCenter.y;

                // <path> cannot use this
                // because it has no xy
                if (model.type !== 'path') {
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
                    model.onUpdate();
                }
            }

            // for (const svgModel of selectedModels) {
            //     svgModel.onUpdate();
            // }

            // rotate operationGrips
            transformation.rotationZ = ((transformation.rotationZ * 180 / Math.PI - deviation.deltaAngle + 180) % 360 - 180) * Math.PI / 180;
        }

        if (deviation.scaleX !== undefined || deviation.scaleY !== undefined) {
            const element = elements[0];
            const model = this.getSVGModelByElement(element);

            if (deviation.scaleX !== undefined) {
                model.updateAndRefresh({
                    transformation: {
                        width: deviation.width,
                        scaleX: deviation.scaleX
                    }
                });
            }
            if (deviation.scaleY !== undefined) {
                model.updateAndRefresh({
                    transformation: {
                        height: deviation.height,
                        scaleY: deviation.scaleY
                    }
                });
            }
        }

        this.modelGroup.updateSelectedGroupTransformation(transformation);
        this.resetSelection();
    }

    addSelectedSvgModelsByModels(models) {
        this.modelGroup.addSelectedModels(models);

        for (const model of models) {
            if (!this.selectedSvgModels.includes(model)) {
                this.selectedSvgModels.push(model);
                // todo
                const posAndSize = this.svgContentGroup.addToSelection([model.elem]);
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

    /**
     * Create model (SVGModel, Model, etc) from element.
     *
     * @returns {Promise<void>}
     */
    async createModelFromElement(element) {
        const headType = this.modelGroup.headType;
        const isRotate = this.modelGroup.materials && this.modelGroup.materials.isRotate;

        const data = genModelConfig(element, this.size);


        const { modelID, content, width, height, transformation, config: elemConfig } = data;
        const blob = new Blob([content], { type: 'image/svg+xml' });
        const file = new File([blob], `${modelID}.svg`);

        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await api.uploadImage(formData);

            const { originalName, uploadName } = res.body;
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
                sourceWidth: res.body.width,
                sourceHeight: res.body.height,
                width,
                height,
                transformation,
                config,
                gcodeConfig,
                elem: element,
                size: this.size
            };

            const svgModel = this.modelGroup.addModel(options);
            svgModel.setParent(this.svgContentGroup.group);
        } catch (e) {
            console.error(e);
        }
    }

    /**
     * Select elements.
     *
     * @param elements
     */
    selectElements(elements) {
        this.svgContentGroup.addToSelection(elements);

        for (const svgModel of this.modelGroup.models) {
            if (elements.includes(svgModel.elem)) {
                this.selectedSvgModels.push(svgModel);
                // todo, not modelGroup here, use flux/editor
                const modelGroup = this.modelGroup;
                if (modelGroup) {
                    modelGroup.addSelectedModels([svgModel]);
                }
            }
        }

        const selectedElements = this.svgContentGroup.selectedElements;

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
        return this.selectedElementsTransformation;
    }

    /**
     * Update internal cached variable `selectedElementsTransformation` to `t`.
     *
     * @param t
     * @private
     */
    _setSelectedElementsTransformation(t) {
        this.selectedElementsTransformation = t;
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
    resizeElementsImmediately(elements, { newWidth, newHeight }) {
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
                width,
                height,
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
    createText(content) {
        return this.svgContentGroup.addSVGElement({
            element: 'text',
            attr: {
                x: this.size.x - 30,
                y: this.size.y,
                fill: '#000000',
                'fill-opacity': 1,
                'font-size': 12,
                'font-family': 'Arial',
                'stroke-width': 0.25,
                opacity: 1,
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

        const config = {};

        if (options.text !== undefined) {
            model.elem.textContent = options.text;

            config.text = options.text;
        }

        if (options.fontFamily !== undefined) {
            model.elem.setAttribute('font-family', options.fontFamily);

            config['font-family'] = options.fontFamily;
        }

        if (options.fontSize !== undefined) {
            model.elem.setAttribute('font-size', options.fontSize);

            config['font-size'] = options.fontSize;
        }

        // Update model
        const { width, height } = model.elem.getBBox();
        const { logicalX, logicalY, scaleX, scaleY, angle } = model;
        const baseUpdateData = {
            sourceWidth: width,
            sourceHeight: height,
            width,
            height,
            transformation: {
                positionX: logicalX,
                positionY: logicalY,
                width: width * Math.abs(scaleX),
                height: height * Math.abs(scaleY),
                scaleX,
                scaleY,
                rotationZ: -angle * Math.PI / 180
            }
        };
        model.updateAndRefresh({ ...baseUpdateData, config });
        this.resetSelection();
    }
}

export default SVGActionsFactory;
