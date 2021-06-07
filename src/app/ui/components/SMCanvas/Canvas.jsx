/**
 * Canvas
 *
 * Canvas is a React Component that is in charge of rendering models
 * on top of OpenGL and handles user interactions.
 */

import noop from 'lodash/noop';
import React, { Component } from 'react';
import { isNil } from 'lodash';
import { Vector3, Color, PerspectiveCamera, Scene, Group, HemisphereLight, DirectionalLight, WebGLRenderer } from 'three';
import Detector from 'three/examples/js/Detector';
import PropTypes from 'prop-types';
import TWEEN from '@tweenjs/tween.js';
import Controls, { EVENTS } from './Controls';


const ANIMATION_DURATION = 500;
const DEFAULT_MODEL_POSITION = new Vector3(0, 0, 0);
const EPS = 0.000001;


class Canvas extends Component {
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
        target: PropTypes.object,

        supportActions: PropTypes.object,

        // callback
        onSelectModels: PropTypes.func,
        updateTarget: PropTypes.func,
        updateScale: PropTypes.func,
        onModelAfterTransform: PropTypes.func,
        onModelTransform: PropTypes.func,

        // tmp
        canOperateModel: PropTypes.bool,
        // isToolpathModel: PropTypes.bool,
        showContextMenu: PropTypes.func,

        // inProgress
        inProgress: PropTypes.func
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
        this.onModelAfterTransform = this.props.onModelAfterTransform || noop;
        this.onModelTransform = this.props.onModelTransform || noop;

        this.transformMode = 'translate'; // transformControls mode: translate/scale/rotate

        // controls
        this.transformControls = null; // pan/scale/rotate selected model


