/**
 * Canvas
 *
 * Canvas is a React Component that is in charge of rendering models
 * on top of OpenGL and handles user interactions.
 */

import { checkSceneFaceless } from '@snapmaker/luban-platform';
import TWEEN from '@tweenjs/tween.js';
import { isNil } from 'lodash';
import noop from 'lodash/noop';
import PropTypes from 'prop-types';
import React from 'react';
import type { Camera, WebGLRenderer } from 'three';
import {
    AmbientLight,
    DirectionalLight,
    Group,
    HemisphereLight,
    Light,
    Object3D,
    PerspectiveCamera,
    PointLight,
    Scene,
    Vector3
} from 'three';

import { TRANSLATE_MODE } from '../../../constants';
import log from '../../../lib/log';
import ModelGroup from '../../../models/ModelGroup';
import Detector from '../../../scene/three-extensions/Detector';
import WebGLRendererWrapper from '../../../scene/three-extensions/WebGLRendererWrapper';
import ControlManager, { EVENTS } from './ControlManager';
import MeshColoringControl from '../../../scene/controls/MeshColoringControl';

const ANIMATION_DURATION = 500;
const DEFAULT_MODEL_POSITION = new Vector3(0, 0, 0);
const EPS = 0.000001;
// const FPS = 60;
// const renderT = 1 / FPS;
let parentDOM = null;
let inputDOM = null;
let inputDOM2 = null; // translate has two input for X and Y axis


interface CanvasProps {
    minScale?: number;
    maxScale?: number;

    backgroundGroup: Object3D;


    onSceneCreated?: (canvas: Canvas) => void;
}

class Canvas extends React.PureComponent<CanvasProps> {
    public static propTypes = {
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
        transformMode: PropTypes.string,

        supportActions: PropTypes.object,

        // callback
        onSelectModels: PropTypes.func,
        updateTarget: PropTypes.func,
        updateScale: PropTypes.func,
        onModelAfterTransform: PropTypes.func,
        onModelBeforeTransform: PropTypes.func,
        onRotationPlacementSelect: PropTypes.func,

        // tmp
        canOperateModel: PropTypes.bool,
        // isToolpathModel: PropTypes.bool,
        showContextMenu: PropTypes.func,

        // inProgress
        inProgress: PropTypes.bool,

        primeTowerSelected: PropTypes.bool
    };

    public static defaultProps = {
        canOperateModel: true
    };

    // scene objects
    private scene: Scene = null;
    private renderer: WebGLRenderer | WebGLRendererWrapper = null;
    private camera: Camera = null;
    private light: Light = null;

    private group: Group = null;
    private modelGroup: ModelGroup;
    private toolPathGroupObject: Object3D = null;
    private gcodeLineGroup: Object3D = null;

    // scene helper objects
    private transformSourceType: '2D' | '3D' = '3D';
    private initialTarget: Vector3 = new Vector3();
    private lastTarget: Vector3 = null;
    private frameId = 0;

    // otehrs
    private node = React.createRef<HTMLDivElement>();
    public controls = null;
    private animationCount = 0;
    private targetObject: Object3D | null = null;

    public constructor(props) {
        super(props);

        // scene
        this.modelGroup = props.modelGroup;

        this.transformSourceType = props.transformSourceType || '3D'; // '3D' | '2D'
        // frozen
        this.toolPathGroupObject = this.props.toolPathGroupObject;
        this.gcodeLineGroup = this.props.gcodeLineGroup;
        this.cameraInitialPosition = this.props.cameraInitialPosition;

        // callback
        this.onSelectModels = this.props.onSelectModels || noop;
        this.onModelBeforeTransform = this.props.onModelBeforeTransform || noop;
        this.onModelAfterTransform = this.props.onModelAfterTransform || noop;
        this.onRotationPlacementSelect = this.props.onRotationPlacementSelect || noop;

        // threejs
        this.controlFrontLeftTop = new Vector3();
        this.cloneRotatePeripheral = new Object3D();
        this.canvasWidthHalf = null;
        this.canvasHeightHalf = null;
        this.inputPositionTop = 0;
        this.inputPositionLeft = 0;
        this.inputLeftOffset = 0;
    }

