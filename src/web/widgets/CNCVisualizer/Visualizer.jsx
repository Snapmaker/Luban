import React, { Component } from 'react';
import * as THREE from 'three';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { Canvas, PrintablePlate } from '../Canvas';
import i18n from '../../lib/i18n';
import { actions } from '../../reducers/modules/cnc';
import UploadControl from './UploadControl';
import modal from '../../lib/modal';
import PrimaryToolbar from '../CanvasToolbar/PrimaryToolbar';
import SecondaryToolbar from '../CanvasToolbar/SecondaryToolbar';
import styles from './styles.styl';


class Visualizer extends Component {
    static propTypes = {
        // from redux
        displayedObject3D: PropTypes.object,
        uploadImage: PropTypes.func.isRequired,
        loadDefaultImage: PropTypes.func.isRequired
    };

    printableArea = new PrintablePlate();
    modelGroup = new THREE.Group();
    canvas = null;

    state = {
        coordinateVisible: true
    };

    actions = {
        onChangeFile: (event) => {
            const file = event.target.files[0];
            this.props.uploadImage(file, () => {
                modal({
                    title: i18n._('Parse Image Error'),
                    body: i18n._('Failed to parse image file {{}}', { filename: file.name })
                });
            });
        },
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
        this.canvas.enabled3D();

        window.addEventListener(
            'hashchange',
            (event) => {
                if (event.newURL.endsWith('cnc')) {
                    this.canvas.resizeWindow();
                }
            },
            false
        );

        this.props.loadDefaultImage();
    }

    componentWillReceiveProps(nextProps) {
        const { displayedObject3D } = nextProps;
        this.modelGroup.remove(...this.modelGroup.children);
        if (displayedObject3D) {
            this.modelGroup.add(displayedObject3D);
        }
    }

    render() {
        return (
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
                <div className={styles['visualizer-upload-control']}>
                    <UploadControl
                        onChangeFile={this.actions.onChangeFile}
                    />
                </div>
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
                        modelInitialRotation={new THREE.Euler()}
                        cameraInitialPosition={new THREE.Vector3(0, 0, 70)}
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
        displayedObject3D: state.cnc.displayedObject3D
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        uploadImage: (file, onFailure) => dispatch(actions.uploadImage(file, onFailure)),
        loadDefaultImage: () => dispatch(actions.loadDefaultImage())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Visualizer);
