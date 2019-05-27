/**
 * Canvas
 *
 * Canvas is a React Component that is in charge of rendering models
 * on top of OpenGL and handles user interactions.
 */

import noop from 'lodash/noop';
import React, { Component } from 'react';
import { Vector3, Color, PerspectiveCamera, Scene, Group, HemisphereLight, WebGLRenderer } from 'three';
import Detector from 'three/examples/js/Detector';
import PropTypes from 'prop-types';
import TWEEN from '@tweenjs/tween.js';
import Controls, { EVENTS } from './Controls';
// import MSRControls from '../three-extensions/MSRControls';
// import TransformControls from '../three-extensions/TransformControls';
// import TransformControls2D from '../three-extensions/TransformControls2D';


const ANIMATION_DURATION = 500;
const DEFAULT_MODEL_POSITION = new Vector3(0, 0, 0);


class Canvas extends Component {
    static propTypes = {
        size: PropTypes.object.isRequired,
        backgroundGroup: PropTypes.object,
        modelGroup: PropTypes.object.isRequired,
        printableArea: PropTypes.object.isRequired,
        enabledTransformModel: PropTypes.bool.isRequired,
        transformModelType: PropTypes.string, // 2D, 3D. Default is 3D
        gcodeLineGroup: PropTypes.object,
        cameraInitialPosition: PropTypes.object.isRequired,
        // callback
        onSelectModel: PropTypes.func,
        onUnselectAllModels: PropTypes.func,
        onModelAfterTransform: PropTypes.func,
        onModelTransform: PropTypes.func,

        // tmp
        showContextMenu: PropTypes.func
    };

    node = React.createRef();

    controls = null;

    animationCount = 0;

    frameId = 0;

    initialTarget = new Vector3();

    constructor(props) {
        super(props);

        // frozen
        this.backgroundGroup = this.props.backgroundGroup;
        this.printableArea = this.props.printableArea;
        this.modelGroup = this.props.modelGroup;
        this.enabledTransformModel = this.props.enabledTransformModel;
        this.transformModelType = this.props.transformModelType || '3D';
        this.gcodeLineGroup = this.props.gcodeLineGroup;
        this.cameraInitialPosition = this.props.cameraInitialPosition;

        // callback
        this.onSelectModel = this.props.onSelectModel || noop;
        this.onUnselectAllModels = this.props.onUnselectAllModels || noop;
        this.onModelAfterTransform = this.props.onModelAfterTransform || noop;
        this.onModelTransform = this.props.onModelTransform || noop;

        this.transformMode = 'translate'; // transformControls mode: translate/scale/rotate

        // controls
        this.msrControls = null; // pan/scale/rotate print area
        this.transformControls = null; // pan/scale/rotate selected model

        // threejs
        this.camera = null;
        this.renderer = null;
        this.scene = null;
        this.group = null;
    }

    componentDidMount() {
        this.setupScene();
        this.setupControls();

        this.group.add(this.printableArea);
        this.printableArea.addEventListener('update', () => this.renderScene()); // TODO: another way to trigger re-render

        this.group.add(this.modelGroup);

        this.gcodeLineGroup && this.group.add(this.gcodeLineGroup);
        this.backgroundGroup && this.group.add(this.backgroundGroup);

        this.renderScene();

        window.addEventListener('resize', this.resizeWindow, false);
    }

    componentWillUnmount() {
        if (this.controls) {
            this.controls.dispose();
        }

        this.msrControls && this.msrControls.dispose();
        this.transformControls && this.transformControls.dispose();
    }

    getVisibleWidth() {
        return this.node.current.parentElement.clientWidth;
    }

    getVisibleHeight() {
        return this.node.current.parentElement.clientHeight;
    }

    setupScene() {
        const width = this.getVisibleWidth();
        const height = this.getVisibleHeight();

        this.camera = new PerspectiveCamera(45, width / height, 0.1, 10000);
        this.camera.position.copy(this.cameraInitialPosition);

        this.renderer = new WebGLRenderer({ antialias: true });
        this.renderer.setClearColor(new Color(0xfafafa), 1);
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;

        this.scene = new Scene();
        this.scene.add(this.camera);

        this.group = new Group();
        this.group.position.copy(DEFAULT_MODEL_POSITION);
        this.scene.add(this.group);

        this.scene.add(new HemisphereLight(0x000000, 0xe0e0e0));

        this.node.current.appendChild(this.renderer.domElement);
    }

