import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import * as THREE from 'three';

const TWEEN = require('@tweenjs/tween.js');


class Canvas extends Component {
    // visualizer DOM node
    node = null;

    constructor(props) {
        super(props);

        this.animate = this.animate.bind(this);
    }

    componentDidMount() {
        this.createRenderer();
        this.createScene();

        this.start();
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
        console.info('width, height = ', width, height);

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
        this.addCubeToSceneAtZeroPoint();

        this.print3dGcodeLoader = new THREE.Print3dGcodeLoader();
        this.msrControls = undefined;
        // this.addControls();

        this.undoMatrix4Array = [];
        this.redoMatrix4Array = [];
        //config
        // this.configManager = new Print3dConfigManager();
        // this.configBeanArr = undefined;
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

    addCubeToSceneAtZeroPoint() {
        var boxGeometry = new THREE.BoxGeometry(5, 5, 5);
        for (var i = 0; i < boxGeometry.faces.length; i += 2) {
            var hex = Math.random() * 0xffffff;
            boxGeometry.faces[i].color.setHex(hex);
            boxGeometry.faces[i + 1].color.setHex(hex);
        }
        var material = new THREE.MeshBasicMaterial({ vertexColors: THREE.FaceColors, overdraw: 0.5 });
        let mCube = new THREE.Mesh(boxGeometry, material);
        mCube.position.set(-125 / 2, -125 / 2, 125 / 2);
        mCube.name = 'mCube';
        this.scene.add(mCube);
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
