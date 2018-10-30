import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import * as THREE from 'three';
import Detector from 'three/examples/js/Detector';
import pubsub from 'pubsub-js';
import PropTypes from 'prop-types';
import TWEEN from '@tweenjs/tween.js';
import MSRControls from '../../components/three-extensions/MSRControls';
import TransformControls from '../../components/three-extensions/TransformControls';
import IntersectDetector from '../../components/three-extensions/IntersectDetector';
import {
    ACTION_CANVAS_OPERATION,
    ACTION_MODEL_TRANSFORM,
    ACTION_MODEL_AFTER_TRANSFORM,
    ACTION_MODEL_SELECTED,
    ACTION_UNSELECTED_ALL_MODELS
} from '../../constants';

const ANIMATION_DURATION = 300;
const ORIGIN_GROUP_POSITION = new THREE.Vector3(0, 0, 0);


class Canvas extends Component {
    static propTypes = {
        mode: PropTypes.string.isRequired,
        printableArea: PropTypes.object.isRequired,
        modelGroup: PropTypes.object.isRequired,
        modelGroupPosition: PropTypes.object.isRequired,
        gcodeLineGroup: PropTypes.object,
        gcodeLineGroupPosition: PropTypes.object,
        msrControlsEnabled: PropTypes.bool.isRequired,
        enabledRotate: PropTypes.bool.isRequired,
        transformControlsEnabled: PropTypes.bool.isRequired,
        intersectDetectorEnabled: PropTypes.bool.isRequired,
        transformMode: PropTypes.string,
        originCameraPosition: PropTypes.object.isRequired,
        selectedModel: PropTypes.object
    };

    // DOM node
    node = null;

    // from props
    mode = '';
    printableArea = null;
    modelGroup = null;
    modelGroupPosition = new THREE.Vector3(0, 0, 0);
    gcodeLineGroup = null;
    gcodeLineGroupPosition = new THREE.Vector3(0, 0, 0);
    transformMode = 'translate'; // transformControls mode: translate/scale/rotate
    msrControlsEnabled = false;
    enabledRotate = true;
    transformControlsEnabled = false;
    intersectDetectorEnabled = false;
    originCameraPosition = new THREE.Vector3(0, 0, 0);

    // controls
    msrControls = null; // pan/scale/rotate print area
    transformControls = null; // pan/scale/rotate selected model
    intersectDetector = null; // detect the intersected model with mouse
    controlMode = 'none'; // determine which controls is in using. none/transform/msr/detect

    // threejs
    camera = null;
    renderer = null;
    scene = null;
    group = null;

    subscriptions = [];

    publishes = {
        onModelTransform: () => {
            pubsub.publish(ACTION_MODEL_TRANSFORM, { mode: this.mode });
        },
        onModelAfterTransform: () => {
            pubsub.publish(ACTION_MODEL_AFTER_TRANSFORM, { mode: this.mode });
        },
        selectModel: (model) => {
            pubsub.publish(ACTION_MODEL_SELECTED, { mode: this.mode, model: model });
        },
        unselectAllModels: () => {
            pubsub.publish(ACTION_UNSELECTED_ALL_MODELS, { mode: this.mode });
        }
    };

    constructor(props) {
        super(props);

        this.mode = this.props.mode;
        this.printableArea = this.props.printableArea;
        this.modelGroup = this.props.modelGroup;
        this.modelGroupPosition = this.props.modelGroupPosition;

        this.gcodeLineGroup = this.props.gcodeLineGroup;
        this.gcodeLineGroupPosition = this.props.gcodeLineGroupPosition || new THREE.Vector3(0, 0, 0);

        this.msrControlsEnabled = this.props.msrControlsEnabled;
        this.transformControlsEnabled = this.props.transformControlsEnabled;
        this.intersectDetectorEnabled = this.props.intersectDetectorEnabled;
        this.enabledRotate = this.props.enabledRotate;
        this.transformMode = this.props.transformMode || 'translate';
        this.originCameraPosition.copy(this.props.originCameraPosition);
    }

    componentDidMount() {
        this.setupThreejs();
        this.setupControls();

        this.group.add(this.printableArea);
        this.group.add(this.modelGroup);
        if (this.gcodeLineGroup) {
            this.gcodeLineGroup.position.copy(this.gcodeLineGroupPosition);
            this.group.add(this.gcodeLineGroup);
        }
        this.group.position.copy(ORIGIN_GROUP_POSITION);
        this.camera.position.copy(this.originCameraPosition);
        this.modelGroup.position.copy(this.modelGroupPosition);
        this.printableArea.position.copy(new THREE.Vector3(0, 0, 0));

        this.start();
        this.subscribe();

        window.addEventListener('hashchange', this.onHashChange, false);
        window.addEventListener('resize', this.onWindowResize, false);
    }

    componentWillUnmount() {
        this.unsubscribe();
        this.msrControls && this.msrControls.dispose();
        this.transformControls && this.transformControls.dispose();
        this.intersectDetector && this.intersectDetector.dispose();
    }

