import React, { Component } from 'react';
import * as THREE from 'three';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Canvas, PrintablePlate } from '../Canvas';
import PrimaryToolbar from '../CanvasToolbar/PrimaryToolbar';
import SecondaryToolbar from '../CanvasToolbar/SecondaryToolbar';
import styles from '../styles.styl';
import { actions } from '../../reducers/modules/laser';


class Visualizer extends Component {
    static propTypes = {
        modelGroup: PropTypes.object.isRequired,
        selectModel: PropTypes.func.isRequired,
        unselectAllModels: PropTypes.func.isRequired
    };

    printableArea = new PrintablePlate();
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
        },
        onSelectModel: (model) => {
            this.props.selectModel(model);
        },
        onUnselectAllModels: () => {
            this.props.unselectAllModels();
        },
        onModelAfterTransform: () => {
        },
        onModelTransform: () => {
        }
    };

    componentDidMount() {
        this.canvas.resizeWindow();
        this.canvas.disable3D();

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

    render() {
        const actions = this.actions;
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
                        modelGroup={this.props.modelGroup}
                        printableArea={this.printableArea}
                        enabledTransformModel={false}
                        modelInitialRotation={new THREE.Euler()}
                        cameraInitialPosition={new THREE.Vector3(0, 0, 70)}
                        onSelectModel={actions.onSelectModel}
                        onUnselectAllModels={actions.onUnselectAllModels}
                        onModelAfterTransform={actions.onModelAfterTransform}
                        onModelTransform={actions.onModelTransform}
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
    const laser = state.laser;
    return {
        modelGroup: laser.modelGroup
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        selectModel: (model) => dispatch(actions.selectModel(model)),
        unselectAllModels: () => dispatch(actions.unselectAllModels())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Visualizer);
