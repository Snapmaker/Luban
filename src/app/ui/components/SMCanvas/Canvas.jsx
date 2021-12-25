/**
 * Canvas
 *
 * Canvas is a React Component that is in charge of rendering models
 * on top of OpenGL and handles user interactions.
 */

import noop from 'lodash/noop';
import React, { PureComponent } from 'react';
import { isNil, throttle } from 'lodash';
import { Vector3, PerspectiveCamera, Scene, Group, HemisphereLight, DirectionalLight } from 'three';
import PropTypes from 'prop-types';
import TWEEN from '@tweenjs/tween.js';

import Controls, { EVENTS } from './Controls';
import log from '../../../lib/log';
import Detector from '../../../three-extensions/Detector';
import WebGLRendererWrapper from '../../../three-extensions/WebGLRendererWrapper';


const ANIMATION_DURATION = 500;
const DEFAULT_MODEL_POSITION = new Vector3(0, 0, 0);
const EPS = 0.000001;
const FPS = 60;
const renderT = 1 / FPS;

class Canvas extends PureComponent {
    node = React.createRef();

    static propTypes = {
        backgroundGroup: PropTypes.object,
        modelGroup: PropTypes.object.isRequired,
        printableArea: PropTypes.object.isRequired,
        transformSourceType: PropTypes.string, // 2D, 3D. Default is 3D
        toolPathGroupObject: PropTypes.object,
        gcodeLineGroup: PropTypes.object,
        cameraInitialPosition: PropTypes.object.isRequired,
        cameraInitialTarget: PropTypes.object.isRequired,
        cameraUp: PropTypes.object,
        scale: PropTypes.number,
        minScale: PropTypes.number,
        maxScale: PropTypes.number,
        scaleSize: PropTypes.number,
        target: PropTypes.object,
        displayedType: PropTypes.string,

        supportActions: PropTypes.object,

        // callback
        onSelectModels: PropTypes.func,
        updateTarget: PropTypes.func,
        updateScale: PropTypes.func,
        onModelAfterTransform: PropTypes.func,
        onModelBeforeTransform: PropTypes.func,
        onModelTransform: PropTypes.func,
        onRotationPlacementSelect: PropTypes.func,

        // tmp
        canOperateModel: PropTypes.bool,
        // isToolpathModel: PropTypes.bool,
        showContextMenu: PropTypes.func,

        // inProgress
        inProgress: PropTypes.bool,

        primeTowerSelected: PropTypes.bool
    };

    static defaultProps = {
        canOperateModel: true
    };

    controls = null;

    animationCount = 0;

    frameId = 0;

    initialTarget = new Vector3();

    lastTarget = null;

    constructor(props) {
        super(props);

        // frozen
        this.backgroundGroup = this.props.backgroundGroup;
        this.modelGroup = this.props.modelGroup;
        this.transformSourceType = this.props.transformSourceType || '3D'; // '3D' | '2D'
        this.toolPathGroupObject = this.props.toolPathGroupObject;
        this.gcodeLineGroup = this.props.gcodeLineGroup;
        this.cameraInitialPosition = this.props.cameraInitialPosition;

        // callback
        this.onSelectModels = this.props.onSelectModels || noop;
        this.onModelBeforeTransform = this.props.onModelBeforeTransform || noop;
        this.onModelAfterTransform = this.props.onModelAfterTransform || noop;
        this.onRotationPlacementSelect = this.props.onRotationPlacementSelect || noop;
        this.onModelTransform = this.props.onModelTransform || noop;

        // threejs
        this.camera = null;
        this.renderer = null;
        this.scene = null;
        this.group = null;
        this.light = null;
    }

