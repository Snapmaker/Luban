import React, { Component } from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import * as THREE from 'three';
import pubsub from 'pubsub-js';
import {
    STAGE_IDLE,
    STAGE_IMAGE_LOADED,
    STAGE_GENERATED,
    ACTION_CHANGE_STAGE_3DP,
    ACTION_3DP_MODEL_VIEW,
    ACTION_3DP_HIDDEN_OPERATION_PANELS
} from '../../constants';
import MSRControls from './MSRControls';

const TWEEN = require('@tweenjs/tween.js');

const ANIMATION_DURATION = 300;
const CAMERA_POSITION_INITIAL_Z = 300;
const GROUP_POSITION_INITIAL = new THREE.Vector3(0, 0, 0);
const GROUP_ROTATION_INITIAL = new THREE.Vector3(Math.PI * (30 / 180), -Math.PI * (30 / 180), 0);

class Canvas extends Component {
    static propTypes = {
        state: PropTypes.object.isRequired
    };

    // visualizer DOM node
    node = null;

    state = {
        stage: STAGE_IDLE
    };

    subscriptions = [];

    constructor(props) {
        super(props);

        this.animate = this.animate.bind(this);
    }

    componentDidMount() {
        this.createRenderer();
        this.createScene();

        this.start();

        this.subscribe();

        this.addMouseDownListener();
    }

    componentWillUnmount() {
        this.unsubscribe();
    }

