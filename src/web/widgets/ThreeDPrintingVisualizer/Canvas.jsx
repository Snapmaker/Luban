import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import * as THREE from 'three';
import pubsub from 'pubsub-js';
import 'imports-loader?THREE=three!./MSRControls';
import { ACTION_CHANGE_CAMERA_ANIMATION } from '../../constants';

const TWEEN = require('@tweenjs/tween.js');


class Canvas extends Component {
    // visualizer DOM node
    node = null;

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
    }

    componentWillUnmount() {
        this.unsubscribe();
    }

    subscribe() {
        this.subscriptions = [
            pubsub.subscribe(ACTION_CHANGE_CAMERA_ANIMATION, (msg, { property, target }) => {
                const tween = new TWEEN.Tween(property).to(target, 1000);
                tween.onUpdate(() => {
                    this.camera.position.z = property.z;
                });
                tween.start();
            })
        ];
    }

    unsubscribe() {
        this.subscriptions.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        this.subscriptions = [];
    }

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
        this.camera.position.set(0, 0, 550);
        this.camera.lookAt(new THREE.Vector3(0, 0, 0));

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setClearColor(new THREE.Color(0xe8e8e8), 1);
        this.renderer.setSize(width, height);
        this.renderer.shadowMapEnabled = true;
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

        this.scene.add(this.group);

        this.modelMaterial = new THREE.MeshPhongMaterial({ color: 0xe0e0e0, specular: 0xe0e0e0, shininess: 30 });
        this.scene.add(new THREE.HemisphereLight(0x000000, 0xe0e0e0));

        this.modelMesh = undefined;
        this.gcodeRenderedObject = undefined;

        const element = ReactDOM.findDOMNode(this.node);
        element.appendChild(this.renderer.domElement);

        this.addEmptyPrintSpaceToGroup();

        this.print3dGcodeLoader = new THREE.Print3dGcodeLoader();
        this.msrControls = undefined;
        this.addMSRControls();

        this.undoMatrix4Array = [];
        this.redoMatrix4Array = [];

        window.addEventListener('hashchange', this.onHashChange, false);
        window.addEventListener('resize', this.onWindowResize, false);
    }

    //fix a bug: Canvas is not visible when first load url is other hash (like #/worspace)
    //getVisibleWidth() and getVisibleHeight() both return 0
    //because <div style={{ display: hidden ? 'none' : 'block' }}>
    onHashChange = (event) => {
        if (event.newURL.endsWith('#/3dp')) {
            this.onWindowResize();
        }
    }

    onWindowResize = () => {
        const width = this.getVisibleWidth();
        const height = this.getVisibleHeight();
        if (width * height !== 0) {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        }
    }

    addMSRControls = () => {
        this.msrControls = new THREE.MSRControls(this.group, this.camera, this.renderer.domElement);
    }

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
        var axis = new THREE.AxesHelper(50);
        axis.position.set(0, 0, 0);
        this.group.add(axis);
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
