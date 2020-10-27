// import EventEmitter from 'events';
// import _ from 'lodash';
import { DATA_PREFIX } from '../constants';
import { coordGmSvgToModel, getBBox } from '../ui/SVGEditor/element-utils';

// import { remapElement } from '../../widgets/SVGEditor/element-recalculate';
import { NS } from '../ui/SVGEditor/lib/namespaces';
import { isZero } from '../lib/utils';
import { generateModelDefaultConfigs } from './ModelInfoUtils';
import SvgModel from './SvgModel';
import api from '../api';
import { DEFAULT_SCALE } from '../ui/SVGEditor/constants';

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


class SVGActionsFactory {
    // event = new EventEmitter();

    svgModels = [];

    selectedSvgModels = [];

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

        for (const svgModel of this.svgModels) {
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
                const svgModel = selectedSVGModels[0];
                const model = svgModel.relatedModel;

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
        if (transformation.svgflip !== undefined) {
            const flip = transformation.svgflip;
            this.svgContentGroup.updateElementFlip(elem, flip);
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

    createFromModel(relatedModel) {
        const { config } = relatedModel;
        const elem = this.svgContentGroup.addSVGElement({
            element: config.svgNodeName || 'image',
            attr: { id: relatedModel.modelID }
        });

        const svgModel = new SvgModel(elem, this.size);
        this.svgModels.push(svgModel);
        svgModel.setParent(this.svgContentGroup.group);

        relatedModel.relatedModels.svgModel = svgModel;
        svgModel.relatedModel = relatedModel;
        svgModel.refresh();
    }

    getSVGModelByElement(elem) {
        for (const svgModel of this.svgModels) {
            if (svgModel.elem === elem) {
                return svgModel;
            }
        }
        return null;
    }

    getModelsByElements(elems) {
        const svgModels = [];
        for (const svgModel of this.svgModels) {
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

            // for (const svgModel of selectedModels) {
            //     svgModel.onUpdate();
            // }

            // rotate operationGrips
            transformation.rotationZ = ((transformation.rotationZ * 180 / Math.PI - deviation.deltaAngle + 180) % 360 - 180) * Math.PI / 180;

            // Reselect all SVG Elements to make a new selection
            // TODO: Refactor this.
            this.clearSelection();
            this.selectElements(elements);

            const selectedSvgModels = this.getModelsByElements(elements);
            for (const svgModel of selectedSvgModels) {
                const model = svgModel.relatedModel;
                const modelGroup = this.modelGroup;
                if (modelGroup) {
                    modelGroup.addSelectedModels([model]);
                    modelGroup.updateSelectedGroupTransformation({
                        positionX: 0,
                        positionY: 0
                    });
                    modelGroup.resetSelectedObjectScaleAndRotation();
                }
            }
            this.svgContentGroup.addToSelection(elements);
        }

        if (deviation.scaleX !== undefined || deviation.scaleY !== undefined) {
            const element = elements[0];
            const svgModel = this.getSVGModelByElement(element);
            const model = svgModel.relatedModel;

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

        this.invokeModelTransformCallback();
    }

    addSelectedSvgModelsByModels(models) {
        this.modelGroup.addSelectedModels(models);

        for (const model of models) {
            const svgModel = model.relatedModels.svgModel;
            if (!this.selectedSvgModels.includes(svgModel)) {
                this.selectedSvgModels.push(svgModel);
                // todo
                const posAndSize = this.svgContentGroup.addToSelection([svgModel.elem]);
                this.modelGroup.updateSelectedGroupTransformation({
                    positionX: posAndSize.positionX - this.size.x,
                    positionY: this.size.y - posAndSize.positionY,
                    width: posAndSize.width,
                    height: posAndSize.height
                });
            }
        }
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
        const svgModel = this.getModelsByElements(elements)[0];
        const model = svgModel.relatedModel;
        model.updateTransformation({
            positionX: posAndSize.positionX - this.size.x,
            positionY: this.size.y - posAndSize.positionY,
            width: posAndSize.width,
            height: posAndSize.height
        });
    }

    // // TODO: This is temporary workaround for model processing
    setModelTransformCallback(callback) {
        this.modelTransformCallback = callback;
    }

    invokeModelTransformCallback() {
        this.modelTransformCallback && this.modelTransformCallback();
    }

    /**
     * Create model (SVGModel, Model, etc) from element.
     *
     * @returns {Promise<void>}
     */
    async createModelFromElement(element) {
        const headType = this.modelGroup.headType;
        const svgModel = new SvgModel(element, this.size);
        this.svgModels.push(svgModel);
        svgModel.setParent(this.svgContentGroup.group);
        const data = svgModel.genModelConfig();

        const { modelID, content, width, height, transformation, config: elemConfig } = data;
        const blob = new Blob([content], { type: 'image/svg+xml' });
        const file = new File([blob], `${modelID}.svg`);

        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await api.uploadImage(formData);

            const { originalName, uploadName } = res.body;
            let sourceType = 'svg';
            let mode = 'vector';
            if (svgModel.type === 'text') {
                sourceType = 'raster';
                mode = headType === 'cnc' ? 'greyscale' : 'bw';
            }


            let { config, gcodeConfig } = generateModelDefaultConfigs(headType, sourceType, mode);

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
                width,
                sourceHeight: res.body.height,
                height,
                transformation,
                config,
                gcodeConfig
            };

            this.modelGroup.addModel(options, { svgModel: svgModel });
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

        for (const svgModel of this.svgModels) {
            if (elements.includes(svgModel.elem)) {
                this.selectedSvgModels.push(svgModel);
                // todo, not modelGroup here, use flux/editor
                const model = svgModel.relatedModel;
                const modelGroup = this.modelGroup;
                if (modelGroup) {
                    modelGroup.addSelectedModels([model]);
                }
            }
        }

        this.resetSelection();
    }

    /**
     * Clear selection of elements.
     */
    clearSelection() {
        this.svgContentGroup.clearSelection();

        this.selectedSvgModels = [];

        // FIXME: this will call render eventually.
        this.modelGroup.emptySelectedModelArray();
    }

    /**
     * Resize element.
     */
    resizeElement(element, { resizeDir, resizeFrom, resizeTo, isUniformScaling }) {
        const svgModel = this.getSVGModelByElement(element);

        svgModel.elemResize({ resizeDir, resizeFrom, resizeTo, isUniformScaling });

        const posAndSize = this.svgContentGroup.operatorPoints.resizeGrips(this.svgContentGroup.selectedElements);
        this.modelGroup.updateSelectedGroupTransformation({
            positionX: posAndSize.positionX - this.size.x,
            positionY: this.size.y - posAndSize.positionY,
            width: posAndSize.width,
            height: posAndSize.height
        });
    }

    /**
     * Resize element.
     */
    afterResizeElement(element) {
        const svgModel = this.getSVGModelByElement(element);
        svgModel.onUpdate();

        this.updateSelectedModelsByTransformation({});
    }

    /**
     * Move element.
     */
    moveElement(element, { dx, dy }) {
        this.updateSelectedModelsByTransformation({ dx, dy });
    }

    /**
     * Rotate element.
     */
    rotateElement(element, { angle, cx, cy }) {
        this.updateSelectedModelsByTransformation({ cx, cy, deltaAngle: angle });
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

        const svgModel = element ? this.getSVGModelByElement(element) : this.selectedSvgModels[0];
        const model = svgModel.relatedModel;


        const config = {};

        if (options.text !== undefined) {
            svgModel.elem.textContent = options.text;

            config.text = options.text;
        }

        if (options.fontFamily !== undefined) {
            svgModel.elem.setAttribute('font-family', options.fontFamily);

            config['font-family'] = options.fontFamily;
        }

        if (options.fontSize !== undefined) {
            svgModel.elem.setAttribute('font-size', options.fontSize);

            config['font-size'] = options.fontSize;
        }

        // Update model
        const { width, height } = svgModel.elem.getBBox();
        const baseUpdateData = {
            sourceWidth: width * DEFAULT_SCALE,
            sourceHeight: height * DEFAULT_SCALE,
            width,
            height,
            transformation: {
                width,
                height
            }
        };
        model.updateAndRefresh({ ...baseUpdateData, config });
        this.resetSelection();
    }
}

export default SVGActionsFactory;