    componentDidMount() {
        if (!this.isCanvasInitialized()) {
            log.warn('Canvas is not initialized properly');
            return;
        }

        this.setupScene();
        this.setupControls();

        this.group.add(this.props.printableArea);
        this.props.printableArea.addEventListener('update', () => this.renderScene()); // TODO: another way to trigger re-render
        this.group.add(this.modelGroup.object);
        this.toolPathGroupObject && this.group.add(this.toolPathGroupObject);
        this.gcodeLineGroup && this.group.add(this.gcodeLineGroup);
        this.backgroundGroup && this.group.add(this.backgroundGroup);


        if (this.controls && this.props.inProgress) {
            this.controls.setInProgress(this.props.inProgress);
        }
        this.renderScene();

        window.addEventListener('resize', this.resizeWindow, false);
    }

    // just for laser and cnc, dont set scale prop for 3dp
    componentWillReceiveProps(nextProps) {
        if (nextProps.inProgress !== this.props.inProgress) {
            this.controls.setInProgress(nextProps.inProgress);
        }

        if (nextProps.scale && nextProps.scale !== this.lastScale) {
            if (!this.isCanvasInitialized()) return;

            const currentScale = this.initialDistance / (this.camera.position.distanceTo(this.controls.target));
            this.controls.setScale(currentScale / nextProps.scale);
            this.lastScale = nextProps.scale;
            this.controls.updateCamera();
        }

        if (nextProps.target && nextProps.target !== this.lastTarget) {
            if (!this.isCanvasInitialized()) return;

            const { x, y } = nextProps.target;
            this.controls.panOffset.add(new Vector3(x - this.controls.target.x, y - this.controls.target.y, 0));
            this.controls.updateCamera();
        }

        if (nextProps.printableArea !== this.props.printableArea) {
            this.group.remove(this.props.printableArea);
            this.group.add(nextProps.printableArea);
        }

        if (nextProps.displayedType !== this.props.displayedType) {
            if (nextProps.displayedType === 'gcode') {
                this.controls.removeTransformControls();
            } else {
                this.controls.recoverTransformControls();
            }
            this.renderScene();
        }

        if (nextProps.primeTowerSelected !== this.props.primeTowerSelected) {
            this.controls.removeTransformControls();
            if (nextProps.primeTowerSelected) {
                this.controls.recoverTransformControls(true);
                this.controls.setPrimeTower(true);
            } else {
                this.controls.recoverTransformControls();
                this.controls.setPrimeTower(false);
            }
            this.renderScene();
        }
    }

