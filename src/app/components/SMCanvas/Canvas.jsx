/**
 * Canvas
 *
 * Canvas is a React Component that is in charge of rendering models
 * on top of OpenGL and handles user interactions.
 */

import noop from 'lodash/noop';
import isEqual from 'lodash/isEqual';
import React, { Component } from 'react';
import * as THREE from 'three';
import Detector from 'three/examples/js/Detector';
import PropTypes from 'prop-types';
import TWEEN from '@tweenjs/tween.js';
import Controls, { EVENTS } from './Controls';
// import MSRControls from '../three-extensions/MSRControls';
// import TransformControls from '../three-extensions/TransformControls';
// import TransformControls2D from '../three-extensions/TransformControls2D';


const ANIMATION_DURATION = 300;
const DEFAULT_MODEL_POSITION = new THREE.Vector3(0, 0, 0);
const DEFAULT_MODEL_ROTATION = new THREE.Euler();
const DEFAULT_MODEL_QUATERNION = new THREE.Quaternion().setFromEuler(DEFAULT_MODEL_ROTATION, false);


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

        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
        this.camera.position.copy(this.cameraInitialPosition);
        // const target = new THREE.Vector3(0, this.cameraInitialPosition.y, 0);
        // this.camera.lookAt(target);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setClearColor(new THREE.Color(0xfafafa), 1);
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;

        this.scene = new THREE.Scene();
        this.scene.add(this.camera);

        this.group = new THREE.Group();
        this.group.position.copy(DEFAULT_MODEL_POSITION);
        this.scene.add(this.group);

        this.scene.add(new THREE.HemisphereLight(0x000000, 0xe0e0e0));

        this.node.current.appendChild(this.renderer.domElement);
    }

    setupControls() {
        this.controls = new Controls(this.camera, this.group, this.renderer.domElement);

        const target = new THREE.Vector3(0, this.cameraInitialPosition.y, 0);
        this.controls.setTarget(target);
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
                    min: new THREE.Vector3(-MAX_SIZE / 2, -MAX_SIZE / 2, -MAX_SIZE / 2),
                    max: new THREE.Vector3(MAX_SIZE / 2, MAX_SIZE / 2, MAX_SIZE / 2)
                });
            } else if (this.transformModelType === '2D') {
                this.transformControls = new TransformControls2D(this.camera, this.renderer.domElement);
            }
        }*/
    }

    componentWillReceiveProps(nextProps) {
        if (!isEqual(nextProps.size, this.props.size)) {
            if (this.msrControls) {
                this.msrControls.updateSize(nextProps.size);
            }
        }
    }

    zoomIn() {
        // if (this.camera.position.z <= this.printableArea.position.z) {
        //     return;
        // }
        const property = { z: this.camera.position.z };
        const target = { z: this.camera.position.z - 50 };
        const tween = new TWEEN.Tween(property).to(target, ANIMATION_DURATION);
        tween.onUpdate(() => {
            this.camera.position.z = property.z;
        });
        tween.start();
    }

    zoomOut() {
        const property = { z: this.camera.position.z };
        const target = { z: this.camera.position.z + 50 };
        const tween = new TWEEN.Tween(property).to(target, ANIMATION_DURATION);
        tween.onUpdate(() => {
            this.camera.position.z = property.z;
        });
        tween.start();
    }

    autoFocus(model) {
        this.group.updateMatrixWorld(true);

        this.camera.position.copy(this.cameraInitialPosition);
        const groupPosition = DEFAULT_MODEL_ROTATION.clone();
        if (model) {
            const newMatrix = new THREE.Matrix4().compose(DEFAULT_MODEL_POSITION, DEFAULT_MODEL_QUATERNION, this.group.scale);
            const bbox = new THREE.Box3().setFromObject(model);

            // Calculate new model bbox after resetting position and rotation (without really resetting)
            const minPoint = bbox.min.clone();
            const maxPoint = bbox.max.clone();
            minPoint.applyMatrix4(new THREE.Matrix4().getInverse(this.group.matrixWorld)).applyMatrix4(newMatrix);
            maxPoint.applyMatrix4(new THREE.Matrix4().getInverse(this.group.matrixWorld)).applyMatrix4(newMatrix);

            // Change position of group so that the camera loots at it
            groupPosition.x = -0.5 * (minPoint.x + maxPoint.x);
            groupPosition.y = -0.5 * (minPoint.y + maxPoint.y);

            // Change position z of camera
            // TODO: find better way to position camera
            const lengthX = bbox.max.x - bbox.min.x;
            const lengthY = bbox.max.y - bbox.min.y;
            this.camera.position.z = 100 + Math.max(lengthX, lengthY);
        }

        // animation
        const property = {
            property1: this.group.position.x,
            property2: this.group.position.y,
            property3: this.group.position.z,
            property4: this.group.rotation.x,
            property5: this.group.rotation.y,
            property6: this.group.rotation.z
        };
        const target = {
            property1: groupPosition.x,
            property2: groupPosition.y,
            property3: groupPosition.z,
            property4: DEFAULT_MODEL_ROTATION.x,
            property5: DEFAULT_MODEL_ROTATION.y,
            property6: DEFAULT_MODEL_ROTATION.z
        };
        const tween = new TWEEN.Tween(property).to(target, ANIMATION_DURATION);
        tween.onUpdate(() => {
            this.group.position.x = property.property1;
            this.group.position.y = property.property2;
            this.group.position.z = property.property3;
            this.group.rotation.x = property.property4;
            this.group.rotation.y = property.property5;
            this.group.rotation.z = property.property6;
        });
        tween.start();
    }

    toLeft() {
        let delta = Math.PI / 2 + (this.group.rotation.y / (Math.PI / 2) - parseInt(this.group.rotation.y / (Math.PI / 2), 0)) * (Math.PI / 2);
        // handle precision of float
        delta = (delta < 0.01) ? (Math.PI / 2) : delta;
        const property = {
            property1: this.group.rotation.x,
            property2: this.group.rotation.y,
            property3: this.group.rotation.z
        };
        const target = {
            property1: 0,
            property2: this.group.rotation.y - delta,
            property3: 0
        };
        const tween = new TWEEN.Tween(property).to(target, ANIMATION_DURATION);
        tween.onUpdate(() => {
            this.group.rotation.x = property.property1;
            this.group.rotation.y = property.property2;
            this.group.rotation.z = property.property3;
        });
        tween.start();
    }

    toRight() {
        let delta = Math.PI / 2 - (this.group.rotation.y / (Math.PI / 2) - parseInt(this.group.rotation.y / (Math.PI / 2), 0)) * (Math.PI / 2);
        // handle precision of float
        delta = (delta < 0.01) ? (Math.PI / 2) : delta;
        const property = {
            property1: this.group.rotation.x,
            property2: this.group.rotation.y,
            property3: this.group.rotation.z
        };
        const target = {
            property1: 0,
            property2: this.group.rotation.y + delta,
            property3: 0
        };
        const tween = new TWEEN.Tween(property).to(target, ANIMATION_DURATION);
        tween.onUpdate(() => {
            this.group.rotation.x = property.property1;
            this.group.rotation.y = property.property2;
            this.group.rotation.z = property.property3;
        });
        tween.start();
    }

    toTop() {
        let delta = Math.PI / 2 - (this.group.rotation.x / (Math.PI / 2) - parseInt(this.group.rotation.x / (Math.PI / 2), 0)) * (Math.PI / 2);
        // handle precision of float
        delta = (delta < 0.01) ? (Math.PI / 2) : delta;
        const property = {
            property1: this.group.rotation.x,
            property2: this.group.rotation.y,
            property3: this.group.rotation.z
        };
        const target = {
            property1: this.group.rotation.x + delta,
            property2: 0,
            property3: 0
        };
        const tween = new TWEEN.Tween(property).to(target, ANIMATION_DURATION);
        tween.onUpdate(() => {
            this.group.rotation.x = property.property1;
            this.group.rotation.y = property.property2;
            this.group.rotation.z = property.property3;
        });
        tween.start();
    }

    toBottom() {
        let delta = Math.PI / 2 + (this.group.rotation.x / (Math.PI / 2) - parseInt(this.group.rotation.x / (Math.PI / 2), 0)) * (Math.PI / 2);
        // handle precision of float
        delta = (delta < 0.01) ? (Math.PI / 2) : delta;
        const property = {
            property1: this.group.rotation.x,
            property2: this.group.rotation.y,
            property3: this.group.rotation.z
        };
        const target = {
            property1: this.group.rotation.x - delta,
            property2: 0,
            property3: 0
        };
        const tween = new TWEEN.Tween(property).to(target, ANIMATION_DURATION);
        tween.onUpdate(() => {
            this.group.rotation.x = property.property1;
            this.group.rotation.y = property.property2;
            this.group.rotation.z = property.property3;
        });
        tween.start();
    }

    resetView() {
        const property = {
            property1: this.group.rotation.x,
            property2: this.group.rotation.y,
            property3: this.group.rotation.z,
            property4: this.group.position.x,
            property5: this.group.position.y,
            property6: this.group.position.z,
            property7: this.camera.position.x,
            property8: this.camera.position.y,
            property9: this.camera.position.z
        };

        const target = {
            property1: 0,
            property2: 0,
            property3: 0,
            property4: DEFAULT_MODEL_POSITION.x,
            property5: DEFAULT_MODEL_POSITION.y,
            property6: DEFAULT_MODEL_POSITION.z,
            property7: this.cameraInitialPosition.x,
            property8: this.cameraInitialPosition.y,
            property9: this.cameraInitialPosition.z
        };

        const tween = new TWEEN.Tween(property).to(target, ANIMATION_DURATION);
        tween.onUpdate(() => {
            this.group.rotation.x = property.property1;
            this.group.rotation.y = property.property2;
            this.group.rotation.z = property.property3;
            this.group.position.x = property.property4;
            this.group.position.y = property.property5;
            this.group.position.z = property.property6;
            this.camera.position.x = property.property7;
            this.camera.position.y = property.property8;
            this.camera.position.z = property.property9;
        });
        tween.start();
    }

    enable3D() {
        if (this.msrControls) {
            this.msrControls.enabledRotate = true;
        }
    }

    disable3D() {
        if (this.msrControls) {
            this.msrControls.enabledRotate = false;
        }
    }

    setTransformMode(mode) {
        if (['translate', 'scale', 'rotate'].includes(mode)) {
            this.transformControls && this.transformControls.setMode(mode);

            this.controls && this.controls.setTransformMode(mode);
        }
    }

    detachSelectedModel() {
        this.transformControls && this.transformControls.detach();
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

    renderScene() {
        this.renderer.render(this.scene, this.camera);
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
