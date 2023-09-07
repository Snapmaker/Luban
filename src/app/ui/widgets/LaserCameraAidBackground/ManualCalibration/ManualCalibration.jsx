import PropTypes from 'prop-types';
import React, { Component } from 'react';
import * as THREE from 'three';

import api from '../../../../api';
import { DATA_PREFIX, DEFAULT_LUBAN_HOST } from '../../../../constants';
import {
    LASER_10W_TAKE_PHOTO_POSITION,
    LASER_1600MW_CALIBRATION_POSITION,
    LEVEL_TWO_POWER_LASER_FOR_SM2,
    MACHINE_SERIES
} from '../../../../constants/machines';
import i18n from '../../../../lib/i18n';
import RectangleGridHelper from '../../../../scene/objects/RectangleGridHelper';
import Detector from '../../../../scene/three-extensions/Detector';
import ManualCalibrationControls from '../../../../scene/three-extensions/ManualCalibrationControls';
import WebGLRendererWrapper from '../../../../scene/three-extensions/WebGLRendererWrapper';
import styles from '../styles.styl';

export const CALIBRATION_MODE = 1;
export const CUTOUT_MODE = 2;

const CALIBRATION_CORNERS = {
    A150: [{ x: 43, y: 122 }, { x: 123, y: 122 }, { x: 123, y: 42 }, { x: 43, y: 42 }],
    A250: [{ x: 76, y: 180 }, { x: 176, y: 180 }, { x: 176, y: 80 }, { x: 76, y: 80 }],
    A350: [{ x: 122, y: 228 }, { x: 222, y: 228 }, { x: 222, y: 128 }, { x: 122, y: 128 }],
    A400: [{ x: 155, y: 255 }, { x: 255, y: 255 }, { x: 255, y: 155 }, { x: 155, y: 155 }]
};

class ManualCalibration extends Component {
    static propTypes = {
        width: PropTypes.number.isRequired,
        height: PropTypes.number.isRequired,
        getPoints: PropTypes.array.isRequired,
        updateAffinePoints: PropTypes.func.isRequired,
        mode: PropTypes.number.isRequired,
        materialThickness: PropTypes.number,
        series: PropTypes.string.isRequired,
        size: PropTypes.object.isRequired,
        toolHead: PropTypes.object.isRequired,
    };

    state = {
        photoFilename: ''
    };

    // DOM node
    node = React.createRef();
    preview = React.createRef();
    previewTransformation = React.createRef();
    callback = React.createRef();
    sourceImg = React.createRef();

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

        this.callback.current = this.updatePreviewImage.bind(this);
        window.addEventListener('update-corner-positions', this.callback.current, false);