    subscribe() {
        this.subscriptions = [
            pubsub.subscribe(ACTION_CHANGE_STAGE_3DP, (msg, state) => {
                this.setState(state);
                if (state.stage === STAGE_IMAGE_LOADED) {
                    if (this.modelGroup.getObjectByName('modelMesh')) {
                        this.modelGroup.remove(this.modelGroup.getObjectByName('modelMesh'));
                    }
                    this.modelGroup.add(this.props.state.modelMesh);
                } else if (state.stage === STAGE_GENERATED) {
                    if (this.gcodeGroup.getObjectByName('gcodeRenderedObject')) {
                        this.gcodeGroup.remove(this.gcodeGroup.getObjectByName('gcodeRenderedObject'));
                    }
                    this.gcodeGroup.add(this.props.state.gcodeRenderedObject);
                }
            }),
            pubsub.subscribe(ACTION_3DP_MODEL_VIEW, (msg, data) => {
                switch (data) {
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
                default:
                    break;
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

    zoomIn = () => {
        if (this.camera.position.z <= 70) {
            return;
        }
        let property = { z: this.camera.position.z };
        let target = { z: this.camera.position.z - 100 };
        let tween = new TWEEN.Tween(property).to(target, ANIMATION_DURATION);
        tween.onUpdate(() => {
            this.camera.position.z = property.z;
        });
        tween.start();
    };

    zoomOut = () => {
        if (this.camera.position.z >= 600) {
            return;
        }
        let property = { z: this.camera.position.z };
        let target = { z: this.camera.position.z + 100 };
        let tween = new TWEEN.Tween(property).to(target, ANIMATION_DURATION);
        tween.onUpdate(() => {
            this.camera.position.z = property.z;
        });
        tween.start();
    };

    toLeft = () => {
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
    };

    toRight = () => {
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
    };

    toTop = () => {
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
    };

    toBottom = () => {
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
    };

    resetView = () => {
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
            property4: GROUP_POSITION_INITIAL.x,
            property5: GROUP_POSITION_INITIAL.y,
            property6: GROUP_POSITION_INITIAL.z,
            property7: CAMERA_POSITION_INITIAL_Z
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
    };

    getVisibleWidth() {
        const element = ReactDOM.findDOMNode(this.node);
        return element.parentNode.clientWidth;
    }

    getVisibleHeight() {
        const element = ReactDOM.findDOMNode(this.node);
        return element.parentNode.clientHeight;
    }

    createRenderer() {
        const width = this.getVisibleWidth();
        const height = this.getVisibleHeight();

        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
        this.camera.position.set(0, 0, CAMERA_POSITION_INITIAL_Z);
        this.camera.lookAt(new THREE.Vector3(0, 0, 0));

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setClearColor(new THREE.Color(0xe8e8e8), 1);
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;
    }

    createScene() {
        this.scene = new THREE.Scene();
        this.scene.add(this.camera);

        this.group = new THREE.Group();

        this.modelGroup = new THREE.Group();
        this.modelGroup.position.set(0, -125 / 2, 0);
        this.group.add(this.modelGroup);

        this.gcodeGroup = new THREE.Group();
        this.gcodeGroup.position.set(-125 / 2, -125 / 2, 125 / 2);
        this.group.add(this.gcodeGroup);
        this.group.position.set(GROUP_POSITION_INITIAL.x, GROUP_POSITION_INITIAL.y, GROUP_POSITION_INITIAL.z);
        this.group.rotation.set(GROUP_ROTATION_INITIAL.x, GROUP_ROTATION_INITIAL.y, GROUP_ROTATION_INITIAL.z);
        this.scene.add(this.group);

        this.scene.add(new THREE.HemisphereLight(0x000000, 0xe0e0e0));

        const element = ReactDOM.findDOMNode(this.node);
        element.appendChild(this.renderer.domElement);

        this.addEmptyPrintSpaceToGroup();

        this.msrControls = undefined;
        this.addMSRControls();

        window.addEventListener('hashchange', this.onHashChange, false);
        window.addEventListener('resize', this.onWindowResize, false);
    }

    // fix a bug: Canvas is not visible when first load url is other hash (like #/worspace)
    // getVisibleWidth() and getVisibleHeight() both return 0
    // because <div style={{ display: hidden ? 'none' : 'block' }}>
    onHashChange = (event) => {
        if (event.newURL.endsWith('#/3dp')) {
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

    addMSRControls = () => {
        this.msrControls = new MSRControls(this.group, this.camera, this.renderer.domElement);
    };

    addEmptyPrintSpaceToGroup() {
        // add 6 sides(GridHelper) of print space
        let size = 125;
        let divisions = 1;

        let bottom = new THREE.GridHelper(size, divisions * 10);
        bottom.position.set(0, -size / 2, 0);
        bottom.material.opacity = 0.25;
        bottom.material.transparent = true;
        this.group.add(bottom);

        let top = new THREE.GridHelper(size, divisions);
        top.position.set(0, size / 2, 0);
        this.group.add(top);

        let left = new THREE.GridHelper(size, divisions);
        left.rotateZ(Math.PI / 2);
        left.position.set(-size / 2, 0, 0);
        this.group.add(left);

        let right = new THREE.GridHelper(size, divisions);
        right.rotateZ(Math.PI / 2);
        right.position.set(size / 2, 0, 0);
        this.group.add(right);

        let front = new THREE.GridHelper(size, divisions);
        front.rotateX(Math.PI / 2);
        front.position.set(0, 0, size / 2);
        this.group.add(front);

        let back = new THREE.GridHelper(size, divisions);
        back.rotateX(Math.PI / 2);
        back.position.set(0, 0, -size / 2);
        this.group.add(back);

        for (let k = 0; k < this.group.children.length; k += 1) {
            if (this.group.children[k] instanceof THREE.GridHelper) {
                this.group.children[k].material.opacity = 0.25;
                this.group.children[k].material.transparent = true;
            }
        }
        // const axis = new THREE.AxesHelper(50);
        // axis.position.set(0, 0, 0);
        // this.group.add(axis);

        // add logo
        const geometry = new THREE.PlaneGeometry(73.5, 16);
        const texture = THREE.ImageUtils.loadTexture('./images/snapmaker-logo-588x128.png');
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
            opacity: 0.75,
            transparent: true
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotateX(-Math.PI / 2);
        mesh.position.set(0, -size / 2, size / 4);
        this.group.add(mesh);
    }

    start() {
        if (!this.frameId) {
            this.frameId = requestAnimationFrame(this.animate);
        }
    }

    stop() {
        cancelAnimationFrame(this.frameId);
    }

    animate() {
        this.renderScene();
        this.frameId = window.requestAnimationFrame(this.animate);
        TWEEN.update();
    }

    renderScene() {
        this.renderer.render(this.scene, this.camera);
    }

    addMouseDownListener = () => {
        this.renderer.domElement.addEventListener('mousedown', () => {
            pubsub.publish(ACTION_3DP_HIDDEN_OPERATION_PANELS);
        });
    };

    render() {
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
