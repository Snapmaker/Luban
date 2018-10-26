import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import * as THREE from 'three';
import Detector from 'three/examples/js/Detector';
import pubsub from 'pubsub-js';
import PropTypes from 'prop-types';
import TWEEN from '@tweenjs/tween.js';
import PrintableArea from './PrintableArea';
import MSRControls from '../../components/three-extensions/MSRControls';
import TransformControls from '../../components/three-extensions/TransformControls';
import IntersectDetector from '../../components/three-extensions/IntersectDetector';
import {
    ACTION_CANVAS_OPERATION,
    ACTION_MODEL_TRANSFORM,
    ACTION_MODEL_AFTER_TRANSFORM,
    ACTION_MODEL_SELECTED
} from '../../constants';

const ANIMATION_DURATION = 300;
const DEFAULT_GROUP_POSITION = new THREE.Vector3(0, 0, 0);
const DEFAULT_SETTING_3DP = {
    cameraPosition: new THREE.Vector3(0, 0, 300),
    printableAreaPosition: new THREE.Vector3(0, 0, 0)
};
const DEFAULT_SETTING_OTHERS = {
    cameraPosition: new THREE.Vector3(10, 10, 70),
    printableAreaPosition: new THREE.Vector3(0, 0, 0)
};


class Canvas extends Component {
    static propTypes = {
        mode: PropTypes.string.isRequired,
        modelGroup: PropTypes.object.isRequired,
        gcodeLineGroup: PropTypes.object,
        transformMode: PropTypes.string
    };
    // DOM node
    node = null;

    // controls
    msrControls = null; // pan/scale/rotate print area
    transformControls = null; // pan/scale/rotate selected model
    intersectDetector = null; // detect the intersected model with mouse

    controlMode = 'none'; // determine which controls is in using. none/transform/msr/detect

    // from props
    mode = null;
    modelGroup = null;
    gcodeLineGroup = null;
    transformMode = null; // transformControls mode: translate/scale/rotate

    // threejs
    camera = null;
    renderer = null;
    scene = null;
    group = null;
    printableArea = null;

    subscriptions = [];

    publishes = {
        modelTransforming: () => {
            pubsub.publish(ACTION_MODEL_TRANSFORM, { mode: this.mode });
        },
        modelTransformEnd: () => {
            pubsub.publish(ACTION_MODEL_AFTER_TRANSFORM, { mode: this.mode });
        },
        selectModel: (model) => {
            pubsub.publish(ACTION_MODEL_SELECTED, { mode: this.mode, model: model });
        }
    };

    constructor(props) {
        super(props);

        this.mode = this.props.mode;
        this.modelGroup = this.props.modelGroup;
        this.gcodeLineGroup = this.props.gcodeLineGroup;
        this.transformMode = this.props.transformMode;
    }

    componentDidMount() {
        this.setupThreejs(this.mode);
        this.setupControls(this.mode);

        this.addModelGroup(this.mode);
        this.addGcodeLineGroup();

        // set position
        this.group.position.copy(DEFAULT_GROUP_POSITION);
        if (this.mode === '3dp') {
            this.camera.position.copy(DEFAULT_SETTING_3DP.cameraPosition);
            this.printableArea.position.copy(DEFAULT_SETTING_3DP.printableAreaPosition);
        } else {
            this.camera.position.copy(DEFAULT_SETTING_OTHERS.cameraPosition);
            this.printableArea.position.copy(DEFAULT_SETTING_OTHERS.printableAreaPosition);
        }

        this.start();
        this.subscribe();

        window.addEventListener('hashchange', this.onHashChange, false);
        window.addEventListener('resize', this.onWindowResize, false);
    }

    componentWillUnmount() {
        this.unsubscribe();
        this.msrControls.dispose();
        this.transformControls.dispose();
        this.intersectDetector.dispose();
    }

    componentWillReceiveProps(nextProps) {
        if (this.mode === '3dp') {
            const nextModelGroup = nextProps.modelGroup;
            if (nextModelGroup) {
                if (!this.transformControls.enabled) {
                    this.transformControls.enabled = true;
                }
                if (!nextModelGroup.getSelectedModel()) {
                    this.transformControls.detach();
                }
            } else {
                if (this.transformControls.enabled) {
                    this.transformControls.enabled = false;
                }
                this.transformControls.enabled = false;
                this.transformControls.detach();
            }
            if (nextProps.transformMode !== this.transformMode) {
                this.transformControls.setMode(nextProps.transformMode);
            }
        }
    }

    addModelGroup(mode) {
        if (this.modelGroup) {
            this.group.add(this.modelGroup);
            if (mode === '3dp') {
                // cling to bottom
                this.modelGroup.position.set(0, -125 / 2, 0);
            } else {
                this.modelGroup.position.set(0, 0, 0);
            }
        }
    }

    addGcodeLineGroup() {
        // add and cling to bottom
        if (this.gcodeLineGroup) {
            this.group.add(this.gcodeLineGroup);
            this.gcodeLineGroup.position.set(-125 / 2, -125 / 2, 125 / 2);
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
                            this.resetView(this.mode);
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
        let property = { z: this.camera.position.z };
        let target = { z: this.camera.position.z - 50 };
        let tween = new TWEEN.Tween(property).to(target, ANIMATION_DURATION);
        tween.onUpdate(() => {
            this.camera.position.z = property.z;
        });
        tween.start();
    }

    zoomOut() {
        let property = { z: this.camera.position.z };
        let target = { z: this.camera.position.z + 50 };
        let tween = new TWEEN.Tween(property).to(target, ANIMATION_DURATION);
        tween.onUpdate(() => {
            this.camera.position.z = property.z;
        });
        tween.start();
    }

    toLeft() {
        let delta = Math.PI / 2 + (this.group.rotation.y / (Math.PI / 2) - parseInt(this.group.rotation.y / (Math.PI / 2), 0)) * (Math.PI / 2);
        // handle precision of float
        delta = (delta < 0.01) ? (Math.PI / 2) : delta;
        let property = {
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
        let property = {
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
        let property = {
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

    resetView(mode) {
        let cameraZ = 0;
        if (mode === '3dp') {
            cameraZ = DEFAULT_SETTING_3DP.cameraPosition.z;
        } else {
            cameraZ = DEFAULT_SETTING_OTHERS.cameraPosition.z;
        }

        let property = {
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
            property4: DEFAULT_GROUP_POSITION.x,
            property5: DEFAULT_GROUP_POSITION.y,
            property6: DEFAULT_GROUP_POSITION.z,
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

    setupThreejs(mode) {
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

        this.printableArea = new PrintableArea(mode);
        this.group.add(this.printableArea);

        const element = ReactDOM.findDOMNode(this.node);
        element.appendChild(this.renderer.domElement);
    }

    setupControls(mode) {
        // add msrControls to all mode
        // add transformControls, intersectDetector only when mode is 3dp
        this.msrControls = new MSRControls(this.group, this.camera, this.renderer.domElement);
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

        if (this.mode === '3dp') {
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
                    this.msrControls.enabled = false;
                    this.controlMode = 'transform';
                }
            );
            // triggered when "mouse up on an axis"
            this.transformControls.addEventListener(
                'mouseUp',
                () => {
                    this.msrControls.enabled = true;
                    this.publishes.modelTransformEnd();
                }
            );
            // triggered when "transform model"
            this.transformControls.addEventListener(
                'objectChange', () => {
                    this.publishes.modelTransforming();
                }
            );
            this.scene.add(this.transformControls);

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