    componentWillUnmount() {
        if (this.controls) {
            this.controls.dispose();
        }
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }
    }

    onScale = () => {
        if (typeof this.props.updateScale !== 'function') {
            return;
        }
        let currentScale = this.initialDistance / (this.camera.position.distanceTo(this.controls.target));
        if (Math.abs(currentScale - this.lastScale) > EPS) {
            if (this.props.minScale && currentScale < this.props.minScale) {
                currentScale = this.props.minScale;
            }
            if (this.props.maxScale && currentScale > this.props.maxScale) {
                currentScale = this.props.maxScale;
            }
            this.lastScale = currentScale;
            this.props.updateScale(currentScale);
        }
    };

    onChangeTarget = () => {
        if (typeof this.props.updateTarget !== 'function') {
            return;
        }
        const { x, y } = this.controls.target;
        this.lastTarget = { x, y };
        this.props.updateTarget(this.lastTarget);
    };

    getVisibleWidth() {
        return this.node.current && this.node.current.parentElement.clientWidth;
    }

    getVisibleHeight() {
        return this.node.current && this.node.current.parentElement.clientHeight;
    }

    setupScene() {
        const width = this.getVisibleWidth();
        const height = this.getVisibleHeight();

        this.camera = new PerspectiveCamera(45, width / height, 0.1, 10000);
        this.camera.position.copy(this.cameraInitialPosition);
        if (this.transformSourceType === '2D') {
            this.light = new DirectionalLight(0xffffff, 0.6);
        }
        if (this.transformSourceType === '3D') {
            this.light = new DirectionalLight(0x666666, 0.4);
        }
        this.light.position.copy(this.cameraInitialPosition);

        // We need to change the default up vector if we use camera to respect XY plane
        if (this.props.cameraUp) {
            this.camera.up = this.props.cameraUp;
        }

        this.renderer = new WebGLRendererWrapper({ antialias: true });
        this.renderer.setSize(width, height);

        this.scene = new Scene();
        this.scene.add(this.camera);
        this.scene.add(this.light);

        this.group = new Group();
        this.group.position.copy(DEFAULT_MODEL_POSITION);
        this.scene.add(this.group);
        if (this.transformSourceType === '3D') {
            const lightTop = new HemisphereLight(0xdddddd, 0x666666);
            lightTop.position.copy(new Vector3(0, 0, 1000));
            this.scene.add(lightTop);
        }
        if (this.transformSourceType === '2D') {
            this.scene.add(new HemisphereLight(0x000000, 0xcecece));
        }

        this.node.current.appendChild(this.renderer.domElement);
    }

    setupControls() {
        this.initialTarget = this.props.cameraInitialTarget;

        const sourceType = this.props.transformSourceType === '2D' ? '2D' : '3D';
        this.controls = new Controls(sourceType, this.props.displayedType, this.camera, this.group, this.renderer.domElement, this.onScale, this.onChangeTarget,
            this.props.supportActions, this.props.minScale, this.props.maxScale, this.props.scaleSize);
        this.controls.canOperateModel = this.props.canOperateModel;
        this.setCamera(this.cameraInitialPosition, this.initialTarget);

        this.controls.setTarget(this.initialTarget);
        this.controls.setSelectableObjects(this.modelGroup.object);

        this.controls.on(EVENTS.UPDATE, () => {
            this.renderScene();
        });
        this.controls.on(EVENTS.SELECT_OBJECTS, (intersect, selectEvent) => {
            this.onSelectModels(intersect, selectEvent);
        });

        this.controls.on(EVENTS.CONTEXT_MENU, (e) => {
            if (this.props.showContextMenu && this.props.canOperateModel) {
                this.props.showContextMenu(e);
            }
        });
        this.controls.on(EVENTS.BEFORE_TRANSFORM_OBJECT, () => {
            this.onModelBeforeTransform(this.controls.transformControl.mode);
        });
        this.controls.on(EVENTS.TRANSFORM_OBJECT, () => {
            if (this.props.canOperateModel) {
                this.onModelTransform();
            }
        });
        this.controls.on(EVENTS.AFTER_TRANSFORM_OBJECT, () => {
            this.onModelAfterTransform(this.controls.transformControl.mode);
        });
        this.controls.on(EVENTS.SELECT_PLACEMENT_FACE, (userData) => {
            this.onRotationPlacementSelect(userData);
        });
    }

    setTransformMode(mode) {
        if (['translate', 'scale', 'rotate', 'mirror', 'rotate-placement'].includes(mode)) {
            this.controls && this.controls.setTransformMode(mode);
        } else {
            this.controls && this.controls.setTransformMode(null);
        }
    }

    animation = () => {
        this.frameId = window.requestAnimationFrame(this.animation);
        this.renderScene();
    };

    setCamera = (position, target) => {
        if (!this.isCanvasInitialized()) return;

        this.camera.position.copy(position);
        this.controls.setTarget(target);
        this.renderScene();

        if (position.x === 0 && position.y === 0) {
            this.initialDistance = (position.z - target.z);
        }
    };

    setCameraOnTop = () => {
        if (!this.isCanvasInitialized()) return;

        const dist = this.camera.position.distanceTo(this.controls.target);
        this.camera.position.copy(new Vector3(0, 0, dist));
        this.controls.setTarget(new Vector3(0, 0, 0));
        this.controls.updateCamera();
    };

    setSelectedModelConvexMeshGroup = (group) => {
        this.controls.setSelectedModelConvexMeshGroup(group);
    };

    resizeWindow = () => {
        if (!this.isCanvasInitialized()) return;

        const width = this.getVisibleWidth();
        const height = this.getVisibleHeight();
        if (width * height !== 0 && !isNil(width) && !isNil(height)) {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        }
        this.renderScene();
    };

    isCanvasInitialized() {
        return !!this.node.current;
    }

    zoomIn() {
        const object = { nonce: 0 };
        const to = { nonce: 20 };

        let lastNonce = 0;
        const tween = new TWEEN.Tween(object)
            .to(to, ANIMATION_DURATION)
            .onUpdate(() => {
                if (object.nonce - lastNonce > 1) {
                    lastNonce = object.nonce;
                    this.controls.dollyIn();
                    this.controls.updateCamera();
                }
            });
        this.startTween(tween);
    }

    zoomOut() {
        const object = { nonce: 0 };
        const to = { nonce: 20 };

        let lastNonce = 0;
        const tween = new TWEEN.Tween(object)
            .to(to, ANIMATION_DURATION)
            .onUpdate(() => {
                if (object.nonce - lastNonce > 1) {
                    lastNonce = object.nonce;
                    this.controls.dollyOut();
                    this.controls.updateCamera();
                }
            });
        this.startTween(tween);
    }

    autoFocus(model, isWorkspaceAutoFocus = false) {
        const target = model ? model.position.clone() : this.initialTarget;
        // const target = model ? model.position.clone() : new Vector3();
        this.setCamera(this.cameraInitialPosition, isWorkspaceAutoFocus ? new Vector3() : target);

        const object = {
            positionX: this.camera.position.x,
            positionY: this.camera.position.y,
            positionZ: this.camera.position.z
        };
        const to = {
            positionX: this.props.cameraInitialPosition.x,
            positionY: this.props.cameraInitialPosition.y,
            positionZ: this.props.cameraInitialPosition.z
        };
        const tween = new TWEEN.Tween(object)
            .to(to, ANIMATION_DURATION)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onUpdate(() => {
                this.camera.position.x = object.positionX;
                this.camera.position.y = object.positionY;
                this.camera.position.z = object.positionZ;

                // this.camera.lookAt(this.controls.target);
            });
        this.startTween(tween);
    }

    _getCameraPositionByRotation(positionStart, target, angleEW, angleNS) {
        const positionRotateNS = {
            x: positionStart.x,
            y: target.y + (positionStart.y - target.y) * Math.cos(angleNS) - (positionStart.z - target.z) * Math.sin(angleNS),
            z: target.z + (positionStart.y - target.y) * Math.sin(angleNS) + (positionStart.z - target.z) * Math.cos(angleNS)
        };

        const positionRotateEW = {
            x: target.x + (positionRotateNS.x - target.x) * Math.cos(angleEW) - (positionRotateNS.y - target.y) * Math.sin(angleEW),
            y: target.y + (positionRotateNS.x - target.x) * Math.sin(angleEW) + (positionRotateNS.y - target.y) * Math.cos(angleEW),
            z: positionRotateNS.z
        };

        return positionRotateEW;
    }

    toTopFrontRight() {
        const positionStart = this.props.cameraInitialPosition;
        const target = { x: 0, y: 0, z: this.props.cameraInitialPosition.z };
        const position = this._getCameraPositionByRotation(positionStart, target, Math.PI / 6, -Math.PI / 10);
        this.camera.position.x = position.x;
        this.camera.position.y = position.y;
        this.camera.position.z = position.z;
        this.controls.setTarget(new Vector3(0, 0, this.props.cameraInitialPosition.z));
        this.renderScene();
    }

    toFront() {
        this.camera.position.x = this.props.cameraInitialPosition.x;
        this.camera.position.y = this.props.cameraInitialPosition.y;
        this.camera.position.z = this.props.cameraInitialPosition.z;
        this.controls.setTarget(new Vector3(0, 0, this.props.cameraInitialPosition.z));
        // this.camera.lookAt(new Vector3(0, 0, this.cameraInitialPosition.z));
        this.renderScene();
    }

    toLeft() {
        const positionStart = this.props.cameraInitialPosition;
        const target = { x: 0, y: 0, z: this.props.cameraInitialPosition.z };
        const position = this._getCameraPositionByRotation(positionStart, target, -Math.PI / 2, 0);
        this.camera.position.x = position.x;
        this.camera.position.y = position.y;
        this.camera.position.z = position.z;
        this.controls.setTarget(new Vector3(0, 0, this.props.cameraInitialPosition.z));
        this.renderScene();
    }

    toRight() {
        const positionStart = this.props.cameraInitialPosition;
        const target = { x: 0, y: 0, z: this.props.cameraInitialPosition.z };
        const position = this._getCameraPositionByRotation(positionStart, target, Math.PI / 2, 0);
        this.camera.position.x = position.x;
        this.camera.position.y = position.y;
        this.camera.position.z = position.z;
        this.controls.setTarget(new Vector3(0, 0, this.props.cameraInitialPosition.z));
        this.renderScene();
    }

    toTop() {
        const positionStart = this.props.cameraInitialPosition;
        const target = { x: 0, y: 0, z: this.props.cameraInitialPosition.z };
        const position = this._getCameraPositionByRotation(positionStart, target, 0, -Math.PI / 2);
        this.camera.position.x = position.x;
        this.camera.position.y = position.y;
        this.camera.position.z = position.z;
        this.controls.setTarget(new Vector3(0, 0, this.props.cameraInitialPosition.z));
        this.renderScene();
    }

    toBottom() {
        this.camera.rotation.y = 0;
        this.camera.rotation.z = 0;

        const object = {
            rotationX: this.camera.rotation.x
        };
        const dist = this.camera.position.distanceTo(this.controls.target);
        const to = {
            rotationX: Math.round(this.camera.rotation.x / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 2
        };
        const tween = new TWEEN.Tween(object)
            .to(to, ANIMATION_DURATION)
            .onUpdate(() => {
                const rotation = object.rotationX;
                this.camera.rotation.x = rotation;

                this.camera.position.x = this.controls.target.x;
                this.camera.position.y = this.controls.target.y - Math.sin(rotation) * dist;
                this.camera.position.z = this.controls.target.z + Math.cos(rotation) * dist;
            });
        this.startTween(tween);
    }

    enable3D() {
        if (this.controls) {
            this.controls.enableRotate = true;
        }
    }

    disable3D() {
        if (this.controls) {
            this.controls.enableRotate = false;
        }
    }

    enableControls() {
        if (this.controls) {
            this.controls.enableClick();
        }
    }

    disableControls() {
        if (this.controls) {
            this.controls.disableClick();
        }
    }

    startSupportMode() {
        if (this.controls) {
            this.controls.startSupportMode();
        }
    }

    stopSupportMode() {
        if (this.controls) {
            this.controls.stopSupportMode();
        }
    }

    attach(objects) {
        if (this.controls) {
            this.controls.attach(objects);
        }
    }

    detach() {
        if (this.controls) {
            this.controls.detach();
        }
    }

    updateBoundingBox() {
        if (this.controls) {
            this.controls.updateBoundingBox();
        }
    }

    startTween(tween) {
        tween.onComplete(() => {
            this.animationCount--;
            this.animationCount = Math.max(this.animationCount, 0); // TODO: tween bug that onComplete called twice
            if (this.animationCount === 0) {
                window.cancelAnimationFrame(this.frameId);
            }
        });
        tween.start();

        this.animationCount++;
        if (this.animationCount === 1) {
            this.animation();
        }
    }

    renderScene() {
        throttle(() => {
            if (!this.isCanvasInitialized()) return;
            this.light.position.copy(this.camera.position);

            this.renderer.render(this.scene, this.camera);

            TWEEN.update();
        }, renderT)();
    }

    render() {
        if (!Detector.isWebGLAvailable()) {
            return Detector.getWebGLErrorMessage();
        }

        return (
            <div
                ref={this.node}
                style={{
                    backgroundColor: '#F5F5F7'
                }}
            />
        );
    }
}

export default Canvas;
