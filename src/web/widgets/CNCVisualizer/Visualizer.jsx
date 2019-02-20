import isEqual from 'lodash/isEqual';
import React, { Component } from 'react';
import * as THREE from 'three';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { Canvas, PrintablePlate } from '../Canvas';
import PrimaryToolbar from '../CanvasToolbar/PrimaryToolbar';
import SecondaryToolbar from '../CanvasToolbar/SecondaryToolbar';
import styles from './styles.styl';
import { actions } from '../../reducers/cncLaserShared';
import combokeys from '../../lib/combokeys';


class Visualizer extends Component {
    static propTypes = {
        size: PropTypes.object.isRequired,
        model: PropTypes.object,
        transformation: PropTypes.object,
        modelGroup: PropTypes.object.isRequired,
        selectModel: PropTypes.func.isRequired,
        unselectAllModels: PropTypes.func.isRequired,
        removeSelectedModel: PropTypes.func.isRequired,
        onModelTransform: PropTypes.func.isRequired
    };

    printableArea = null;
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


    constructor(props) {
        super(props);

        const size = props.size;
        this.printableArea = new PrintablePlate(size);
    }

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
        this.addEventHandlers();

        this.canvas.resizeWindow();
        // this.canvas.disable3D();
        this.canvas.enable3D();

        window.addEventListener(
            'hashchange',
            (event) => {
                if (event.newURL.endsWith('cnc')) {
                    this.canvas.resizeWindow();
                }
            },
            false
        );
    }

    componentWillUnmount() {
        this.removeEventHandlers();
    }

    componentWillReceiveProps(nextProps) {
        if (!isEqual(nextProps.size, this.props.size)) {
            const size = nextProps.size;
            this.printableArea.updateSize(size);
        }

        // TODO: find better way
        this.canvas.updateTransformControl2D();
        const { model } = nextProps;
        if (!model) {
            this.canvas.detachSelectedModel();
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
                        size={this.props.size}
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
    const machine = state.machine;
    // call canvas.updateTransformControl2D() when transformation changed or model selected changed
    const { modelGroup, transformation, model } = state.cncLaserShared.cnc;
    return {
        size: machine.size,
        model,
        modelGroup,
        transformation
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        selectModel: (model) => dispatch(actions.selectModel('cnc', model)),
        unselectAllModels: () => dispatch(actions.unselectAllModels('cnc')),
        removeSelectedModel: () => dispatch(actions.removeSelectedModel('cnc')),
        onModelTransform: () => dispatch(actions.onModelTransform('cnc'))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Visualizer);
