import React, { Component } from 'react';
import { Vector3, Matrix4, Color, PerspectiveCamera, Scene, Group, WebGLRenderer, DirectionalLight, HemisphereLight } from 'three';
import Detector from 'three/examples/js/Detector';
import PropTypes from 'prop-types';
import TWEEN from '@tweenjs/tween.js';

import Controls from './Controls';

const ANIMATION_DURATION = 500;
const DEFAULT_MODEL_POSITION = new Vector3(0, 0, 0);


class Canvas extends Component {
    node = React.createRef();

    static propTypes = {

        mesh: PropTypes.object.isRequired,
        environment: PropTypes.object,
        worldTransform: PropTypes.object,
        cameraInitialPosition: PropTypes.object

    };

    controls = null;

    animationCount = 0;

    frameId = 0;

    initialTarget = new Vector3();

    lastTarget = null;

    constructor(props) {
        super(props);

        this.cameraInitialTarget = new Vector3(0, 0, 0);
        this.group = new Group();
        this.camera = new PerspectiveCamera(45, 1, 0.1, 10000);
        this.camera.up = new Vector3(0, 0, 1);
        this.scene = new Scene();
        this.light = new DirectionalLight(0x666666, 1);
        // this.light = new HemisphereLight(0xffffff, 0xffffff);
        this.renderer = new WebGLRenderer({ antialias: true });

        this.controls = new Controls(this.camera, this.group, this.renderer.domElement);
    }

    componentDidMount() {
        this.setupScene();
        this.group.add(this.props.mesh);
        if (this.props.environment) {
            this.group.add(this.props.environment);
        }
        if (this.props.worldTransform) {
            this.group.applyMatrix(this.props.worldTransform);
        }

        this.setupControls();

        this.renderScene();
        window.addEventListener('resize', this.resizeWindow, false);
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.mesh !== this.props.mesh) {
            this.group.add(nextProps.mesh);
            this.renderScene();
        }
        if (nextProps.environment !== this.props.environment) {
            this.group.remove(this.props.environment);
            this.group.add(nextProps.environment);
            this.renderScene();
        }
        if (nextProps.cameraInitialPosition !== this.props.cameraInitialPosition) {
            this.setCamera(nextProps.cameraInitialPosition, this.initialTarget);
            this.renderScene();
        }
        if (nextProps.worldTransform !== this.props.worldTransform) {
            this.group.applyMatrix(new Matrix4().getInverse(this.group.matrix));
            if (nextProps.worldTransform) {
                this.group.applyMatrix(nextProps.worldTransform);
            }

            this.renderScene();
        }
    }

    componentWillUnmount() {
        if (this.controls) {
            this.controls.dispose();
        }

        this.transformControls && this.transformControls.dispose();
    }


    getVisibleWidth() {
        return this.node.current.parentElement.clientWidth;
    }

    getVisibleHeight() {
        return this.node.current.parentElement.clientHeight;
    }

    setupScene() {
        const width = 400;
        const height = 260;

        this.setCamera(this.props.cameraInitialPosition, this.initialTarget);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setClearColor(new Color(0xfafafa), 1);
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;

        this.scene.add(this.camera);
        this.scene.add(this.light);
        this.scene.add(new HemisphereLight(0x999999, 0x999999));


        this.group.position.copy(DEFAULT_MODEL_POSITION);
        this.scene.add(this.group);
        // this.scene.add(new HemisphereLight(0x000000, 0xcecece));

        this.node.current.appendChild(this.renderer.domElement);
    }

    setupControls() {
        this.controls.setTarget(this.initialTarget);

        this.controls.on('update', () => {
            this.renderScene();
        });
    }

    animation = () => {
        this.frameId = window.requestAnimationFrame(this.animation);

        this.renderScene();
    };

    setCamera = (position, target) => {
        this.camera.position.copy(position);
        this.controls.setTarget(target);
        this.renderScene();
    };


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


    enable3D() {
        this.controls.enableRotate = true;
    }

    disable3D() {
        this.controls.enableRotate = false;
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
