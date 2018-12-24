import * as THREE from 'three';
import { WEB_CACHE_IMAGE } from '../constants';
import api from '../api';
import { generateToolPathObject3D } from './generator';

class Model2D extends THREE.Mesh {
    constructor(modelInfo) {
        const { filename } = modelInfo.origin;
        const { width, height } = modelInfo.transformation;
        const geometry = new THREE.PlaneGeometry(width, height);
        // Model2D is mesh
        // display things by changing visibility of modelPlane/toolPathObject3D
        super(geometry, new THREE.MeshBasicMaterial({ color: 0xe0e0e0, visible: false }));

        this.isModel2D = true;
        this.stage = 'idle'; // idle, previewing, previewed

        this.modelInfo = modelInfo;
        this.modelPlane = null;
        this.modelPlaneOriginWidth = width;
        this.modelPlaneOriginHeight = height;
        this.toolPathGroup = new THREE.Object3D();
        this.dashedLine = null;
        this._selected = false;

        this.add(this.toolPathGroup);

        // add modelPlane
        const modelPath = `${WEB_CACHE_IMAGE}/${filename}`;
        const modelPlaneTexture = new THREE.TextureLoader().load(modelPath);
        const modelPlaneMaterial = new THREE.MeshBasicMaterial({
            map: modelPlaneTexture,
            side: THREE.DoubleSide,
            opacity: 1,
            transparent: true
        });
        this.modelPlane = new THREE.Mesh(geometry, modelPlaneMaterial);
        this.add(this.modelPlane);

        // add dashedLine
        const offset = 0.5;
        const z = 0;
        const geometry2 = new THREE.Geometry();
        geometry2.vertices = [];
        geometry2.vertices.push(new THREE.Vector3(width / 2 + offset, height / 2 + offset, z));
        geometry2.vertices.push(new THREE.Vector3(-width / 2 - offset, height / 2 + offset, z));
        geometry2.vertices.push(new THREE.Vector3(-width / 2 - offset, -height / 2 - offset, z));
        geometry2.vertices.push(new THREE.Vector3(width / 2 + offset, -height / 2 - offset, z));
        geometry2.vertices.push(new THREE.Vector3(width / 2 + offset, height / 2 + offset, z));
        this.dashedLine = new THREE.Line(geometry2, new THREE.LineDashedMaterial({ color: 0x0000ff, dashSize: 3, gapSize: 2 }));
        this.dashedLine.computeLineDistances();
        this.add(this.dashedLine);

        this.setSelected(this._selected);
    }

    getModelInfo() {
        return this.modelInfo;
    }

    // todo: only display model when config changed
    updateTransformation(params) {
        this.displayModel();

        const { rotation, width, height, translateX, translateY } = params;
        if (rotation !== undefined) {
            this.rotation.z = Math.PI * rotation / 180;
        }
        if (translateX !== undefined) {
            this.position.x = translateX;
        }
        if (translateY !== undefined) {
            this.position.y = translateY;
        }

        // uniform scale
        const transformSize = this._setTransformSize(width, height);

        this.modelInfo.transformation = {
            ...this.modelInfo.transformation,
            ...params,
            ...transformSize
        };
    }

    _setTransformSize(width, height) {
        if (width === undefined && height === undefined) {
            return null;
        }

        let transformWidth = width;
        let transformHeight = height;

        const ratio = this.modelPlaneOriginWidth / this.modelPlaneOriginHeight;

        if (transformWidth !== undefined) {
            transformHeight = transformWidth / ratio;
        } else if (transformHeight !== undefined) {
            transformWidth = transformHeight * ratio;
        }

        this.scale.x = transformWidth / this.modelPlaneOriginWidth;
        this.scale.y = transformHeight / this.modelPlaneOriginHeight;
        return {
            width: transformWidth,
            height: transformHeight
        };
    }

    updateConfig(params) {
        this.displayModel();
        this.modelInfo.config = {
            ...this.modelInfo.config,
            ...params
        };
    }

    updateGcodeConfig(params) {
        this.modelInfo.gcodeConfig = {
            ...this.modelInfo.gcodeConfig,
            ...params
        };
    }

    setSelected(selected) {
        this._selected = selected;
        this.dashedLine.visible = selected;
    }

    isSelected() {
        return this._selected;
    }

    displayToolPathObj3D(toolPathObj3D) {
        this.toolPathGroup.visible = true;
        this.modelPlane.visible = true;
        this.toolPathGroup.remove(...this.toolPathGroup.children);
        this.toolPathGroup.add(toolPathObj3D);
        toolPathObj3D.position.x = 100;
        toolPathObj3D.rotation.z = -this.rotation.z;
        this.stage = 'previewed';
    }

    displayModel() {
        this.toolPathGroup.visible = false;
        this.modelPlane.visible = true;
        this.stage = 'idle';
    }

    preview() {
        this.stage = 'previewing';
        api.generateToolPathLaser(this.modelInfo)
            .then((res) => {
                const toolPathFilePath = `${WEB_CACHE_IMAGE}/${res.body.filename}`;
                new THREE.FileLoader().load(
                    toolPathFilePath,
                    (toolPathStr) => {
                        const toolPathObj3D = generateToolPathObject3D(toolPathStr);
                        this.displayToolPathObj3D(toolPathObj3D);
                    }
                );
            })
            .catch(() => {
                this.stage = 'idle';
            });
    }
}
export default Model2D;
