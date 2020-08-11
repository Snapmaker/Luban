// import EventEmitter from 'events';
import _ from 'lodash';
import { DATA_PREFIX } from '../../constants';
import { DEFAULT_SCALE } from '../../constants/svg-constants';
import { coordGmSvgToModel } from '../../widgets/CncLaserSvgEditor/element-utils';


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

    constructor(modelGroup) {
        this.modelGroup = modelGroup;
        this.modelGroup.on('select', () => {
            const selectedModel = this.modelGroup.getSelectedModel();
            if (!selectedModel.modelID) return;
            this.selectElementById(selectedModel.modelID);
            this.showSelectedElement();
        });
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
        this.svgContentGroup.selectOnly(elem);
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
        this.svgContentGroup.selectOnly(selected);
        this.addModel(clone);
    }

    selectElementById(modelID) {
        const elem = this.svgContentGroup.findSVGElement(modelID);
        this.svgContentGroup.selectOnly(elem);
    }

    deleteElement() {
        const selected = this.svgContentGroup.getSelected();
        if (!selected) {
            return;
        }
        this.svgContentGroup.deleteElement(selected);
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
        this.svgContentGroup.selectOnly(elem);
    }

    hideSelectedElement() {
        const selectedElement = this.svgContentGroup.getSelected();
        selectedElement.visible = false;
        selectedElement.setAttribute('display', 'none');
        const selector = this.svgContentGroup.requestSelector(selectedElement);
        selector.showGrips(false);
    }

    showSelectedElement() {
        const selectedElement = this.svgContentGroup.getSelected();
        selectedElement.visible = true;
        selectedElement.setAttribute('display', 'inherit');
        const selector = this.svgContentGroup.requestSelector(selectedElement);
        selector.showGrips(true);
    }

    createFromModel(relatedModel) {
        const { config } = relatedModel;
        const elem = this.svgContentGroup.addSVGElement({ element: config.svgNodeName, attr: { id: relatedModel.modelID } });

        const model = new SvgModel(elem, this);
        this.svgModels.push(model);
        model.setParent(this.svgContentGroup.group);

        relatedModel.relatedModels.svgModel = model;
        model.relatedModel = relatedModel;
        model.refresh();
    }

    addModel(elem) {
        const headType = this.modelGroup.headType;
        const model = new SvgModel(elem, this);
        this.svgModels.push(model);
        model.setParent(this.svgContentGroup.group);
        const selector = this.svgContentGroup.requestSelector(elem);
        selector.showGrips(true);
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

    resizeSelector(elem) {
        const selector = this.svgContentGroup.requestSelector(elem);
        selector.resize();
    }

    getModelByElement(elem) {
        for (const model of this.svgModels) {
            if (model.elem === elem) {
                return model;
            }
        }
        return null;
    }
}

export default SvgModelGroup;
