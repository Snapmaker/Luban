import Canvg, { presets } from 'canvg';
import { coordGmSvgToModel } from '../../widgets/CncLaserSvgEditor/element-utils';

import { remapElement } from '../../widgets/CncLaserSvgEditor/element-recalculate';
import { NS } from '../../widgets/CncLaserSvgEditor/lib/namespaces';
import { DEFAULT_SCALE } from '../../constants/svg-constants';
import { DATA_PREFIX } from '../../constants';

import {
// matrixMultiply,
// transformListToTransform

} from '../../widgets/CncLaserSvgEditor/element-transform';

import api from '../../api';

const svg = document.createElementNS(NS.SVG, 'svg');

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

class SvgModel {
    // SvgModel is View Model, need related to Model object
    relatedModel = null

    constructor(elem, modelGroup) {
        this.elem = elem;
        this.modelGroup = modelGroup;
    }

    get type() {
        return this.elem.nodeName;
    }

    setRelatedModel(relatedModel, update = true) {
        this.relatedModel = relatedModel;
        update && this.onUpdate();
    }

    setParent(parent) {
        this.parent = parent;
        this.appendToParent();
    }

    appendToParent() {
        this.parent && this.parent.append(this.elem);
    }

    genModelConfig() {
        const elem = this.elem;
        const coord = coordGmSvgToModel(this.modelGroup.size, elem);
        // const fontSize = elem.getAttribute('font-size') * 8;

        // eslint-disable-next-line prefer-const
        let { x, y, width, height, positionX, positionY, scaleX, scaleY } = coord;
        width *= scaleX;
        height *= scaleY;

        const scale = svg.createSVGTransform();
        scale.setScale(8, 8);

        const clone = elem.cloneNode(true);
        clone.setAttribute('transform', `scale(${scaleX} ${scaleY})`);
        clone.setAttribute('font-size', clone.getAttribute('font-size') * DEFAULT_SCALE);
        remapElement(clone, scale.matrix);

        let vx = x * DEFAULT_SCALE * scaleX;
        let vy = y * DEFAULT_SCALE * scaleY;
        let vwidth = width * DEFAULT_SCALE;
        let vheight = height * DEFAULT_SCALE;

        if (scaleX < 0) {
            vx += vwidth;
            vwidth = -vwidth;
        }
        if (scaleY < 0) {
            vy += vheight;
            vheight = -vheight;
        }

        // Todo: need to optimize
        const content = `<svg x="0" y="0" width="${vwidth}" height="${vheight}}" `
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

    async updateSource() {
        const bbox = this.elem.getBBox();
        const { width, height } = bbox;
        const uploadName = await this.uploadSourceFile();
        this.relatedModel.updateSource({ uploadName, width, height, sourceWidth: width * 8, sourceHeight: height * 8 });
    }

    async uploadSourceFile() {
        const width = 100, height = 100;
        const { content } = this.genModelConfig();
        let blob, file;
        if (this.type === 'text') {
            const canvas = new OffscreenCanvas(width, height);
            const ctx = canvas.getContext('2d');
            const v = await Canvg.fromString(ctx, content, presets.offscreen());
            await v.render();
            blob = await canvas.convertToBlob();
            file = new File([blob], 'gen.png');
        } else {
            blob = new Blob([content], { type: 'image/svg+xml' });
            file = new File([blob], 'gen.svg');
        }

        // console.log(content, URL.createObjectURL(blob));

        const formData = new FormData();
        formData.append('image', file);
        const res = await api.uploadImage(formData);
        return res.body.uploadName;
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
        const { config, transformation, uploadName } = this.relatedModel;
        const href = `${DATA_PREFIX}/${uploadName}`;
        const { positionX, positionY, width, height } = transformation;
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
            case 'image':
                elem.setAttribute('x', x - width / 2);
                elem.setAttribute('y', y - height / 2);
                elem.setAttribute('width', width);
                elem.setAttribute('height', height);
                elem.setAttribute('href', href);
                break;
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

        this.modelGroup.setElementTransformToList(this.elemTransformList(), this.relatedModel.transformation);
    }

    setElementTransformToList(transformList, transformation) {
        // const { positionX, positionY, rotationZ, scaleX, scaleY, flip } = this.relatedModel.transformation;
        const { positionX, positionY, rotationZ, scaleX, scaleY, flip } = transformation;
        const center = this.pointModelToSvg({ x: positionX, y: positionY });

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

    refresh() {
        this.elemTransformList().clear();
        this.refreshElemAttrs();
    }

    onUpdate() {
        const transform = this.elemTransform();
        if (!transform) return;
        const { bbox: { width, height, x, y }, scaleX, scaleY, translateX, translateY, rotationAngle } = transform;

        if (rotationAngle) {
            this.relatedModel.updateAndRefresh({ transformation: { rotationZ: -rotationAngle / 180 * Math.PI } });
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
                width: width,
                height: height
            }
        };
        // reserve scale cause stroke-width scaled
        if (this.type === 'rect' || this.type === 'ellipse') {
            attrs.config['stroke-width'] = 0.25 / Math.min(scaleX, scaleY);
        }

        // remap will reset all transforms
        if (this.type === 'path') {
            const d = remapPath(this.elem, remap, scaleW, scaleH);
            attrs.config.d = d;
            attrs.transformation.scaleX = 1;
            attrs.transformation.scaleY = 1;
            attrs.width *= Math.abs(scaleX);
            attrs.height *= Math.abs(scaleY);
            attrs.transformation.width *= Math.abs(scaleX);
            attrs.transformation.height *= Math.abs(scaleY);
            this.elem.setAttribute('d', d);
            this.updateSource();
        }

        this.relatedModel.updateAndRefresh(attrs);
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
            if (transformList.getItem(rotationIdx).angle.toFixed(5) !== (-this.relatedModel.transformation.rotationZ / Math.PI * 180).toFixed(5)) {
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

    elemResize({ resizeDir, resizeFrom, resizeTo, isUniformScaling }) {
        let clonedElem = this.elem.cloneNode();
        const transformList = clonedElem.transform.baseVal;
        transformList.clear();
        this.modelGroup.setElementTransformToList(transformList, this.relatedModel.transformation);
        const matrix = transformList.consolidate().matrix;
        const matrixInverse = matrix.inverse();
        function transformPoint(p, m) {
            const svgPoint = svg.createSVGPoint();
            svgPoint.x = p.x;
            svgPoint.y = p.y;
            return svgPoint.matrixTransform(m);
        }

        const { positionX, positionY, width, height, scaleX, scaleY, flip, uniformScalingState } = this.relatedModel.transformation;
        // ( x, y ) is the center of model on modelGroup
        const { x, y } = this.pointModelToSvg({ x: positionX, y: positionY });

        // 3 points before matrix
        // resize model from ptFrom to ptTo base the center ptFixed
        const ptFrom = transformPoint(resizeFrom, matrixInverse);
        const ptTo = transformPoint(resizeTo, matrixInverse);
        const ptFixed = { x, y };
        if (ptFrom.x > x + width / 3) ptFixed.x -= width / 2;
        if (ptFrom.x < x - width / 3) ptFixed.x += width / 2;
        if (ptFrom.y > y + height / 3) ptFixed.y -= height / 2;
        if (ptFrom.y < y - height / 3) ptFixed.y += height / 2;
        // scale before matrix
        let sx = 1;
        let sy = 1;
        if (Math.abs(ptFrom.x - x) > width / 10) {
            sx = (ptFixed.x - ptTo.x) / width * ((flip & 2) ? 1 : -1) * (scaleX > 0 ? 1 : -1);
            if (resizeDir.includes('w')) {
                sx *= -1;
            }
        }
        if (Math.abs(ptFrom.y - y) > height / 10) {
            sy = (ptFixed.y - ptTo.y) / height * ((flip & 1) ? 1 : -1) * (scaleY > 0 ? 1 : -1);
            if (resizeDir.includes('n')) {
                sy *= -1;
            }
        }
        // while uniform scaling
        const uniformScaling = uniformScalingState || isUniformScaling;
        if (uniformScaling) {
            if (Math.abs(sx) === 1) {
                sx *= Math.abs(sy);
            } else {
                sy = Math.abs(sx) * sy / Math.abs(sy);
            }
        }

        // scale after matrix
        const list = this.elemTransformList();
        const scale = list.getItem(findItemIndexByType(list, 3));
        scale.setScale(sx * scaleX * ((flip & 2) ? -1 : 1), sy * scaleY * ((flip & 1) ? -1 : 1));

        clonedElem = this.elem.cloneNode();
        clonedElem.transform.baseVal.getItem(0).setTranslate(x, y);
        const ptFixedFrom = transformPoint(ptFixed, matrix);
        const matrixTrans = clonedElem.transform.baseVal.consolidate().matrix;
        const ptFixedTo = transformPoint(ptFixed, matrixTrans);
        const tx = ptFixedTo.x - ptFixedFrom.x;
        const ty = ptFixedTo.y - ptFixedFrom.y;
        const trans = list.getItem(0);
        trans.setTranslate(x - tx, y - ty);
    }

    pointModelToSvg({ x, y }) {
        return { x: this.modelGroup.size.x + x, y: this.modelGroup.size.y - y };
    }

    pointSvgToModel({ x, y }) {
        return { x: -this.modelGroup.size.x + x, y: this.modelGroup.size.y - y };
    }
}


export default SvgModel;
