import React, { Component } from 'react';
import * as THREE from 'three';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Canvas, PrintablePlate } from '../Canvas';
import PrimaryToolbar from '../CanvasToolbar/PrimaryToolbar';
import SecondaryToolbar from '../CanvasToolbar/SecondaryToolbar';
import styles from '../styles.styl';
import { actions } from '../../reducers/laser';
import combokeys from '../../lib/combokeys';


class Visualizer extends Component {
    static propTypes = {
        backgroundGroup: PropTypes.object.isRequired,
        model: PropTypes.object,
        modelType: PropTypes.string,
        modelGroup: PropTypes.object.isRequired,
        selectModel: PropTypes.func.isRequired,
        unselectAllModels: PropTypes.func.isRequired,
        removeSelectedModel: PropTypes.func.isRequired,
        onModelTransform: PropTypes.func.isRequired
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
            this.props.onModelTransform();
        }
    };

    keyEventHandlers = {
        'DELETE': (event) => {
            this.props.removeSelectedModel();
        }
    };

    addEventHandlers() {
        Object.keys(this.keyEventHandlers).forEach(eventName => {
            const callback = this.keyEventHandlers[eventName];
            combokeys.on(eventName, callback);
        });
    }

    removeEventHandlers() {
        Object.keys(this.keyEventHandlers).forEach(eventName => {
            const callback = this.keyEventHandlers[eventName];
            combokeys.removeListener(eventName, callback);
        });
    }

    componentDidMount() {
        this.canvas.resizeWindow();
        this.canvas.disable3D();

        window.addEventListener(
            'hashchange',
            (event) => {
                if (event.newURL.endsWith('laser')) {
                    this.canvas.resizeWindow();
                } else {
                    // Unselect all models when switch to other tabs
                    this.props.unselectAllModels();
                }
            },
            false
        );

        this.addEventHandlers();
    }

    componentWillUnmount() {
        this.removeEventHandlers();
    }

    componentWillReceiveProps(nextProps) {
        // TODO: fix
        this.canvas.updateTransformControl2D();
        const { model } = nextProps;
        if (!model) {
            this.canvas.detachSelectedModel();
        } else {
            const sourceType = model.modelInfo.source.type;
            if (sourceType === 'text') {
                this.canvas.setTransformControls2DState({ enabledScale: false });
            } else {
                this.canvas.setTransformControls2DState({ enabledScale: true });
            }
            this.canvas.transformControls.attach(model);
        }
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
                        backgroundGroup={this.props.backgroundGroup}
                        modelGroup={this.props.modelGroup}
                        printableArea={this.printableArea}
                        enabledTransformModel={true}
                        modelInitialRotation={new THREE.Euler()}
                        cameraInitialPosition={new THREE.Vector3(0, 0, 70)}
                        onSelectModel={actions.onSelectModel}
                        onUnselectAllModels={actions.onUnselectAllModels}
                        onModelAfterTransform={actions.onModelAfterTransform}
                        onModelTransform={actions.onModelTransform}
                        transformModelType="2D"
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
    const { background, modelGroup, model, transformation } = state.laser;
    const { rotation, width, height, translateX, translateY } = transformation;
    return {
        backgroundGroup: background.group,
        modelGroup: modelGroup,
        modelType: model ? model.modelInfo.source.type : null,
        model: model,
        rotation: rotation,
        width: width,
        height: height,
        translateX: translateX,
        translateY: translateY
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        selectModel: (model) => dispatch(actions.selectModel(model)),
        unselectAllModels: () => dispatch(actions.unselectAllModels()),
        removeSelectedModel: () => dispatch(actions.removeSelectedModel()),
        onModelTransform: () => dispatch(actions.onModelTransform())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Visualizer);