        this.preview.current.addEventListener('zoom', ev => {
            this.previewTransformation.current = ev.detail.newTransformation;
        });
    }


    componentWillUnmount() {
        cancelAnimationFrame(this.frameId);

        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }

        window.removeEventListener('update-corner-positions', this.callback.current, false);
    }

    getLaserSize() {
        const toolIdentifier = this.props.toolHead.laserToolhead;

        let takePhotoPosition = LASER_10W_TAKE_PHOTO_POSITION[this.props.series].z;
        if (toolIdentifier === LEVEL_TWO_POWER_LASER_FOR_SM2) {
            takePhotoPosition = LASER_10W_TAKE_PHOTO_POSITION[this.props.series].z;
        } else {
            takePhotoPosition = LASER_1600MW_CALIBRATION_POSITION[this.props.series].z;
        }

        const machine = MACHINE_SERIES[this.props.series];
        let workRange = {
            min: [0, 0, 0],
            max: [machine.metadata.size.x, machine.metadata.size.y, machine.metadata.size.z],
        };
        for (const toolHeadOption of machine.metadata.toolHeads) {
            if (toolHeadOption.identifier === toolIdentifier) {
                if (toolHeadOption.workRange) {
                    workRange = toolHeadOption.workRange;
                }
                break;
            }
        }

        const laserMaxHeight = workRange.max[2];
        return {
            takePhotoPosition, laserMaxHeight
        };
    }

    updateCutoutPreview() {
        const x = this.previewTransformation.current?.e;
        const y = this.previewTransformation.current?.f;

        if (!this.state.photoFilename) {
            return;
        }
        const affinePoints = this.getPoints();

        const boundingBox = {
            minX: Infinity,
            maxX: -Infinity,
            minY: Infinity,
            maxY: -Infinity
        };

        for (const point of affinePoints) {
            boundingBox.minX = Math.min(boundingBox.minX, point.x);
            boundingBox.maxX = Math.max(boundingBox.maxX, point.x);
            boundingBox.minY = Math.min(boundingBox.minY, point.y);
            boundingBox.maxY = Math.max(boundingBox.maxY, point.y);
        }
        const center = {
            x: (boundingBox.maxX + boundingBox.minX) / 2,
            y: (boundingBox.maxY + boundingBox.minY) / 2
        };

        const machineWidth = this.props.size.x;
        const machineHeight = this.props.size.y;

        const canvas = document.createElement('canvas');
        canvas.width = machineWidth;
        canvas.height = machineHeight;

        const ctx = canvas.getContext('2d');
        const sourceImg = new Image();
        sourceImg.crossOrigin = 'Anonymous';
        const imagePath = `${DATA_PREFIX}/${this.state.photoFilename}`;
        sourceImg.src = imagePath;
        sourceImg.onload = () => {
            affinePoints.forEach((point) => {
                point.x -= boundingBox.minX;
                point.y -= boundingBox.minY;
            });
            ctx.beginPath();
            for (let i = 0; i < affinePoints.length; i++) {
                ctx.lineTo(affinePoints[i].x, affinePoints[i].y);
            }
            ctx.lineTo(affinePoints[0].x, affinePoints[0].y);
            ctx.clip();

            ctx.drawImage(
                sourceImg,
                boundingBox.minX * -1,
                boundingBox.minY * -1,
                machineWidth,
                machineHeight
            );

            const imgData = canvas.toDataURL('image/png');

            const previewCanvas = this.preview.current;
            const previewCtx = previewCanvas.canvas().getContext('2d');

            const background = new Image();
            background.crossOrigin = 'Anonymous';
            background.src = `${DEFAULT_LUBAN_HOST}/resources/images/aluminum-grid-plate.svg`;
            background.onload = () => {
                previewCtx.drawImage(background, 0, 0, machineWidth, machineHeight);

                const material = new Image();
                material.crossOrigin = 'Anonymous';
                material.src = imgData;
                material.onload = () => {
                    const { takePhotoPosition, laserMaxHeight } = this.getLaserSize();
                    if (this.props.materialThickness + takePhotoPosition > laserMaxHeight) {
                        const scale = laserMaxHeight / (this.props.materialThickness + takePhotoPosition);
                        previewCtx.drawImage(
                            material,
                            ((center.x - machineWidth / 2) * scale + machineWidth / 2) - (boundingBox.maxX - boundingBox.minX) * scale / 2,
                            ((center.y - machineHeight / 2) * scale + machineHeight / 2) - (boundingBox.maxY - boundingBox.minY) * scale / 2,
                            machineWidth * scale,
                            machineHeight * scale
                        );
                    } else {
                        previewCtx.drawImage(
                            material,
                            boundingBox.minX,
                            boundingBox.minY,
                            machineWidth,
                            machineHeight
                        );
                    }
                    if (this.previewTransformation.current) {
                        previewCanvas.applyTranslation(-this.previewTransformation.current.e, -this.previewTransformation.current.f);
                        previewCanvas.applyTranslation(x, y);
                    } else {
                        if (this.props.series === 'A350') {
                            previewCanvas.applyZoom(2, {
                                x: 80,
                                y: 80
                            });
                        } else if (this.props.series === 'A150') {
                            previewCanvas.applyZoom(4, {
                                x: 35,
                                y: 30
                            });
                        }
                    }
                };
            };
        };
    }

    updateCalibrationPreview() {
        if (!this.state.photoFilename) {
            return;
        }
        if (this.props.toolHead.laserToolhead === LEVEL_TWO_POWER_LASER_FOR_SM2) {
            const affinePoints = this.getPoints();
            const corners = CALIBRATION_CORNERS[this.props.series];
            const options = { picAmount: 1, currentIndex: 0, size: this.props.size, series: this.props.series, currentArrIndex: 0, getPoints: affinePoints, corners, fileNames: [], stitchFileName: this.state.photoFilename, materialThickness: this.props.materialThickness, applyAntiDistortion: this.props.series === 'A350' };

            api.processStitchEach(options).then((stitchImg) => {
                const { filename } = JSON.parse(stitchImg.text);
                this.sourceImg.current = filename;
                this.generateCalibrationPreview();
            });
        } else {
            const affinePoints = this.getPoints();
            const options = {
                'picAmount': 9,
                'currentIndex': 4,
                'size': this.props.size,
                'series': 'A350',
                'centerDis': 150,
                'currentArrIndex': 0,
                getPoints: affinePoints,
                'corners': CALIBRATION_CORNERS[this.props.series],
                'fileNames': [],
                stitchFileName: this.state.photoFilename,
                'laserToolhead': this.props.toolHead.laserToolhead,
                'materialThickness': null,
                isCalibration: true
            };


            api.processStitchEach(options).then((stitchImg) => {
                const { filename } = JSON.parse(stitchImg.text);
                this.sourceImg.current = filename;
                this.generateCalibrationPreview();
            });
        }
    }

    generateCalibrationPreview() {
        const canvas = this.preview.current;
        const ctx = canvas.getContext('2d');

        const x = this.previewTransformation.current?.e;
        const y = this.previewTransformation.current?.f;

        const machineWidth = this.props.size.x;
        const machineHeight = this.props.size.y;
        const options = { corners: CALIBRATION_CORNERS[this.props.series] };

        const img = new Image();
        img.crossOrigin = 'Anonymous';
        const imgPath = `${DATA_PREFIX}/${this.sourceImg.current}`;
        img.src = imgPath;

        img.onload = () => {
            ctx.drawImage(
                img,
                0, 0,
                machineWidth, machineHeight
            );

            ctx.lineWidth = 0.2;
            ctx.strokeStyle = '#ff0000';
            ctx.beginPath();
            for (let i = 0; i < options.corners.length; i++) {
                ctx.lineTo(options.corners[i].x, machineHeight - options.corners[i].y);
            }
            ctx.lineTo(options.corners[0].x, machineHeight - options.corners[0].y);
            ctx.stroke();

            if (this.previewTransformation.current) {
                canvas.applyTranslation(-this.previewTransformation.current.e, -this.previewTransformation.current.f);
                canvas.applyTranslation(x, y);
            } else {
                if (this.props.series === 'A350') {
                    canvas.applyZoom(2, {
                        x: 80,
                        y: 80
                    });
                } else if (this.props.series === 'A150') {
                    canvas.applyZoom(4, {
                        x: 35,
                        y: 30
                    });
                }
            }
        };
    }

    updatePreviewImage() {
        if (!this.preview.current) {
            return;
        }
        if (this.props.mode === CUTOUT_MODE) {
            this.updateCutoutPreview();
        } else {
            this.updateCalibrationPreview();
        }
    }

    onChangeImage(filename, width, height, initialized = false) {
        this.extractControls.resetCornerPositions();
        if (!initialized) {
            this.extractControls.visible = true;
            this.plateGroup.visible = true;
            this.photoMesh && this.group.remove(this.photoMesh);
            this.backgroundMesh && this.group.remove(this.backgroundMesh);

            const photoDisplayedWidth = width, photoDisplayedHeight = height;

            const imgPath = `${DATA_PREFIX}/${filename}`;
            this.imgPath = imgPath;
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
        const width = 500;
        const height = 500;

        this.camera = new THREE.PerspectiveCamera(90, width / height, 0.1, 10000);
        // change position
        this.camera.position.set(0, 0, Math.max(
            Math.max(this.props.width, this.props.height) * 0.5,
            120
        ));
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
        this.extractControls = new ManualCalibrationControls(this.camera, this.renderer.domElement, this.scale, null, null, this.props.mode);
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
    exportPreviewImage() {
        return new Promise((resolve) => {
            const previewCanvas = this.preview.current.canvas();

            const previewCtx = this.preview.current.getContext('2d');
            this.previewTransformation.current = previewCtx.getTransform();

            this.preview.current.applyZoom(1 / this.previewTransformation.current.a);
            setTimeout(() => {
                this.preview.current.applyTranslation(-this.previewTransformation.current.e, -this.previewTransformation.current.f);
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = this.props.size.x;
                canvas.height = this.props.size.y;

                const cutImg = new Image();
                cutImg.crossOrigin = 'Anonymous';
                const imgData = previewCanvas.toDataURL('image/png');
                cutImg.src = imgData;
                cutImg.onload = () => {
                    ctx.drawImage(
                        cutImg,
                        0, 0
                    );

                    canvas.toBlob((blob) => {
                        const url = URL.createObjectURL(blob);
                        resolve(url);
                    });
                };
            });
        });
    }

    getPoints() {
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

        return affinePoints;
    }

    updateMatrix() {
        if (!this.state.photoFilename) {
            return;
        }

        const affinePoints = this.getPoints();

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
            <div>
                <div className="sm-flex" style={{ marginBottom: '5px' }}>
                    <div className="font-weight-bold" style={{ flex: 1, textAlign: 'left' }}>{i18n._('key-Laser/CamaeraCapture-Adjust area')}</div>
                    <div className="font-weight-bold" style={{ flex: 1, textAlign: 'left' }}>{i18n._('key-Laser/CamaeraCapture-Preview Area')}</div>
                </div>
                <div className="sm-flex justify-space-between ">
                    <div className={styles['calibrate-wrapper']} style={{ border: '1px solid #c8c8c8', overflow: 'hidden', boxSizing: 'border-box', background: '#F5F5F7', borderRadius: 8, marginLeft: '10px' }} ref={this.node} />
                    <div style={{ width: '500px', height: '500px', border: '1px solid #c8c8c8', overflow: 'hidden', boxSizing: 'border-box', background: '#F5F5F7', borderRadius: 8 }}>
                        <canvas2d-zoom ref={this.preview} width={500} height={500} min-zoom="1" max-zoom="8" zoom-factor="1.1" />
                    </div>
                </div>
            </div>
        );
    }
}

export default ManualCalibration;
