import _ from 'lodash';
import colornames from 'colornames';
import pubsub from 'pubsub-js';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import * as THREE from 'three';
import Detector from 'three/examples/js/Detector';
import log from '../../lib/log';
import CombinedCamera from '../../components/three-extensions/CombinedCamera';
import './TrackballControls';
import Viewport from './Viewport';
import CoordinateAxes from './CoordinateAxes';
import TargetPoint from './TargetPoint';
import GridLine from './GridLine';
import PivotPoint3 from './PivotPoint3';
import TextSprite from './TextSprite';
import {
    METRIC_UNITS
} from '../../constants';
import {
    CAMERA_MODE_PAN,
    CAMERA_MODE_ROTATE
} from './constants';

const METRIC_GRID_COUNT = 60; // 60 cm
const METRIC_GRID_SPACING = 10; // 10 mm
const METRIC_AXIS_LENGTH = METRIC_GRID_SPACING * 30; // 300 mm
const CAMERA_VIEWPORT_WIDTH = 300; // 300 mm
const CAMERA_VIEWPORT_HEIGHT = 300; // 300 mm
const PERSPECTIVE_FOV = 70;
const PERSPECTIVE_NEAR = 0.001;
const PERSPECTIVE_FAR = 2000;
const ORTHOGRAPHIC_FOV = 35;
const ORTHOGRAPHIC_NEAR = 0.001;
const ORTHOGRAPHIC_FAR = 2000;
const CAMERA_POSITION_X = 0;
const CAMERA_POSITION_Y = 0;
const CAMERA_POSITION_Z = 200; // Move the camera out a bit from the origin (0, 0, 0)
const TRACKBALL_CONTROLS_MIN_DISTANCE = 1;
const TRACKBALL_CONTROLS_MAX_DISTANCE = 2000;

class Visualizer extends Component {
    static propTypes = {
        show: PropTypes.bool,
        state: PropTypes.object
    };

    pubsubTokens = [];
    isAgitated = false;
    workPosition = {
        x: 0,
        y: 0,
        z: 0
    };
    interval = null;

    group = new THREE.Group();
    pivotPoint = new PivotPoint3({ x: 0, y: 0, z: 0 }, (x, y, z) => { // relative position
        _.each(this.group.children, (o) => {
            o.translateX(x);
            o.translateY(y);
            o.translateZ(z);
        });

        // Update the scene
        this.updateScene();
    });

