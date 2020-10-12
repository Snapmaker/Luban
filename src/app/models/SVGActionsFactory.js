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
        // this.modelGroup.on('select', () => {
        //     const selectedModel = this.modelGroup.getSelectedModel();
        //     if (!selectedModel.modelID) return;
        //     this.selectElementById(selectedModel.modelID);
        //     this.showSelectedElement();
        // });

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
    updateSelectedElementsTransformation(transformation) {
        const elements = this.svgContentGroup.selectedElements;
        if (elements.length === 0) {
            return;
        }
        if (transformation.uniformScalingState !== undefined) {
            if (elements.length === 1) {
                // todo after multi select resize
                this.modelGroup.selectedModelArray[0].updateTransformation({ uniformScalingState: transformation.uniformScalingState });
            }
        }
        if (transformation.positionX !== undefined || transformation.positionY !== undefined) {
            const originTransformation = this.modelGroup.getSelectedModelTransformation();
            if (transformation.positionX === undefined) {
                transformation.positionX = originTransformation.positionX;
            }
            if (transformation.positionY === undefined) {
                transformation.positionY = originTransformation.positionY;
            }
            // todo, just copy from canvas now
            const dx = transformation.positionX - originTransformation.positionX;
            const dy = -(transformation.positionY - originTransformation.positionY);

            // mouse down
            this.svgContentGroup.translateSelectedElementsOnMouseDown();
            const transform = svg.createSVGTransform();
            transform.setTranslate(dx, dy);
            // mouse move
            this.svgContentGroup.translateSelectedElementsOnMouseMove(transform);
            // mouse up
            this.updateSelectedModelsByTransformation({
                dx,
                dy
            });
            this.mode = 'select';
            // todo do not use modelGroup here
            const newTransformation = this.modelGroup.getSelectedModelTransformation();
            const posAndSize = this.svgContentGroup.resetSelection(this.size, newTransformation);
            this.modelGroup.updateSelectedModelTransformation({
                positionX: posAndSize.positionX - this.size.x,
                positionY: this.size.y - posAndSize.positionY,
                width: posAndSize.width,
                height: posAndSize.height
            });
        }
        if (transformation.rotationZ !== undefined) {
            // todo, copy from canvas mouse up
            // mouse up
            const { x, y } = this.svgContentGroup.operatorPoints.getCenterPoint();

            // todo, use rotationZ
            let angle = -transformation.rotationZ * 180 / Math.PI;
            const angleOld = -this.modelGroup.getSelectedModelTransformation().rotationZ * 180 / Math.PI;
            angle = (angle - angleOld + 540) % 360 - 180;
            this.updateSelectedModelsByTransformation({
                angle, cx: x, cy: y
            });

            // todo, just copy canvas
            // select only(elements)
            this.clearSelection();
            this.selectElements(elements);
            const selectedSvgModels = this.getModelsByElements(elements);
            for (const svgModel of selectedSvgModels) {
                const model = svgModel.relatedModel;
                const modelGroup = model && model.modelGroup;
                if (modelGroup) {
                    modelGroup.addSelectedModels([model]);
                    modelGroup.updateSelectedModelTransformation({
                        positionX: 0,
                        positionY: 0
                    });
                    modelGroup.resetSelectedObjectScaleAndRotation();
                }
            }
            this.svgContentGroup.addToSelection(elements);
            // todo
            const posAndSize = this.svgContentGroup.resetSelection(this.size, this.modelGroup.getSelectedModelTransformation());
            this.modelGroup.updateSelectedModelTransformation({
                positionX: posAndSize.positionX - this.size.x,
                positionY: this.size.y - posAndSize.positionY,
                width: posAndSize.width,
                height: posAndSize.height
            });
        }
        if ((transformation.scaleX !== undefined || transformation.scaleY !== undefined) && elements.length === 1) {
            // todo, to fix uniform scale
            const element = elements[0];
            const svgModel = this.getSVGModelByElement(element);
            const model = svgModel.relatedModel;
            if (transformation.scaleX !== undefined) {
                model.updateAndRefresh({
                    transformation: {
                        width: transformation.width,
                        scaleX: transformation.scaleX
                    }
                });
            }
            if (transformation.scaleY !== undefined) {
                model.updateAndRefresh({
                    transformation: {
                        height: transformation.height,
                        scaleY: transformation.scaleY
                    }
                });
            }
            // todo
            const posAndSize = this.svgContentGroup.resetSelection(this.size, this.modelGroup.getSelectedModelTransformation());
            this.modelGroup.updateSelectedModelTransformation({
                positionX: posAndSize.positionX - this.size.x,
                positionY: this.size.y - posAndSize.positionY,
                width: posAndSize.width,
                height: posAndSize.height
            });
        }
        // this.invokeModelTransformCallback();
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
        this.modelGroup.updateSelectedModelTransformation({
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
        this.svgContentGroup.operatorPoints.showGrips(false);
    }

    showSelectedElement() {
        const selectedElement = this.svgContentGroup.getSelected();
        selectedElement.visible = true;
        selectedElement.setAttribute('display', 'inherit');
        this.svgContentGroup.operatorPoints.showGrips(true);
    }

    createFromModel(relatedModel) {
        const { config } = relatedModel;
        const elem = this.svgContentGroup.addSVGElement({
            element: config.svgNodeName || 'image',
            attr: { id: relatedModel.modelID }
        });

        const svgModel = new SvgModel(elem, this);
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
    setElementTransformToList(transformList, transformation) {
        // const { positionX, positionY, rotationZ, scaleX, scaleY, flip } = this.relatedModel.transformation;
        transformList.clear();
        const size = this.size;

        function pointModelToSvg({ x, y }) {
            return { x: size.x + x, y: size.y - y };
        }

        const { positionX, positionY, rotationZ, scaleX, scaleY, flip } = transformation;
        const center = pointModelToSvg({ x: positionX, y: positionY });

        const translateOrigin = svg.createSVGTransform();
        translateOrigin.tag = 'translateOrigin';
        translateOrigin.setTranslate(-center.x, -center.y);
        transformList.insertItemBefore(translateOrigin, 0);

        const scale = svg.createSVGTransform();
        scale.tag = 'scale';
        scale.setScale(scaleX * ((flip & 2) ? -1 : 1), scaleY * ((flip & 1) ? -1 : 1));
        transformList.insertItemBefore(scale, 0);

        const rotate = svg.createSVGTransform();
        rotate.tag = 'rotate';
        rotate.setRotate(-rotationZ / Math.PI * 180, 0, 0);
        transformList.insertItemBefore(rotate, 0);

        const translateBack = svg.createSVGTransform();
        translateBack.setTranslate(center.x, center.y);
        transformList.insertItemBefore(translateBack, 0);
        transformList.getItem(0).tag = 'translateBack';
    }

    updateSelectedModelsByTransformation(deviation) { // todo, just after move now
        // deviation: dx dy, angle cx cy, scaleX scaleY
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
        if (deviation.angle) {
            // translate and rotate models
            for (const svgModel of selectedModels) {
                const elem = svgModel.elem;
                const rotateBox = svg.createSVGTransform();
                rotateBox.setRotate(deviation.angle, deviation.cx, deviation.cy);
                const startBbox = getBBox(elem);
                const startCenter = svg.createSVGPoint();
                startCenter.x = startBbox.x + startBbox.width / 2;
                startCenter.y = startBbox.y + startBbox.height / 2;
                const endCenter = startCenter.matrixTransform(rotateBox.matrix);
                const modelNewCenter = svgModel.pointSvgToModel(endCenter);
                const model = svgModel.relatedModel;
                const rotationZ = ((model.transformation.rotationZ * 180 / Math.PI - deviation.angle + 540) % 360 - 180) * Math.PI / 180;
                const positionX = modelNewCenter.x;
                const positionY = modelNewCenter.y;
                // console.log('----rotation mouse up----', positionX, positionY, rotationZ, deviation.angle);

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
            // rotate operationGrips
            transformation.rotationZ = ((transformation.rotationZ * 180 / Math.PI - deviation.angle + 180) % 360 - 180) * Math.PI / 180;
        }
        if (deviation.scaleX) {
            //
        }
        if (deviation.scaleY) {
            //
        }
        this.modelGroup.updateSelectedModelTransformation(transformation);
        // this.setElementTransformToList(this.svgContentGroup.operatorPoints.operatorPointsGroup.transform.baseVal, transformation);
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
                this.modelGroup.updateSelectedModelTransformation({
                    positionX: posAndSize.positionX - this.size.x,
                    positionY: this.size.y - posAndSize.positionY,
                    width: posAndSize.width,
                    height: posAndSize.height
                });
            }
        }
    }

    resetSelection(modelGroupTransformation) {
        const transformation = ((modelGroupTransformation !== undefined) ? modelGroupTransformation : this.modelGroup.getSelectedModelTransformation());
        const posAndSize = this.svgContentGroup.resetSelection(this.size, transformation);
        this.modelGroup.updateSelectedModelTransformation({
            positionX: posAndSize.positionX - this.size.x,
            positionY: this.size.y - posAndSize.positionY,
            width: posAndSize.width,
            height: posAndSize.height
        });

        // hide operator when model hide
        const selectedModels = this.modelGroup.getSelectedModelArray();
        if (selectedModels && selectedModels.length === 1 && !selectedModels[0].visible) {
            this.svgContentGroup.operatorPoints.showResizeAndRotateGrips(false);
            // this.svgContentGroup.showGrips(false);
        }
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
        const svgModel = new SvgModel(element, this);
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
            const sourceType = svgModel.type === 'text' ? 'raster' : 'svg';
            const mode = headType === 'cnc' ? 'greyscale' : 'bw';

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
                const modelGroup = model && model.modelGroup;
                if (modelGroup) {
                    modelGroup.addSelectedModels([model]);
                }
            }
        }

        // Calculate position and size of selected model, set them to modelGroup.selectedGroup
        const posAndSize = this.svgContentGroup.resetSelection(this.size, this.modelGroup.getSelectedModelTransformation());

        this.modelGroup.updateSelectedModelTransformation({
            positionX: posAndSize.positionX - this.size.x,
            positionY: this.size.y - posAndSize.positionY,
            width: posAndSize.width,
            height: posAndSize.height
        });
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
        this.modelGroup.updateSelectedModelTransformation({
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
        this.updateSelectedModelsByTransformation({
            dx,
            dy
        });
        this.resetSelection();
    }

    /**
     * Rotate element.
     */
    rotateElement(element, { angle, cx, cy }) {
        this.updateSelectedModelsByTransformation({
            angle, cx, cy
        });
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
            sourceWidth: width * 8,
            sourceHeight: height * 8,
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