    setupControls() {
        this.initialTarget.set(0, this.cameraInitialPosition.y, 0);

        const modelType = this.props.transformModelType === '2D' ? '2D' : '3D';

        this.controls = new Controls(modelType, this.camera, this.group, this.renderer.domElement);

        this.controls.setTarget(this.initialTarget);
        this.controls.setSelectableObjects(this.modelGroup.children);

        this.controls.on(EVENTS.UPDATE, () => {
            this.renderScene();
        });
        this.controls.on(EVENTS.CONTEXT_MENU, (e) => {
            if (this.props.showContextMenu) {
                this.props.showContextMenu(e);
            }
        });
        this.controls.on(EVENTS.SELECT_OBJECT, (object) => {
            this.onSelectModel(object);
        });
        this.controls.on(EVENTS.UNSELECT_OBJECT, () => {
            this.onUnselectAllModels();
        });
        this.controls.on(EVENTS.TRANSFORM_OBJECT, () => {
            this.onModelTransform();
        });
        this.controls.on(EVENTS.AFTER_TRANSFORM_OBJECT, () => {
            this.onModelAfterTransform();
        });

        // this.msrControls = new MSRControls(this.group, this.camera, this.renderer.domElement, this.props.size);
        // this.msrControls = new MSRControls(this.group, this.camera, this.renderer.domElement, this.props.size);
        // triggered first, when "mouse down on canvas"
        /*
        this.msrControls.addEventListener(
            'move',
            () => {
                this.updateTransformControl2D();
            }
        );
        */

        /*
        if (this.enabledTransformModel) {
            if (this.transformModelType === '3D') {
                const MAX_SIZE = 400;
                this.transformControls = new TransformControls(this.camera, this.renderer.domElement, {
                    min: new Vector3(-MAX_SIZE / 2, -MAX_SIZE / 2, -MAX_SIZE / 2),
                    max: new Vector3(MAX_SIZE / 2, MAX_SIZE / 2, MAX_SIZE / 2)
                });
            } else if (this.transformModelType === '2D') {
                this.transformControls = new TransformControls2D(this.camera, this.renderer.domElement);
            }
        }*/
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

    autoFocus(model) {
        this.camera.position.copy(this.cameraInitialPosition);

        const target = model ? model.position : new Vector3(0, this.cameraInitialPosition.y, 0);
        this.controls.setTarget(target);

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

    toLeft() {
        this.camera.rotation.x = 0;
        this.camera.rotation.z = 0;

        const object = {
            rotationY: this.camera.rotation.y
        };
        const dist = this.camera.position.distanceTo(this.controls.target);
        const to = {
            rotationY: Math.round(this.camera.rotation.y / (Math.PI / 2)) * (Math.PI / 2) - Math.PI / 2,
        };
        const tween = new TWEEN.Tween(object)
            .to(to, ANIMATION_DURATION)
            .onUpdate(() => {
                const rotation = object.rotationY;
                this.camera.rotation.y = rotation;

                this.camera.position.x = this.controls.target.x + Math.sin(rotation) * dist;
                this.camera.position.y = this.controls.target.y;
                this.camera.position.z = this.controls.target.z + Math.cos(rotation) * dist;
            });
        this.startTween(tween);
    }

    toRight() {
        this.camera.rotation.x = 0;
        this.camera.rotation.z = 0;

        const object = {
            rotationY: this.camera.rotation.y
        };
        const dist = this.camera.position.distanceTo(this.controls.target);
        const to = {
            rotationY: Math.round(this.camera.rotation.y / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 2,
        };
        const tween = new TWEEN.Tween(object)
            .to(to, ANIMATION_DURATION)
            .onUpdate(() => {
                const rotation = object.rotationY;
                this.camera.rotation.y = rotation;

                this.camera.position.x = this.controls.target.x + Math.sin(rotation) * dist;
                this.camera.position.y = this.controls.target.y;
                this.camera.position.z = this.controls.target.z + Math.cos(rotation) * dist;
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
            rotationX: Math.round(this.camera.rotation.x / (Math.PI / 2)) * (Math.PI / 2) - Math.PI / 2,
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
            rotationX: Math.round(this.camera.rotation.x / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 2,
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

    setTransformMode(mode) {
        if (['translate', 'scale', 'rotate'].includes(mode)) {
            this.transformControls && this.transformControls.setMode(mode);

            this.controls && this.controls.setTransformMode(mode);
        }
    }

    updateTransformControl2D() {
        this.transformModelType === '2D' && this.transformControls && this.transformControls.updateGizmo();
    }

    setTransformControls2DState(params) {
        const { enabledTranslate, enabledScale, enabledRotate } = params;
        if (this.transformModelType === '2D' && this.transformControls) {
            if (enabledTranslate !== undefined) {
                this.transformControls.setEnabledRotate(enabledTranslate);
            }
            if (enabledScale !== undefined) {
                this.transformControls.setEnabledScale(enabledScale);
            }
            if (enabledRotate !== undefined) {
                this.transformControls.setEnabledRotate(enabledRotate);
            }
        }
    }

    resizeWindow = () => {
        const width = this.getVisibleWidth();
        const height = this.getVisibleHeight();
        if (width * height !== 0) {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        }

        this.renderScene();
    };

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

    animation = () => {
        this.frameId = window.requestAnimationFrame(this.animation);

        this.renderScene();
    };

    renderScene() {
        this.renderer.render(this.scene, this.camera);

        TWEEN.update();
    }

    render() {
        if (!Detector.webgl) {
            return null;
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
