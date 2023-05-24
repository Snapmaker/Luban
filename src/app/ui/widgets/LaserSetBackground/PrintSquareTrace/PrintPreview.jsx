import React, { Component } from 'react';
import PropTypes from 'prop-types';
import * as THREE from 'three';
import RectangleGridHelper from '../../../../scene/objects/RectangleGridHelper';
import WebGLRendererWrapper from '../../../../scene/three-extensions/WebGLRendererWrapper';
import Detector from '../../../../scene/three-extensions/Detector';
import { DEFAULT_LUBAN_HOST } from '../../../../constants';

class PrintPreview extends Component {
    static propTypes = {
        size: PropTypes.object.isRequired,
        width: PropTypes.number.isRequired,
        height: PropTypes.number.isRequired,
        sideLength: PropTypes.number.isRequired
    };

    node = React.createRef();

    constructor(props) {
        super(props);

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

    componentWillUnmount() {
        cancelAnimationFrame(this.frameId);

        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }
    }

    setupThreejs() {
        const { width, height } = this.props;

        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
        this.camera.position.set(0, 0, 170);
        this.camera.lookAt(new THREE.Vector3(0, 0, 0));

        this.renderer = new WebGLRendererWrapper({ antialias: true });
        this.renderer.setClearColor(new THREE.Color(0xfafafa), 1);
        this.renderer.setSize(width, height);

        this.scene = new THREE.Scene();
        this.scene.add(this.camera);

        this.group = new THREE.Group();
        this.scene.add(this.group);

        // this.scene.add(new THREE.HemisphereLight(0x000000, 0xe0e0e0));

        const element = this.node.current;
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

    animate = () => {
        this.renderScene();
        this.frameId = requestAnimationFrame(this.animate);
    };

    addGrid() {
        const { size } = this.props;

        const grid = new RectangleGridHelper(size.x, size.y, 10);
        grid.material.opacity = 0.25;
        grid.material.transparent = true;
        grid.rotateX(Math.PI / 2);
        this.group.add(grid);

        // add logo
        const minSideLength = Math.min(size.x, size.y);
        const geometry = new THREE.PlaneGeometry(minSideLength / 2, minSideLength / 8);
        const texture = new THREE.TextureLoader().load(`${DEFAULT_LUBAN_HOST}/resources/images/snapmaker-logo-512x128.png`);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
            opacity: 0.75,
            transparent: true
        });
        const mesh = new THREE.Mesh(geometry, material);
        this.group.add(mesh);
    }

    renderScene() {
        this.renderer.render(this.scene, this.camera);
    }

    render() {
        if (!Detector.isWebGLAvailable()) {
            return null;
        }
        return (
            <div ref={this.node} style={{ width: this.props.width, margin: '0 auto' }} />
        );
    }
}

export default PrintPreview;
