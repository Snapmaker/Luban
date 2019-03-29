import isEqual from 'lodash/isEqual';
import React, { Component } from 'react';
import * as THREE from 'three';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { Canvas, PrintablePlate } from '../Canvas';
import PrimaryToolbar from '../CanvasToolbar/PrimaryToolbar';
import SecondaryToolbar from '../CanvasToolbar/SecondaryToolbar';
import styles from '../styles.styl';
import { actions } from '../../reducers/cncLaserShared';
import ContextMenu from '../../components/ContextMenu';
import i18n from '../../lib/i18n';
import { simulateMouseEvent } from '../../lib/utils';
import controller from '../../lib/controller';
import ProgressBar from '../../components/ProgressBar';
import { toFixed } from '../../lib/numeric-utils';
import { EPSILON } from '../../constants';

class Visualizer extends Component {
    static propTypes = {
        hasModel: PropTypes.bool.isRequired,
        size: PropTypes.object.isRequired,
        model: PropTypes.object,
        transformation: PropTypes.object,
        modelGroup: PropTypes.object.isRequired,
        onSetSelectedModelPosition: PropTypes.func.isRequired,
        onFlipModel: PropTypes.func.isRequired,
        selectModel: PropTypes.func.isRequired,
        unselectAllModels: PropTypes.func.isRequired,
        removeSelectedModel: PropTypes.func.isRequired,
        onModelTransform: PropTypes.func.isRequired,
        updateSelectedModelTransformation: PropTypes.func.isRequired,
        getEstimatedTimeStr: PropTypes.func.isRequired
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
            this.props.modelGroup.bringSelectedModelToFront();
        },
        sendToBack: () => {
            this.props.modelGroup.sendSelectedModelToBack();
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
            this.props.modelGroup.arrangeAllModels();
        }
    };

    constructor(props) {
        super(props);

        const size = props.size;
        this.printableArea = new PrintablePlate(size);
    }

    controllerEvents = {
        'task:completed': (params) => {
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
        },
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

    hideContextMenu = () => {
        ContextMenu.hide();
    };

    showContextMenu = (event) => {
        this.contextMenuRef.current.show(event);
    };

    componentDidMount() {
        this.visualizerRef.current.addEventListener('mousedown', this.hideContextMenu, false);
        this.visualizerRef.current.addEventListener('wheel', this.hideContextMenu, false);
        this.visualizerRef.current.addEventListener('contextmenu', this.showContextMenu, false);
        this.addControllerEvents();

        this.visualizerRef.current.addEventListener('mouseup', (e) => {
            const event = simulateMouseEvent(e, 'contextmenu');
            this.visualizerRef.current.dispatchEvent(event);
        }, false);

        this.canvas.current.resizeWindow();
        this.canvas.current.disable3D();

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

    componentWillUnmount() {
        this.visualizerRef.current.removeEventListener('mousedown', this.hideContextMenu, false);
        this.visualizerRef.current.removeEventListener('wheel', this.hideContextMenu, false);
        this.visualizerRef.current.removeEventListener('contextmenu', this.showContextMenu, false);
        this.removeControllerEvents();
    }

    componentWillReceiveProps(nextProps) {
        if (!isEqual(nextProps.size, this.props.size)) {
            const size = nextProps.size;
            this.printableArea.updateSize(size);
        }

        // TODO: find better way
        this.canvas.current.updateTransformControl2D();
        const { model } = nextProps;
        if (!model) {
            this.canvas.current.detachSelectedModel();
        } else {
            this.canvas.current.transformControls.attach(model);
        }
    }

    render() {
        const actions = this.actions;
        const isModelSelected = !!this.props.model;
        const hasModel = this.props.hasModel;
        const estimatedTimeStr = this.props.getEstimatedTimeStr();
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
                <div className={styles['visualizer-info']}>
                    <p><span />{estimatedTimeStr}</p>
                </div>
                {isModelSelected && (
                    <div className={styles['progress-title']}>
                        {(this.state.progress < 1 - EPSILON) &&
                            <p>{i18n._('Generating ToolPath... {{progress}}%', { progress: toFixed(this.state.progress, 2) * 100.0 })}</p>
                        }
                        {(this.state.progress > 1 - EPSILON) &&
                            <p>{i18n._('Generated ToolPath successfully.')}</p>
                        }
                    </div>
                )}
                {isModelSelected && (
                    <div className={styles['progress-bar']}>
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
                                onClick: actions.bringToFront
                            },
                            {
                                type: 'item',
                                label: i18n._('Send to Back'),
                                disabled: !isModelSelected,
                                onClick: actions.sendToBack
                            },
                            {
                                type: 'subMenu',
                                label: i18n._('Reference Position'),
                                disabled: !isModelSelected,
                                items: [
                                    {
                                        type: 'item',
                                        label: i18n._('Top Left'),
                                        onClick: () => actions.onUpdateSelectedModelPosition('Top Left')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Top Middle'),
                                        onClick: () => actions.onUpdateSelectedModelPosition('Top Middle')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Top Right'),
                                        onClick: () => actions.onUpdateSelectedModelPosition('Top Right')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Center Left'),
                                        onClick: () => actions.onUpdateSelectedModelPosition('Center Left')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Center'),
                                        onClick: () => actions.onUpdateSelectedModelPosition('Center')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Center Right'),
                                        onClick: () => actions.onUpdateSelectedModelPosition('Center Right')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Bottom Left'),
                                        onClick: () => actions.onUpdateSelectedModelPosition('Bottom Left')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Bottom Middle'),
                                        onClick: () => actions.onUpdateSelectedModelPosition('Bottom Middle')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Bottom Right'),
                                        onClick: () => actions.onUpdateSelectedModelPosition('Bottom Right')
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
                                        label: i18n._('Upside Down'),
                                        onClick: () => this.props.onFlipModel('Upside Down')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Left to Right'),
                                        onClick: () => this.props.onFlipModel('Left to Right')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Reset'),
                                        onClick: () => this.props.onFlipModel('Reset')
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
                                onClick: actions.deleteSelectedModel
                            },
                            {
                                type: 'item',
                                label: i18n._('Arrange All Models'),
                                disabled: !hasModel,
                                onClick: actions.arrangeAllModels
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
    const { modelGroup, transformation, model, hasModel } = state.cnc;
    return {
        size: machine.size,
        model,
        modelGroup,
        transformation,
        hasModel
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateSelectedModelTransformation: (transformation) => dispatch(actions.updateSelectedModelTransformation('cnc', transformation)),
        onSetSelectedModelPosition: (position) => dispatch(actions.onSetSelectedModelPosition('cnc', position)),
        onFlipModel: (flip) => dispatch(actions.onFlipModel('cnc', flip)),
        selectModel: (model) => dispatch(actions.selectModel('cnc', model)),
        unselectAllModels: () => dispatch(actions.unselectAllModels('cnc')),
        removeSelectedModel: () => dispatch(actions.removeSelectedModel('cnc')),
        onModelTransform: () => dispatch(actions.onModelTransform('cnc')),
        getEstimatedTimeStr: () => dispatch(actions.getEstimatedTimeStr('cnc'))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Visualizer);
