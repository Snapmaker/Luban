import React, { Component } from 'react';
import * as THREE from 'three';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Canvas, PrintablePlate } from '../Canvas';
import PrimaryToolbar from '../CanvasToolbar/PrimaryToolbar';
import SecondaryToolbar from '../CanvasToolbar/SecondaryToolbar';
import styles from '../styles.styl';


class Visualizer extends Component {
    static propTypes = {
        source: PropTypes.object.isRequired,
        target: PropTypes.object.isRequired
    };

    printableArea = new PrintablePlate();
    modelGroup = new THREE.Group();
    canvas = null;

    state = {
        coordinateVisible: true
    };

    actions = {
        // canvas header
        switchCoordinateVisibility: () => {
            const visible = !this.state.coordinateVisible;
            this.setState(
                { coordinateVisible: visible },
                () => {
                    this.printableArea.changeCoordinateVisibility(visible);
                }
            );
        },
        // canvas footer
        zoomIn: () => {
            this.canvas.zoomIn();
        },
        zoomOut: () => {
            this.canvas.zoomOut();
        },
        autoFocus: () => {
            this.canvas.autoFocus();
        }
    };

    componentDidMount() {
        this.canvas.resizeWindow();
        this.canvas.disabled3D();

        window.addEventListener(
            'hashchange',
            (event) => {
                if (event.newURL.endsWith('laser')) {
                    this.canvas.resizeWindow();
                }
            },
            false
        );
    }

    componentWillReceiveProps(nextProps) {
        const { processed, width, height, anchor } = { ...nextProps.source, ...nextProps.target };
        // FIXME: callback twice
        // if any changed, update modelGroup
        // not support multi-models
        this.modelGroup.remove(...this.modelGroup.children);
        const geometry = new THREE.PlaneGeometry(width, height);
        const texture = new THREE.TextureLoader().load(processed);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
            opacity: 0.75,
            transparent: true
        });
        const mesh = new THREE.Mesh(geometry, material);
        let position = new THREE.Vector3(0, 0, 0);
        switch (anchor) {
            case 'Center':
            case 'Center Left':
            case 'Center Right':
                position = new THREE.Vector3(0, 0, 0);
                break;
            case 'Bottom Left':
                position = new THREE.Vector3(width / 2, height / 2, 0);
                break;
            case 'Bottom Middle':
                position = new THREE.Vector3(0, height / 2, 0);
                break;
            case 'Bottom Right':
                position = new THREE.Vector3(-width / 2, height / 2, 0);
                break;
            case 'Top Left':
                position = new THREE.Vector3(width / 2, -height / 2, 0);
                break;
            case 'Top Middle':
                position = new THREE.Vector3(0, -height / 2, 0);
                break;
            case 'Top Right':
                position = new THREE.Vector3(-width / 2, -height / 2, 0);
                break;
            default:
                break;
        }
        mesh.position.copy(position);
        this.modelGroup.add(mesh);
    }

    render() {
        return (
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
                <div className={styles['canvas-header']}>
                    <PrimaryToolbar actions={this.actions} state={this.state} />
                </div>
                <div className={styles['canvas-content']}>
                    <Canvas
                        ref={node => {
                            this.canvas = node;
                        }}
                        modelGroup={this.modelGroup}
                        printableArea={this.printableArea}
                        enabledTransformModel={false}
                        cameraZ={70}
                    />
                </div>
                <div className={styles['canvas-footer']}>
                    <SecondaryToolbar actions={this.actions} />
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        source: state.laser.source,
        target: state.laser.target
    };
};

export default connect(mapStateToProps)(Visualizer);
