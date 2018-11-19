import React, { Component } from 'react';
import * as THREE from 'three';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import PrintablePlate from '../../components/PrintablePlate';
import Canvas from '../Canvas/Canvas';
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
        imageParams: PropTypes.object.isRequired,
        anchor: PropTypes.string.isRequired,
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
        this.canvas.disabled3D();

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
        this.updateModel(nextProps.imageParams, nextProps.anchor);
    }

    updateModel(imageParams, anchor) {
        // FIXME: callback several times
        // if any changed, update modelGroup
        // not support multi-models
        const { imageSrc, sizeWidth, sizeHeight } = imageParams;
        if (!imageSrc || !sizeWidth || !sizeHeight || !anchor) {
            return;
        }
        this.modelGroup.remove(...this.modelGroup.children);
        const geometry = new THREE.PlaneGeometry(sizeWidth, sizeHeight);
        const texture = new THREE.TextureLoader().load(imageSrc);
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
                position = new THREE.Vector3(sizeWidth / 2, sizeHeight / 2, 0);
                break;
            case 'Bottom Middle':
                position = new THREE.Vector3(0, sizeHeight / 2, 0);
                break;
            case 'Bottom Right':
                position = new THREE.Vector3(-sizeWidth / 2, sizeHeight / 2, 0);
                break;
            case 'Top Left':
                position = new THREE.Vector3(sizeWidth / 2, -sizeHeight / 2, 0);
                break;
            case 'Top Middle':
                position = new THREE.Vector3(0, -sizeHeight / 2, 0);
                break;
            case 'Top Right':
                position = new THREE.Vector3(-sizeWidth / 2, -sizeHeight / 2, 0);
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
        imageParams: state.cnc.imageParams,
        anchor: state.cnc.pathParams.anchor
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        uploadImage: (file, onFailure) => dispatch(actions.uploadImage(file, onFailure)),
        loadDefaultImage: () => dispatch(actions.loadDefaultImage())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Visualizer);
