import React, { Component } from 'react';
import PropTypes from 'prop-types';
import * as THREE from 'three';
import Detector from 'three/examples/js/Detector';
import { DATA_PREFIX } from '../../../constants';
import ManualCalibrationControls from '../../../components/three-extensions/ManualCalibrationControls';
import RectangleGridHelper from '../../../components/three-extensions/RectangleGridHelper';


class ManualCalibration extends Component {
    static propTypes = {
        width: PropTypes.number.isRequired,
        height: PropTypes.number.isRequired,
        getPoints: PropTypes.array.isRequired,
        updateAffinePoints: PropTypes.func.isRequired
    };

    state = {
        photoFilename: ''
    };

    // DOM node
    node = React.createRef();

    constructor(props) {
        super(props);

        // threejs
        this.camera = null;
        this.renderer = null;
        this.scene = null;
        this.group = null;
        this.plateGroup = null;
        this.extractControls = null;
        this.photoMesh = null;
        this.backgroundMesh = null;

        // scale
        this.translatePosition = { x: 0, y: 0 }; // todo
        this.offset = { x: 0, y: 0 }; // todo
        this.lastPosition = { x: 0, y: 0 }; // todo
        this.mouseWheelX = 0;
        this.mouseWheelY = 0;
        this.scale = 1;
    }

    componentDidMount() {
        this.setupThreejs();
        this.setupExtractControls();
        this.setupPlate();
        this.animate();
        this.bindEventListeners();
    }


    componentWillUnmount() {
        cancelAnimationFrame(this.frameId);
    }