    componentWillReceiveProps(nextProps) {
        if (this.transformControls) {
            const transformMode = nextProps.transformMode;
            if (['translate', 'scale', 'rotate'].includes(transformMode) && transformMode !== this.props.transformMode) {
                this.transformControls.setMode(transformMode);
            }

            if (!nextProps.selectedModel) {
                this.transformControls.detach();
            }
        }
    }

    subscribe() {
        this.subscriptions = [
            pubsub.subscribe(ACTION_CANVAS_OPERATION, (msg, data) => {
                const { mode, operation, value } = { ...data };
                if (this.mode === mode) {
                    switch (operation) {
                        case 'top':
                            this.toTop();
                            break;
                        case 'bottom':
                            this.toBottom();
                            break;
                        case 'left':
                            this.toLeft();
                            break;
                        case 'right':
                            this.toRight();
                            break;
                        case 'reset':
                            this.resetView();
                            break;
                        case 'zoomIn':
                            this.zoomIn();
                            break;
                        case 'zoomOut':
                            this.zoomOut();
                            break;
                        case 'changeCoordinateVisibility':
                            this.changeCoordinateVisibility(value);
                            break;
                        case 'resize':
                            this.onWindowResize();
                            break;
                        default:
                            break;
                    }
                }
            })
        ];
    }

    unsubscribe() {
        this.subscriptions.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        this.subscriptions = [];
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
        const cameraZ = this.originCameraPosition.z;
        const property = {
            property1: this.group.rotation.x,
            property2: this.group.rotation.y,
            property3: this.group.rotation.z,
            property4: this.group.position.x,
            property5: this.group.position.y,
            property6: this.group.position.z,
            property7: this.camera.position.z
        };

        const target = {
            property1: 0,
            property2: 0,
            property3: 0,
            property4: ORIGIN_GROUP_POSITION.x,
            property5: ORIGIN_GROUP_POSITION.y,
            property6: ORIGIN_GROUP_POSITION.z,
            property7: cameraZ
        };

        const tween = new TWEEN.Tween(property).to(target, ANIMATION_DURATION);
        tween.onUpdate(() => {
            this.group.rotation.x = property.property1;
            this.group.rotation.y = property.property2;
            this.group.rotation.z = property.property3;
            this.group.position.x = property.property4;
            this.group.position.y = property.property5;
            this.group.position.z = property.property6;
            this.camera.position.z = property.property7;
        });
        tween.start();
    }
    changeCoordinateVisibility(value) {
        this.printableArea.changeCoordinateVisibility(value);
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
        this.camera.lookAt(new THREE.Vector3(0, 0, 0));

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setClearColor(new THREE.Color(0xe8e8e8), 1);
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;

        this.scene = new THREE.Scene();
        this.scene.add(this.camera);

        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.scene.add(new THREE.HemisphereLight(0x000000, 0xe0e0e0));

        const element = ReactDOM.findDOMNode(this.node);
        element.appendChild(this.renderer.domElement);
    }

    setupControls() {
        if (this.msrControlsEnabled) {
            this.msrControls = new MSRControls(this.group, this.camera, this.renderer.domElement);
            this.msrControls.enabledRotate = this.enabledRotate;
            // triggered first, when "mouse down on canvas"
            this.msrControls.addEventListener(
                'mouseDown',
                () => {
                    this.controlMode = 'none';
                }
            );
            // targeted in last, when "mouse up on canvas"
            this.msrControls.addEventListener(
                'moveStart',
                () => {
                    this.controlMode = 'msr';
                }
            );
            // triggered last, when "mouse up on canvas"
            this.msrControls.addEventListener(
                'mouseUp',
                (eventWrapper) => {
                    switch (eventWrapper.event.button) {
                        case THREE.MOUSE.LEFT:
                            if (this.controlMode === 'none') {
                                this.publishes.unselectAllModels();
                                this.transformControls && this.transformControls.detach(); // make axis invisible
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
        }

        if (this.transformControlsEnabled) {
            this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
            this.transformControls.space = 'local';
            this.transformControls.setMode(this.transformMode);
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
                    this.publishes.onModelAfterTransform();
                }
            );
            // triggered when "transform model"
            this.transformControls.addEventListener(
                'objectChange', () => {
                    this.publishes.onModelTransform();
                }
            );
            this.scene.add(this.transformControls);
        }

        if (this.intersectDetectorEnabled) {
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
                    this.publishes.selectModel(modelMesh);
                    this.transformControls && this.transformControls.attach(modelMesh);
                }
            );
        }
    }

    // fix a bug: Canvas is not visible when first load url is other hash (like #/worspace)
    // getVisibleWidth() and getVisibleHeight() both return 0
    // because <div style={{ display: hidden ? 'none' : 'block' }}>
    onHashChange = (event) => {
        if (event.newURL.endsWith(this.mode)) {
            this.onWindowResize();
        }
    };

    onWindowResize = () => {
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
    }

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
