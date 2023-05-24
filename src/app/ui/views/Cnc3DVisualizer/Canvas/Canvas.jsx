import React, { Component } from 'react';
import { Vector3, Matrix4, Color, PerspectiveCamera, Scene, Group, DirectionalLight, HemisphereLight } from 'three';
import PropTypes from 'prop-types';
import TWEEN from '@tweenjs/tween.js';

import Controls from './Controls';
import Detector from '../../../../scene/three-extensions/Detector';
import WebGLRendererWrapper from '../../../../scene/three-extensions/WebGLRendererWrapper';

const ANIMATION_DURATION = 500;
const DEFAULT_MODEL_POSITION = new Vector3(0, 0, 0);


class Canvas extends Component {
    node = React.createRef();

    static propTypes = {

        mesh: PropTypes.object.isRequired,
        environment: PropTypes.object,
        worldTransform: PropTypes.object,
        cameraInitialPosition: PropTypes.object,
        visible: PropTypes.bool

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
        this.renderer = new WebGLRendererWrapper({ antialias: true });

        this.controls = new Controls(this.camera, this.group, this.renderer.domElement);
    }

    componentDidMount() {
        this.setupScene();
        this.group.add(this.props.visible ? this.props.mesh : null);
        if (this.props.environment) {
            this.group.add(this.props.environment);
        }
        if (this.props.worldTransform) {
            this.group.applyMatrix4(this.props.worldTransform);
        }

        this.setupControls();

        this.renderScene();
        // window.addEventListener('resize', this.resizeWindow, false);
    }

    // componentWillReceiveProps(nextProps) {
    //     if (nextProps.mesh !== this.props.mesh) {
    //         this.group.add(nextProps.mesh);
    //         this.renderScene();
    //     }
    //     if (nextProps.environment !== this.props.environment) {
    //         this.group.remove(this.props.environment);
    //         this.group.add(nextProps.environment);
    //         this.renderScene();
    //     }
    //     if (nextProps.cameraInitialPosition !== this.props.cameraInitialPosition) {
    //         this.setCamera(nextProps.cameraInitialPosition, this.initialTarget);
    //         this.renderScene();
    //     }
    //     if (nextProps.worldTransform !== this.props.worldTransform) {
    //         this.group.applyMatrix(new Matrix4().getInverse(this.group.matrix));
    //         if (nextProps.worldTransform) {
    //             this.group.applyMatrix(nextProps.worldTransform);
    //         }

    //         this.renderScene();
    //     }
    // }
    componentDidUpdate() {

    }

    componentWillUnmount() {
        if (this.controls) {
            this.controls.dispose();
        }

        this.transformControls && this.transformControls.dispose();

        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }
    }

    getSnapshotBeforeUpdate(prevProps) {
        if (prevProps.mesh !== this.props.mesh || prevProps.visible !== this.props.visible) {
            if (this.props.visible) {
                this.group.add(this.props.mesh);
            } else {
                this.group.remove(prevProps.mesh);
            }
            this.renderScene();
        }
        if (prevProps.environment !== this.props.environment) {
            this.group.remove(prevProps.environment);
            this.group.add(this.props.environment);
            this.renderScene();
        }
        if (prevProps.cameraInitialPosition !== this.props.cameraInitialPosition) {
            this.setCamera(this.props.cameraInitialPosition, this.initialTarget);
            this.renderScene();
        }
        if (prevProps.worldTransform !== this.props.worldTransform) {
            this.group.applyMatrix4(new Matrix4().copy(this.group.matrix).invert());
            if (this.props.worldTransform) {
                this.group.applyMatrix4(this.props.worldTransform);
            }

            this.renderScene();
        }
        return prevProps;
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
        this.setCamera(this.props.cameraInitialPosition || new Vector3(0, 0, 0), this.initialTarget);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setClearColor(new Color(0xffffff), 1);
        this.renderer.setSize(width, height);

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
        if (!Detector.isWebGLAvailable()) {
            return null;
        }
        return (
            <div
                ref={this.node}
            />
        );
    }
}

export default Canvas;
