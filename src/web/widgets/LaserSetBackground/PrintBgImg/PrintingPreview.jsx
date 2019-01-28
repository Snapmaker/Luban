import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import * as THREE from 'three';
import Detector from 'three/examples/js/Detector';
import PropTypes from 'prop-types';


class PrintingPreview extends Component {
    static propTypes = {
        sideLength: PropTypes.number.isRequired
    };

    constructor(props) {
        super(props);

        // DOM node
        this.node = null;

        // threejs
        this.camera = null;
        this.renderer = null;
        this.scene = null;
        this.group = null;
        this.squareLine = null;
    }

    componentDidMount() {
        this.setupThreejs();
        this.setupSquare(this.props.sideLength);
        this.addGrid();
        this.animate();
    }

    componentWillReceiveProps(nextProps) {
        const { sideLength } = nextProps;
        sideLength && this.squareLine.scale.set(sideLength, sideLength, 1);
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
        const width = 400, height = 400;

        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
        this.camera.position.set(0, 0, 170);
        this.camera.lookAt(new THREE.Vector3(0, 0, 0));

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setClearColor(new THREE.Color(0xfafafa), 1);
        this.renderer.setSize(width, height);

        this.scene = new THREE.Scene();
        this.scene.add(this.camera);

        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.scene.add(new THREE.HemisphereLight(0x000000, 0xe0e0e0));

        const element = ReactDOM.findDOMNode(this.node);
        element.appendChild(this.renderer.domElement);
    }

    setupSquare(squareSideLength) {
        const material = new THREE.LineBasicMaterial({ color: 0x000000 });
        const geometry = new THREE.Geometry();
        geometry.vertices.push(new THREE.Vector3(0.5, 0.5, 0));
        geometry.vertices.push(new THREE.Vector3(-0.5, 0.5, 0));
        geometry.vertices.push(new THREE.Vector3(-0.5, -0.5, 0));
        geometry.vertices.push(new THREE.Vector3(0.5, -0.5, 0));
        geometry.vertices.push(new THREE.Vector3(0.5, 0.5, 0));
        this.squareLine = new THREE.Line(geometry, material);
        this.squareLine.scale.set(squareSideLength, squareSideLength, 1);
        this.group.add(this.squareLine);
    }

    addGrid() {
        const size = 125;
        const divisions = 1;

        const grid = new THREE.GridHelper(size, divisions * 10);
        grid.material.opacity = 0.25;
        grid.material.transparent = true;
        grid.rotateX(Math.PI / 2);
        this.group.add(grid);

        // add logo
        const geometry = new THREE.PlaneGeometry(size / 2, size / 8);
        const texture = new THREE.TextureLoader().load('./images/snapmaker-logo-512x128.png');
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
            opacity: 0.75,
            transparent: true
        });
        const mesh = new THREE.Mesh(geometry, material);
        this.group.add(mesh);
    }

    animate = () => {
        this.renderScene();
        this.frameId = window.requestAnimationFrame(this.animate);
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

export default PrintingPreview;
