import uuid from 'uuid';
import * as THREE from 'three';
import Canvg from 'canvg';
import { coordGmSvgToModel } from '../ui/SVGEditor/element-utils';

import { NS } from '../ui/SVGEditor/lib/namespaces';
import { DATA_PREFIX } from '../constants';


// import ThreeDxfLoader from '../lib/threejs/ThreeDxfLoader';

import api from '../api';
import { checkIsImageSuffix } from '../../shared/lib/utils';

import BaseModel from './BaseModel';
// import { DEFAULT_FILL_COLOR } from '../ui/SVGEditor/constants';

const EVENTS = {
    UPDATE: { type: 'update' }
};

const svg = document.createElementNS(NS.SVG, 'svg');
let updateTimer;

// function transformPoint(point, m) {
//     const { x, y } = point;
//     return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
// }

const findItemIndexByType = (list, type) => {
    for (let k = 0; k < list.length; k++) {
        if (list.getItem(k).type === type) {
            return k;
        }
    }
    return -1;
};


const remapPath = (elem, remap, scaleW, scaleH) => {
    const PATH_MAP = [
        0, 'z', 'M', 'm', 'L', 'l', 'C', 'c', 'Q', 'q',
        'A', 'a', 'H', 'h', 'V', 'v', 'S', 's', 'T', 't'
    ];
    const changes = {};
    const pathSegList = elem.pathSegList;
    const len = pathSegList.numberOfItems;
    changes.d = [];
    for (let i = 0; i < len; i++) {
        const seg = pathSegList.getItem(i);
        changes.d[i] = {
            type: seg.pathSegType,
            x: seg.x,
            y: seg.y,
            x1: seg.x1,
            y1: seg.y1,
            x2: seg.x2,
            y2: seg.y2,
            r1: seg.r1,
            r2: seg.r2,
            angle: seg.angle,
            largeArcFlag: seg.largeArcFlag,
            sweepFlag: seg.sweepFlag
        };
    }

    const firstSeg = changes.d[0];
    const pt0 = remap(firstSeg.x, firstSeg.y);
    changes.d[0].x = pt0.x;
    changes.d[0].y = pt0.y;
    for (let i = 1; i < len; i++) {
        const seg = changes.d[i];

        if (seg.type % 2 === 0) { // absolute
            const x = (seg.x !== undefined) ? seg.x : pt0.x;
            const y = (seg.y !== undefined) ? seg.y : pt0.y;

            const pt = remap(x, y);
            const pt1 = remap(seg.x1, seg.y1);
            const pt2 = remap(seg.x2, seg.y2);
            seg.x = pt.x;
            seg.y = pt.y;
            seg.x1 = pt1.x;
            seg.y1 = pt1.y;
            seg.x2 = pt2.x;
            seg.y2 = pt2.y;
            seg.r1 = scaleW(seg.r1);
            seg.r2 = scaleH(seg.r2);
        } else { // relative
            seg.x = scaleW(seg.x);
            seg.y = scaleH(seg.y);
            seg.x1 = scaleW(seg.x1);
            seg.y1 = scaleH(seg.y1);
            seg.x2 = scaleW(seg.x2);
            seg.y2 = scaleH(seg.y2);
            seg.r1 = scaleW(seg.r1);
            seg.r2 = scaleH(seg.r2);
        }
    }

    let d = '';
    for (let i = 0; i < len; i++) {
        const seg = changes.d[i];
        d += PATH_MAP[seg.type];
        switch (seg.type) {
            case 2: // M, m
            case 3:
            case 4: // L, l
            case 5:
            case 18: // T, t
            case 19:
                d += `${seg.x},${seg.y} `;
                break;
            case 12: // H, h
            case 13:
                d += `${seg.x} `;
                break;
            case 14: // V, v
            case 15:
                d += `${seg.y} `;
                break;
            case 6: // C, c
            case 7:
                d += `${seg.x1},${seg.y1} ${seg.x2},${seg.y2} ${seg.x},${seg.y} `;
                break;
            case 8: // Q, q
            case 9:
                d += `${seg.x1},${seg.y1} ${seg.x},${seg.y} `;
                break;
            case 10: // A, a
            case 11:
                d += `${seg.r1},${seg.r2} ${seg.angle} ${seg.largeArcFlag} ${seg.sweepFlag} ${seg.x},${seg.y} `;
                break;
            case 16: // S, s
            case 17:
                d += `${seg.x2},${seg.y2} ${seg.x},${seg.y} `;
                break;
            default:
                break;
        }
    }

    return d;
};

