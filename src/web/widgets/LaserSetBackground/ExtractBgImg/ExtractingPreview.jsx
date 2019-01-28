import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import * as THREE from 'three';
import Detector from 'three/examples/js/Detector';
import { WEB_CACHE_IMAGE } from '../../../constants';
import api from '../../../api';
import ExtractControls from '../../../components/three-extensions/ExtractControls';

const DISPLAYED_PLANE_SIZE = 125;

class ExtractingPreview extends Component {
    state = {
        photoOriginWidth: 0,
        photoOriginHeight: 0,
        photoDisplayedWidth: 0,
        photoDisplayedHeight: 0,
        photoFilename: ''
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
        this.plateGroup = null;
        this.extractControls = null; // todo
        this.photoMesh = null;
        this.bgImgMesh = null;
    }

    componentDidMount() {
        this.setupThreejs();
        this.setupExtractControls();
        this.setupPlate();
        this.animate();
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
        // const width = this.getVisibleWidth();
        // const height = this.getVisibleHeight();
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

    setupExtractControls() {
        this.extractControls = new ExtractControls(this.camera, this.renderer.domElement);
        this.extractControls.visible = false;
        this.scene.add(this.extractControls);
    }

    uploadPhoto(file) {
        const formData = new FormData();
        formData.append('image', file);
        api.uploadImage(formData)
            .then((res) => {
                this.extractControls.resetCornerPositions();
                this.extractControls.visible = true;
                this.plateGroup.visible = true;
                this.photoMesh && this.group.remove(this.photoMesh);
                this.bgImgMesh && this.group.remove(this.bgImgMesh);

                const { width, height, filename } = res.body;
                let photoDisplayedWidth = width, photoDisplayedHeight = height;
                const ratio = height / width;
                if (width > height && width > DISPLAYED_PLANE_SIZE) {
                    photoDisplayedWidth = DISPLAYED_PLANE_SIZE;
                    photoDisplayedHeight = DISPLAYED_PLANE_SIZE * ratio;
                } else if (width < height && height > DISPLAYED_PLANE_SIZE) {
                    photoDisplayedWidth = DISPLAYED_PLANE_SIZE / ratio;
                    photoDisplayedHeight = DISPLAYED_PLANE_SIZE;
                }

                const imgPath = `${WEB_CACHE_IMAGE}/${filename}`;
                const texture = new THREE.TextureLoader().load(imgPath);
                const material = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 1,
                    map: texture
                });
                const geometry = new THREE.PlaneGeometry(photoDisplayedWidth, photoDisplayedHeight);
                const offsetX = (DISPLAYED_PLANE_SIZE - photoDisplayedWidth) / 2;
                const offsetY = (DISPLAYED_PLANE_SIZE - photoDisplayedHeight) / 2;
                this.photoMesh = new THREE.Mesh(geometry, material);
                this.photoMesh.position.set(-offsetX, -offsetY, 0);
                this.group.add(this.photoMesh);

                this.setState({
                    photoFilename: filename,
                    photoOriginWidth: width,
                    photoOriginHeight: height,
                    photoDisplayedWidth: photoDisplayedWidth,
                    photoDisplayedHeight: photoDisplayedHeight
                });
            })
            .catch(() => {
                // onFailure && onFailure();
            });
    }

    reset() {
        this.bgImgMesh && this.group.remove(this.bgImgMesh);
        this.photoMesh.visible = true;
        this.extractControls.visible = true;
        this.plateGroup.visible = false;
    }

    // extract bgImg from photo
    extract(sideLength, callback) {
        const positions = this.extractControls.getCornerPositions();
        const { leftTop, leftBottom, rightBottom, rightTop } = positions;
        const { photoFilename, photoOriginWidth, photoOriginHeight, photoDisplayedWidth } = this.state;
        leftTop.x += DISPLAYED_PLANE_SIZE / 2;
        leftTop.y += DISPLAYED_PLANE_SIZE / 2;

        leftBottom.x += DISPLAYED_PLANE_SIZE / 2;
        leftBottom.y += DISPLAYED_PLANE_SIZE / 2;

        rightBottom.x += DISPLAYED_PLANE_SIZE / 2;
        rightBottom.y += DISPLAYED_PLANE_SIZE / 2;

        rightTop.x += DISPLAYED_PLANE_SIZE / 2;
        rightTop.y += DISPLAYED_PLANE_SIZE / 2;

        const options = {
            height: photoOriginHeight,
            image: photoFilename,
            mm2pixelRatio: photoDisplayedWidth / photoOriginWidth,
            targetWidth: sideLength,
            targetHeight: sideLength,
            p0: leftBottom,
            p1: rightBottom,
            p2: rightTop,
            p3: leftTop
        };
        api.stockRemapProcess(options)
            .then((res) => {
                const { filename } = res.body;
                callback(filename);

                this.plateGroup.visible = true;
                this.photoMesh.visible = false;
                this.extractControls.visible = false;
                this.bgImgMesh && this.group.remove(this.bgImgMesh);

                const imgPath = `${WEB_CACHE_IMAGE}/${filename}`;
                const texture = new THREE.TextureLoader().load(imgPath);
                const material = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.6,
                    map: texture
                });
                const geometry = new THREE.PlaneGeometry(sideLength, sideLength);
                this.bgImgMesh = new THREE.Mesh(geometry, material);
                this.group.add(this.bgImgMesh);
            });
    }

    setupPlate() {
        this.plateGroup = new THREE.Group();
        this.plateGroup.visible = false;
        this.group.add(this.plateGroup);

        const size = DISPLAYED_PLANE_SIZE;
        const divisions = 1;
        const grid = new THREE.GridHelper(size, divisions * 10);
        grid.material.opacity = 0.25;
        grid.material.transparent = true;
        grid.rotateX(Math.PI / 2);
        this.plateGroup.add(grid);

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
        this.plateGroup.add(mesh);
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

export default ExtractingPreview;

