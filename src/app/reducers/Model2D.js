import uuid from 'uuid';
import * as THREE from 'three';
import { DATA_PREFIX } from '../constants';
import api from '../api';
import { generateToolPathObject3D } from './generator';
import GcodeGenerator from '../widgets/GcodeGenerator';
import controller from '../lib/controller';
import ThreeUtils from '../components/three-extensions/ThreeUtils';

const EVENTS = {
    UPDATE: { type: 'update' }
};

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
        this.toolPath = null;
        this.toolPathObj3D = null;
        this.modelObject3D = null;
        this.autoPreviewEnabled = false;
        this.displayToolPathId = null;
        this.boundingBox = null;

        this.displayModelObject3D(
            modelInfo.source.name,
            modelInfo.source.filename,
            modelInfo.transformation.width,
            modelInfo.transformation.height
        );
        this.setSelected(this._selected);
    }

    displayModelObject3D(name, filename, width, height) {
        this.modelObject3D && this.remove(this.modelObject3D);

        const modelPath = `${DATA_PREFIX}/${filename}`;
        const texture = new THREE.TextureLoader().load(modelPath, () => {
            this.dispatchEvent(EVENTS.UPDATE);
        });
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
        if (transformation.flip !== undefined) {
            this.modelInfo.transformation.flip = transformation.flip;
            needAutoPreview = true;
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
        // TODO only for calculating estimatedTime
        this.showModelObject3D();
        this.autoPreview();
    }

    setSelected(selected) {
        this._selected = selected;
    }

    isSelected() {
        return this._selected;
    }

    displayToolPathObj3D() {
        if (!this.toolPath) {
            return;
        }

        this.toolPathObj3D && (this.remove(this.toolPathObj3D));
        this.toolPathObj3D = generateToolPathObject3D(this.toolPath);
        this.toolPathObj3D.rotation.z = -this.rotation.z;
        const { x, y } = this.scale;
        this.toolPathObj3D.scale.set(1 / x, 1 / y, 1);
        this.add(this.toolPathObj3D);

        this.modelObject3D && (this.modelObject3D.visible = false);
        this.stage = 'previewed';

        this.dispatchEvent(EVENTS.UPDATE);
    }

    showModelObject3D() {
        this.toolPathObj3D && (this.toolPathObj3D.visible = false);
        this.modelObject3D && (this.modelObject3D.visible = true);
        this.stage = 'idle';
    }

    autoPreview(force) {
        if (force || this.autoPreviewEnabled) {
            this.stage = 'previewing';
            this.modelInfo.taskId = uuid.v4();
            this.modelInfo.modelId = this.modelId;
            // api.commitTask(this.modelInfo)
            //     .then((res) => {
            //     });
            // For convenience, use modelInfo as task
            controller.commitTask(this.modelInfo);
        }
    }

    loadToolPath(filename, taskId) {
        if (this.modelInfo.taskId === taskId && this.displayToolPathId !== taskId) {
            if (this.stage === 'previewed') {
                return Promise.resolve(null);
            }
            const toolPathFilePath = `${DATA_PREFIX}/${filename}`;
            return new Promise((resolve) => {
                new THREE.FileLoader().load(
                    toolPathFilePath,
                    (data) => {
                        this.toolPath = JSON.parse(data);
                        this.displayToolPathObj3D();
                        this.stage = 'previewed';
                        this.displayToolPathId = taskId;
                        return resolve(null);
                    }
                );
            });
        } else {
            return Promise.resolve(null);
        }
    }

    preview(callback) {
        this.stage = 'previewing';
        api.generateToolPath(this.modelInfo)
            .then((res) => {
                const { filename } = res.body;
                const toolPathFilePath = `${DATA_PREFIX}/${filename}`;
                new THREE.FileLoader().load(
                    toolPathFilePath,
                    (data) => {
                        this.toolPath = JSON.parse(data);
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
        const toolPath = this.toolPath;

        const { gcodeConfig, transformation } = this.modelInfo;
        const { translateX, translateY } = transformation;
        toolPath.translateX = translateX;
        toolPath.translateY = translateY;

        return gcodeGenerator.parseToolPathObjToGcode(toolPath, gcodeConfig);
    }

    computeBoundingBox() {
        const { width, height, rotation } = this.modelInfo.transformation;
        const bboxWidth = Math.abs(width * Math.cos(rotation)) + Math.abs(height * Math.sin(rotation));
        const bboxHeight = Math.abs(width * Math.sin(rotation)) + Math.abs(height * Math.cos(rotation));
        const { x, y } = this.position;
        this.boundingBox = new THREE.Box2(
            new THREE.Vector2(x - bboxWidth / 2, y - bboxHeight / 2),
            new THREE.Vector2(x + bboxWidth / 2, y + bboxHeight / 2)
        );
    }
}

export default Model2D;