        // threejs
        this.camera = null;
        this.renderer = null;
        this.scene = null;
        this.group = null;
        this.light = null;
    }

    componentDidMount() {
        if (this.node) {
            this.setupScene();
            this.setupControls();

            this.group.add(this.props.printableArea);
            this.props.printableArea.addEventListener('update', () => this.renderScene()); // TODO: another way to trigger re-render
            this.group.add(this.modelGroup.object);
            this.toolPathGroupObject && this.group.add(this.toolPathGroupObject);
            this.gcodeLineGroup && this.group.add(this.gcodeLineGroup);
            this.backgroundGroup && this.group.add(this.backgroundGroup);

            this.renderScene();

            window.addEventListener('resize', this.resizeWindow, false);
        }

        if (this.controls && this.props.inProgress) {
            this.controls.setInProgress(this.props.inProgress);
        }
    }

    // just for laser and cnc, dont set scale prop for 3dp
    componentWillReceiveProps(nextProps) {
        if (nextProps.inProgress !== this.props.inProgress) {
            this.controls.setInProgress(nextProps.inProgress);
        }

        if (nextProps.scale && nextProps.scale !== this.lastScale) {
            const currentScale = this.initialDistance / (this.camera.position.distanceTo(this.controls.target));
            this.controls.setScale(currentScale / nextProps.scale);
            this.lastScale = nextProps.scale;
            this.controls.updateCamera();
        }

        if (nextProps.target && nextProps.target !== this.lastTarget) {
            const { x, y } = nextProps.target;
            this.controls.panOffset.add(new Vector3(x - this.controls.target.x, y - this.controls.target.y, 0));
            this.controls.updateCamera();
        }
        // if (this.props.toolPathGroupObject) {
        //     if (this.props.toolPathGroupObject.isRotate && this.props.toolPathGroupObject.visible) {
        //         this.controls.setShouldForbidSelect(true);
        //     } else {
        //         this.controls.setShouldForbidSelect(false);
        //     }
        // }

        if (nextProps.printableArea !== this.props.printableArea) {
            this.group.remove(this.props.printableArea);
            this.group.add(nextProps.printableArea);
        }
    }

    componentWillUnmount() {
        if (this.controls) {
            this.controls.dispose();
        }

        this.transformControls && this.transformControls.dispose();
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

        this.renderer = new WebGLRenderer({ antialias: true });
        this.renderer.setClearColor(new Color(0xfafafa), 1);
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;

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

        this.controls = new Controls(sourceType, this.camera, this.group, this.renderer.domElement, this.onScale, this.onChangeTarget,
            this.props.supportActions);
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
        this.controls.on(EVENTS.TRANSFORM_OBJECT, () => {
            if (this.props.canOperateModel) {
                this.onModelTransform();
            }
        });
        this.controls.on(EVENTS.AFTER_TRANSFORM_OBJECT, () => {
            this.onModelAfterTransform();
        });
    }

    setTransformMode(mode) {
        if (['translate', 'scale', 'rotate', 'mirror'].includes(mode)) {
            this.transformControls && this.transformControls.setMode(mode);
            this.controls && this.controls.setTransformMode(mode);
        } else {
            this.controls && this.controls.setTransformMode(null);
        }
    }

    setTransformControls2DState(params) {
        const { enabledTranslate, enabledScale, enabledRotate } = params;
        if (this.transformSourceType === '2D' && this.transformControls) {
            if (enabledTranslate !== undefined) {
                this.transformControls.setEnabledTranslate(enabledTranslate);
            }
            if (enabledScale !== undefined) {
                this.transformControls.setEnabledScale(enabledScale);
            }
            if (enabledRotate !== undefined) {
                this.transformControls.setEnabledRotate(enabledRotate);
            }
        }
    }

    animation = () => {
        this.frameId = window.requestAnimationFrame(this.animation);

        this.renderScene();
    };

    setCamera = (position, target) => {
        this.camera.position.copy(position);
        this.controls.setTarget(target);
        this.renderScene();

        if (position.x === 0 && position.y === 0) {
            this.initialDistance = (position.z - target.z);
        }
    };

    setCameraOnTop = () => {
        const dist = this.camera.position.distanceTo(this.controls.target);
        this.camera.position.copy(new Vector3(0, 0, dist));
        this.controls.setTarget(new Vector3(0, 0, 0));
        this.controls.updateCamera();
    }

    resizeWindow = () => {
        const width = this.getVisibleWidth();
        const height = this.getVisibleHeight();
        if (width * height !== 0 && !isNil(width) && !isNil(height)) {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        }
        this.renderScene();
    };

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

    autoFocus(model) {
        const target = model ? model.position.clone() : this.initialTarget;
        this.setCamera(this.cameraInitialPosition, target);

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

    toFront() {
        this.camera.position.x = this.props.cameraInitialPosition.x;
        this.camera.position.y = this.props.cameraInitialPosition.y;
        this.camera.position.z = this.props.cameraInitialPosition.z;
        this.controls.setTarget(new Vector3(0, 0, this.props.cameraInitialPosition.z));
        // this.camera.lookAt(new Vector3(0, 0, this.cameraInitialPosition.z));
        this.renderScene();
    }

    toLeft() {
        this.camera.rotation.x = Math.PI / 2;
        this.camera.rotation.z = 0;

        // BTH, I don't know why Y rotation is applied before X rotation, so here we can't change rotation.z
        const object = {
            rotationY: this.camera.rotation.y
        };
        const dist = this.camera.position.distanceTo(this.controls.target);
        const to = {
            rotationY: Math.round(this.camera.rotation.y / (Math.PI / 2)) * (Math.PI / 2) - Math.PI / 2
        };
        const tween = new TWEEN.Tween(object)
            .to(to, ANIMATION_DURATION)
            .onUpdate(() => {
                const rotation = object.rotationY;
                this.camera.rotation.y = rotation;

                this.camera.position.x = this.controls.target.x + Math.sin(rotation) * dist;
                this.camera.position.y = this.controls.target.y - Math.cos(rotation) * dist;
                this.camera.position.z = this.controls.target.z;
            });
        this.startTween(tween);
    }

    toRight() {
        this.camera.rotation.x = Math.PI / 2;
        this.camera.rotation.z = 0;

        const object = {
            rotationY: this.camera.rotation.y
        };
        const dist = this.camera.position.distanceTo(this.controls.target);
        const to = {
            rotationY: Math.round(this.camera.rotation.y / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 2
        };
        const tween = new TWEEN.Tween(object)
            .to(to, ANIMATION_DURATION)
            .onUpdate(() => {
                const rotation = object.rotationY;
                this.camera.rotation.y = rotation;

                this.camera.position.x = this.controls.target.x + Math.sin(rotation) * dist;
                this.camera.position.y = this.controls.target.y - Math.cos(rotation) * dist;
                this.camera.position.z = this.controls.target.z;
            });
        this.startTween(tween);
    }

    toTop() {
        this.camera.rotation.y = 0;
        this.camera.rotation.z = 0;

        const object = {
            rotationX: this.camera.rotation.x
        };
        const dist = this.camera.position.distanceTo(this.controls.target);
        const to = {
            rotationX: Math.round(this.camera.rotation.x / (Math.PI / 2)) * (Math.PI / 2) - Math.PI / 2
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
        this.controls.enableRotate = true;
    }

    disable3D() {
        this.controls.enableRotate = false;
    }

    updateTransformControl2D() {
        this.transformSourceType === '2D' && this.transformControls && this.transformControls.updateGizmo();
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
        this.light.position.copy(this.camera.position);

        this.renderer.render(this.scene, this.camera);

        TWEEN.update();
    }

    render() {
        if (!Detector.webgl) {
            return (
                <div
                    style={{
                        backgroundColor: '#eee'
                    }}
                >
                    `Failed to get WebGL context. Your browser or device may not support WebGL.`
                </div>
            );
        }
        return (
            <div
                ref={this.node}
                style={{
                    backgroundColor: '#eee'
                }}
            />
        );
    }
}

export default Canvas;
