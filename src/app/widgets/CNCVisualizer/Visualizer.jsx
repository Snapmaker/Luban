import isEqual from 'lodash/isEqual';
import React, { Component } from 'react';
import * as THREE from 'three';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';

import { EPSILON } from '../../constants';
import i18n from '../../lib/i18n';
import controller from '../../lib/controller';
import { toFixed } from '../../lib/numeric-utils';
import ProgressBar from '../../components/ProgressBar';
import ContextMenu from '../../components/ContextMenu';
import Space from '../../components/Space';

import Canvas from '../../components/SMCanvas';
import PrintablePlate from '../CncLaserShared/PrintablePlate';
import PrimaryToolbar from '../CanvasToolbar/PrimaryToolbar';
import SecondaryToolbar from '../CanvasToolbar/SecondaryToolbar';
import { actions } from '../../flux/cncLaserShared';
import styles from '../styles.styl';


function humanReadableTime(t) {
    const hours = Math.floor(t / 3600);
    const minutes = Math.ceil((t - hours * 3600) / 60);
    return (hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`);
}


class Visualizer extends Component {
    static propTypes = {
        hasModel: PropTypes.bool.isRequired,
        size: PropTypes.object.isRequired,
        // model: PropTypes.object,
        selectedModelID: PropTypes.string,
        modelGroup: PropTypes.object.isRequired,

        renderingTimestamp: PropTypes.number.isRequired,

        // func
        getEstimatedTime: PropTypes.func.isRequired,
        getSelectedModel: PropTypes.func.isRequired,
        bringSelectedModelToFront: PropTypes.func.isRequired,
        sendSelectedModelToBack: PropTypes.func.isRequired,
        arrangeAllModels2D: PropTypes.func.isRequired,

        onSetSelectedModelPosition: PropTypes.func.isRequired,
        onFlipSelectedModel: PropTypes.func.isRequired,
        selectModel: PropTypes.func.isRequired,
        unselectAllModels: PropTypes.func.isRequired,
        removeSelectedModel: PropTypes.func.isRequired,
        onModelTransform: PropTypes.func.isRequired
    };

    contextMenuRef = React.createRef();

    visualizerRef = React.createRef();

    printableArea = null;

    canvas = React.createRef();

    state = {
        coordinateVisible: true,
        progress: 0
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
            this.canvas.current.zoomIn();
        },
        zoomOut: () => {
            this.canvas.current.zoomOut();
        },
        autoFocus: () => {
            this.canvas.current.autoFocus();
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
        },
        // context menu
        bringToFront: () => {
            this.props.bringSelectedModelToFront();
        },
        sendToBack: () => {
            this.props.sendSelectedModelToBack();
        },
        onUpdateSelectedModelPosition: (position) => {
            this.props.onSetSelectedModelPosition(position);
        },
        deleteSelectedModel: () => {
            this.props.removeSelectedModel();
            this.setState({
                progress: 0
            });
        },
        arrangeAllModels: () => {
            this.props.arrangeAllModels2D();
        }
    };

    controllerEvents = {
        'task:completed': () => {
            this.setState({
                progress: 1.0
            });
        },
        'task:progress': (progress) => {
            if (Math.abs(progress - this.state.progress) > 0.05) {
                this.setState({
                    progress: progress
                });
            }
        }
    };

    constructor(props) {
        super(props);

        const size = props.size;
        this.printableArea = new PrintablePlate(size);
    }

    componentDidMount() {
        // this.visualizerRef.current.addEventListener('mousedown', this.hideContextMenu, false);
        // this.visualizerRef.current.addEventListener('wheel', this.hideContextMenu, false);
        // this.visualizerRef.current.addEventListener('contextmenu', this.showContextMenu, false);
        this.addControllerEvents();

        // this.visualizerRef.current.addEventListener('mouseup', (e) => {
        //     const event = simulateMouseEvent(e, 'contextmenu');
        //     this.visualizerRef.current.dispatchEvent(event);
        // }, false);

        this.canvas.current.resizeWindow();
        // this.canvas.current.disable3D();

        window.addEventListener(
            'hashchange',
            (event) => {
                if (event.newURL.endsWith('cnc')) {
                    this.canvas.current.resizeWindow();
                }
            },
            false
        );
    }

    componentWillReceiveProps(nextProps) {
        const { renderingTimestamp } = nextProps;

        if (!isEqual(nextProps.size, this.props.size)) {
            const size = nextProps.size;
            this.printableArea.updateSize(size);
        }

        // TODO: find better way
        /*
        this.canvas.current.updateTransformControl2D();
        const { model } = nextProps;
        if (model !== this.props.model) {
            if (!model) {
                this.canvas.current.controls.detach();
            } else {
                const sourceType = model.modelInfo.source.type;
                if (sourceType === 'text') {
                    this.canvas.current.setTransformControls2DState({ enabledScale: false });
                } else {
                    this.canvas.current.setTransformControls2DState({ enabledScale: true });
                }

                this.canvas.current.controls.attach(model);
            }
        }
        */

        this.canvas.current.updateTransformControl2D();
        const { selectedModelID } = nextProps;
        // const { model } = nextProps;
        if (selectedModelID !== this.props.selectedModelID) {
            const selectedModel = this.props.getSelectedModel();
            if (!selectedModel) {
                this.canvas.current.controls.detach();
            } else {
                const sourceType = selectedModel.sourceType;
                if (sourceType === 'text') {
                    this.canvas.current.setTransformControls2DState({ enabledScale: false });
                } else {
                    this.canvas.current.setTransformControls2DState({ enabledScale: true });
                }
                // this.canvas.current.controls.attach(model);
                // this.canvas.current.controls.attach(this.props.getSelectedModel().meshObject);
                const meshObject = selectedModel.meshObject;
                if (meshObject) {
                    this.canvas.current.controls.attach(meshObject);
                }
            }
        }

        if (renderingTimestamp !== this.props.renderingTimestamp) {
            this.canvas.current.renderScene();
        }
    }

    componentWillUnmount() {
        // this.visualizerRef.current.removeEventListener('mousedown', this.hideContextMenu, false);
        // this.visualizerRef.current.removeEventListener('wheel', this.hideContextMenu, false);
        // this.visualizerRef.current.removeEventListener('contextmenu', this.showContextMenu, false);
        this.removeControllerEvents();
    }

    // hideContextMenu = () => {
    //     ContextMenu.hide();
    // };

    showContextMenu = (event) => {
        this.contextMenuRef.current.show(event);
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

    render() {
        // const actions = this.actions;
        // const isModelSelected = !!this.props.model;
        const isModelSelected = !!this.props.selectedModelID;
        const hasModel = this.props.hasModel;

        // const { model, modelGroup } = this.props;

        /*
        let estimatedTime = 0;
        if (hasModel) {
            if (model && model.toolPath) {
                estimatedTime = model.toolPath.estimatedTime;
                if (model.modelInfo.gcodeConfig.multiPassEnabled) {
                    estimatedTime *= model.modelInfo.gcodeConfig.multiPasses;
                }
            } else {
                for (const model2 of modelGroup.children) {
                    if (model2.toolPath) {
                        let t = model2.toolPath.estimatedTime;
                        if (model2.modelInfo.gcodeConfig.multiPassEnabled) {
                            t *= model2.modelInfo.gcodeConfig.multiPasses;
                        }
                        estimatedTime += t;
                    }
                }
            }
        }
        */

        const estimatedTime = isModelSelected ? this.props.getEstimatedTime('selected') : this.props.getEstimatedTime('total');

        return (
            <div
                ref={this.visualizerRef}
                style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
            >
                <div className={styles['canvas-header']}>
                    <PrimaryToolbar actions={this.actions} state={this.state} />
                </div>
                <div className={styles['canvas-content']}>
                    <Canvas
                        ref={this.canvas}
                        size={this.props.size}
                        modelGroup={this.props.modelGroup.object}
                        printableArea={this.printableArea}
                        cameraInitialPosition={new THREE.Vector3(0, 0, 70)}
                        onSelectModel={this.actions.onSelectModel}
                        onUnselectAllModels={this.actions.onUnselectAllModels}
                        onModelAfterTransform={this.actions.onModelAfterTransform}
                        onModelTransform={this.actions.onModelTransform}
                        showContextMenu={this.showContextMenu}
                        transformSourceType="2D"
                    />
                </div>
                <div className={styles['canvas-footer']}>
                    <SecondaryToolbar actions={this.actions} />
                </div>
                {estimatedTime && (
                    <div className={styles['visualizer-info']}>
                        {i18n._('Estimated Time:')}<Space width={4} />{humanReadableTime(estimatedTime)}
                    </div>
                )}
                {isModelSelected && (
                    <div className={styles['visualizer-notice']}>
                        {(this.state.progress < 1 - EPSILON) && (
                            <p>{i18n._('Generating tool path... {{progress}}%', { progress: toFixed(this.state.progress, 2) * 100.0 })}</p>
                        )}
                        {(this.state.progress > 1 - EPSILON) && (
                            <p>{i18n._('Generated tool path successfully.')}</p>
                        )}
                    </div>
                )}
                {isModelSelected && (
                    <div className={styles['visualizer-progress']}>
                        <ProgressBar progress={this.state.progress * 100.0} />
                    </div>
                )}
                <ContextMenu
                    ref={this.contextMenuRef}
                    id="cnc"
                    menuItems={
                        [
                            {
                                type: 'item',
                                label: i18n._('Bring to Front'),
                                disabled: !isModelSelected,
                                onClick: this.actions.bringToFront
                            },
                            {
                                type: 'item',
                                label: i18n._('Send to Back'),
                                disabled: !isModelSelected,
                                onClick: this.actions.sendToBack
                            },
                            {
                                type: 'subMenu',
                                label: i18n._('Reference Position'),
                                disabled: !isModelSelected,
                                items: [
                                    {
                                        type: 'item',
                                        label: i18n._('Top Left'),
                                        onClick: () => this.actions.onUpdateSelectedModelPosition('Top Left')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Top Middle'),
                                        onClick: () => this.actions.onUpdateSelectedModelPosition('Top Middle')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Top Right'),
                                        onClick: () => this.actions.onUpdateSelectedModelPosition('Top Right')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Center Left'),
                                        onClick: () => this.actions.onUpdateSelectedModelPosition('Center Left')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Center'),
                                        onClick: () => this.actions.onUpdateSelectedModelPosition('Center')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Center Right'),
                                        onClick: () => this.actions.onUpdateSelectedModelPosition('Center Right')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Bottom Left'),
                                        onClick: () => this.actions.onUpdateSelectedModelPosition('Bottom Left')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Bottom Middle'),
                                        onClick: () => this.actions.onUpdateSelectedModelPosition('Bottom Middle')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Bottom Right'),
                                        onClick: () => this.actions.onUpdateSelectedModelPosition('Bottom Right')
                                    }
                                ]
                            },
                            {
                                type: 'subMenu',
                                label: i18n._('Flip'),
                                disabled: !isModelSelected,
                                items: [
                                    {
                                        type: 'item',
                                        label: i18n._('Vertical'),
                                        onClick: () => this.props.onFlipSelectedModel('Vertical')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Horizontal'),
                                        onClick: () => this.props.onFlipSelectedModel('Horizontal')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Reset'),
                                        onClick: () => this.props.onFlipSelectedModel('Reset')
                                    }
                                ]
                            },
                            {
                                type: 'separator'
                            },
                            {
                                type: 'item',
                                label: i18n._('Delete Selected Model'),
                                disabled: !isModelSelected,
                                onClick: this.actions.deleteSelectedModel
                            },
                            {
                                type: 'item',
                                label: i18n._('Arrange All Models'),
                                disabled: !hasModel,
                                onClick: this.actions.arrangeAllModels
                            }
                        ]
                    }
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    // call canvas.updateTransformControl2D() when transformation changed or model selected changed
    const { selectedModelID, modelGroup, hasModel, renderingTimestamp } = state.cnc;
    return {
        size: machine.size,
        // model,
        modelGroup,
        selectedModelID,
        hasModel,
        renderingTimestamp
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        getEstimatedTime: (type) => dispatch(actions.getEstimatedTime('cnc', type)),
        getSelectedModel: () => dispatch(actions.getSelectedModel('cnc')),
        bringSelectedModelToFront: () => dispatch(actions.bringSelectedModelToFront('cnc')),
        sendSelectedModelToBack: () => dispatch(actions.sendSelectedModelToBack('cnc')),
        arrangeAllModels2D: () => dispatch(actions.arrangeAllModels2D('cnc')),
        onSetSelectedModelPosition: (position) => dispatch(actions.onSetSelectedModelPosition('cnc', position)),
        onFlipSelectedModel: (flip) => dispatch(actions.onFlipSelectedModel('cnc', flip)),
        selectModel: (model) => dispatch(actions.selectModel('cnc', model)),
        unselectAllModels: () => dispatch(actions.unselectAllModels('cnc')),
        removeSelectedModel: () => dispatch(actions.removeSelectedModel('cnc')),
        onModelTransform: () => dispatch(actions.onModelTransform('cnc'))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Visualizer);
