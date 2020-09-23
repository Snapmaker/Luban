// import EventEmitter from 'events';
import _ from 'lodash';
import { DATA_PREFIX } from '../../constants';
import { DEFAULT_SCALE } from '../../constants/svg-constants';
import { coordGmSvgToModel, getBBox } from '../../widgets/CncLaserSvgEditor/element-utils';

import { remapElement } from '../../widgets/CncLaserSvgEditor/element-recalculate';
import { NS } from '../../widgets/CncLaserSvgEditor/lib/namespaces';
import { isZero } from '../../lib/utils';
import { generateModelDefaultConfigs } from './ModelInfoUtils';
import SvgModel from './SvgModel';
import api from '../../api';

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

const elementToString = (element, scale = 1) => {
    let res = `<${element.tagName}`;
    const needScaleAttributes = ['width', 'height', 'x', 'y', 'cx', 'cy', 'rx', 'ry'];
    for (const attribute of element.attributes) {
        if (_.includes(needScaleAttributes, attribute.name)) {
            res += ` ${attribute.name}="${attribute.value * scale}" `;
        } else {
            res += ` ${attribute.name}="${attribute.value}" `;
        }
    }
    res += `>${element.innerHTML}</${element.tagName}>`;
    return res;
};


class SvgModelGroup {
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
    }

    init(svgContentGroup, size) {
        this.svgContentGroup = svgContentGroup;
        this.size = size;
    }

    updateSize(size) {
        const data = [];
        for (const node of this.svgContentGroup.getChildNodes()) {
            const transform = coordGmSvgToModel(this.size, node);
            data.push([node, transform]);
        }
        this.size = {
            ...size
        };
        for (const datum of data) {
            this.updateTransformation({
                positionX: datum[1].positionX,
                positionY: datum[1].positionY
            }, datum[0]);
        }
    }

    // emit(key, ...args) {
    //     switch (key) {
    //         case SVG_EVENT_ADD:
    //             this.event.emit(key, this.svgToModel(args[0]));
    //             break;
    //         case SVG_EVENT_MOVE: {
    //             this.event.emit(key, this.svgToTransformation(args[0]));
    //             break;
    //         }
    //         case SVG_EVENT_SELECT:
    //             this.event.emit(key, {
    //                 modelID: args[0] !== null ? args[0].getAttribute('id') : null
    //             });
    //             break;
    //         default:
    //             this.event.emit(key, ...args);
    //             break;
    //     }
    // }

    // on(key, func) {
    //     this.event.on(key, func);
    // }

    svgToTransformation(elem) {
        const { width, height, positionX, positionY, rotationZ, scaleX, scaleY } = coordGmSvgToModel(this.size, elem);

        const config = {

            transformation: {
                positionX: positionX,
                positionY: positionY,
                rotationZ: rotationZ,
                scaleX,
                scaleY,
                width: width,
                height: height
            }
        };

        return config;
    }

    svgToModel(elem) {
        const { x, y, width, height, positionX, positionY } = coordGmSvgToModel(this.size, elem);

        const clone = elem.cloneNode(true);

        const scale = svg.createSVGTransform();
        scale.setScale(8, 8);

        remapElement(clone, scale.matrix);

        const content = `<svg x="0" y="0" width="${width * DEFAULT_SCALE}" height="${height * DEFAULT_SCALE}" `
            + `viewBox="${x * DEFAULT_SCALE} ${y * DEFAULT_SCALE} ${width * DEFAULT_SCALE} ${height * DEFAULT_SCALE}" `
            + `xmlns="http://www.w3.org/2000/svg">${elementToString(clone)}</svg>`;
        const model = {
            modelID: elem.getAttribute('id'),
            content: content,
            width: width,
            height: height,
            transformation: {
                positionX: positionX,
                positionY: positionY
            }
        };

        return model;
    }

    clearImageBackground() {
        const backgroundGroup = this.svgContentGroup.backgroundGroup;
        while (backgroundGroup.firstChild) {
            backgroundGroup.removeChild(backgroundGroup.lastChild);
        }
    }

    addImageBackgroundToSVG(model) {
        const { x, y, width, height } = coordGmModelToSvg(this.size, model.transformation);
        const uploadPath = `${DATA_PREFIX}/${model.uploadName}`;
        const elem = this.svgContentGroup.addSVGBackgroundElement({
            element: 'image',
            attr: {
                x: x,
                y: y,
                width: width,
                height: height,
                href: uploadPath,
                id: model.modelID,
                preserveAspectRatio: 'none'
            }
        });
        return {
            modelID: elem.getAttribute('id')
        };
    }

    addModelToSVGElement(model) {
        const { x, y, width, height } = coordGmModelToSvg(this.size, model.transformation);
        const uploadPath = `${DATA_PREFIX}/${model.uploadName}`;
        const elem = this.svgContentGroup.addSVGElement({
            element: 'image',
            attr: {
                x: x,
                y: y,
                width: width,
                height: height,
                href: uploadPath,
                id: model.modelID,
                preserveAspectRatio: 'none'
            }
        });
        // todo
        const posAndSize = this.svgContentGroup.selectOnly([elem]);
        this.modelGroup.updateSelectedModelTransformation({
            positionX: posAndSize.positionX - this.size.x,
            positionY: this.size.y - posAndSize.positionY,
            width: posAndSize.width,
            height: posAndSize.height
        });
        return {
            modelID: elem.getAttribute('id'),
            elem
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

    duplicateElement(modelID) {
        const selected = this.svgContentGroup.getSelected();
        if (!selected) {
            return;
        }
        const clone = selected.cloneNode(true);
        clone.setAttribute('id', modelID);
        this.svgContentGroup.group.append(clone);
        this.updateTransformation({
            positionX: 0,
            positionY: 0
        }, clone);
        // todo
        const posAndSize = this.svgContentGroup.selectOnly([selected]);
        this.modelGroup.updateSelectedModelTransformation({
            positionX: posAndSize.positionX - this.size.x,
            positionY: this.size.y - posAndSize.positionY,
            width: posAndSize.width,
            height: posAndSize.height
        });
        this.addModel(clone);
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
            this.svgContentGroup.clearSelection();
            this.addSelectedSvgModelsByElements(elements);
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
            const svgModel = this.getModelByElement(element);
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

        const model = new SvgModel(elem, this);
        this.svgModels.push(model);
        model.setParent(this.svgContentGroup.group);

        relatedModel.relatedModels.svgModel = model;
        model.relatedModel = relatedModel;
        model.refresh();

        // A
        // this.addModelToSVGElement(model);
    }

    addModel(elem) {
        const headType = this.modelGroup.headType;
        const model = new SvgModel(elem, this);
        this.svgModels.push(model);
        model.setParent(this.svgContentGroup.group);
        const data = model.genModelConfig();

        const { modelID, content, width, height, transformation, config: elemConfig } = data;
        const blob = new Blob([content], { type: 'image/svg+xml' });
        const file = new File([blob], `${modelID}.svg`);

        const formData = new FormData();
        formData.append('image', file);

        api.uploadImage(formData)
            .then((res) => {
                const { originalName, uploadName } = res.body;
                const sourceType = model.type === 'text' ? 'raster' : 'svg';
                const mode = 'vector';

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

                this.modelGroup.addModel(options, { svgModel: model });
            })
            .catch((err) => {
                console.error(err);
            });
    }

    resizeSelectorByElementsSelected(elements) {
        for (const elem of elements) {
            if (!this.svgContentGroup.selectedElements.find(i => i === elem)) {
                return;
            }
        }
        this.svgContentGroup.requestSelectorByElements(elements);
        // const selector = this.svgContentGroup.requestSelectorByElements(elements);
        // selector.resize();
    }

    getModelByElement(elem) {
        for (const model of this.svgModels) {
            if (model.elem === elem) {
                return model;
            }
        }
        return null;
    }

    getModelsByElements(elems) {
        const models = [];
        for (const model of this.svgModels) {
            if (elems.includes(model.elem)) {
                models.push(model);
            }
        }
        return models;
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

    clearSelection() {
        this.selectedSvgModels = [];
        this.modelGroup.emptySelectedModelArray();
        this.svgContentGroup.clearSelection();
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

    addSelectedSvgModelsByElements(elements) {
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
        }
    }

    // // TODO: This is temporary workaround for model processing
    setModelTransformCallback(callback) {
        this.modelTransformCallback = callback;
    }

    invokeModelTransformCallback() {
        this.modelTransformCallback && this.modelTransformCallback();
    }
}

export default SvgModelGroup;
