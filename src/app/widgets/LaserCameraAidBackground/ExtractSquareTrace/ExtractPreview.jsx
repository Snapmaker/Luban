import React, { Component } from 'react';
import PropTypes from 'prop-types';
// import * as THREE from 'three';
// import Detector from 'three/examples/js/Detector';
import { DATA_PREFIX } from '../../../constants';
// import api from '../../../api';
import styles from '../styles.styl';
// import ExtractControls from '../../../components/three-extensions/ExtractControls';
// import RectangleGridHelper from '../../../components/three-extensions/RectangleGridHelper';


class ExtractPreview extends Component {
    static propTypes = {
        width: PropTypes.number.isRequired,
        height: PropTypes.number.isRequired,
        size: PropTypes.object.isRequired
    };

    state = {
    };

    // DOM node
    node = React.createRef();

    constructor(props) {
        super(props);
        this.renderer = null;
    }

    componentDidMount() {
        this.setupThreejs();
        // this.setupExtractControls();
        // this.setupPlate();
        // this.animate();
    }

    componentWillUnmount() {
        // cancelAnimationFrame(this.frameId);
    }

    onChangeImage(filename, width, height) {
        const { size } = this.props;
        console.log(size, DATA_PREFIX);
        console.log(filename, width, height);
        const imgPath = `${DATA_PREFIX}/${filename}`;
        this.renderer.src = imgPath;
        // this.extractControls.resetCornerPositions();
        // this.extractControls.visible = true;
        // this.plateGroup.visible = true;
        // this.photoMesh && this.group.remove(this.photoMesh);
        // this.backgroundMesh && this.group.remove(this.backgroundMesh);
        //
        // let photoDisplayedWidth = width, photoDisplayedHeight = height;
        // if (width * size.y > height * size.x && width > size.x) {
        //     photoDisplayedWidth = size.x;
        //     photoDisplayedHeight = size.x * height / width;
        // } else if (width * size.y < height * size.x && height > size.y) {
        //     photoDisplayedWidth = size.y * width / height;
        //     photoDisplayedHeight = size.y;
        // }
        // const imgPath = `${DATA_PREFIX}/${filename}`;
        // const texture = new THREE.TextureLoader().load(imgPath);
        // const material = new THREE.MeshBasicMaterial({
        //     color: 0xffffff,
        //     transparent: true,
        //     opacity: 1,
        //     map: texture
        // });
        // const geometry = new THREE.PlaneGeometry(photoDisplayedWidth, photoDisplayedHeight);
        // this.photoMesh = new THREE.Mesh(geometry, material);
        // this.photoMesh.position.set(0, 0, 0);
        // this.group.add(this.photoMesh);
    }

    setupThreejs() {
        const { width, height } = this.props;

        // this.camera = new THREE.PerspectiveCamera(90, width / height, 0.1, 10000);
        // this.camera.position.set(0, 0, Math.max(this.props.size.x, this.props.size.y) * 0.5);
        // this.camera.lookAt(new THREE.Vector3(0, 0, 0));

        // this.renderer = new THREE.WebGLRenderer({ antialias: true });
        // this.renderer.setClearColor(new THREE.Color(0xfafafa), 1);
        // this.renderer.setSize(width, height);

        //
        // this.scene = new THREE.Scene();
        // this.scene.add(this.camera);
        //
        // this.group = new THREE.Group();
        // this.scene.add(this.group);
        //
        // this.scene.add(new THREE.HemisphereLight(0x000000, 0xe0e0e0));
        this.renderer = new Image();
        this.renderer.width = width;
        this.renderer.height = height;

        this.node.current.appendChild(this.renderer);
    }

    render() {
        // if (!Detector.webgl) {
        //     return null;
        // }
        return (
            <div ref={this.node} className={styles['laser-extract-previous']} />
        );
    }
}

export default ExtractPreview;
