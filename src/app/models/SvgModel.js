import { v4 as uuid } from 'uuid';
import * as THREE from 'three';
import Canvg from 'canvg';
import svgPath from 'svgpath';
import { cloneDeep } from 'lodash';
import { coordGmSvgToModel, createSVGElement } from '../ui/SVGEditor/element-utils';

import { NS } from '../ui/SVGEditor/lib/namespaces';


// import ThreeDxfLoader from '../lib/threejs/ThreeDxfLoader';

import api from '../api';
import { checkIsImageSuffix } from '../../shared/lib/utils';
import BaseModel from './BaseModel';
import Resource from './Resource';
import { SVG_MOVE_MINI_DISTANCE } from '../constants';
// import { DEFAULT_FILL_COLOR } from '../ui/SVGEditor/constants';

const EVENTS = {
    UPDATE: { type: 'update' }
};

const svg = document.createElementNS(NS.SVG, 'svg');
// let updateTimer;

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

    resource = new Resource();

    pathPreSelectionArea = null;

    vertexPoints = []

    constructor(modelInfo, modelGroup) {
        super(modelInfo, modelGroup);
        const { elem, size } = modelInfo;
        this.elem = elem;
        this.size = size;

        this.resource.setOriginalFile(
            // modelInfo.originalName,
            modelInfo.uploadName,
            modelInfo.sourceWidth,
            modelInfo.sourceHeight
        );
        this.resource.setProcessedFile(
            modelInfo.processImageName,
            modelInfo.transformation.width,
            modelInfo.transformation.height
        );

        this.isToolPathSelect = false;

        this.geometry = new THREE.PlaneGeometry(this.width, this.height);
        const material = new THREE.MeshBasicMaterial({ color: 0xe0e0e0, visible: false });

        this.meshObject = new THREE.Mesh(this.geometry, material);

        this.generateModelObject3D();

        this.processMode(modelInfo.mode, modelInfo.config);
        // use model info to refresh element
        this.refresh();
        this.generatePathPreSelectionArea();
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

    setPreSelection(parent) {
        if (this.pathPreSelectionArea) {
            this.pathPreSelectionArea.setAttribute('target-id', this.modelID);
            parent.append(this.pathPreSelectionArea);
        }
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
            case 'path':
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

    calculationPath(path) {
        const allPoints = [];
        svgPath(path).iterate((segment, __, x, y) => {
            const arr = cloneDeep(segment);
            const mark = arr.shift();

            if (mark !== 'M' && mark !== 'Z') {
                const points = [];
                points.push([x, y]);
                for (let index = 0; index < arr.length; index += 2) {
                    points.push([
                        Number(arr[index]),
                        Number(arr[index + 1])
                    ]);
                }
                allPoints.push(points);
            }
        });

        const sorted = [];
        const findConnect = (arr) => {
            const latest = sorted[sorted.length - 1];
            const latestPoints = latest.item;

            return [arr[0], arr[arr.length - 1]].some((i) => {
                return (!latest.connected ? [latestPoints[0], latestPoints[latestPoints.length - 1]] : [latestPoints[latestPoints.length - 1]]).some((j) => {
                    return Math.abs(i[0] - j[0]) <= SVG_MOVE_MINI_DISTANCE && Math.abs(i[1] - j[1]) <= SVG_MOVE_MINI_DISTANCE;
                });
            });
        };
        const setSort = (item, connected) => {
            const latest = sorted[sorted.length - 1];
            if (connected && latest) {
                if (Math.abs(latest.item[latest.item.length - 1][0] - item[0][0]) <= SVG_MOVE_MINI_DISTANCE && Math.abs(latest.item[latest.item.length - 1][1] - item[0][1]) <= SVG_MOVE_MINI_DISTANCE) {
                    sorted.push({ item, connected: true });
                } else {
                    item.reverse();
                    sorted.push({ item, connected: true });
                }
            } else {
                sorted.push({ item, connected: false });
            }
        };

        const setupConnection = () => {
            let flag = true;
            while (flag) {
                const connected = allPoints.map((i, _index) => {
                    return {
                        arr: i,
                        _index
                    };
                }).filter(p => p.arr && findConnect(p.arr));
                const latest = sorted[sorted.length - 1];
                const latestPoints = latest.item;

                if (connected.length > 0) {
                    const c = allPoints[connected[0]._index];
                    // flip first point
                    if (!latest.connected) {
                        if (!(
                            Math.abs(latestPoints[latestPoints.length - 1][0] - c[0][0]) <= SVG_MOVE_MINI_DISTANCE
                            && Math.abs(latestPoints[latestPoints.length - 1][1] - c[0][1]) <= SVG_MOVE_MINI_DISTANCE)
                        ) {
                            const arr = latestPoints;
                            const a = arr.pop();
                            const b = arr.shift();
                            arr.push(b);
                            arr.unshift(a);
                            sorted[sorted.length - 1] = {
                                item: arr,
                                connected: false
                            };
                        }
                    }
                    setSort(c, true);
                    allPoints[connected[0]._index] = null;
                    flag = true;
                } else {
                    flag = false;
                }
            }
        };

        for (let index = 0; index < allPoints.length; index++) {
            if (sorted.length === 0) {
                setSort(allPoints[index], false);
                allPoints[index] = null;
                setupConnection();
            }
            if (allPoints[index]) {
                // TODO: Judge whether the new point is connected to the head of the latest clip. Flip the latest clip
                setSort(allPoints[index], false);
                setupConnection();
            }
        }

        const mark = (length) => {
            switch (length) {
                case 1:
                    return 'L';
                case 2:
                    return 'Q';
                case 3:
                    return 'C';
                default:
                    return '';
            }
        };

        const paths = sorted.reduce((p, c) => {
            const arr = c.item;
            if (c.connected) {
                arr.shift();
                p[p.length - 1] += ` ${mark(arr.length)} ${arr.map(item => item.join(' ')).join(' ')}`;
            } else {
                p.push(`M ${arr.shift().join(' ')} ${mark(arr.length)} ${arr.map(item => item.join(' ')).join(' ')}`);
            }
            return p;
        }, []);

        return paths;
    }

    genModelConfig() {
        const elem = this.elem;
        const coord = coordGmSvgToModel(this.size, elem);

        const { x, y, width, height, positionX, positionY } = coord;
        let modelContent = '';
        const isDraw = elem.getAttribute('id')?.includes('graph');

        if (elem instanceof SVGPathElement && isDraw) {
            const path = elem.getAttribute('d');
            const paths = this.calculationPath(path);
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
            clone.setAttribute('transform', 'scale(1 1)');
            clone.setAttribute('font-size', clone.getAttribute('font-size'));
            modelContent = new XMLSerializer().serializeToString(clone);
        }

        // Todo: need to optimize
        const content = `<svg x="0" y="0" width="${width}mm" height="${height}mm" `
            + `viewBox="${x} ${y} ${width} ${height}" `
            + `xmlns="http://www.w3.org/2000/svg">${modelContent}</svg>`;
        const model = {
            modelID: elem.getAttribute('id'),
            content: content,
            width: width,
            height: height,
            transformation: {
                positionX,
                positionY
            },
            config: {
                svgNodeName: elem.nodeName,
                text: elem.getAttribute('textContent'),
                'font-size': elem.getAttribute('font-size'),
                'font-family': elem.getAttribute('font-family')
            }
        };

        return model;
    }

    // just for svg file
    async uploadSourceImage() {
        if (this.resource.originalFile.name.indexOf('.svg') === -1) {
            return;
        }
        const content = await fetch(this.resource.originalFile.path, { method: 'GET' })
            .then(res => res.text());

        const canvas = document.createElement('canvas');
        // set canvas size to get image of exactly same size
        canvas.width = this.width;
        canvas.height = this.height;
        canvas.style.font = '16px Arial';
        document.body.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        ctx.font = canvas.style.font;
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
        // this.uploadName = uploadName || this.uploadName;
        this.resource.originalFile.update(uploadName);
        this.resource.processedFile.update(processImageName);


        // this.displayModelObject3D(uploadName, sourceWidth, sourceHeight);
        // const width = this.transformation.width;
        // const height = sourceHeight / sourceWidth * width;
        this.generateModelObject3D();
        this.generateProcessObject3D();
    }

    async uploadSourceFile() {
        const { content } = this.genModelConfig();

        const blob = new Blob([content], { type: 'image/svg+xml' });
        const file = new File([blob], 'gen.svg');
        const formData = new FormData();
        formData.append('image', file);
        const res = await api.uploadImage(formData);

        return res.body.uploadName;
    }

    static getTransformList(elem) {
        const transform = elem.transform;
        if (!transform) {
            elem.setAttribute('transform', 'translate(0,0)');
        }
        return transform.baseVal;
    }

    elemTransformList() {
        const transform = this.elem.transform;
        if (!transform) {
            this.elem.setAttribute('transform', 'translate(0,0)');
        }
        return this.elem.transform.baseVal;
    }

    isDrawGraphic() {
        return this.elem.getAttribute('id')?.includes('graph');
    }

    refreshElemAttrs() {
        const elem = this.elem;
        const { config, transformation, width, height } = this;
        const href = this.resource.originalFile.path;
        const { positionX, positionY } = transformation;

        for (const key of Object.keys(config)) {
            elem.setAttribute(key, config[key]);
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
            case 'path': {
                const isDraw = this.isDrawGraphic();
                if (isDraw) {
                    const d = elem.getAttribute('d');
                    const bbox = elem.getBBox();
                    const cx = bbox.x + bbox.width / 2;
                    const cy = bbox.y + bbox.height / 2;
                    // clone Model
                    if (cx !== x || cy !== y) {
                        const newPath = svgPath(d)
                            .translate(x - cx, y - cy)
                            .toString();
                        elem.setAttribute('d', newPath);
                    }
                    break;
                }
                const imageElement = document.createElementNS(NS.SVG, 'image');
                const absWidth = Math.abs(width), absHeight = Math.abs(height);
                const attributes = {
                    from: 'inner-svg',
                    'href': href.replace(/\.svg$/, 'parsed.svg'),
                    'id': elem.getAttribute('id'),
                    'x': x - absWidth / 2,
                    'y': y - absHeight / 2,
                    width: absWidth,
                    height: absHeight
                };
                // // set attribute
                for (const [key, value] of Object.entries(attributes)) {
                    imageElement.setAttribute(key, value);
                }
                this.elem.parentNode.append(imageElement);
                this.elem.remove();
                this.elem = imageElement;
                break;
            }
            case 'rect': {
                elem.setAttribute('x', x - width / 2);
                elem.setAttribute('y', y - height / 2);
                elem.setAttribute('width', width);
                elem.setAttribute('height', height);
                break;
            }
            case 'image': {
                const originalWidth = Math.abs(transformation.width / transformation.scaleX);
                const originalHeight = Math.abs(transformation.height / transformation.scaleY);
                elem.setAttribute('x', x - originalWidth / 2);
                elem.setAttribute('y', y - originalHeight / 2);
                elem.setAttribute('width', originalWidth);
                elem.setAttribute('height', originalHeight);
                if (!elem.getAttribute('href')) {
                    elem.setAttribute('href', checkIsImageSuffix(href) ? href : './resources/images/loading.gif');
                }
                break;
            }
            case 'text': {
                const imageElement = document.createElementNS(NS.SVG, 'image');
                const attributes = {
                    from: 'inner-svg',
                    'href': href || elem.getAttribute('href'),
                    'id': elem.getAttribute('id'),
                    'x': elem.getAttribute('x') - width / 2,
                    'y': elem.getAttribute('y') - height / 2,
                    width,
                    height
                };
                // // set attribute
                for (const [key, value] of Object.entries(attributes)) {
                    imageElement.setAttribute(key, value);
                }
                this.elem.parentNode.append(imageElement);
                this.elem.remove();
                this.elem = imageElement;

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
        let { imageWidth = 0, imageHeight = 0 } = t;
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
                if (imageWidth === 0 && imageHeight === 0) {
                    imageWidth = width;
                    imageHeight = height;
                }
                element.setAttribute('x', x - imageWidth / 2);
                element.setAttribute('y', y - imageHeight / 2);
                element.setAttribute('width', imageWidth);
                element.setAttribute('height', imageHeight);
                break;
            }
            case 'path': {
                const d = element.getAttribute('d');
                const bbox = element.getBBox();
                const cx = bbox.x + bbox.width / 2;
                const cy = bbox.y + bbox.height / 2;
                const newPath = svgPath(d)
                    .translate(-cx, -cy)
                    .scale(absScaleX, absScaleY)
                    // .rotate(angle)
                    .translate(x, y)
                    .toString();
                element.setAttribute('d', newPath);
                scaleX /= absScaleX;
                scaleY /= absScaleY;
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
        SvgModel.updatePathPreSelectionArea(element);
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
            const uploadPath = this.resource.originalFile.path;
            const texture = new THREE.TextureLoader().load(`${uploadPath}`, () => {
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
        }
        this.updateTransformation(this.transformation);
    }

    generateProcessObject3D() {
        if (!this.resource.processedFile.name) {
            return;
        }
        const uploadPath = this.resource.processedFile.path;
        const texture = new THREE.TextureLoader().load(`${uploadPath}`, () => {
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

        this.updateTransformation(this.transformation);
    }

    generatePathPreSelectionArea() {
        if (this.type === 'path') {
            const d = this.elem.getAttribute('d');
            const strokeWidth = this.elem.getAttribute('stroke-width');
            const id = this.elem.getAttribute('id');
            this.pathPreSelectionArea = createSVGElement({
                element: 'path',
                attr: {
                    'target-id': id,
                    'stroke-width': Number(strokeWidth) * 20,
                    d,
                    fill: 'transparent',
                    stroke: 'transparent'
                }
            });
        }
    }

    static updatePathPreSelectionArea(element) {
        if (element && element.nodeName === 'path') {
            const d = element.getAttribute('d');
            const id = element.getAttribute('id');
            const transform = element.getAttribute('transform');
            const pathPreSelectionArea = document.querySelector(`[target-id="${id}"]`);
            if (pathPreSelectionArea) {
                pathPreSelectionArea.setAttribute('d', d);
                pathPreSelectionArea.setAttribute('transform', transform);
            }
        }
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
            this.resource.processedFile.update(null);
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

    computevertexPoints() {
        const { rotationZ } = this.transformation;
        const { width, height, positionX: x, positionY: y } = this.transformation;
        if (!width) {
            this.vertexPoints = [
                [x, y + height / 2],
                [x, y - height / 2],
            ];
        } else if (!height) {
            this.vertexPoints = [
                [x - width / 2, y],
                [x + width / 2, y],
            ];
        } else {
            const modelBoxPoints = [
                [x - width / 2, y + height / 2],
                [x - width / 2, y - height / 2],
                [x + width / 2, y - height / 2],
                [x + width / 2, y + height / 2]
            ];

            this.vertexPoints = modelBoxPoints.map(([x1, y1]) => {
                return [
                    (x1 - x) * Math.cos(rotationZ) - (y1 - y) * Math.sin(rotationZ) + x,
                    (x1 - x) * Math.sin(rotationZ) + (y1 - y) * Math.cos(rotationZ) + y
                ];
            });
        }
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
            uploadName: this.resource.originalFile.name,
            processImageName: this.resource.processedFile.name,

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
        // this.updateSource();
        const isDraw = this.isDrawGraphic();
        if (isDraw) {
            this.config.d = this.elem.getAttribute('d');
        }
        this.computevertexPoints();
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
                // For inner text, have to update 'originalFile' inside resource when 'uploadName' changed
                if (key === 'uploadName') {
                    this.resource.originalFile.update(others[key]);
                    this[key] = others[key];
                } else {
                    this[key] = others[key];
                }
            }
        }

        this.refresh();
        this.modelGroup.modelChanged();
    }

    /**
     * Note that you need to give cloned Model a new model name.
     *
     * @returns {ThreeModel}
     */
    clone(modelGroup) {
        const clone = new SvgModel({ ...this }, modelGroup);
        clone.originModelID = this.modelID;
        const specialPrefix = this.isDrawGraphic() ? 'graph-' : '';
        clone.modelID = `${specialPrefix}${uuid()}`;
        clone.updateConfig(clone.config);
        clone.generateModelObject3D();
        clone.generateProcessObject3D();
        this.meshObject.updateMatrixWorld();

        // clone.setMatrix(this.meshObject.matrixWorld);
        clone.meshObject.parent = this.meshObject.parent;
        clone.elem = this.elem.cloneNode(true); // <text> element has a text child node

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
        this.resource.processedFile.update(processImageName);

        this.generateProcessObject3D();
    }
    // --Model functions--

    getSerializableConfig() {
        const {
            modelID, limitSize, headType, sourceType, originalName, config, mode,
            transformation, visible, sourceHeight, sourceWidth
        } = this;
        return {
            modelID,
            limitSize,
            headType,
            sourceType,
            sourceHeight,
            sourceWidth,
            originalName,
            uploadName: this.resource.originalFile.name,
            config,
            visible,
            mode,
            transformation,
            processImageName: this.resource.processedFile.name
        };
    }

    isStraightLine() {
        if (this.type === 'path') {
            const d = this.elem.getAttribute('d');
            const flag = ['M', 'L', 'Z'];
            let res = true;
            svgPath(d).iterate((segment, index) => {
                if (segment[0] !== flag[index]) {
                    res = false;
                }
            });
            return res;
        }
        return false;
    }
}


export default SvgModel;
