import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import * as THREE from 'three';
import Detector from 'three/examples/js/Detector';
import PropTypes from 'prop-types';
import TWEEN from '@tweenjs/tween.js';
import MSRControls from '../../components/three-extensions/MSRControls';
import TransformControls from '../../components/three-extensions/TransformControls';
import TransformControls2D from '../../components/three-extensions/TransformControls2D';
import IntersectDetector from '../../components/three-extensions/IntersectDetector';

const ANIMATION_DURATION = 300;
const DEFAULT_MODEL_POSITION = new THREE.Vector3(0, 0, 0);
const DEFAULT_MODEL_ROTATION = new THREE.Euler();
const DEFAULT_MODEL_QUATERNION = new THREE.Quaternion().setFromEuler(DEFAULT_MODEL_ROTATION, false);

const noop = () => {};

class Canvas extends Component {
    static propTypes = {
        modelGroup: PropTypes.object.isRequired,
        printableArea: PropTypes.object.isRequired,
        enabledTransformModel: PropTypes.bool.isRequired,
        transformModelType: PropTypes.string, // 2D, 3D. Default is 3D
        enabledDetectModel: PropTypes.bool,
        gcodeLineGroup: PropTypes.object,
        modelInitialRotation: PropTypes.object.isRequired,
        cameraInitialPosition: PropTypes.object.isRequired,
        // callback
        onSelectModel: PropTypes.func,
        onUnselectAllModels: PropTypes.func,
        onModelAfterTransform: PropTypes.func,
        onModelTransform: PropTypes.func
    };

    constructor(props) {
        super(props);

        // frozen
        this.printableArea = this.props.printableArea;
        this.modelGroup = this.props.modelGroup;
        this.enabledTransformModel = this.props.enabledTransformModel;
        this.transformModelType = this.props.transformModelType || '3D';
        this.enabledDetectModel = this.props.enabledDetectModel || true;
        this.gcodeLineGroup = this.props.gcodeLineGroup;
        this.cameraInitialPosition = this.props.cameraInitialPosition;

        // callback
        this.onSelectModel = this.props.onSelectModel || noop;
        this.onUnselectAllModels = this.props.onUnselectAllModels || noop;
        this.onModelAfterTransform = this.props.onModelAfterTransform || noop;
        this.onModelTransform = this.props.onModelTransform || noop;

        // DOM node
        this.node = null;

        this.transformMode = 'translate'; // transformControls mode: translate/scale/rotate

        // controls
        this.msrControls = null; // pan/scale/rotate print area
        this.transformControls = null; // pan/scale/rotate selected model
        this.intersectDetector = null; // detect the intersected model with mouse
        this.controlMode = 'none'; // determine which controls is in using. none/transform/msr/detect

        // threejs
        this.camera = null;
        this.renderer = null;
        this.scene = null;
        this.group = null;
    }

    componentDidMount() {
        this.setupThreejs();
        this.setupControls();

        this.group.add(this.printableArea);
        this.group.add(this.modelGroup);
        if (this.gcodeLineGroup) {
            this.group.add(this.gcodeLineGroup);
        }

        this.start();

        window.addEventListener('resize', this.resizeWindow, false);
    }

    componentWillUnmount() {
        this.msrControls && this.msrControls.dispose();
        this.transformControls && this.transformControls.dispose();
        this.intersectDetector && this.intersectDetector.dispose();
    }

    getVisibleWidth() {
        const element = ReactDOM.findDOMNode(this.node);
        return element.parentNode.clientWidth;
    }

    getVisibleHeight() {
        const element = ReactDOM.findDOMNode(this.node);
        return element.parentNode.clientHeight;
    }

    setupThreejs() {
        const width = this.getVisibleWidth();
        const height = this.getVisibleHeight();

        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
        this.camera.position.copy(this.cameraInitialPosition);
        this.camera.lookAt(new THREE.Vector3(0, 0, 0));

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setClearColor(new THREE.Color(0xfafafa), 1);
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;

        this.scene = new THREE.Scene();
        this.scene.add(this.camera);

        this.group = new THREE.Group();
        this.group.position.copy(DEFAULT_MODEL_POSITION);
        this.group.rotation.copy(this.props.modelInitialRotation);
        this.scene.add(this.group);

        this.scene.add(new THREE.HemisphereLight(0x000000, 0xe0e0e0));

        const element = ReactDOM.findDOMNode(this.node);
        element.appendChild(this.renderer.domElement);
    }

