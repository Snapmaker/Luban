import uuid from 'uuid';
import * as THREE from 'three';
import { WEB_CACHE_IMAGE } from '../constants';
import api from '../api';
import { generateToolPathObject3D } from './generator';
import GcodeGenerator from '../widgets/GcodeGenerator';
import ThreeUtils from '../components/three-extensions/ThreeUtils';

class Model2D extends THREE.Mesh {
    constructor(modelInfo) {
        const { origin, transformation } = modelInfo;
        const { width, height } = transformation;
        const { filename } = origin;

        super(
            new THREE.PlaneGeometry(width, height),
            new THREE.MeshBasicMaterial({ color: 0xe0e0e0, visible: false })
        );

        this.modelId = uuid.v4();
        this.isModel2D = true;
        this.stage = 'idle'; // idle, previewing, previewed
        this._selected = false;
        this.modelInfo = modelInfo;
        this.toolPathStr = null;
        this.toolPathObj3D = null;
        this.modelObject3D = null;

        this.displayModelObject3D(filename, width, height);
        this.setSelected(this._selected);
        this.autoPreview();
    }

    displayModelObject3D(filename, width, height) {
        const modelPath = `${WEB_CACHE_IMAGE}/${filename}`;
        const texture = new THREE.TextureLoader().load(modelPath);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1,
            map: texture
        });
        const geometry = new THREE.PlaneGeometry(width, height);
        this.modelObject3D && (this.remove(this.modelObject3D));
        this.modelObject3D = new THREE.Mesh(geometry, material);
        this.add(this.modelObject3D);

        this.toolPathObj3D && (this.toolPathObj3D.visible = false);
    }

    getModelInfo() {
        const size = ThreeUtils.getGeometrySize(this.geometry, true);
        const scale = this.scale;
        const transformation = {
            rotation: this.rotation.z,
            translateX: this.position.x,
            translateY: this.position.y,
            width: size.x * scale.x,
            height: size.y * scale.y
        };
        this.modelInfo.transformation = transformation;
        return this.modelInfo;
    }

    // todo: only display model when config changed
    updateTransformation(params) {
        const { rotation, translateX, translateY } = params;
        let { width, height } = params;

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
        if (!(width === undefined && height === undefined)) {
            const { origin } = this.modelInfo;
            const ratio = origin.width / origin.height;

            if (width !== undefined) {
                height = width / ratio;
            } else if (height !== undefined) {
                width = height * ratio;
            }

            params.width = width;
            params.height = height;

            // keep the same size
            this.geometry = new THREE.PlaneGeometry(width, height);
            this.modelObject3D && (this.modelObject3D.geometry = new THREE.PlaneGeometry(width, height));
        }

        this.modelInfo.transformation = {
            ...this.modelInfo.transformation,
            ...params
        };
        this.showModelObject3D();
        this.autoPreview();
    }

    setTransformationSize(params) {
        let { width, height } = params;
        // uniform scale
        if (!(width === undefined && height === undefined)) {
            const { origin } = this.modelInfo;
            const ratio = origin.width / origin.height;

            if (width !== undefined) {
                height = width / ratio;
            } else if (height !== undefined) {
                width = height * ratio;
            }

            params.width = width;
            params.height = height;

            // keep the same size
            this.geometry = new THREE.PlaneGeometry(width, height);
            this.modelObject3D && (this.modelObject3D.geometry = new THREE.PlaneGeometry(width, height));

            this.modelInfo.transformation = {
                ...this.modelInfo.transformation,
                ...params
            };
        }
    }

    setOrigin(origin) {
        this.modelInfo.origin = origin;
        const { filename } = origin;
        const { width, height } = this.modelInfo.transformation;
        this.displayModelObject3D(filename, width, height);
        this.autoPreview();
    }

    updateConfig(params) {
        this.modelInfo.config = {
            ...this.modelInfo.config,
            ...params
        };
        this.showModelObject3D();
        this.autoPreview();
    }

    updateGcodeConfig(params) {
        this.modelInfo.gcodeConfig = {
            ...this.modelInfo.gcodeConfig,
            ...params
        };
        // todo: use gcode config place holder to generate tool path
        this.autoPreview();
    }

    setSelected(selected) {
        this._selected = selected;
    }

    isSelected() {
        return this._selected;
    }

    displayToolPathObj3D(toolPathStr) {
        if (!toolPathStr) {
            return;
        }

        this.toolPathObj3D && (this.remove(this.toolPathObj3D));
        this.toolPathObj3D = generateToolPathObject3D(toolPathStr);
        this.toolPathObj3D.rotation.z = -this.rotation.z;
        this.add(this.toolPathObj3D);

        this.modelObject3D && (this.modelObject3D.visible = false);
        this.stage = 'previewed';
    }

    showModelObject3D() {
        this.toolPathObj3D && (this.toolPathObj3D.visible = false);
        this.modelObject3D && (this.modelObject3D.visible = true);
        this.stage = 'idle';
    }

    autoPreview() {
        this.stage = 'previewing';
        this.modelInfo.taskId = uuid.v4();
        this.modelInfo.modelId = this.modelId;
        api.commitTask(this.modelInfo)
            .then((res) => {
            });
    }

    loadToolpathObj(filename, taskId) {
        if (this.modelInfo.taskId === taskId) {
            if (this.stage === 'previewed') {
                return;
            }
            const toolPathFilePath = `${WEB_CACHE_IMAGE}/${filename}`;
            new THREE.FileLoader().load(
                toolPathFilePath,
                (toolPathStr) => {
                    if (this.modelInfo.taskId === taskId) {
                        this.toolPathStr = toolPathStr;
                        this.displayToolPathObj3D(toolPathStr);
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
                        this.displayToolPathObj3D(toolPathStr);
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
