import React, { Component } from 'react';
import PropTypes from 'prop-types';
import * as THREE from 'three';
import Detector from 'three/examples/js/Detector';
import controller from '../../../lib/controller';
import RectangleGridHelper from '../../../components/three-extensions/RectangleGridHelper';
import { WEB_CACHE_IMAGE } from '../../../constants';

class TracePreview extends Component {
    static propTypes = {
        size: PropTypes.object.isRequired,
        width: PropTypes.number.isRequired,
        height: PropTypes.number.isRequired,
        sideLength: PropTypes.number.isRequired
    };

    state = {
        tracePaths: []
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
        this.filenames = [];
    }

    controllerEvents = {
        'task:state': (tracePaths) => {
            this.setState({
                tracePaths: tracePaths
            });
        }
    };

    addControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.on(eventName, callback);
        });
    }

    removeControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.off(eventName, callback);
        });
    }

    componentDidMount() {
        this.setupThreejs();
        // this.setupSquare(this.props.sideLength);
        // this.addGrid();
        this.animate();
        this.addControllerEvents();
    }

    componentWillUnmount() {
        cancelAnimationFrame(this.frameId);
        this.removeControllerEvents();
    }

    componentWillReceiveProps(nextProps) {
        const { sideLength } = nextProps;
        sideLength && this.squareLine.scale.set(sideLength, sideLength, 1);
    }

    setupThreejs() {
        const { width, height } = this.props;

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
        this.node.current.appendChild(this.renderer.domElement);
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
        const { size } = this.props;

        const grid = new RectangleGridHelper(size.x, size.y, 10);
        grid.material.opacity = 0.25;
        grid.material.transparent = true;
        grid.rotateX(Math.PI / 2);
        this.group.add(grid);
    }

    animate = () => {
        this.renderScene();
        this.frameId = requestAnimationFrame(this.animate);
    };

    renderScene() {
        this.renderer.render(this.scene, this.camera);
    }

    render() {
        if (!Detector.webgl) {
            return null;
        }
        const filenames = this.state.tracePaths.filenames;
        const imgLength = filenames ? filenames.length : 0;
        const { width, height } = this.props;
        const imgWidth = imgLength ? width / imgLength : 400;
        const imgHeight = imgLength ? height / imgLength : 400;
        return (
            <div ref={this.node}>
                {filenames && (
                    <img
                        src={`${WEB_CACHE_IMAGE}/${filenames[0]}`}
                        alt="trace"
                        width={imgWidth}
                        height={imgHeight}
                    />
                )}
            </div>
        );
    }
}

export default TracePreview;
