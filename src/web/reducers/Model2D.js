/* eslint-disable */

import * as THREE from 'three';
import { WEB_CACHE_IMAGE } from '../constants';
import api from '../api';
import { generateToolPathObject3D } from './generator';
import GcodeGenerator from '../widgets/GcodeGenerator';

// todo: use a lib or move this to lib directory
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

class Model2D extends THREE.Mesh {
    constructor(modelInfo) {
        super(
            new THREE.PlaneGeometry(1, 1),
            new THREE.MeshBasicMaterial({ color: 0xe0e0e0, visible: false })
        );
        this.modelId = uuidv4();
        this.isModel2D = true;
        this.stage = 'idle'; // idle, previewing, previewed
        this._selected = false;
        this.modelInfo = modelInfo;
        this.toolPathStr = null;

        this.modelDisplayedGroup = new THREE.Group();
        this.toolPathDisplayedGroup = new THREE.Group();

        this.add(this.modelDisplayedGroup);
        this.add(this.toolPathDisplayedGroup);

        const { width, height } = this.modelInfo.transformation;
        this.scale.set(width, height, 1);

        this.setSelected(this._selected);

        this.displayModel();
        this.autoPreview();
    }

    getModelInfo() {
        const transformation = {
            rotation: this.rotation.z,
            translateX: this.position.x,
            translateY: this.position.y,
            width: this.scale.x,
            height: this.scale.y
        };
        this.modelInfo.transformation = {
            ...this.modelInfo.transformation,
            ...transformation
        };
        return this.modelInfo;
    }

    // todo: only display model when config changed
    updateTransformation(params) {
        this.showDisplayedModel();

        const { rotation, width, height, translateX, translateY } = params;
        if (rotation !== undefined) {
            this.rotation.z = rotation;
        }
        if (translateX !== undefined) {
            this.position.x = translateX;
        }
        if (translateY !== undefined) {
            this.position.y = translateY;
        }

        // uniform scale
        const transformSize = this._setTransformationSize(width, height);

        this.modelInfo.transformation = {
            ...this.modelInfo.transformation,
            ...params,
            ...transformSize
        };
        this.autoPreview();
    }

    _setTransformationSize(width, height) {
        if (width === undefined && height === undefined) {
            return null;
        }

        const { origin } = this.modelInfo;
        const ratio = origin.width / origin.height;

        if (width !== undefined) {
            height = width / ratio;
        } else if (height !== undefined) {
            width = height * ratio;
        }

        this.scale.set(width, height, 1);

        return {
            width: width,
            height: height
        };
    }

    updateOrigin(params) {
        this.showDisplayedModel();
        this.modelInfo.origin = {
            ...this.modelInfo.origin,
            ...params
        };
        this.autoPreview();
    }

    updateConfig(params) {
        this.showDisplayedModel();
        this.modelInfo.config = {
            ...this.modelInfo.config,
            ...params
        };
        this.autoPreview();
    }

    updateGcodeConfig(params) {
        this.modelInfo.gcodeConfig = {
            ...this.modelInfo.gcodeConfig,
            ...params
        };
    }

    setSelected(selected) {
        this._selected = selected;
    }

    isSelected() {
        return this._selected;
    }

    displayToolPathObj3D() {
        this.toolPathDisplayedGroup.visible = true;
        this.modelDisplayedGroup.visible = false;

        const toolPathObj3D = generateToolPathObject3D(this.toolPathStr);
        this.toolPathDisplayedGroup.remove(...this.toolPathDisplayedGroup.children);
        this.toolPathDisplayedGroup.add(toolPathObj3D);
        const scale = this.scale;
        this.toolPathDisplayedGroup.scale.set(1 / scale.x, 1 / scale.y, 1);
        toolPathObj3D.position.x = 0;
        toolPathObj3D.rotation.z = -this.rotation.z;
        this.stage = 'previewed';
    }

    showDisplayedModel() {
        this.toolPathDisplayedGroup.visible = false;
        this.modelDisplayedGroup.visible = true;
        this.stage = 'idle';
    }

    displayModel() {
        this.toolPathDisplayedGroup.visible = false;
        this.modelDisplayedGroup.visible = true;

        const { origin, transformation } = this.modelInfo;
        const { filename } = origin;
        const { width, height } = transformation;
        const modelPath = `${WEB_CACHE_IMAGE}/${filename}`;
        const modelPlaneTexture = new THREE.TextureLoader().load(modelPath);
        const modelPlaneMaterial = new THREE.MeshBasicMaterial({
            map: modelPlaneTexture,
            side: THREE.DoubleSide,
            opacity: 1,
            transparent: true
        });
        const geometry = new THREE.PlaneGeometry(width, height);
        const displayedModel = new THREE.Mesh(geometry, modelPlaneMaterial);

        const scale = this.scale;
        displayedModel.scale.set(1 / scale.x, 1 / scale.y, 1);
        this.modelDisplayedGroup.remove(...this.modelDisplayedGroup.children);
        this.modelDisplayedGroup.add(displayedModel);
    }

    resize() {
        const { width, height } = this.modelInfo.transformation;
        this.scale.set(width, height, 1);
        this.displayModel();
    }

    autoPreview() {
        this.stage = 'previewing';
        this.modelInfo.taskId = uuidv4();
        this.modelInfo.modelId = this.modelId;
        api.commitTask(this.modelInfo)
            .then((res) => {
            });
    }
    loadToolpathObj(filename, taskId) {
        if (this.modelInfo.taskId === taskId) {
            if (this.stage === 'previewed'){
                return;
            }
            const toolPathFilePath = `${WEB_CACHE_IMAGE}/${filename}`;
            new THREE.FileLoader().load(
                toolPathFilePath,
                (toolPathStr) => {
                    if (this.modelInfo.taskId === taskId) {
                        this.toolPathStr = toolPathStr;
                        this.displayToolPathObj3D();
                        this.stage = 'previewed';
                    }
                }
            );
        }
    }
    preview(callback) {
        this.stage = 'previewing';
        api.generateToolPathLaser(this.modelInfo)
            .then((res) => {
                const { filename } = res.body;
                const toolPathFilePath = `${WEB_CACHE_IMAGE}/${filename}`;
                new THREE.FileLoader().load(
                    toolPathFilePath,
                    (toolPathStr) => {
                        this.toolPathStr = toolPathStr;
                        this.displayToolPathObj3D();
                        callback();
                    }
                );
            })
            .catch(() => {
                this.stage = 'idle';
                callback('err');
            });
    }

    generateGcode() {
        const gcodeGenerator = new GcodeGenerator();
        const toolPathObj = JSON.parse(this.toolPathStr);
        const gcodeStr = gcodeGenerator.parseToolPathObjToGcode(toolPathObj);
        return gcodeStr;
    }
}
export default Model2D;
