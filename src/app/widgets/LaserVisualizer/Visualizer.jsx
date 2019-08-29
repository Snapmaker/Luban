import React, { Component } from 'react';
import * as THREE from 'three';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import isEqual from 'lodash/isEqual';
import request from 'superagent';

import { DATA_PREFIX, EPSILON } from '../../constants';
import controller from '../../lib/controller';
import { toFixed } from '../../lib/numeric-utils';
import i18n from '../../lib/i18n';
import ProgressBar from '../../components/ProgressBar';
import Space from '../../components/Space';
import ContextMenu from '../../components/ContextMenu';

import Canvas from '../../components/SMCanvas';
import PrintablePlate from '../CncLaserShared/PrintablePlate';
import SecondaryToolbar from '../CanvasToolbar/SecondaryToolbar';
import { actions } from '../../flux/cncLaserShared';
import { actions as svgActions } from '../../flux/svgeditor';
import VisualizerTopLeft from './VisualizerTopLeft';
import styles from './styles.styl';


function humanReadableTime(t) {
    const hours = Math.floor(t / 3600);
    const minutes = Math.ceil((t - hours * 3600) / 60);
    return (hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`);
}


class Visualizer extends Component {
    static propTypes = {
        sourceType: PropTypes.string.isRequired,
        hasModel: PropTypes.bool.isRequired,
        size: PropTypes.object.isRequired,
        selectedModelID: PropTypes.string,
        backgroundGroup: PropTypes.object.isRequired,
        modelGroup: PropTypes.object.isRequired,
        toolPathModelGroup: PropTypes.object.isRequired,
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
        onModelTransform: PropTypes.func.isRequired,
        onModelAfterTransform: PropTypes.func.isRequired,

        importSVGString: PropTypes.func.isRequired
    };

    contextMenuRef = React.createRef();

    visualizerRef = React.createRef();

    printableArea = null;

    canvas = React.createRef();

    state = {
        progress: 0
    };

    actions = {
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
            this.props.onModelAfterTransform();
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
        },
        editSVG: async () => {
            const selectedModel = this.props.getSelectedModel();
            const uploadPath = `${DATA_PREFIX}/${selectedModel.uploadName}`;
            const res = await request.get(uploadPath);
            this.props.importSVGString(res.text);
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

        this.showContextMenu = this.showContextMenu.bind(this);
    }

    componentDidMount() {
        this.addControllerEvents();

        this.canvas.current.resizeWindow();
        this.canvas.current.disable3D();

        window.addEventListener(
            'hashchange',
            (event) => {
                if (event.newURL.endsWith('laser')) {
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

        const { selectedModelID } = nextProps;
        if (selectedModelID !== this.props.selectedModelID) {
            const selectedModel = this.props.getSelectedModel();
            if (!selectedModel) {
                this.canvas.current.controls.detach();
            } else {
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
        this.removeControllerEvents();
    }

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

    showContextMenu(event) {
        this.contextMenuRef.current.show(event);
    }

    render() {
        const isModelSelected = !!this.props.selectedModelID;
        const { sourceType, hasModel } = this.props;

        const estimatedTime = isModelSelected ? this.props.getEstimatedTime('selected') : this.props.getEstimatedTime('total');

        const menuItems = [
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
        ];

        if (sourceType === 'svg') {
            menuItems.splice(0, 0, {
                type: 'item',
                label: i18n._('Edit'),
                onClick: this.actions.editSVG
            }, {
                type: 'separator'
            });
        }

        return (
            <div
                ref={this.visualizerRef}
                style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
            >
                <div className={styles['visualizer-content']}>
                    <Canvas
                        ref={this.canvas}
                        size={this.props.size}
                        backgroundGroup={this.props.backgroundGroup}
                        modelGroup={this.props.modelGroup.object}
                        toolPathModelGroup={this.props.toolPathModelGroup.object}
                        printableArea={this.printableArea}
                        cameraInitialPosition={new THREE.Vector3(0, 0, 70)}
                        onSelectModel={this.actions.onSelectModel}
                        onUnselectAllModels={this.actions.onUnselectAllModels}
                        onModelAfterTransform={this.actions.onModelAfterTransform}
                        onModelTransform={this.actions.onModelTransform}
                        showContextMenu={this.showContextMenu}
                        transformSourceType="2D"
                    />
                    <div className={styles['visualizer-top-left']}>
                        <VisualizerTopLeft />
                    </div>
                </div>
                <div className={styles['visualizer-footer']}>
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
                    id="laser"
                    menuItems={menuItems}
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;

    const { background } = state.laser;
    // const { modelGroup, transformation, model, hasModel, previewUpdated, renderingTimestamp } = state.laser;
    const { selectedModelID, modelGroup, toolPathModelGroup, sourceType, hasModel, renderingTimestamp } = state.laser;
    return {
        size: machine.size,
        sourceType,
        hasModel,
        selectedModelID,
        modelGroup,
        toolPathModelGroup,
        // model,
        backgroundGroup: background.group,
        renderingTimestamp
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        getEstimatedTime: (type) => dispatch(actions.getEstimatedTime('laser', type)),
        getSelectedModel: () => dispatch(actions.getSelectedModel('laser')),
        bringSelectedModelToFront: () => dispatch(actions.bringSelectedModelToFront('laser')),
        sendSelectedModelToBack: () => dispatch(actions.sendSelectedModelToBack('laser')),
        arrangeAllModels2D: () => dispatch(actions.arrangeAllModels2D('laser')),
        // updateSelectedModelTransformation: (transformation) => dispatch(actions.updateSelectedModelTransformation('laser', transformation)),
        onSetSelectedModelPosition: (position) => dispatch(actions.onSetSelectedModelPosition('laser', position)),
        onFlipSelectedModel: (flip) => dispatch(actions.onFlipSelectedModel('laser', flip)),
        selectModel: (model) => dispatch(actions.selectModel('laser', model)),
        unselectAllModels: () => dispatch(actions.unselectAllModels('laser')),
        removeSelectedModel: () => dispatch(actions.removeSelectedModel('laser')),
        onModelTransform: () => dispatch(actions.onModelTransform('laser')),
        onModelAfterTransform: () => dispatch(actions.onModelAfterTransform('laser')),
        importSVGString: (content) => dispatch(svgActions.importSVGString(content))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Visualizer);