function setElementTransformToList(transformList, transformation, size) {
    transformList.clear();

    function pointModelToSvg({ x, y }) {
        return { x: size.x + x, y: size.y - y };
    }

    const { positionX, positionY, rotationZ, scaleX, scaleY } = transformation;
    const center = pointModelToSvg({ x: positionX, y: positionY });

    const translateOrigin = svg.createSVGTransform();
    translateOrigin.tag = 'translateOrigin';
    translateOrigin.setTranslate(-center.x, -center.y);
    transformList.insertItemBefore(translateOrigin, 0);

    const scale = svg.createSVGTransform();
    scale.tag = 'scale';
    scale.setScale(scaleX, scaleY);
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

class SvgModel extends BaseModel {
    isSvgModel = true;

    modeConfigs = {};

    constructor(modelInfo, modelGroup) {
        super(modelInfo, modelGroup);
        const { elem, size } = modelInfo;
        this.elem = elem;
        this.size = size;

        this.isToolPathSelect = false;

        this.geometry = new THREE.PlaneGeometry(this.width, this.height);
        const material = new THREE.MeshBasicMaterial({ color: 0xe0e0e0, visible: false });

        this.meshObject = new THREE.Mesh(this.geometry, material);

        this.generateModelObject3D();

        this.processMode(modelInfo.mode, modelInfo.config);
        // use model info to refresh element
        this.refresh();
        // trigger update source, should add parmas to togger this func
        this.onTransform();
    }

    get type() {
        return this.elem.nodeName;
    }

    get x() {
        const transformList = SvgModel.getTransformList(this.elem);
        const transform = transformList.getItem(0);
        return transform.matrix.e;
    }

    get y() {
        const transformList = SvgModel.getTransformList(this.elem);
        const transform = transformList.getItem(0);
        return transform.matrix.f;
    }

    get scaleX() {
        const transformList = SvgModel.getTransformList(this.elem);
        const transform = transformList.getItem(2);

        return transform.matrix.a || 1;
    }

    get scaleY() {
        const transformList = SvgModel.getTransformList(this.elem);
        const transform = transformList.getItem(2);
        return transform.matrix.d || 1;
    }

    get angle() {
        const transformList = SvgModel.getTransformList(this.elem);
        const transform = transformList.getItem(1);
        return transform.angle || 0;
    }

    get logicalX() {
        return this.x - this.size.x;
    }

    get logicalY() {
        return -this.y + this.size.y;
    }

    setParent(parent) {
        this.parent = parent;
        this.appendToParent();
    }

    appendToParent() {
        this.parent && this.parent.append(this.elem);
    }

    /**
     * Update canvas size to correct calculation of element positions.
     *
     * @param {Object} size - { x, y } size of canvas
     */
    updateSize(size) {
        this.size = size;
    }

    /**
     *
     */
    updateIsToolPathSelect(selected) {
        this.isToolPathSelect = selected;

        switch (this.type) {
            // case 'path':
            case 'circle':
            case 'rect':
            case 'ellipse':
                if (selected) {
                    this.elem.setAttribute('filter', 'url(#inSelectedToolPathSVG)');
                } else {
                    this.elem.setAttribute('filter', 'none');
                }
                break;
            case 'text':
                if (selected) {
                    this.elem.setAttribute('filter', 'url(#inSelectedToolPathText)');
                } else {
                    this.elem.setAttribute('filter', 'none');
                }
                break;
            case 'image':
                if (selected) {
                    this.elem.setAttribute('filter', 'url(#inSelectedToolPathImage)');
                } else {
                    this.elem.setAttribute('filter', 'none');
                }
                break;
            default:
                break;
        }
    }

    genModelConfig() {
        const elem = this.elem;
        const coord = coordGmSvgToModel(this.size, elem);

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

    // just for svg file
    async uploadSourceImage() {
        const { uploadName } = this;

        if (uploadName.indexOf('.svg') === -1) {
            return;
        }
        const content = await fetch(`${DATA_PREFIX}/${uploadName}`, { method: 'GET' })
            .then(res => res.text());
        const canvas = document.createElement('canvas');
        // set canvas size to get image of exactly same size
        canvas.width = this.width;
        canvas.height = this.height;
        document.body.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        const v = await Canvg.fromString(ctx, content);
        await v.render();
        const blob = await new Promise(resolve => canvas.toBlob(resolve));
        const file = new File([blob], 'gen.png');
        document.body.removeChild(canvas);
        const formData = new FormData();
        formData.append('image', file);
        const res = await api.uploadImage(formData);

        this.uploadImageName = res.body.uploadName;
        this.generateModelObject3D();
        this.generateProcessObject3D();
    }

    // update model source file
    async updateSource() {
        // svg and image files(always has this.type = 'image') do nothing
        if (this.type === 'image') return;
        const { width, height } = this.elem.getBBox();
        const uploadName = await this.uploadSourceFile();
        const processImageName = uploadName,
            // !!!source file size MUST NOT apply scale
            sourceWidth = width,
            sourceHeight = height;


        this.sourceHeight = sourceHeight || this.sourceHeight;
        this.sourceWidth = sourceWidth || this.sourceWidth;
        this.width = width || this.width;
        this.height = height || this.height;
        this.uploadName = uploadName || this.uploadName;
        this.processImageName = processImageName || this.processImageName;


        // this.displayModelObject3D(uploadName, sourceWidth, sourceHeight);
        // const width = this.transformation.width;
        // const height = sourceHeight / sourceWidth * width;
        this.generateModelObject3D();
        this.generateProcessObject3D();
    }

    async uploadSourceFile() {
        const { content } = this.genModelConfig();
        let blob, file, res;
        if (this.type === 'text') {
            // eslint-disable-next-line prefer-const
            let { text, 'font-family': font, 'font-size': size } = this.config;
            // enlarge font-size to make process image clear enough
            size *= 16;
            const cloneElement = this.elem.cloneNode(true);
            cloneElement.setAttribute('font-size', size);
            this.elem.parentNode.append(cloneElement);
            // eslint-disable-next-line prefer-const
            let { x, y, width, height } = cloneElement.getBBox();
            const bbox = { x, y, width, height };
            x = parseFloat(cloneElement.getAttribute('x'));
            y = parseFloat(cloneElement.getAttribute('y'));
            cloneElement.remove();

            const name = this.originalName;
            const alignment = 'middle';
            res = await api.convertOneLineTextToSvg({ text, font, name, size, x, y, bbox, alignment });
        } else {
            blob = new Blob([content], { type: 'image/svg+xml' });
            file = new File([blob], 'gen.svg');
            const formData = new FormData();
            formData.append('image', file);
            res = await api.uploadImage(formData);
        }
        return res.body.uploadName;
    }

    static getTransformList(elem) {
        const transform = elem.transform;
        if (!transform) {
            elem.setAttribute('transform', 'translate(0,0)');
        }
        return elem.transform.baseVal;
    }

    elemTransformList() {
        const transform = this.elem.transform;
        if (!transform) {
            this.elem.setAttribute('transform', 'translate(0,0)');
        }
        return this.elem.transform.baseVal;
    }

    refreshElemAttrs() {
        const elem = this.elem;
        const { config, transformation, uploadName, width, height } = this;
        const href = `${DATA_PREFIX}/${uploadName}`;
        const { positionX, positionY } = transformation;

        for (const key of Object.keys(config)) {
            if (key === 'text') {
                elem.textContent = config[key];
            } else {
                elem.setAttribute(key, config[key]);
            }
        }

        const { x, y } = this.pointModelToSvg({ x: positionX, y: positionY });
        switch (this.type) {
            case 'circle':
                elem.setAttribute('cx', x);
                elem.setAttribute('cy', y);
                elem.setAttribute('r', width / 2);
                break;
            case 'ellipse':
                elem.setAttribute('cx', x);
                elem.setAttribute('cy', y);
                elem.setAttribute('rx', width / 2);
                elem.setAttribute('ry', height / 2);
                break;
            // case 'line':
            //     numberAttrs.push('x1', 'y1', 'x2', 'y2');
            //     break;
            // case 'path':
            //     changes.d = elem.getAttribute('d');
            //     break;
            case 'rect':
            case 'image': {
                elem.setAttribute('x', x - width / 2);
                elem.setAttribute('y', y - height / 2);
                elem.setAttribute('width', width);
                elem.setAttribute('height', height);
                if (!elem.getAttribute('href')) {
                    elem.setAttribute('href', checkIsImageSuffix(href) ? href : './resources/images/loading.gif');
                }
                break;
            }
            case 'text': {
                const diffY = elem.getAttribute('y') - elem.getBBox().y;
                elem.setAttribute('x', x - width / 2);
                elem.setAttribute('y', y - height / 2 + diffY);
                elem.setAttribute('fill', '#000');
                break;
            }
            default:
                break;
        }

        setElementTransformToList(this.elemTransformList(), this.transformation, this.size);
    }

    refresh() {
        this.elemTransformList().clear();
        this.refreshElemAttrs();
    }

    static getElementTransform(element) {
        const { x, y, width, height } = element.getBBox();

        const transformList = SvgModel.getTransformList(element);

        const scaleX = transformList.getItem(2).matrix.a;
        const scaleY = transformList.getItem(2).matrix.d;
        const angle = transformList.getItem(1).angle;

        return {
            x: x + width / 2,
            y: y + height / 2,
            width,
            height,
            scaleX,
            scaleY,
            angle
        };
    }

    static initializeElementTransform(element) {
        // if (element.transform) {
        //     return;
        // }

        // element.setAttribute('transform', 'translate(0,0)');

        const { x, y, width, height } = element.getBBox();

        const center = svg.createSVGPoint();
        center.x = x + width / 2;
        center.y = y + height / 2;

        SvgModel.recalculateElementAttributes(element, {
            x: x + width / 2,
            y: y + height / 2,
            width,
            height,
            scaleX: 1,
            scaleY: 1,
            angle: 0
        });
    }

    /**
     * On transform complete, normalize transform list.
     */
    static completeElementTransform(element) {
        // normalize transform list
        const transformList = SvgModel.getTransformList(element);

        // derive transform action(s) from transform list
        function inferTransformType(svgTransformList) {
            if (svgTransformList.length === 5) {
                const t = svgTransformList.getItem(0);
                if (t.type === 2) {
                    return 'move';
                } else {
                    return 'rotate';
                }
            } else {
                return 'resize';
            }
        }

        const transformType = inferTransformType(transformList);
        if (transformType === 'move') {
            // move action
            // [T][T][R][S][T]
            const { x, y, width, height } = element.getBBox();

            const angle = transformList.getItem(2).angle;
            const scaleX = transformList.getItem(3).matrix.a;
            const scaleY = transformList.getItem(3).matrix.d;

            const transform = transformList.consolidate();
            const matrix = transform.matrix;

            const center = svg.createSVGPoint();
            center.x = x + width / 2;
            center.y = y + height / 2;

            const newCenter = center.matrixTransform(matrix);

            const t = {
                x: newCenter.x,
                y: newCenter.y,
                width,
                height,
                scaleX,
                scaleY,
                angle
            };

            SvgModel.recalculateElementAttributes(element, t);
        } else if (transformType === 'resize') {
            // resize action
            // [T][R][S][T]
            const { x, y, width, height } = element.getBBox();

            const angle = transformList.getItem(1).angle;
            const scaleX = transformList.getItem(2).matrix.a;
            const scaleY = transformList.getItem(2).matrix.d;

            const transform = transformList.consolidate();
            const matrix = transform.matrix;

            const center = svg.createSVGPoint();
            center.x = x + width / 2;
            center.y = y + height / 2;

            const newCenter = center.matrixTransform(matrix);

            const t = {
                x: newCenter.x,
                y: newCenter.y,
                width,
                height,
                scaleX,
                scaleY,
                angle
            };

            SvgModel.recalculateElementAttributes(element, t);
        } else {
            // rotate action
            // [R][T][R][S][T]
            const { x, y, width, height } = element.getBBox();

            const rotateAngle = transformList.getItem(0).angle;

            const angle = transformList.getItem(2).angle;
            const scaleX = transformList.getItem(3).matrix.a;
            const scaleY = transformList.getItem(3).matrix.d;

            const transform = transformList.consolidate();
            const matrix = transform.matrix;

            const center = svg.createSVGPoint();
            center.x = x + width / 2;
            center.y = y + height / 2;

            const newCenter = center.matrixTransform(matrix);

            const t = {
                x: newCenter.x,
                y: newCenter.y,
                width,
                height,
                scaleX,
                scaleY,
                angle: angle + rotateAngle
            };

            SvgModel.recalculateElementAttributes(element, t);
        }

        // emit event?
    }

    static recalculateElementAttributes(element, t) {
        const { x, y, width = 0, height = 0, angle } = t;
        let { scaleX, scaleY } = t;
        const absScaleX = Math.abs(scaleX);
        const absScaleY = Math.abs(scaleY);

        switch (element.nodeName) {
            case 'ellipse': {
                element.setAttribute('cx', x);
                element.setAttribute('cy', y);
                element.setAttribute('rx', width / 2 * absScaleX);
                element.setAttribute('ry', height / 2 * absScaleY);
                scaleX /= absScaleX;
                scaleY /= absScaleY;
                break;
            }
            case 'image': {
                element.setAttribute('x', x - width / 2);
                element.setAttribute('y', y - height / 2);
                element.setAttribute('width', width);
                element.setAttribute('height', height);
                break;
            }
            case 'rect': {
                element.setAttribute('x', x - width * absScaleX / 2);
                element.setAttribute('y', y - height * absScaleY / 2);
                element.setAttribute('width', width * absScaleX);
                element.setAttribute('height', height * absScaleY);
                scaleX /= absScaleX;
                scaleY /= absScaleY;
                break;
            }
            case 'text': {
                // text uses base line as y
                const baselineOffsetY = element.getAttribute('y') - element.getBBox().y;
                element.setAttribute('x', x - width / 2);
                element.setAttribute('y', y - height / 2 + baselineOffsetY);
                break;
            }
            default:
                break;
        }

        SvgModel.recalculateElementTransformList(element, { x, y, scaleX, scaleY, angle });
    }

    static recalculateElementTransformList(element, t) {
        const { x, y, scaleX, scaleY, angle } = t;
        const transformList = SvgModel.getTransformList(element);

        transformList.clear();

        // [T]
        const translateToOrigin = svg.createSVGTransform();
        translateToOrigin.setTranslate(-x, -y);
        transformList.appendItem(translateToOrigin);

        // [S][T]
        const scale = svg.createSVGTransform();
        scale.setScale(scaleX, scaleY);
        transformList.insertItemBefore(scale, 0);

        // [R][S][T]
        const rotate = svg.createSVGTransform();
        rotate.setRotate(angle, 0, 0);
        transformList.insertItemBefore(rotate, 0);

        // [T][R][S][T]
        const translateToPosition = svg.createSVGTransform();
        translateToPosition.setTranslate(x, y);
        transformList.insertItemBefore(translateToPosition, 0);
    }

    onUpdate() {
        const transform = this.elemTransform();
        if (!transform) return;

        const { width, height } = this;
        const { bbox: { x, y }, scaleX, scaleY, translateX, translateY, rotationAngle } = transform;

        if (rotationAngle) {
            this.updateAndRefresh({ transformation: { rotationZ: -rotationAngle / 180 * Math.PI } });
            return;
        }

        function remap(x1, y1) {
            if (x1.x) {
                y1 = x1.y;
                x1 = x1.x;
            }
            return { x: x1 * scaleX + translateX, y: y1 * scaleY + translateY };
        }

        function scaleW(w) {
            return scaleX * w;
        }

        function scaleH(w) {
            return scaleY * w;
        }

        const center = { x: x + width / 2, y: y + height / 2 };
        const { x: positionX, y: positionY } = this.pointSvgToModel(remap(center));

        const attrs = {
            config: {
                'stroke-width': this.elem.getAttribute('stroke-width')
            },
            width: width,
            height: height,
            transformation: {
                positionX: positionX,
                positionY: positionY,
                scaleX,
                scaleY,
                width: width * Math.abs(scaleX),
                height: height * Math.abs(scaleY)
            }
        };

        // remap will reset all transforms
        // Reset scale to 1, which resets the border to 1
        if (this.type === 'path') {
            const d = remapPath(this.elem, remap, scaleW, scaleH);
            attrs.config.d = d;
            attrs.transformation.scaleX = 1;
            attrs.transformation.scaleY = 1;
            attrs.width *= Math.abs(scaleX);
            attrs.height *= Math.abs(scaleY);
            this.elem.setAttribute('d', d);
            this.updateSource();
        }
        if (this.type === 'rect') {
            /*
            attrs.transformation.scaleX = 1;
            attrs.transformation.scaleY = 1;
            attrs.width *= Math.abs(scaleX);
            attrs.height *= Math.abs(scaleY);
            this.elem.setAttribute('width', attrs.transformation.width);
            this.elem.setAttribute('height', attrs.transformation.height);
            this.updateSource();
            */
        }
        if (this.type === 'ellipse') {
            attrs.transformation.scaleX = 1;
            attrs.transformation.scaleY = 1;
            attrs.width *= Math.abs(scaleX);
            attrs.height *= Math.abs(scaleY);
            this.elem.setAttribute('rx', attrs.transformation.width / 2);
            this.elem.setAttribute('ry', attrs.transformation.height / 2);
            this.updateSource();
        }

        this.updateAndRefresh(attrs);
    }

    elemTransform() {
        // bbox translate, scale, rotation
        const elem = this.elem;
        const transformList = this.elemTransformList();
        const bbox = elem.getBBox();
        const transform = {
            bbox,
            translateX: 0,
            translateY: 0,
            scaleX: 0,
            scaleY: 0,
            rotationAngle: 0
        };


        const rotationIdx = findItemIndexByType(transformList, 4);
        let angle = 0;
        if (rotationIdx > -1) {
            angle = transformList.getItem(rotationIdx).angle;

            // rotation can not happen with other transform
            if (transformList.getItem(rotationIdx).angle.toFixed(5) !== (-this.transformation.rotationZ / Math.PI * 180).toFixed(5)) {
                transform.rotationAngle = transformList.getItem(rotationIdx).angle;
                return transform;
            }
        }


        if (angle) {
            const point = svg.createSVGPoint();
            point.x = bbox.x + bbox.width / 2;
            point.y = bbox.y + bbox.height / 2;
            const matrix = transformList.consolidate().matrix;
            const center = point.matrixTransform(matrix);

            const rotateBack = svg.createSVGTransform();
            rotateBack.setRotate(-angle, center.x, center.y);
            this.elemTransformList().insertItemBefore(rotateBack, 0);
        }

        const m = (transformList.consolidate() || svg.createSVGTransform()).matrix;
        transform.scaleX = m.a;
        transform.scaleY = m.d;
        transform.translateX = m.e;
        transform.translateY = m.f;

        return transform;
    }


    pointModelToSvg({ x, y }) {
        return { x: this.size.x + x, y: this.size.y - y };
    }

    pointSvgToModel({ x, y }) {
        return { x: -this.size.x + x, y: this.size.y - y };
    }

    // --Model functions--


    generateModelObject3D() {
        if (this.sourceType !== '3d' && this.sourceType !== 'image3d') {
            const uploadPath = `${DATA_PREFIX}/${this.uploadName}`;
            const texture = new THREE.TextureLoader().load(uploadPath, () => {
                this.meshObject.dispatchEvent(EVENTS.UPDATE);
            });
            // TODO make the 'MeshBasicMaterial' to be transparent
            const material = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 1,
                map: texture,
                side: THREE.DoubleSide
            });
            if (this.modelObject3D) {
                this.meshObject.remove(this.modelObject3D);
                this.modelObject3D = null;
            }
            this.meshObject.geometry = new THREE.PlaneGeometry(this.width, this.height);
            this.modelObject3D = new THREE.Mesh(this.meshObject.geometry, material);

            this.meshObject.add(this.modelObject3D);
            this.modelObject3D.visible = this.showOrigin;
        }
        this.updateTransformation(this.transformation);
    }

    generateProcessObject3D() {
        if (!this.processImageName) {
            return;
        }
        const uploadPath = `${DATA_PREFIX}/${this.processImageName}`;
        // const texture = new THREE.TextureLoader().load(uploadPath);
        const texture = new THREE.TextureLoader().load(uploadPath, () => {
            this.meshObject.dispatchEvent(EVENTS.UPDATE);
        });
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1,
            map: texture,
            side: THREE.DoubleSide
        });
        if (this.processObject3D) {
            this.meshObject.remove(this.processObject3D);
            this.processObject3D = null;
        }
        this.meshObject.geometry = new THREE.PlaneGeometry(this.width, this.height);
        this.processObject3D = new THREE.Mesh(this.meshObject.geometry, material);

        this.meshObject.add(this.processObject3D);


        this.processObject3D.visible = !this.showOrigin;

        this.updateTransformation(this.transformation);
    }

    changeShowOrigin() {
        this.showOrigin = !this.showOrigin;
        this.modelObject3D.visible = this.showOrigin;
        if (this.processObject3D) {
            this.processObject3D.visible = !this.showOrigin;
        }

        return {
            showOrigin: this.showOrigin,
            showImageName: this.showOrigin ? this.uploadName : this.processImageName
        };
    }

    // updateVisible(param) {
    //     if (param === false) {
    //         this.modelObject3D && (this.modelObject3D.visible = param);
    //         this.processObject3D && (this.processObject3D.visible = param);
    //     } else {
    //         // todo
    //         this.modelObject3D && (this.modelObject3D.visible = this.showOrigin);
    //         this.processObject3D && (this.processObject3D.visible = !this.showOrigin);
    //     }
    // }

    getModeConfig(mode) {
        if (this.sourceType !== 'raster') {
            return null;
        }
        return this.modeConfigs[mode];
    }

    processMode(mode, config) {
        if (this.mode !== mode) {
            this.modeConfigs[this.mode] = {
                config: {
                    ...this.config
                }
            };
            if (this.modeConfigs[mode]) {
                this.config = {
                    ...this.modeConfigs[mode].config
                };
            } else {
                this.config = {
                    ...config
                };
            }

            this.mode = mode;
            this.processImageName = null;
        }

        this.generateProcessObject3D();

        // const res = await api.processImage({
        //     headType: this.headType,
        //     uploadName: this.uploadName,
        //     config: {
        //         ...this.config,
        //         density: 4
        //     },
        //     sourceType: this.sourceType,
        //     mode: mode,
        //     transformation: {
        //         width: this.width,
        //         height: this.height,
        //         rotationZ: 0
        //     }
        // });
        //
        // this.processImageName = res.body.filename;
    }

    computeBoundingBox() {
        const { width, height, rotationZ, scaleX, scaleY } = this.transformation;
        const bboxWidth = (Math.abs(width * Math.cos(rotationZ)) + Math.abs(height * Math.sin(rotationZ))) * scaleX;
        const bboxHeight = (Math.abs(width * Math.sin(rotationZ)) + Math.abs(height * Math.cos(rotationZ))) * scaleY;
        const { logicalX: x, logicalY: y } = this;
        this.boundingBox = new THREE.Box2(
            new THREE.Vector2(x - bboxWidth / 2, y - bboxHeight / 2),
            new THREE.Vector2(x + bboxWidth / 2, y + bboxHeight / 2)
        );
    }

    getTaskInfo() {
        const taskInfo = {
            modelID: this.modelID,
            modelName: this.modelName,
            headType: this.headType,
            sourceType: this.sourceType,
            mode: this.mode,

            visible: this.visible,
            isToolPathSelect: this.isToolPathSelect,

            sourceHeight: this.sourceHeight,
            sourceWidth: this.sourceWidth,
            scale: this.scale,
            originalName: this.originalName,
            uploadName: this.uploadName,
            processImageName: this.processImageName,

            transformation: {
                ...this.transformation
            },
            config: {
                ...this.config
            }
        };
        // svg process as image
        if (taskInfo.sourceType === 'svg' && taskInfo.mode !== 'vector') {
            taskInfo.uploadName = this.uploadImageName;
        }
        return taskInfo;
    }

    onTransform() {
        const t = SvgModel.getElementTransform(this.elem);
        const size = this.size;

        const transformation = {
            ...this.transformation,
            positionX: t.x - size.x,
            positionY: -t.y + size.y,
            // positionZ: 0,
            scaleX: t.scaleX,
            scaleY: t.scaleY,
            scaleZ: 1,
            rotationX: 0,
            rotationY: 0,
            rotationZ: -t.angle / 180 * Math.PI,
            width: t.width * Math.abs(t.scaleX),
            height: t.height * Math.abs(t.scaleY)
        };

        this.updateTransformation(transformation);
        // Need to update source for SVG, element attributes(width, height) changed
        // Not to update source for text, because <path> need to remap first
        // Todo, <Path> error, add remap method or not to use model source
        this.updateSource();
    }

    async updateAndRefresh({ transformation, config, ...others } = {}) {
        if (transformation) {
            this.updateTransformation(transformation);
        }
        if (config) {
            this.config = {
                ...this.config,
                ...config
            };
        }
        if (Object.keys(others)) {
            for (const key of Object.keys(others)) {
                this[key] = others[key];
            }
        }

        this.refresh();
        this.modelGroup.modelChanged();
        if (this.config.svgNodeName === 'text') {
            updateTimer && clearTimeout(updateTimer);
            updateTimer = setTimeout(() => {
                this.updateSource();
            }, 300); // to prevent continuous input cause frequently update
        }
    }

    /**
     * Note that you need to give cloned Model a new model name.
     *
     * @returns {ThreeModel}
     */
    clone(modelGroup) {
        const clone = new SvgModel({ ...this }, modelGroup);
        clone.originModelID = this.modelID;
        clone.modelID = uuid.v4();
        clone.generateModelObject3D();
        clone.generateProcessObject3D();
        this.meshObject.updateMatrixWorld();

        clone.setMatrix(this.meshObject.matrixWorld);

        return clone;
    }

    updateConfig(config) {
        this.config = {
            ...this.config,
            ...config
        };
        this.processMode(this.mode, this.config);
    }

    updateProcessImageName(processImageName) {
        // this.processMode(this.mode, this.config, processImageName);
        this.processImageName = processImageName;

        this.generateProcessObject3D();
    }
    // --Model functions--

    getSerializableConfig() {
        const {
            modelID, limitSize, headType, sourceType, sourceHeight, sourceWidth, originalName, uploadName, config, mode,
            transformation, processImageName
        } = this;
        return {
            modelID,
            limitSize,
            headType,
            sourceType,
            sourceHeight,
            sourceWidth,
            originalName,
            uploadName,
            config,
            mode,
            transformation,
            processImageName
        };
    }
}


export default SvgModel;
