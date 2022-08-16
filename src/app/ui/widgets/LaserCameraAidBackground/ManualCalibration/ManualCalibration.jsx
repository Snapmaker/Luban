import React, { Component } from 'react';
import PropTypes from 'prop-types';
import * as THREE from 'three';
import { DATA_PREFIX } from '../../../../constants';
import ManualCalibrationControls from '../../../../three-extensions/ManualCalibrationControls';
import RectangleGridHelper from '../../../../three-extensions/RectangleGridHelper';
import WebGLRendererWrapper from '../../../../three-extensions/WebGLRendererWrapper';
import Detector from '../../../../three-extensions/Detector';
import styles from '../styles.styl';


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

        this.spherical = new THREE.Spherical();

        this.sphericalDelta = new THREE.Spherical();
        // scale
        this.offset = new THREE.Vector3(); // todo
        this.panOffset = new THREE.Vector3();
        this.panPosition = new THREE.Vector2();
        this.mouse3D = new THREE.Vector3();
        this.target = new THREE.Vector3(0, 0, 100);
        this.maxDistance = 540;
        this.scale = 1;
    }

    componentDidMount() {
        this.setupThreejs();
        this.setupExtractControls();
        this.setupPlate();
        this.updateCamera(false, true);
        this.animate();
        this.bindEventListeners();
    }


    componentWillUnmount() {
        cancelAnimationFrame(this.frameId);

        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }
    }

    onChangeImage(filename, width, height, initialized = false) {
        // const { size } = this.props;

        this.extractControls.resetCornerPositions();
        if (!initialized) {
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
        }

        this.setState({
            photoFilename: filename
        });
    }

    onMouseWheel = (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.handleMouseWheel(event);
    };

    panLeft(distance, matrix) {
        const v = new THREE.Vector3().setFromMatrixColumn(matrix, 0); // Get X column
        v.multiplyScalar(-distance);
        this.panOffset.add(v);
    }

    panUp(distance, matrix) {
        const v = new THREE.Vector3().setFromMatrixColumn(matrix, 1); // Get Y column
        v.multiplyScalar(distance);
        this.panOffset.add(v);
    }

    pan(deltaX, deltaY) {
        const elem = this.renderer.domElement === document ? document.body : this.renderer.domElement;

        this.offset.copy(this.camera.position).sub(this.target);
        // calculate move distance of target in perspective view of camera
        const distance = 2 * this.offset.length() * Math.tan(this.camera.fov / 2 * Math.PI / 180);
        let leftDistance = distance * deltaX / elem.clientWidth;
        let upDistance = distance * deltaY / elem.clientHeight;
        if (Math.abs(distance / elem.clientWidth) < 0.3) {
            leftDistance = 0.3 * deltaX;
        }
        if (Math.abs(distance / elem.clientHeight) < 0.3) {
            upDistance = 0.3 * deltaY;
        }
        this.panLeft(leftDistance, this.camera.matrix);
        this.panUp(upDistance, this.camera.matrix);
    }


    onMouseDown = (event) => {
        event.preventDefault();
        this.panPosition.set(event.clientX, event.clientY);
        // this.translatePosition.x = event.clientX;
        // this.translatePosition.y = event.clientY;
        if (event.button === THREE.MOUSE.MIDDLE || event.button === THREE.MOUSE.RIGHT) {
            document.addEventListener('mousemove', this.onDocumentMouseMove, false);
            document.addEventListener('mouseup', this.onDocumentMouseUp, false);
        }
    };

    handleMouseMovePan = (event) => {
        this.pan(event.clientX - this.panPosition.x, event.clientY - this.panPosition.y);
        this.panPosition.set(event.clientX, event.clientY);
        this.updateCamera();
    };

    onDocumentMouseMove = (event) => {
        this.handleMouseMovePan(event);
    };

    onDocumentMouseUp = () => {
        document.removeEventListener('mousemove', this.onDocumentMouseMove, false);
        document.removeEventListener('mouseup', this.onDocumentMouseUp, false);
    };


    setupThreejs() {
        const width = this.props.width / 2.3;
        const height = this.props.width / 2.3;
        // width *= 2;
        // height *= 2;

        this.camera = new THREE.PerspectiveCamera(90, width / height, 0.1, 10000);
        // change position
        this.camera.position.set(0, 0, Math.max(this.props.width, this.props.height) * 0.5);
        this.camera.lookAt(this.target);

        this.renderer = new WebGLRendererWrapper({ antialias: true });
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
        grid.material.opacity = 1;
        grid.material.transparent = true;
        grid.rotateX(Math.PI / 2);
        this.plateGroup.add(grid);

        const minSideLength = Math.min(width, height);
        const geometry = new THREE.PlaneGeometry(minSideLength / 2, minSideLength / 8);
        const material = new THREE.MeshBasicMaterial({
            side: THREE.DoubleSide,
            opacity: 1,
            transparent: true
        });
        const mesh = new THREE.Mesh(geometry, material);
        this.plateGroup.add(mesh);
    }

    // update mouse 3D position
    updateMouse3D = (() => {
        const scope = this;
        const v = new THREE.Vector3();
        const v1 = new THREE.Vector3();
        return (event) => {
            const element = scope.renderer.domElement === document ? scope.renderer.domElement.body : scope.renderer.domElement;
            // Conversion screen coordinates to world coordinates and calculate distance
            // Calculate mouse relative position, use event.offsetY or event.clientY in different situations
            v.set((event.offsetX / element.clientWidth) * 2 - 1, -(event.offsetY / element.clientHeight) * 2 + 1, 0.5);

            v.unproject(scope.camera);

            v.sub(scope.camera.position).normalize();
            // now v is Vector3 which is from mouse position camera position
            const distanceAll = v1.copy(scope.target).sub(scope.camera.position).length();
            scope.mouse3D.copy(scope.camera.position).add(v.multiplyScalar(distanceAll));
        };
    })();

    updateCamera(shouldUpdateTarget = false, updateScale = false) {
        this.offset.copy(this.camera.position).sub(this.target);

        const spherialOffset = new THREE.Vector3();

        // rotate & scale
        if (this.sphericalDelta.theta !== 0 || this.sphericalDelta.phi !== 0 || this.scale !== 1 || updateScale) {
            spherialOffset.copy(this.offset);
            this.spherical.setFromVector3(spherialOffset);

            this.spherical.theta += this.sphericalDelta.theta;
            this.spherical.phi += this.sphericalDelta.phi;

            this.spherical.makeSafe();

            const prevRadius = this.spherical.radius;
            this.spherical.radius *= this.scale;
            this.spherical.radius = Math.max(this.spherical.radius, 0.05);
            this.spherical.radius = Math.min(this.spherical.radius, this.maxDistance);
            // suport zoomToCursor (mouse only)
            if (shouldUpdateTarget) {
                this.target.lerp(this.mouse3D, 1 - this.spherical.radius / prevRadius);
            }
            spherialOffset.setFromSpherical(this.spherical);


            this.offset.copy(spherialOffset);

            this.sphericalDelta.set(1, 0, 0);
        }

        // pan
        if (this.panOffset.x || this.panOffset.y) {
            this.target.add(this.panOffset);
            this.panOffset.set(0, 0, 0);
        }


        // re-position camera
        this.camera.position.copy(this.target).add(this.offset);
        this.camera.lookAt(this.target);

        // need to update scale after camera position setted,
        // because of camera position used to calculate current scale
        if (this.scale !== 1) {
            this.scale = 1;
        }
    }


    handleMouseWheel = (event) => {
        this.updateMouse3D(event);
        if (event.deltaY < 0) {
            this.scale *= 0.9;
        } else {
            this.scale /= 0.9;
        }
        this.updateCamera(true);
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
        if (!Detector.isWebGLAvailable()) {
            return null;
        }
        return (
            <div className={styles['calibrate-wrapper']} style={{ border: '1px solid #c8c8c8', overflow: 'hidden', boxSizing: 'border-box', background: '#F5F5F7', borderRadius: 8 }} ref={this.node} />
        );
    }
}

export default ManualCalibration;
