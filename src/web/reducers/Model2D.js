import uuid from 'uuid';
import * as THREE from 'three';
import { WEB_CACHE_IMAGE } from '../constants';
import api from '../api';
import { generateToolPathObject3D } from './generator';
import GcodeGenerator from '../widgets/GcodeGenerator';
import ThreeUtils from '../components/three-extensions/ThreeUtils';

class Model2D extends THREE.Mesh {
    constructor(modelInfo) {
        const { width, height } = modelInfo.transformation;

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
        this.allowAutoPreview = false;

        this.displayModelObject3D(
            modelInfo.source.name,
            modelInfo.source.filename,
            modelInfo.transformation.width,
            modelInfo.transformation.height
        );
        this.setSelected(this._selected);
    }

    enableAutoPreview() {
        this.allowAutoPreview = true;

        this.autoPreview();
    }

    displayModelObject3D(name, filename, width, height) {
        this.modelObject3D && this.remove(this.modelObject3D);

        const modelPath = `${WEB_CACHE_IMAGE}/${filename}`;
        const texture = new THREE.TextureLoader().load(modelPath);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1,
            map: texture,
            side: THREE.DoubleSide
        });
        this.geometry = new THREE.PlaneGeometry(width, height);
        this.modelObject3D = new THREE.Mesh(this.geometry, material);
        this.add(this.modelObject3D);

        this.toolPathObj3D && (this.toolPathObj3D.visible = false);
    }

    updateTransformationFromModel() {
        const geometrySize = ThreeUtils.getGeometrySize(this.geometry, true);
        const transformation = {
            rotation: this.rotation.z,
            translateX: this.position.x,
            translateY: this.position.y,
            width: geometrySize.x * this.scale.x,
            height: geometrySize.y * this.scale.y
        };
        this.modelInfo.transformation = {
            ...this.modelInfo.transformation,
            ...transformation
        };
    }

    onTransform() {
        const { width, height, rotation } = this.modelInfo.transformation;

        this.updateTransformationFromModel();

        const transformation = this.modelInfo.transformation;
        if (width !== transformation.width || height !== transformation.height || rotation !== transformation.rotation) {
            this.showModelObject3D();
            this.autoPreview();
        }
    }

    updateTransformation(transformation) {
        let needAutoPreview = false;

        if (transformation.rotation !== undefined) {
            this.rotation.z = transformation.rotation;
            this.modelInfo.transformation.rotation = transformation.rotation;
            needAutoPreview = true;
        }
        if (transformation.translateX !== undefined) {
            this.position.x = transformation.translateX;
            this.modelInfo.transformation.translateX = transformation.translateX;
        }
        if (transformation.translateY !== undefined) {
            this.position.y = transformation.translateY;
            this.modelInfo.transformation.translateY = transformation.translateY;
        }

        // uniform scale
        if (transformation.width || transformation.height) {
            const { source } = this.modelInfo;

            let { width, height } = transformation;

            if (!width) {
                width = height * source.width / source.height;
            } else {
                height = width * source.height / source.width;
            }

            // scale model2D
            const geometrySize = ThreeUtils.getGeometrySize(this.geometry, true);
            const scaleX = width / geometrySize.x;
            const scaleY = height / geometrySize.y;
            this.scale.set(scaleX, scaleY, 1);

            this.modelInfo.transformation.width = width;
            this.modelInfo.transformation.height = height;
            needAutoPreview = true;
        }

        if (needAutoPreview) {
            this.autoPreview();
        }
    }

    // Update source
    updateSource(source) {
        this.modelInfo.source = {
            ...this.modelInfo.source,
            ...source
        };
        const { name, filename, width, height } = this.modelInfo.source;
        this.displayModelObject3D(name, filename, width, height);
        this.autoPreview();
    }

    updateConfig(config) {
        this.modelInfo.config = {
            ...this.modelInfo.config,
            ...config
        };
        this.showModelObject3D();
        this.autoPreview();
    }

    updateGcodeConfig(gcodeConfig) {
        this.modelInfo.gcodeConfig = {
            ...this.modelInfo.gcodeConfig,
            ...gcodeConfig
        };
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
        const { x, y } = this.scale;
        this.toolPathObj3D.scale.set(1 / x, 1 / y, 1);
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
        if (this.allowAutoPreview) {
            this.stage = 'previewing';
            this.modelInfo.taskId = uuid.v4();
            this.modelInfo.modelId = this.modelId;
            api.commitTask(this.modelInfo)
                .then((res) => {
                });
        }
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
        api.generateToolPath(this.modelInfo)
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
        const { gcodeConfig, transformation } = this.modelInfo;
        const { translateX, translateY } = transformation;
        toolPathObj.translateX = translateX;
        toolPathObj.translateY = translateY;
        const gcodeStr = gcodeGenerator.parseToolPathObjToGcode(toolPathObj, gcodeConfig);
        return gcodeStr;
    }
}

export default Model2D;