    componentWillMount() {
        // three-extensions.js
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.controls = null;
        this.viewport = null;
        this.toolhead = null;
        this.targetPoint = null;
        this.visualizer = null;
        this.plane = null;
        this.interval = null;
    }
    componentDidMount() {
        this.subscribe();
        this.addResizeEventListener();

        if (this.node) {
            const el = ReactDOM.findDOMNode(this.node);
            this.createScene(el);
            this.resizeRenderer();
            // auto center when initialized
            this.lookAtCenter();
        }

        // hack, workarond the case that texture image haven't loaded, but the triggerd update scene have been executed.
        // https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/setInterval
        const __nativeSI__ = window.setInterval;
        window.setInterval = function (vCallback, nDelay, ...aArgs) {
            const oThis = this;
            return __nativeSI__(vCallback instanceof Function ? () => {
                vCallback.apply(oThis, aArgs);
            } : vCallback, nDelay);
        };
        setInterval.call(this, function() {
            this.renderer.render(this.scene, this.camera);
        }, 1000);
    }
    componentWillUnmount() {
        this.unsubscribe();
        this.removeResizeEventListener();
        this.clearScene();
    }
    componentWillReceiveProps(nextProps) {
        let forceUpdate = false;
        let needUpdateScene = false;
        const state = this.props.state;
        const nextState = nextProps.state;

        // Enable or disable 3D view
        if ((this.props.show !== nextProps.show) && (!!nextProps.show === true)) {
            this.viewport.update();

            // Set forceUpdate to true when enabling or disabling 3D view
            forceUpdate = true;
            needUpdateScene = true;
        }
        log.debug(state);
        log.debug(nextState);

        if (state.imageSrc !== nextState.imageSrc
            || state.sizeWidth !== nextState.sizeWidth
            || state.sizeHeight !== nextState.sizeHeight) {
            this.createPlane(nextState);

            // auto center
            this.lookAtCenter();

            forceUpdate = true;
            needUpdateScene = true;
        }
        if (state.alignment !== nextState.alignment) {
            if (nextState.alignment === 'center') {
                this.plane.position.x = 0;
                this.plane.position.y = 0;
            } else {
                this.plane.position.x = nextState.sizeWidth / 2;
                this.plane.position.y = nextState.sizeHeight / 2;
            }

            this.lookAtCenter();

            forceUpdate = true;
            needUpdateScene = true;
        }

        // Projection
        if (state.projection !== nextState.projection) {
            if (nextState.projection === 'orthographic') {
                this.camera.toOrthographic();
                this.camera.setZoom(1);
                this.camera.setFov(ORTHOGRAPHIC_FOV);
            } else {
                this.camera.toPerspective();
                this.camera.setZoom(1);
                this.camera.setFov(PERSPECTIVE_FOV);
            }
            if (this.viewport) {
                this.viewport.update();
            }
            needUpdateScene = true;
        }

        // Camera Mode
        if (state.cameraMode !== nextState.cameraMode) {
            this.setCameraMode(nextState.cameraMode);
            needUpdateScene = true;
        }


        // Display or hide coordinate system
        if (nextState.objects.coordinateSystem.visible !== state.objects.coordinateSystem.visible) {
            const visible = nextState.objects.coordinateSystem.visible;

            // Metric
            const metricCoordinateSystem = this.group.getObjectByName('MetricCoordinateSystem');
            if (metricCoordinateSystem) {
                metricCoordinateSystem.visible = visible && (nextState.units === METRIC_UNITS);
            }

            needUpdateScene = true;
        }

        // Update work position
        if (!_.isEqual(this.workPosition, nextState.workPosition)) {
            this.workPosition = nextState.workPosition;
            this.setWorkPosition(this.workPosition);

            needUpdateScene = true;
        }

        if (needUpdateScene) {
            this.updateScene({ forceUpdate: forceUpdate });
        }

        if (this.isAgitated !== nextState.isAgitated) {
            this.isAgitated = nextState.isAgitated;

            if (this.isAgitated) {
                // Call renderAnimationLoop when the state changes and isAgitated is true
                requestAnimationFrame(::this.renderAnimationLoop);
            }
        }
    }
    shouldComponentUpdate(nextProps, nextState) {
        if (nextProps.show !== this.props.show) {
            return true;
        }
        return false;
    }
    subscribe() {
        const tokens = [
            pubsub.subscribe('resize', (msg) => {
                this.resizeRenderer();
            })
        ];
        this.pubsubTokens = this.pubsubTokens.concat(tokens);
    }
    unsubscribe() {
        this.pubsubTokens.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        this.pubsubTokens = [];
    }
    // https://tylercipriani.com/blog/2014/07/12/crossbrowser-javascript-scrollbar-detection/
    hasVerticalScrollbar() {
        return window.innerWidth > document.documentElement.clientWidth;
    }
    hasHorizontalScrollbar() {
        return window.innerHeight > document.documentElement.clientHeight;
    }
    // http://www.alexandre-gomes.com/?p=115
    getScrollbarWidth() {
        const inner = document.createElement('p');
        inner.style.width = '100%';
        inner.style.height = '200px';

        const outer = document.createElement('div');
        outer.style.position = 'absolute';
        outer.style.top = '0px';
        outer.style.left = '0px';
        outer.style.visibility = 'hidden';
        outer.style.width = '200px';
        outer.style.height = '150px';
        outer.style.overflow = 'hidden';
        outer.appendChild(inner);

        document.body.appendChild(outer);
        const w1 = inner.offsetWidth;
        outer.style.overflow = 'scroll';
        const w2 = (w1 === inner.offsetWidth) ? outer.clientWidth : inner.offsetWidth;
        document.body.removeChild(outer);

        return (w1 - w2);
    }
    getVisibleWidth() {
        const el = ReactDOM.findDOMNode(this.node);
        const visibleWidth = Math.max(
            Number(el && el.parentNode && el.parentNode.clientWidth) || 0,
            360
        );

        return visibleWidth;
    }
    getVisibleHeight() {
        const clientHeight = document.documentElement.clientHeight;
        const navbarHeight = 50;
        const widgetHeaderHeight = 32;
        const widgetFooterHeight = 32;
        const visibleHeight = (
            clientHeight - navbarHeight - widgetHeaderHeight - widgetFooterHeight - 1
        );

        return visibleHeight;
    }
    addResizeEventListener() {
        // handle resize event
        if (!(this.onResize)) {
            this.onResize = () => {
                this.resizeRenderer();
            };
        }
        this.onResize();
        this.onResizeThrottled = _.throttle(::this.onResize, 10);
        window.addEventListener('resize', this.onResizeThrottled);
    }
    removeResizeEventListener() {
        // handle resize event
        window.removeEventListener('resize', this.onResizeThrottled);
        this.onResizeThrottled = null;
    }
    resizeRenderer() {
        if (!(this.camera && this.renderer)) {
            return;
        }

        const width = this.getVisibleWidth();
        const height = this.getVisibleHeight();

        if (width === 0 || height === 0) {
            log.warn(`The width (${width}) and height (${height}) cannot be a zero value`);
        }

        // https://github.com/mrdoob/three.js/blob/dev/examples/js/cameras/CombinedCamera.js#L156
        // THREE.CombinedCamera.prototype.setSize = function(width, height) {
        //     this.cameraP.aspect = width / height;
        //     this.left = - width / 2;
        //     this.right = width / 2;
        //     this.top = height / 2;
        //     this.bottom = - height / 2;
        // }
        this.camera.setSize(width, height);
        this.camera.aspect = width / height; // Update camera aspect as well
        this.camera.updateProjectionMatrix();

        // Initialize viewport at the first time of resizing renderer
        if (!this.viewport) {
            // Defaults to 300x300mm
            this.viewport = new Viewport(this.camera, CAMERA_VIEWPORT_WIDTH, CAMERA_VIEWPORT_HEIGHT);
        }

        this.controls.handleResize();

        this.renderer.setSize(width, height);

        // Update the scene
        this.updateScene();
    }
    createCoordinateSystem(options) {
        const {
            axisLength = METRIC_AXIS_LENGTH,
            gridCount = METRIC_GRID_COUNT,
            gridSpacing = METRIC_GRID_SPACING
        } = { ...options };

        const group = new THREE.Group();

        { // Coordinate Grid
            const gridLine = new GridLine(
                gridCount * gridSpacing,
                gridSpacing,
                gridCount * gridSpacing,
                gridSpacing,
                colornames('blue'), // center line
                colornames('gray 44') // grid
            );
            _.each(gridLine.children, (o) => {
                o.material.opacity = 0.15;
                o.material.transparent = true;
                o.material.depthWrite = false;
            });
            gridLine.name = 'GridLine';
            group.add(gridLine);
        }

        { // Coordinate Axes
            const coordinateAxes = new CoordinateAxes(axisLength);
            coordinateAxes.name = 'CoordinateAxes';
            group.add(coordinateAxes);
        }

        { // Axis Labels
            const axisXLabel = new TextSprite({
                x: axisLength + 10,
                y: 0,
                z: 0,
                size: 20,
                text: 'X',
                color: colornames('red')
            });
            const axisYLabel = new TextSprite({
                x: 0,
                y: axisLength + 10,
                z: 0,
                size: 20,
                text: 'Y',
                color: colornames('green')
            });
            const axisZLabel = new TextSprite({
                x: 0,
                y: 0,
                z: axisLength + 10,
                size: 20,
                text: 'Z',
                color: colornames('blue')
            });

            group.add(axisXLabel);
            group.add(axisYLabel);
            group.add(axisZLabel);

            for (let i = -gridCount; i <= gridCount; ++i) {
                if (i !== 0) {
                    const textLabel = new TextSprite({
                        x: i * gridSpacing,
                        y: 5,
                        z: 0,
                        size: 6,
                        text: i,
                        color: colornames('red'),
                        opacity: 0.5
                    });
                    group.add(textLabel);
                }
            }
            for (let i = -gridCount; i <= gridCount; ++i) {
                if (i !== 0) {
                    const textLabel = new TextSprite({
                        x: -5,
                        y: i * gridSpacing,
                        z: 0,
                        size: 6,
                        text: i,
                        color: colornames('green'),
                        opacity: 0.5
                    });
                    group.add(textLabel);
                }
            }
        }

        return group;
    }
    //
    // Creating a scene
    // http://threejs.org/docs/#Manual/Introduction/Creating_a_scene
    //
    createScene(el) {
        if (!el) {
            return;
        }

        const { state } = this.props;
        const { units, objects } = state;
        const width = this.getVisibleWidth();
        const height = this.getVisibleHeight();

        // WebGLRenderer
        this.renderer = new THREE.WebGLRenderer({
            autoClearColor: true,
            antialias: true,
            alpha: true
        });
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(new THREE.Color(colornames('white')), 1);
        this.renderer.setSize(width, height);
        this.renderer.clear();

        el.appendChild(this.renderer.domElement);

        // To actually be able to display anything with three-extensions.js, we need three things:
        // A scene, a camera, and a renderer so we can render the scene with the camera.
        this.scene = new THREE.Scene();

        this.camera = this.createCombinedCamera(width, height);
        this.controls = this.createTrackballControls(this.camera, this.renderer.domElement);

        this.setCameraMode(state.cameraMode);

        // Projection
        if (state.projection === 'orthographic') {
            this.camera.toOrthographic();
            this.camera.setZoom(1);
            this.camera.setFov(ORTHOGRAPHIC_FOV);
        } else {
            this.camera.toPerspective();
            this.camera.setZoom(1);
            this.camera.setFov(PERSPECTIVE_FOV);
        }

        { // Lights
            let light;

            // Directional Light
            light = new THREE.DirectionalLight(0xffffff);
            light.position.set(1, 1, 1);
            this.scene.add(light);

            // Directional Light
            light = new THREE.DirectionalLight(0x002288);
            light.position.set(-1, -1, -1);
            this.scene.add(light);

            // Ambient Light
            light = new THREE.AmbientLight(colornames('gray 25')); // soft white light
            this.scene.add(light);
        }

        { // Metric
            const visible = objects.coordinateSystem.visible;
            const metricCoordinateSystem = this.createCoordinateSystem({
                axisLength: METRIC_AXIS_LENGTH,
                gridCount: METRIC_GRID_COUNT,
                gridSpacing: METRIC_GRID_SPACING
            });
            metricCoordinateSystem.name = 'MetricCoordinateSystem';
            metricCoordinateSystem.visible = visible && (units === METRIC_UNITS);
            this.group.add(metricCoordinateSystem);
        }


        { // Target Point
            this.targetPoint = new TargetPoint({
                color: colornames('indianred'),
                radius: 0.5
            });
            this.targetPoint.name = 'TargetPoint';
            this.targetPoint.visible = true;
            this.group.add(this.targetPoint);
        }

        this.createPlane(state);

        this.scene.add(this.group);
    }
    // @param [options] The options object.
    // @param [options.forceUpdate] Force rendering
    updateScene(options = {}) {
        const { forceUpdate = false } = options;
        const needUpdateScene = this.props.show || forceUpdate;

        if (this.renderer && needUpdateScene) {
            this.renderer.render(this.scene, this.camera);
        }
    }
    clearScene() {
        // to iterrate over all children (except the first) in a scene
        const objsToRemove = _.tail(this.scene.children);
        _.each(objsToRemove, (obj) => {
            this.scene.remove(obj);
        });

        if (this.controls) {
            this.controls.dispose();
        }

        // Update the scene
        this.updateScene();
    }
    createPlane(state) {
        if (this.plane) {
            this.group.remove(this.plane);
        }

        const spriteMap = new THREE.TextureLoader().load(state.imageSrc);
        const geometry = new THREE.PlaneGeometry(state.sizeWidth, state.sizeHeight, 32);
        const material = new THREE.MeshBasicMaterial({ map: spriteMap, transparent: true, opacity: 1 });

        this.plane = new THREE.Mesh(geometry, material);
        if (state.alignment === 'center') {
            this.plane.position.x = 0;
            this.plane.position.y = 0;
        } else {
            this.plane.position.x = state.sizeWidth / 2;
            this.plane.position.y = state.sizeHeight / 2;
        }
        this.group.add(this.plane);
    }
    renderAnimationLoop() {
        if (this.isAgitated) {
            // Call the render() function up to 60 times per second (i.e. 60fps)
            requestAnimationFrame(::this.renderAnimationLoop);

            // Set to 360 rounds per minute (rpm)
            this.rotateToolHead(360);
        } else {
            // Stop rotation
            this.rotateToolHead(0);
        }

        // Update the scene
        this.updateScene();
    }
    createCombinedCamera(width, height) {
        const frustumWidth = width / 2;
        const frustumHeight = (height || width) / 2; // same to width if height is 0
        const fov = PERSPECTIVE_FOV;
        const near = PERSPECTIVE_NEAR;
        const far = PERSPECTIVE_FAR;
        const orthoNear = ORTHOGRAPHIC_NEAR;
        const orthoFar = ORTHOGRAPHIC_FAR;

        const camera = new CombinedCamera(
            frustumWidth,
            frustumHeight,
            fov,
            near,
            far,
            orthoNear,
            orthoFar
        );

        camera.position.x = CAMERA_POSITION_X;
        camera.position.y = CAMERA_POSITION_Y;
        camera.position.z = CAMERA_POSITION_Z;

        return camera;
    }
    createPerspectiveCamera(width, height) {
        const fov = PERSPECTIVE_FOV;
        const aspect = (width > 0 && height > 0) ? Number(width) / Number(height) : 1;
        const near = PERSPECTIVE_NEAR;
        const far = PERSPECTIVE_FAR;
        const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

        camera.position.x = CAMERA_POSITION_X;
        camera.position.y = CAMERA_POSITION_Y;
        camera.position.z = CAMERA_POSITION_Z;

        return camera;
    }
    createOrthographicCamera(width, height) {
        const left = -width / 2;
        const right = width / 2;
        const top = height / 2;
        const bottom = -height / 2;
        const near = ORTHOGRAPHIC_NEAR;
        const far = ORTHOGRAPHIC_FAR;
        const camera = new THREE.OrthographicCamera(left, right, top, bottom, near, far);

        return camera;
    }
    createTrackballControls(object, domElement) {
        const controls = new THREE.TrackballControls(object, domElement);

        controls.rotateSpeed = 1.0;
        controls.zoomSpeed = 1.2;
        controls.panSpeed = 0.8;
        controls.noZoom = false;
        controls.noPan = false;

        controls.staticMoving = true;
        controls.dynamicDampingFactor = 0.3;

        controls.keys = [65, 83, 68];

        controls.minDistance = TRACKBALL_CONTROLS_MIN_DISTANCE;
        controls.maxDistance = TRACKBALL_CONTROLS_MAX_DISTANCE;

        let shouldAnimate = false;
        const animate = () => {
            controls.update();

            // Update the scene
            this.updateScene();

            if (shouldAnimate) {
                requestAnimationFrame(animate);
            }
        };

        controls.addEventListener('start', () => {
            shouldAnimate = true;
            animate();
        });
        controls.addEventListener('end', () => {
            shouldAnimate = false;
            this.updateScene();
        });
        controls.addEventListener('change', () => {
            // Update the scene
            this.updateScene();
        });

        return controls;
    }
    // Rotates the tool head around the z axis with a given rpm and an optional fps
    // @param {number} rpm The rounds per minutes
    // @param {number} [fps] The frame rate (Defaults to 60 frames per second)
    rotateToolHead(rpm = 0, fps = 60) {
        if (!this.toolhead) {
            return;
        }

        const delta = 1 / fps;
        const degrees = 360 * (delta * Math.PI / 180); // Rotates 360 degrees per second
        this.toolhead.rotateZ(-(rpm / 60 * degrees)); // rotate in clockwise direction
    }
    // Set work position
    setWorkPosition(workPosition) {
        const pivotPoint = this.pivotPoint.get();

        let { x = 0, y = 0, z = 0 } = { ...workPosition };
        x = (Number(x) || 0) - pivotPoint.x;
        y = (Number(y) || 0) - pivotPoint.y;
        z = (Number(z) || 0) - pivotPoint.z;

        if (this.toolhead) { // Update toolhead position
            this.toolhead.position.set(x, y, z);
        }

        if (this.targetPoint) { // Update target point position
            this.targetPoint.position.set(x, y, z);
        }
    }
    // Make the controls look at the specified position
    lookAt(x, y, z) {
        this.controls.target.x = x;
        this.controls.target.y = y;
        this.controls.target.z = z;
        this.controls.update();
    }
    // Make the controls look at the center position
    lookAtCenter() {
        // let image fill the viewport
        if (this.viewport && this.plane) {
            const planeParameters = this.plane.geometry.parameters;
            this.viewport.set(planeParameters.width * 1.5, planeParameters.height * 1.5);
        }
        if (this.controls) {
            this.controls.reset();
        }
        if (this.plane && this.plane.position) {
            this.pan(-this.plane.position.x, this.plane.position.y);
        }
        this.updateScene();
    }
    setCameraMode(mode) {
        // https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
        // A number representing a given button:
        // 0: main button pressed, usually the left button or the un-initialized state
        const MAIN_BUTTON = 0;
        const ROTATE = 0;
        const PAN = 2;

        if (mode === CAMERA_MODE_ROTATE) {
            this.controls && this.controls.setMouseButtonState(MAIN_BUTTON, ROTATE);
        }
        if (mode === CAMERA_MODE_PAN) {
            this.controls && this.controls.setMouseButtonState(MAIN_BUTTON, PAN);
        }
    }
    zoom(factor) {
        if (factor === 1.0 || factor <= 0) {
            return;
        }

        if (this.camera.inOrthographicMode) {
            const zoom = this.camera.zoom * factor;
            if (zoom > 0.1) {
                this.camera.setZoom(zoom);
            } else {
                this.camera.setZoom(0.1);
            }
        } else {
            this.camera.position.z *= (2 - factor);
        }

        this.controls.update();

        // Update the scene
        this.updateScene();
    }
    zoomIn(delta = 0.1) {
        const { noZoom, zoomSpeed } = this.controls;
        const factor = 1.0 + delta * zoomSpeed;
        !noZoom && this.zoom(factor);
    }
    zoomOut(delta = 0.1) {
        const { noZoom, zoomSpeed } = this.controls;
        const factor = 1.0 + -1 * delta * zoomSpeed;
        !noZoom && this.zoom(factor);
    }
    // deltaX and deltaY are in pixels; right and down are positive
    pan(deltaX, deltaY) {
        const eye = new THREE.Vector3();
        const pan = new THREE.Vector3();
        const objectUp = new THREE.Vector3();

        eye.subVectors(this.controls.object.position, this.controls.target);
        objectUp.copy(this.controls.object.up);

        pan.copy(eye).cross(objectUp.clone()).setLength(deltaX);
        pan.add(objectUp.clone().setLength(deltaY));

        this.controls.object.position.add(pan);
        this.controls.target.add(pan);
        this.controls.update();
    }
    // http://stackoverflow.com/questions/18581225/orbitcontrol-or-trackballcontrol
    panUp() {
        const { noPan, panSpeed } = this.controls;
        !noPan && this.pan(0, 1 * panSpeed);
    }
    panDown() {
        const { noPan, panSpeed } = this.controls;
        !noPan && this.pan(0, -1 * panSpeed);
    }
    panLeft() {
        const { noPan, panSpeed } = this.controls;
        !noPan && this.pan(1 * panSpeed, 0);
    }
    panRight() {
        const { noPan, panSpeed } = this.controls;
        !noPan && this.pan(-1 * panSpeed, 0);
    }
    render() {
        if (!Detector.webgl) {
            return null;
        }

        return (
            <div
                ref={node => {
                    this.node = node;
                }}
            />
        );
    }
}

export default Visualizer;
