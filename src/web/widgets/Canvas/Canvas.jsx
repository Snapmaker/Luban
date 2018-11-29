import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import * as THREE from 'three';
import Detector from 'three/examples/js/Detector';
import PropTypes from 'prop-types';
import TWEEN from '@tweenjs/tween.js';
import MSRControls from '../../components/three-extensions/MSRControls';
import TransformControls from '../../components/three-extensions/TransformControls';
import IntersectDetector from '../../components/three-extensions/IntersectDetector';

const ANIMATION_DURATION = 300;
const ORIGIN_GROUP_POSITION = new THREE.Vector3(0, 0, 0);


class Canvas extends Component {
    static propTypes = {
        modelGroup: PropTypes.object.isRequired,
        printableArea: PropTypes.object.isRequired,
        enabledTransformModel: PropTypes.bool.isRequired,
        gcodeLineGroup: PropTypes.object,
        cameraZ: PropTypes.number.isRequired
    };

    constructor(props) {
        super(props);

        // frozen
        this.printableArea = this.props.printableArea;
        this.modelGroup = this.props.modelGroup;
        this.enabledTransformModel = this.props.enabledTransformModel;
        this.gcodeLineGroup = this.props.gcodeLineGroup;
        this.cameraZ = this.props.cameraZ;

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

        if (this.modelGroup.addChangeListener) {
            this.modelGroup.addChangeListener((args) => {
                const selectedModel = args.selected.model;
                if (!selectedModel) {
                    this.transformControls && this.transformControls.detach();
                }
            });
        }
    }

    componentDidMount() {
        this.setupThreejs();
        this.setupControls();

        this.group.add(this.printableArea);
        this.group.add(this.modelGroup);
        if (this.gcodeLineGroup) {
            this.group.add(this.gcodeLineGroup);
        }

        this.group.position.copy(ORIGIN_GROUP_POSITION);
        this.camera.position.copy(new THREE.Vector3(0, 0, this.cameraZ));

        this.start();

        window.addEventListener('resize', this.resizeWindow, false);
    }

    componentWillUnmount() {
        this.msrControls && this.msrControls.dispose();
        this.transformControls && this.transformControls.dispose();
        this.intersectDetector && this.intersectDetector.dispose();
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
            property7: this.camera.position.z
        };

        const target = {
            property1: 0,
            property2: 0,
            property3: 0,
            property4: ORIGIN_GROUP_POSITION.x,
            property5: ORIGIN_GROUP_POSITION.y,
            property6: ORIGIN_GROUP_POSITION.z,
            property7: this.cameraZ
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
                            this.modelGroup.unselectAllModels && this.modelGroup.unselectAllModels();
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

        if (this.enabledTransformModel) {
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
                    this.modelGroup.onModelAfterTransform && this.modelGroup.onModelAfterTransform();
                }
            );
            // triggered when "transform model"
            this.transformControls.addEventListener(
                'objectChange', () => {
                    this.modelGroup.onModelTransform && this.modelGroup.onModelTransform();
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
                    this.modelGroup.selectModel && this.modelGroup.selectModel(modelMesh);
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
        // reset
        this.group.rotation.copy(new THREE.Euler());
        this.group.position.copy(ORIGIN_GROUP_POSITION);
        this.group.updateMatrixWorld(true); // must call before computing model bbox
        this.camera.position.z = this.cameraZ;

        if (model) {
            // calculate center position in world
            const bbox = new THREE.Box3().setFromObject(model); // in world
            const centerX = bbox.min.x + (bbox.max.x - bbox.min.x) / 2;
            const centerY = bbox.min.y + (bbox.max.y - bbox.min.y) / 2;

            // calculate camera z
            // todo: find better way
            const lengthX = bbox.max.x - bbox.min.x;
            const lengthY = bbox.max.y - bbox.min.y;
            const z = 100 + Math.max(lengthX, lengthY);
            this.camera.position.z = z;

            const posWorld = new THREE.Vector3(centerX, centerY, 0).multiplyScalar(-1);
            this.group.position.copy(posWorld);
        }
    }

    enabled3D() {
        this.msrControls.enabledRotate = true;
    }

    disabled3D() {
        this.msrControls.enabledRotate = false;
    }

    setTransformMode(value) {
        if (['translate', 'scale', 'rotate'].includes(value)) {
            this.transformControls && this.transformControls.setMode(value);
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
