import EventEmitter from 'events';
import _ from 'lodash';
import { DATA_PREFIX } from '../../constants';
import { DEFAULT_SCALE, SVG_EVENT_ADD, SVG_EVENT_MOVE, SVG_EVENT_SELECT } from '../../constants/svg-constatns';
import { getBBox } from '../../widgets/CncLaserSvgEditor/element-utils';
import { remapElement } from '../../widgets/CncLaserSvgEditor/element-recalculate';
import { NS } from '../../widgets/CncLaserSvgEditor/lib/namespaces';
import { getRotationAngle } from '../../widgets/CncLaserSvgEditor/element-transform';

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

const coordGmSvgToModel = (size, elem) => {
    const bbox = getBBox(elem);
    const angle = getRotationAngle(elem) || 0;
    bbox.positionX = bbox.x + bbox.width / 2 - size.x;
    bbox.positionY = size.y - bbox.y - bbox.height / 2;
    bbox.rotationZ = -angle / 180 * Math.PI;
    return bbox;
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
    event = new EventEmitter();

    svgModels = [];

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

    emit(key, ...args) {
        switch (key) {
            case SVG_EVENT_ADD:
                this.event.emit(key, this.svgToModel(args[0]));
                break;
            case SVG_EVENT_MOVE:
                this.event.emit(key, this.svgToTransformation(args[0]));
                break;
            case SVG_EVENT_SELECT:
                this.event.emit(key, {
                    modelID: args[0] !== null ? args[0].getAttribute('id') : null
                });
                break;
            default:
                this.event.emit(key, ...args);
                break;
        }
    }

    on(key, func) {
        this.event.on(key, func);
    }

    svgToTransformation(elem) {
        const { width, height, positionX, positionY, rotationZ } = coordGmSvgToModel(this.size, elem);

        const model = {
            modelID: elem.getAttribute('id'),
            transformation: {
                positionX: positionX,
                positionY: positionY,
                rotationZ: rotationZ,
                width: width,
                height: height
            }
        };

        return model;
    }

    svgToModel(elem) {
        const { x, y, width, height, positionX, positionY } = coordGmSvgToModel(this.size, elem);

        const clone = elem.cloneNode();
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

    duplicateElement(modelID) {
        const selected = this.svgContentGroup.getSelected();
        if (!selected) {
            return;
        }
        const clone = selected.cloneNode();
        clone.setAttribute('id', modelID);
        this.svgContentGroup.group.append(clone);
        this.updateTransformation({
            positionX: 0,
            positionY: 0
        }, clone);
        this.svgContentGroup.selectOnly(selected);
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
            const item1 = childNodes[index + 1];
            const clone = item.cloneNode();
            const clone1 = item1.cloneNode();
            this.svgContentGroup.group.replaceChild(clone1, item);
            this.svgContentGroup.group.replaceChild(clone, item1);
            this.svgContentGroup.selectOnly(clone);
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
            const item1 = childNodes[index - 1];
            const clone = item.cloneNode();
            const clone1 = item1.cloneNode();
            this.svgContentGroup.group.replaceChild(clone1, item);
            this.svgContentGroup.group.replaceChild(clone, item1);
            this.svgContentGroup.selectOnly(clone);
        }
    }

    updateTransformation(transformation, elem) {
        elem = elem || this.svgContentGroup.getSelected();
        if (!elem) {
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
        if (transformation.width !== undefined || transformation.height !== undefined) {
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
        this.svgContentGroup.selectOnly(elem);
    }
}

export default SvgModelGroup;