    public componentDidMount() {
        if (!this.isCanvasInitialized()) {
            log.warn('Canvas is not initialized properly');
            return;
        }

        this.setupScene();
        this.setupControls();

        const { backgroundGroup, printableArea } = this.props;

        this.group.add(printableArea);
        printableArea.addEventListener('update', () => this.renderScene());

        this.modelGroup.object.addEventListener('update', () => this.renderScene());

        this.group.add(this.modelGroup.object);
        if (this.modelGroup.clippingGroup) {
            this.group.add(this.modelGroup.clippingGroup);
        }
        if (this.modelGroup.plateAdhesion) {
            this.group.add(this.modelGroup.plateAdhesion);
        }

        this.toolPathGroupObject && this.group.add(this.toolPathGroupObject);
        this.gcodeLineGroup && this.group.add(this.gcodeLineGroup);

        if (backgroundGroup) {
            this.group.add(backgroundGroup);
        }

        if (this.controls && this.props.inProgress) {
            this.controls.setInProgress(this.props.inProgress);
        }

        window.addEventListener('resize', this.resizeWindow, false);

        this.renderScene();

        if (this.props.onSceneCreated) {
            this.props.onSceneCreated(this);
        }
    }

    // just for laser and cnc, dont set scale prop for 3dp
    public componentWillReceiveProps(nextProps) {
        if (nextProps.inProgress !== this.props.inProgress) {
            this.controls.setInProgress(nextProps.inProgress);
        }

        if (nextProps.scale && nextProps.scale !== this.lastScale) {
            if (!this.isCanvasInitialized()) return;

            const currentScale = this.initialDistance
                / this.camera.position.distanceTo(this.controls.target);
            this.controls.setScale(currentScale / nextProps.scale);
            this.lastScale = nextProps.scale;
            this.controls.updateCamera();
        }

        if (nextProps.target && nextProps.target !== this.lastTarget) {
            if (!this.isCanvasInitialized()) return;

            const { x, y } = nextProps.target;
            this.controls.panOffset.add(
                new Vector3(
                    x - this.controls.target.x,
                    y - this.controls.target.y,
                    0
                )
            );
            this.controls.updateCamera();
        }

        if (nextProps.printableArea !== this.props.printableArea) {
            this.group.remove(this.props.printableArea);
            this.group.add(nextProps.printableArea);
        }

        if (nextProps.displayedType !== this.props.displayedType) {
            if (nextProps.displayedType === 'gcode') {
                this.controls.removeTransformControls();
                this.group.remove(this.modelGroup.object);
                this.group.add(this.modelGroup.grayModeObject);
            } else {
                this.controls.recoverTransformControls(
                    nextProps.primeTowerSelected,
                    nextProps.transformMode
                );
                this.group.remove(this.modelGroup.grayModeObject);
                this.group.add(this.modelGroup.object);
            }
            this.renderScene();
        }

        if (
            nextProps.primeTowerSelected !== this.props.primeTowerSelected
            && nextProps.displayedType !== 'gcode'
        ) {
            this.controls.removeTransformControls();
            if (nextProps.primeTowerSelected) {
                this.controls.recoverTransformControls(
                    true,
                    nextProps.transformMode
                );
                this.controls.setPrimeTower(true);
            } else {
                this.controls.recoverTransformControls(
                    false,
                    nextProps.transformMode
                );
                this.controls.setPrimeTower(false);
            }
            this.renderScene();
        }
    }

