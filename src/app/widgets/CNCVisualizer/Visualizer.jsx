import isEqual from 'lodash/isEqual';
import React, { Component } from 'react';
import * as THREE from 'three';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';

import i18n from '../../lib/i18n';
import { controller } from '../../lib/controller';
import ProgressBar from '../../components/ProgressBar';
import ContextMenu from '../../components/ContextMenu';
import Space from '../../components/Space';

import Canvas from '../../components/SMCanvas';
import PrintablePlate from '../CncLaserShared/PrintablePlate';
import SecondaryToolbar from '../CanvasToolbar/SecondaryToolbar';
import { actions as editorActions, CNC_LASER_STAGE } from '../../flux/editor';
import styles from './styles.styl';
import VisualizerTopLeft from './VisualizerTopLeft';
import { PAGE_EDITOR } from '../../constants';
import CncLaserSvgEditor from '../CncLaserSvgEditor';


function humanReadableTime(t) {
    const hours = Math.floor(t / 3600);
    const minutes = Math.ceil((t - hours * 3600) / 60);
    return (hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`);
}


class Visualizer extends Component {
    static propTypes = {
        page: PropTypes.string.isRequired,
        stage: PropTypes.number.isRequired,
        progress: PropTypes.number.isRequired,
        hasModel: PropTypes.bool.isRequired,

        size: PropTypes.object.isRequired,
        // model: PropTypes.object,
        selectedModelID: PropTypes.string,
        modelGroup: PropTypes.object.isRequired,
        svgModelGroup: PropTypes.object.isRequired,
        toolPathModelGroup: PropTypes.object.isRequired,

        renderingTimestamp: PropTypes.number.isRequired,

        // func
        getEstimatedTime: PropTypes.func.isRequired,
        getSelectedModel: PropTypes.func.isRequired,
        bringSelectedModelToFront: PropTypes.func.isRequired,
        sendSelectedModelToBack: PropTypes.func.isRequired,
        arrangeAllModels2D: PropTypes.func.isRequired,
        insertDefaultTextVector: PropTypes.func.isRequired,

        onSetSelectedModelPosition: PropTypes.func.isRequired,
        onFlipSelectedModel: PropTypes.func.isRequired,
        selectModel: PropTypes.func.isRequired,
        unselectAllModels: PropTypes.func.isRequired,
        removeSelectedModel: PropTypes.func.isRequired,
        duplicateSelectedModel: PropTypes.func.isRequired,
        onModelTransform: PropTypes.func.isRequired,
        onModelAfterTransform: PropTypes.func.isRequired
    };

    contextMenuRef = React.createRef();

    visualizerRef = React.createRef();

    printableArea = null;

    svgCanvas = React.createRef();

    canvas = React.createRef();

    actions = {
        // canvas footer
        zoomIn: () => {
            if (this.props.page === PAGE_EDITOR) {
                this.svgCanvas.current.zoomIn();
            } else {
                this.canvas.current.zoomIn();
            }
        },
        zoomOut: () => {
            if (this.props.page === PAGE_EDITOR) {
                this.svgCanvas.current.zoomOut();
            } else {
                this.canvas.current.zoomOut();
            }
        },
        autoFocus: () => {
            if (this.props.page === PAGE_EDITOR) {
                this.svgCanvas.current.autoFocus();
            } else {
                this.canvas.current.autoFocus();
            }
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
        },
        arrangeAllModels: () => {
            this.props.arrangeAllModels2D();
        },
        duplicateSelectedModel: () => {
            this.props.duplicateSelectedModel();
        }
    };

    constructor(props) {
        super(props);

        const size = props.size;
        this.printableArea = new PrintablePlate(size);
    }

    componentDidMount() {
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
            this.canvas.current.setCamera(new THREE.Vector3(0, 0, Math.min(size.z, 300)), new THREE.Vector3());
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
                // todo, this hide flag will be packaged
                if (meshObject && !selectedModel.hideFlag) {
                    this.canvas.current.controls.attach(meshObject);
                } else {
                    this.canvas.current.controls.detach();
                }
            }
        } else {
            const selectedModel = this.props.getSelectedModel();
            if (!selectedModel) {
                this.canvas.current.controls.detach();
            } else {
                if (selectedModel.hideFlag) {
                    this.canvas.current.controls.detach();
                } else {
                    this.canvas.current.controls.attach(selectedModel.meshObject);
                }
            }
        }

        if (renderingTimestamp !== this.props.renderingTimestamp) {
            this.canvas.current.renderScene();
        }
    }

    // hideContextMenu = () => {
    //     ContextMenu.hide();
    // };

    getNotice() {
        const { stage, progress } = this.props;
        switch (stage) {
            case CNC_LASER_STAGE.EMPTY:
                return '';
            case CNC_LASER_STAGE.GENERATING_TOOLPATH:
                return i18n._('Generating tool path... {{progress}}%', { progress: (100.0 * progress).toFixed(1) });
            case CNC_LASER_STAGE.GENERATE_TOOLPATH_SUCCESS:
                return i18n._('Generated tool path successfully.');
            case CNC_LASER_STAGE.GENERATE_TOOLPATH_FAILED:
                return i18n._('Failed to generate tool path.');
            case CNC_LASER_STAGE.PREVIEWING:
                return i18n._('Previewing tool path...');
            case CNC_LASER_STAGE.PREVIEW_SUCCESS:
                return i18n._('Previewed tool path successfully');
            case CNC_LASER_STAGE.RE_PREVIEW:
                return i18n._('Please preview again');
            case CNC_LASER_STAGE.PREVIEW_FAILED:
                return i18n._('Failed to preview tool path.');
            case CNC_LASER_STAGE.GENERATING_GCODE:
                return i18n._('Generating G-code... {{progress}}%', { progress: (100.0 * progress).toFixed(1) });
            case CNC_LASER_STAGE.GENERATE_GCODE_SUCCESS:
                return i18n._('Generated G-code successfully.');
            case CNC_LASER_STAGE.GENERATE_GCODE_FAILED:
                return i18n._('Failed to generate G-code.');
            default:
                return '';
        }
    }

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
        // eslint-disable-next-line no-unused-vars
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
        const notice = this.getNotice();
        const isEditor = this.props.page === PAGE_EDITOR;

        return (
            <div
                ref={this.visualizerRef}
                style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
            >
                {isEditor && (
                    <div className={styles['visualizer-top-left']}>
                        <VisualizerTopLeft />
                    </div>
                )}
                <div style={{
                    visibility: isEditor ? 'visible' : 'hidden'
                }}
                >
                    <CncLaserSvgEditor
                        ref={this.svgCanvas}
                        size={this.props.size}
                        svgModelGroup={this.props.svgModelGroup}
                        insertDefaultTextVector={this.props.insertDefaultTextVector}
                        showContextMenu={this.showContextMenu}
                    />
                </div>
                <div
                    className={styles['canvas-content']}
                    style={{
                        visibility: !isEditor ? 'visible' : 'hidden'
                    }}
                >
                    <Canvas
                        ref={this.canvas}
                        isEditor={isEditor}
                        size={this.props.size}
                        modelGroup={this.props.modelGroup.object}
                        toolPathModelGroup={this.props.toolPathModelGroup.object}
                        printableArea={this.printableArea}
                        cameraInitialPosition={new THREE.Vector3(0, 0, Math.min(this.props.size.z, 300))}
                        cameraInitialTarget={new THREE.Vector3(0, 0, 0)}
                        onSelectModel={this.actions.onSelectModel}
                        onUnselectAllModels={this.actions.onUnselectAllModels}
                        onModelAfterTransform={this.actions.onModelAfterTransform}
                        onModelTransform={this.actions.onModelTransform}
                        showContextMenu={this.showContextMenu}
                        transformSourceType="2D"
                    />
                </div>
                <div className={styles['canvas-footer']}>
                    <SecondaryToolbar
                        zoomIn={this.actions.zoomIn}
                        zoomOut={this.actions.zoomOut}
                        autoFocus={this.actions.autoFocus}
                    />
                </div>
                {estimatedTime && (
                    <div className={styles['visualizer-info']}>
                        {i18n._('Estimated Time:')}<Space width={4} />{humanReadableTime(estimatedTime)}
                    </div>
                )}
                <div className={styles['visualizer-progress']}>
                    <ProgressBar tips={notice} progress={this.props.progress * 100} />
                </div>
                <ContextMenu
                    ref={this.contextMenuRef}
                    id="cnc"
                    menuItems={
                        [
                            {
                                type: 'item',
                                label: i18n._('Duplicate Selected Model'),
                                disabled: !isModelSelected,
                                onClick: this.actions.duplicateSelectedModel
                            },
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
                            }
                            // {
                            //     type: 'item',
                            //     label: i18n._('Arrange All Models'),
                            //     disabled: !hasModel,
                            //     onClick: this.actions.arrangeAllModels
                            // }
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
    const { page, selectedModelID, modelGroup, svgModelGroup, toolPathModelGroup, hasModel, renderingTimestamp, stage, progress } = state.cnc;
    return {
        page,
        size: machine.size,
        // model,
        modelGroup,
        svgModelGroup,
        toolPathModelGroup,
        selectedModelID,
        hasModel,
        renderingTimestamp,
        stage,
        progress
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        getEstimatedTime: (type) => dispatch(editorActions.getEstimatedTime('cnc', type)),
        getSelectedModel: () => dispatch(editorActions.getSelectedModel('cnc')),
        bringSelectedModelToFront: () => dispatch(editorActions.bringSelectedModelToFront('cnc')),
        insertDefaultTextVector: () => dispatch(editorActions.insertDefaultTextVector('cnc')),
        sendSelectedModelToBack: () => dispatch(editorActions.sendSelectedModelToBack('cnc')),
        arrangeAllModels2D: () => dispatch(editorActions.arrangeAllModels2D('cnc')),
        onSetSelectedModelPosition: (position) => dispatch(editorActions.onSetSelectedModelPosition('cnc', position)),
        onFlipSelectedModel: (flip) => dispatch(editorActions.onFlipSelectedModel('cnc', flip)),
        selectModel: (model) => dispatch(editorActions.selectModel('cnc', model)),
        unselectAllModels: () => dispatch(editorActions.unselectAllModels('cnc')),
        duplicateSelectedModel: () => dispatch(editorActions.duplicateSelectedModel('cnc')),
        removeSelectedModel: () => dispatch(editorActions.removeSelectedModel('cnc')),
        onModelTransform: () => dispatch(editorActions.onModelTransform('cnc')),
        onModelAfterTransform: () => dispatch(editorActions.onModelAfterTransform('cnc'))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Visualizer);