    setupControls() {
        this.msrControls = new MSRControls(this.group, this.camera, this.renderer.domElement);
        // triggered first, when "mouse down on canvas"
        this.msrControls.addEventListener(
            'mouseDown',
            () => {
                this.controlMode = 'none';
            }
        );
        // triggered last, when "mouse up on canvas"
        this.msrControls.addEventListener(
            'moveStart',
            () => {
                this.controlMode = 'msr';
            }
        );
        this.msrControls.addEventListener(
            'move',
            () => {
                this.updateTransformControl2D();
            }
        );
        // triggered last, when "mouse up on canvas"
        this.msrControls.addEventListener(
            'mouseUp',
            (eventWrapper) => {
                switch (eventWrapper.event.button) {
                    case THREE.MOUSE.LEFT:
                        if (this.controlMode === 'none') {
                            this.transformControls && this.transformControls.detach(); // make axis invisible
                            this.onUnselectAllModels();
                        }
                        break;
                    case THREE.MOUSE.MIDDLE:
                    case THREE.MOUSE.RIGHT:
                        if (this.controlMode !== 'none') {
                            eventWrapper.event.stopPropagation();
                        }
                        break;
                    default:
                        break;
                }
                this.controlMode = 'none';
            }
        );

        if (this.enabledTransformModel) {
            if (this.transformModelType === '3D') {
                this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
                this.transformControls.space = 'local';
                this.transformControls.setMode(this.transformMode);
                this.scene.add(this.transformControls);
            } else if (this.transformModelType === '2D') {
                this.transformControls = new TransformControls2D(this.camera, this.renderer.domElement);
                this.group.add(this.transformControls);
            }
            this.transformControls.addEventListener(
                'change',
                () => {
                    this.renderScene();
                }
            );
            // triggered when "mouse down on an axis"
            this.transformControls.addEventListener(
                'mouseDown',
                () => {
                    this.msrControls && (this.msrControls.enabled = false);
                    this.controlMode = 'transform';
                }
            );
            // triggered when "mouse up on an axis"
            this.transformControls.addEventListener(
                'mouseUp',
                () => {
                    this.msrControls && (this.msrControls.enabled = true);
                    this.onModelAfterTransform();
                }
            );
            // triggered when "transform model"
            this.transformControls.addEventListener(
                'objectChange', () => {
                    this.onModelTransform();
                }
            );
        }
        if (this.enabledDetectModel) {
            // only detect 'modelGroup.children'
            this.intersectDetector = new IntersectDetector(
                this.modelGroup.children,
                this.camera,
                this.renderer.domElement
            );
            // triggered when "left mouse down on model"
            this.intersectDetector.addEventListener(
                'detected',
                (event) => {
                    const modelMesh = event.object;
                    this.controlMode = 'detect';
                    this.onSelectModel(modelMesh);
                    this.transformControls && this.transformControls.attach(modelMesh);
                }
            );
        }
    }

    zoomIn() {
        if (this.camera.position.z <= this.printableArea.position.z) {
            return;
        }
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
        this.msrControls.enabledRotate = true;
    }

    disable3D() {
        this.msrControls.enabledRotate = false;
    }

    setTransformMode(value) {
        if (['translate', 'scale', 'rotate'].includes(value)) {
            this.transformControls && this.transformControls.setMode(value);
        }
    }

    detachSelectedModel() {
        this.transformControls && this.transformControls.detach();
    }

    updateTransformControl2D() {
        this.transformModelType === '2D' && this.transformControls.updateGizmo();
    }

    resizeWindow = () => {
        const width = this.getVisibleWidth();
        const height = this.getVisibleHeight();
        if (width * height !== 0) {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        }
    };

    start() {
        if (!this.frameId) {
            this.frameId = requestAnimationFrame(this.animate);
        }
    }

    stop() {
        cancelAnimationFrame(this.frameId);
    }

    animate = () => {
        this.renderScene();
        this.frameId = window.requestAnimationFrame(this.animate);
        TWEEN.update();
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
                ref={(node) => {
                    this.node = node;
                }}
                style={{
                    backgroundColor: '#eee'
                }}
            />
        );
    }
}

export default Canvas;