    public componentWillUnmount() {
        if (this.controls) {
            this.controls.dispose();
        }
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }
    }

    public onScale = () => {
        if (typeof this.props.updateScale !== 'function') {
            return;
        }
        let currentScale = this.initialDistance
            / this.camera.position.distanceTo(this.controls.target);
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

    public onChangeTarget = () => {
        if (typeof this.props.updateTarget !== 'function') {
            return;
        }
        const { x, y } = this.controls.target;
        this.lastTarget = { x, y };
        this.props.updateTarget(this.lastTarget);
    };

    public getVisibleWidth() {
        return this.node.current && this.node.current.parentElement.clientWidth;
    }

    public getVisibleHeight() {
        return (
            this.node.current && this.node.current.parentElement.clientHeight
        );
    }

    public getCamera(): Camera {
        return this.camera;
    }

    public setupScene() {
        const width = this.getVisibleWidth();
        const height = this.getVisibleHeight();

        this.camera = new PerspectiveCamera(45, width / height, 0.1, 10000);
        this.camera.position.copy(this.cameraInitialPosition);
        if (this.transformSourceType === '2D') {
            this.light = new DirectionalLight(0xffffff, 0.6);
            this.light.position.copy(this.cameraInitialPosition);
        }
        if (this.transformSourceType === '3D') {
            this.light = new DirectionalLight(0x666666, 0.4);
            const pLight = new PointLight(0xffffff, 0.6, 0, 0.6);
            this.camera.add(pLight);
            pLight.position.copy(new Vector3(-4000, 7000, 50000));
        }

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
            const lightTop = new HemisphereLight(0xa3a3a3, 0x545454, 0.5);
            const lightInside = new AmbientLight(0x666666);
            lightTop.position.copy(new Vector3(0, 0, -49000));
            lightInside.position.copy(new Vector3(0, 0, 0));
            this.scene.add(lightTop);
            this.scene.add(lightInside);
        }
        if (this.transformSourceType === '2D') {
            this.scene.add(new HemisphereLight(0x000000, 0xcecece));
        }

        this.node.current.appendChild(this.renderer.domElement);
    }

    public setupControls() {
        this.initialTarget = this.props.cameraInitialTarget;

        const sourceType = this.props.transformSourceType === '2D' ? '2D' : '3D';
        this.controls = new ControlManager(
            sourceType,
            this.props.displayedType,
            this.camera,
            this.group,
            this.renderer.domElement,
            this.onScale,
            this.onChangeTarget,
            this.props.supportActions,
            this.props.minScale,
            this.props.maxScale,
            this.props.scaleSize
        );
        this.controls.canOperateModel = this.props.canOperateModel;
        this.setCamera(this.cameraInitialPosition, this.initialTarget);

        this.controls.setTarget(this.initialTarget);
        this.controls.setSelectableObjects(this.modelGroup.object);
        this.controls.setHighlightableObjects(this.modelGroup.clippingGroup);

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
        this.controls.on(EVENTS.AFTER_TRANSFORM_OBJECT, () => {
            this.onModelAfterTransform(
                this.controls.transformControl.mode,
                this.controls.transformControl.axis
            );
        });
        this.controls.on(EVENTS.SELECT_PLACEMENT_FACE, (userData) => {
            this.onRotationPlacementSelect(userData);
        });
        this.controls.on(EVENTS.PAN_SCALE, (scale) => {
            if (this.props.printableArea.onPanScale) {
                const needRefresh = this.props.printableArea.onPanScale(scale);
                if (needRefresh) {
                    this.renderScene();
                }
            }
        });
        this.controls.on(EVENTS.UPDATE_CAMERA, (position) => {
            if (this.props.printableArea.updateCamera) {
                const needRefresh = this.props.printableArea.updateCamera(position);
                if (needRefresh) {
                    this.renderScene();
                }
            }
        });
    }

    public getControlManager(): ControlManager {
        return this.controls;
    }

    public setTransformMode(mode) {
        if (
            [
                'translate',
                'scale',
                'rotate',
                'mirror',
                'rotate-placement'
            ].includes(mode)
        ) {
            this.controls && this.controls.setTransformMode(mode);
        } else {
            this.controls && this.controls.setTransformMode(null);
        }
    }

    public setHoverFace(face) {
        this.controls && this.controls.transformControl.setHoverFace(face);
    }

    public animation = () => {
        this.frameId = window.requestAnimationFrame(this.animation);
        this.renderScene();
    };

    public setCamera = (position, target) => {
        if (!this.isCanvasInitialized()) return;

        this.camera.position.copy(position);
        this.controls.setTarget(target);
        this.renderScene();

        if (position.x === 0 && position.y === 0) {
            this.initialDistance = position.z - target.z;
        }
    };

    public setCameraOnTop = () => {
        if (!this.isCanvasInitialized()) return;

        const dist = this.camera.position.distanceTo(this.controls.target);
        this.camera.position.copy(new Vector3(0, 0, dist));
        this.controls.setTarget(new Vector3(0, 0, 0));
        this.controls.updateCamera();
    };

    public setSelectedModelConvexMeshGroup = (group) => {
        this.controls.setSelectedModelConvexMeshGroup(group);
    };

    public resizeWindow = () => {
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

    public isCanvasInitialized() {
        return !!this.node.current;
    }

    public zoomIn() {
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

    public zoomOut() {
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

    public autoFocus(model, isWorkspaceAutoFocus = false) {
        const target = model ? model.position.clone() : this.initialTarget;
        // const target = model ? model.position.clone() : new Vector3();
        this.setCamera(
            this.cameraInitialPosition,
            isWorkspaceAutoFocus ? new Vector3() : target
        );

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

    private _getCameraPositionByRotation(positionStart, target, angleEW, angleNS) {
        const positionRotateNS = {
            x: positionStart.x,
            y:
                target.y
                + (positionStart.y - target.y) * Math.cos(angleNS)
                - (positionStart.z - target.z) * Math.sin(angleNS),
            z:
                target.z
                + (positionStart.y - target.y) * Math.sin(angleNS)
                + (positionStart.z - target.z) * Math.cos(angleNS)
        };

        const positionRotateEW = {
            x:
                target.x
                + (positionRotateNS.x - target.x) * Math.cos(angleEW)
                - (positionRotateNS.y - target.y) * Math.sin(angleEW),
            y:
                target.y
                + (positionRotateNS.x - target.x) * Math.sin(angleEW)
                + (positionRotateNS.y - target.y) * Math.cos(angleEW),
            z: positionRotateNS.z
        };

        return positionRotateEW;
    }

    public toTopFrontRight() {
        const positionStart = this.props.cameraInitialPosition;
        const target = { x: 0, y: 0, z: this.props.cameraInitialPosition.z };
        const position = this._getCameraPositionByRotation(
            positionStart,
            target,
            Math.PI / 6,
            -Math.PI / 10
        );
        this.camera.position.x = position.x;
        this.camera.position.y = position.y;
        this.camera.position.z = position.z;
        this.controls.setTarget(
            new Vector3(0, 0, this.props.cameraInitialPosition.z)
        );
        this.controls.resetPanScale();
        this.renderScene();
    }

    public toFront() {
        this.camera.position.x = this.props.cameraInitialPosition.x;
        this.camera.position.y = this.props.cameraInitialPosition.y;
        this.camera.position.z = this.props.cameraInitialPosition.z;
        this.controls.setTarget(
            new Vector3(0, 0, this.props.cameraInitialPosition.z)
        );
        // this.camera.lookAt(new Vector3(0, 0, this.cameraInitialPosition.z));
        this.controls.resetPanScale();
        this.renderScene();
    }

    public toLeft() {
        const positionStart = this.props.cameraInitialPosition;
        const target = { x: 0, y: 0, z: this.props.cameraInitialPosition.z };
        const position = this._getCameraPositionByRotation(
            positionStart,
            target,
            -Math.PI / 2,
            0
        );
        this.camera.position.x = position.x;
        this.camera.position.y = position.y;
        this.camera.position.z = position.z;
        this.controls.setTarget(
            new Vector3(0, 0, this.props.cameraInitialPosition.z)
        );
        this.controls.resetPanScale();
        this.renderScene();
    }

    public toRight() {
        const positionStart = this.props.cameraInitialPosition;
        const target = { x: 0, y: 0, z: this.props.cameraInitialPosition.z };
        const position = this._getCameraPositionByRotation(
            positionStart,
            target,
            Math.PI / 2,
            0
        );
        this.camera.position.x = position.x;
        this.camera.position.y = position.y;
        this.camera.position.z = position.z;
        this.controls.setTarget(
            new Vector3(0, 0, this.props.cameraInitialPosition.z)
        );
        this.controls.resetPanScale();
        this.renderScene();
    }

    public toTop() {
        const positionStart = this.props.cameraInitialPosition;
        const target = { x: 0, y: 0, z: this.props.cameraInitialPosition.z };
        const position = this._getCameraPositionByRotation(
            positionStart,
            target,
            0,
            -Math.PI / 2
        );
        this.camera.position.x = position.x;
        this.camera.position.y = position.y;
        this.camera.position.z = position.z;
        this.controls.setTarget(
            new Vector3(0, 0, this.props.cameraInitialPosition.z)
        );
        this.controls.resetPanScale();
        this.renderScene();
    }

    public fitViewIn(center, selectedGroupBsphereRadius) {
        const r = selectedGroupBsphereRadius;
        const newTarget = {
            ...center
        };
        // from
        const object = {
            ox: this.camera.position.x,
            oy: this.camera.position.y,
            oz: this.camera.position.z
        };

        // Calculate to = { o2, c }
        // P1 = this.camrea + newTarget - oldTarget
        const p1 = {
            x: this.camera.position.x + center.x - this.controls.target.x,
            y: this.camera.position.y + center.y - this.controls.target.y,
            z: this.camera.position.z + center.z - this.controls.target.z
        };
        const multiple = 1.8;
        const p1c = Math.sqrt(
            (p1.x - center.x) * (p1.x - center.x)
            + (p1.y - center.y) * (p1.y - center.y)
            + (p1.z - center.z) * (p1.z - center.z)
        );
        const o2 = {
            x:
                (multiple * (p1.x - center.x) * Math.sqrt(2) * r) / p1c
                + center.x,
            y:
                (multiple * (p1.y - center.y) * Math.sqrt(2) * r) / p1c
                + center.y,
            z:
                (multiple * (p1.z - center.z) * Math.sqrt(2) * r) / p1c
                + center.z
        };

        // to
        const to = {
            ox: o2.x,
            oy: o2.y,
            oz: o2.z
        };
        const tween = new TWEEN.Tween(object)
            .to(to, ANIMATION_DURATION)
            .onUpdate(() => {
                this.camera.position.x = object.ox;
                this.camera.position.y = object.oy;
                this.camera.position.z = object.oz;
            });
        this.startTween(tween);

        setTimeout(() => {
            this.camera.position.x = o2.x;
            this.camera.position.y = o2.y;
            this.camera.position.z = o2.z;
            this.controls.setTarget(
                new Vector3(newTarget.x, newTarget.y, newTarget.z)
            );
            this.controls.updatePanScale();
            this.renderScene();
        }, ANIMATION_DURATION);
    }

    public toBottom() {
        this.camera.rotation.y = 0;
        this.camera.rotation.z = 0;

        const object = {
            rotationX: this.camera.rotation.x
        };
        const dist = this.camera.position.distanceTo(this.controls.target);
        const to = {
            rotationX:
                Math.round(this.camera.rotation.x / (Math.PI / 2))
                * (Math.PI / 2)
                + Math.PI / 2
        };
        const tween = new TWEEN.Tween(object)
            .to(to, ANIMATION_DURATION)
            .onUpdate(() => {
                const rotation = object.rotationX;
                this.camera.rotation.x = rotation;

                this.camera.position.x = this.controls.target.x;
                this.camera.position.y = this.controls.target.y - Math.sin(rotation) * dist;
                this.camera.position.z = this.controls.target.z + Math.cos(rotation) * dist;
                this.controls.resetPanScale();
            });
        this.startTween(tween);
    }

    public enable3D() {
        if (this.controls) {
            this.controls.enableRotate = true;
        }
    }

    public disable3D() {
        if (this.controls) {
            this.controls.enableRotate = false;
        }
    }

    public enableControls() {
        if (this.controls) {
            this.controls.enableClick();
        }
    }

    public disableControls() {
        if (this.controls) {
            this.controls.disableClick();
        }
    }

    public startSupportMode() {
        if (this.controls) {
            this.controls.startSupportMode();
        }
    }

    public stopSupportMode() {
        if (this.controls) {
            this.controls.stopSupportMode();
        }
    }

    public startMeshColoringMode(): void {
        if (this.controls) {
            this.controls.startMeshColoringMode();

            const control = this.controls.getControl('mesh-coloring') as MeshColoringControl;
            if (control) {
                control.setTargetObject(this.targetObject);
            }
        }
    }

    public stopMeshColoringMode(): void {
        if (this.controls) {
            this.controls.stopMeshColoringMode();
        }
    }

    public attach(objects) {
        this.targetObject = objects;
        if (this.controls) {
            this.controls.attach(objects);
        }
    }

    public detach() {
        this.targetObject = null;
        if (this.controls) {
            this.controls.detach();
        }
    }

    public updateBoundingBox() {
        if (this.controls) {
            this.controls.updateBoundingBox();
        }
    }

    public startTween(tween) {
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

    public renderScene() {
        if (!this.isCanvasInitialized()) return;

        if (this.transformSourceType === '2D') {
            this.light.position.copy(this.camera.position);
        }

        if (
            this.transformSourceType === '3D'
            && this.controls.transformControl.mode !== 'mirror'
            && this.modelGroup?.selectedModelArray
            && this.modelGroup.selectedModelArray[0]?.type !== 'primeTower'
        ) {
            switch (this.controls.transformControl.mode) {
                case 'translate':
                    this.cloneControlPeripheral = this.controls.transformControl.translatePeripheral.clone();
                    break;
                case 'rotate':
                    this.cloneControlPeripheral = this.controls.transformControl.rotatePeripheral.clone();
                    break;
                case 'scale':
                    this.cloneControlPeripheral = this.controls.transformControl.scalePeripheral.clone();
                    break;
                default:
                    this.cloneControlPeripheral = this.controls.transformControl.translatePeripheral.clone();
                    break;
            }
            this.cloneControlPeripheral.updateMatrixWorld();
            this.controlFrontLeftTop.setFromMatrixPosition(
                this.cloneControlPeripheral.matrixWorld
            );
            this.controlFrontLeftTop.project(this.camera);
            inputDOM = document.getElementById('control-input');
            inputDOM2 = document.getElementById('control-input-2');
            parentDOM = document.getElementById('smcanvas');
            this.inputLeftOffset = inputDOM2 ? 104 : 48; // one input width is 96, if has inputDOM2, inputDOM has marginRight 16px
            this.canvasWidthHalf = parentDOM.clientWidth * 0.5;
            this.canvasHeightHalf = parentDOM.clientHeight * 0.5;
            if (
                Math.abs(
                    parseFloat(this.inputPositionLeft)
                    - (this.controlFrontLeftTop.x * this.canvasWidthHalf
                        + this.canvasWidthHalf
                        - this.inputLeftOffset)
                ) > 10
                || Math.abs(
                    parseFloat(this.inputPositionTop)
                    - (-(
                        this.controlFrontLeftTop.y
                        * this.canvasHeightHalf
                    )
                        + this.canvasHeightHalf
                        - 220)
                ) > 10
            ) {
                this.inputPositionLeft = `${this.controlFrontLeftTop.x * this.canvasWidthHalf
                    + this.canvasWidthHalf
                    - this.inputLeftOffset}px`;
                this.inputPositionTop = `${-(this.controlFrontLeftTop.y * this.canvasHeightHalf)
                    + this.canvasHeightHalf
                    - 220}px`;
            }
            inputDOM && (inputDOM.style.top = this.inputPositionTop);
            inputDOM && (inputDOM.style.left = this.inputPositionLeft);
            if (
                this.controls.transformControl.mode === TRANSLATE_MODE
                && (this.controls.transformControl.axis === 'XY'
                    || this.controls.transformControl.axis === null)
            ) {
                inputDOM2 && (inputDOM2.style.top = this.inputPositionTop);
                inputDOM2
                    && (inputDOM2.style.left = `${parseFloat(this.inputPositionLeft) + 120}px`);
                inputDOM2
                    && this.controls.transformControl.dragging
                    && (inputDOM2.style.display = 'block');
            }
            this.controls.transformControl.dragging
                && inputDOM
                && (inputDOM.style.display = 'block');
        }
        if (
            this.transformSourceType === '3D'
            && (!this.modelGroup.selectedModelArray?.length
                || !this.modelGroup.isSelectedModelAllVisible())
        ) {
            inputDOM && (inputDOM.style.display = 'none');
            inputDOM2 && (inputDOM2.style.display = 'none');
        }
        if (this.controls.transformControl.mode === null) {
            inputDOM && (inputDOM.style.display = 'none');
            inputDOM2 && (inputDOM2.style.display = 'none');
        }
        if (this.controls.transformControl.mode === 'scale' && this.modelGroup.selectedModelArray?.length > 1) {
            inputDOM && (inputDOM.style.display = 'none');
            inputDOM2 && (inputDOM2.style.display = 'none');
        }

        checkSceneFaceless(this.scene);

        this.renderer.render(this.scene, this.camera);
        TWEEN.update();
    }

    public render() {
        if (!Detector.isWebGLAvailable()) {
            return (
                <div
                    style={{
                        background: 'fff',
                        textAlign: 'center',
                        width: '400px',
                        margin: '0 auto 5em',
                        padding: '10em 1.5em'
                    }}
                >
                    Your graphics card does not seem to support <b>WebGL</b>.
                    <br />
                    Find out how to get it <a href="http://get.webgl.org/" style={{ color: '#28a7e1' }}>here</a>.
                </div>
            );
        }

        return (
            <div
                id="smcanvas"
                ref={this.node}
                style={{
                    backgroundColor: '#F5F5F7'
                }}
            />
        );
    }
}

export default Canvas;