    onChangeImage(filename, width, height) {
        // const { size } = this.props;

        this.extractControls.resetCornerPositions();
        this.extractControls.visible = true;
        this.plateGroup.visible = true;
        this.photoMesh && this.group.remove(this.photoMesh);
        this.backgroundMesh && this.group.remove(this.backgroundMesh);

        const photoDisplayedWidth = width, photoDisplayedHeight = height;


        const imgPath = `${DATA_PREFIX}/${filename}`;
        const texture = new THREE.TextureLoader().load(imgPath);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1,
            map: texture
        });
        const geometry = new THREE.PlaneGeometry(photoDisplayedWidth, photoDisplayedHeight);
        this.photoMesh = new THREE.Mesh(geometry, material);
        this.photoMesh.position.set(0, 0, 0);
        this.group.add(this.photoMesh);

        this.setState({
            photoFilename: filename
        });
    }

    onMouseWheel = (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.mouseWheelX = event.offsetX;
        this.mouseWheelY = event.offsetY;
        this.handleMouseWheel(event);
    };

    onMouseDown = (event) => {
        event.preventDefault();
        this.translatePosition.x = event.clientX;
        this.translatePosition.y = event.clientY;
        if (event.button === THREE.MOUSE.MIDDLE || event.button === THREE.MOUSE.RIGHT) {
            document.addEventListener('mousemove', this.onDocumentMouseMove, false);
            document.addEventListener('mouseup', this.onDocumentMouseUp, false);
        }
    };

    onDocumentMouseMove = (event) => {
        // Coordinate axis adaptation
        const [offsetX, offsetY] = [this.translatePosition.x - event.clientX, event.clientY - this.translatePosition.y];
        this.camera.position.set(this.offset.x + offsetX, this.offset.y + offsetY, Math.max(this.props.width, this.props.height) * 0.5 * this.scale);
        this.lastPosition = {
            x: this.offset.x + offsetX,
            y: this.offset.y + offsetY
        };
    };

    onDocumentMouseUp = (event) => {
        if (this.translatePosition.x - event.clientX !== 0 || this.translatePosition.y - event.clientY !== 0) {
            this.offset = {
                x: this.lastPosition.x,
                y: this.lastPosition.y
            };
        }
        document.removeEventListener('mousemove', this.onDocumentMouseMove, false);
        document.removeEventListener('mouseup', this.onDocumentMouseUp, false);
    };


    setupThreejs() {
        const width = this.props.width / 2;
        const height = this.props.width / 2;
        // width *= 2;
        // height *= 2;

        this.camera = new THREE.PerspectiveCamera(90, width / height, 0.1, 10000);
        // change position
        this.camera.position.set(0, 0, Math.max(this.props.width, this.props.height) * 0.5);
        this.camera.lookAt(new THREE.Vector3(0, 0, 0));

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setClearColor(new THREE.Color(0xfafafa), 1);
        this.renderer.setSize(width, height);

        this.scene = new THREE.Scene();
        this.scene.add(this.camera);

        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.scene.add(new THREE.HemisphereLight(0x000000, 0xe0e0e0));

        this.node.current.appendChild(this.renderer.domElement);
    }

    setupExtractControls() {
        const { width, height, getPoints } = this.props;
        this.extractControls = new ManualCalibrationControls(this.camera, this.renderer.domElement, this.scale);
        // the order is [leftBottom, rightBottom, rightTop. leftTop]
        if (getPoints.length > 0) {
            this.extractControls.updateRectangleSize(getPoints, width, height);
        }

        this.extractControls.visible = false;
        this.scene.add(this.extractControls);
    }


    setupPlate() {
        this.plateGroup = new THREE.Group();
        this.plateGroup.visible = false;
        this.group.add(this.plateGroup);

        const { width, height } = this.props;

        const grid = new RectangleGridHelper(width / 2, height / 2, 10);
        grid.material.opacity = 0.25;
        grid.material.transparent = true;
        grid.rotateX(Math.PI / 2);
        this.plateGroup.add(grid);

        const minSideLength = Math.min(width, height);
        const geometry = new THREE.PlaneGeometry(minSideLength / 2, minSideLength / 8);
        const material = new THREE.MeshBasicMaterial({
            side: THREE.DoubleSide,
            opacity: 0.75,
            transparent: true
        });
        const mesh = new THREE.Mesh(geometry, material);
        this.plateGroup.add(mesh);
    }

    handleMouseWheel = (event) => {
        const { width, height } = this.props;
        if (event.deltaY < 0) {
            this.scale /= 1.05;
            this.camera.position.set(this.mouseWheelX * 2 - width / 2,
                height / 2 - this.mouseWheelY * 2,
                Math.max(this.props.width, this.props.height) * 0.5 * this.scale);
        } else if (this.scale < 1 && event.deltaY > 0) {
            this.scale *= 1.05;
            this.camera.position.set(
                this.mouseWheelX * 2 - width / 2,
                height / 2 - this.mouseWheelY * 2,
                Math.max(this.props.width, this.props.height) * 0.5 * this.scale
            );
            if (this.scale >= 1) {
                this.camera.position.set(0, 0, Math.max(this.props.width, this.props.height) * 0.5);
                this.offset = {
                    x: 0,
                    y: 0
                };
            }
        }
    };

    animate = () => {
        this.renderScene();
        this.frameId = requestAnimationFrame(this.animate);
    };


    bindEventListeners() {
        this.renderer.domElement.addEventListener('mousedown', this.onMouseDown, false);
        this.renderer.domElement.addEventListener('wheel', this.onMouseWheel, false);
    }

    // extract background image from photo
    updateMatrix() {
        if (!this.state.photoFilename) {
            return;
        }
        const positions = this.extractControls.getCornerPositions();
        const { leftTop, leftBottom, rightBottom, rightTop } = positions;
        const { width, height } = this.props;
        [leftTop, rightTop, rightBottom, leftBottom].map((item,) => {
            item.x += width / 2;
            item.y = -item.y + height / 2;
            return item;
        });


        // TODO change point order
        const affinePoints = [
            leftTop,
            rightTop,
            rightBottom,
            leftBottom
        ];
        this.props.updateAffinePoints(affinePoints);
    }


    renderScene() {
        this.renderer.render(this.scene, this.camera);
    }

    render() {
        if (!Detector.webgl) {
            return null;
        }
        return (
            <div style={{ border: '1px solid #c8c8c8', overflow: 'hidden', boxSizing: 'border-box' }} ref={this.node} />
        );
    }
}

export default ManualCalibration;
