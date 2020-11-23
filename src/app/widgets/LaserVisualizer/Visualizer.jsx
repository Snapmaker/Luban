import React, { Component } from 'react';
import noop from 'lodash/noop';
import * as THREE from 'three';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import isEqual from 'lodash/isEqual';

import i18n from '../../lib/i18n';
import ProgressBar from '../../components/ProgressBar';
import Space from '../../components/Space';
import ContextMenu from '../../components/ContextMenu';

import Canvas from '../../components/SMCanvas';
import PrintablePlate from '../CncLaserShared/PrintablePlate';
import SecondaryToolbar from '../CanvasToolbar/SecondaryToolbar';
import { actions as editorActions, CNC_LASER_STAGE } from '../../flux/editor';
import VisualizerTopLeft from './VisualizerTopLeft';
import VisualizerTopRight from '../LaserCameraAidBackground';
import styles from './styles.styl';
import { PAGE_EDITOR } from '../../constants';
// eslint-disable-next-line no-unused-vars
import SVGEditor from '../../ui/SVGEditor';


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
        materials: PropTypes.object,

        size: PropTypes.object.isRequired,
        scale: PropTypes.number.isRequired,
        target: PropTypes.object,
        // model: PropTypes.object,
        // selectedModelID: PropTypes.string,
        selectedModelArray: PropTypes.array,
        backgroundGroup: PropTypes.object.isRequired,
        modelGroup: PropTypes.object.isRequired,
        SVGActions: PropTypes.object.isRequired,
        toolPathModelGroup: PropTypes.object.isRequired,
        renderingTimestamp: PropTypes.number.isRequired,

        // func
        initContentGroup: PropTypes.func.isRequired,
        updateTarget: PropTypes.func,
        updateScale: PropTypes.func,
        getEstimatedTime: PropTypes.func.isRequired,
        // getSelectedModel: PropTypes.func.isRequired,
        bringSelectedModelToFront: PropTypes.func.isRequired,
        sendSelectedModelToBack: PropTypes.func.isRequired,
        arrangeAllModels2D: PropTypes.func.isRequired,
        insertDefaultTextVector: PropTypes.func.isRequired,

        onSetSelectedModelPosition: PropTypes.func.isRequired,
        onFlipSelectedModel: PropTypes.func.isRequired,
        selectTargetModel: PropTypes.func.isRequired,
        removeSelectedModel: PropTypes.func.isRequired,
        duplicateSelectedModel: PropTypes.func.isRequired,
        // onModelTransform: PropTypes.func.isRequired,
        // onModelAfterTransform: PropTypes.func.isRequired,

        // editor actions
        onCreateElement: PropTypes.func.isRequired,
        onSelectElements: PropTypes.func.isRequired,
        onClearSelection: PropTypes.func.isRequired,
        onResizeElement: PropTypes.func.isRequired,
        onAfterResizeElement: PropTypes.func.isRequired,
        onMoveElement: PropTypes.func.isRequired,
        onRotateElement: PropTypes.func.isRequired,
        createText: PropTypes.func.isRequired,
        updateTextTransformationAfterEdit: PropTypes.func.isRequired
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
            this.props.updateScale(1);
            this.props.updateTarget({ x: 0, y: 0 });
        },
        onSelectModels: (intersect) => { // this is a toolpath model? mesh object??
            // todo
            // console.log('----on process select----', model);
            this.props.selectTargetModel(intersect);
        },
        /*
        onModelAfterTransform: () => {
            this.props.onModelAfterTransform();
        },
        onModelTransform: () => {
            this.props.onModelTransform();
        },
        */
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

        const { size, materials } = props;
        this.printableArea = new PrintablePlate(size, materials);
    }

    // hideContextMenu = () => {
    //     ContextMenu.hide();
    // };

    componentDidMount() {
        this.canvas.current.resizeWindow();
        // this.canvas.current.disable3D();

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

        if (!isEqual(nextProps.size, this.props.size) || !isEqual(nextProps.materials, this.props.materials)) {
            const { size, materials } = nextProps;
            this.printableArea.updateSize(size, materials);
            this.canvas.current.setCamera(new THREE.Vector3(0, 0, Math.min(size.z, 300)), new THREE.Vector3());
        }

        /*
        this.canvas.current.updateTransformControl2D();
        const { model } = nextProps;
        if (model !== this.props.model) {
            if (!model) {
                this.canvas.current.controls.detach();
            } else {
                this.canvas.current.controls.attach(model);

                const sourceType = model.modelInfo.source.type;
                if (sourceType === 'text') {
                    this.canvas.current.setTransformControls2DState({ enabledScale: false });
                } else {
                    this.canvas.current.setTransformControls2DState({ enabledScale: true });
                }
            }
        }
        */

        this.canvas.current.updateTransformControl2D();
        // const { model } = nextProps;
        const { selectedModelArray } = nextProps;
        // todo, selectedModelId nof found
        if (selectedModelArray !== this.props.selectedModelArray) {
            const selectedModel = selectedModelArray[0];
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
                // const meshObject = nextProps.getSelectedModel().meshObject;
                const meshObject = selectedModel.meshObject;
                if (meshObject && selectedModel.visible) {
                    this.canvas.current.controls.attach(meshObject);
                } else {
                    this.canvas.current.controls.detach();
                }
            }
        }
        // else {
        //     const selectedModel = this.props.modelGroup.getSelectedModelArray()[0]; //getSelectedModel();
        //     console.log(selectedModel);
        //     if (!selectedModel) {
        //         this.canvas.current.controls.detach();
        //     } else {
        //         if (selectedModel.visible) {
        //             this.canvas.current.controls.attach(selectedModel.meshObject);
        //         } else {
        //             this.canvas.current.controls.detach();
        //         }
        //     }
        // }

        if (renderingTimestamp !== this.props.renderingTimestamp) {
            this.canvas.current.renderScene();
        }
    }

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
            case CNC_LASER_STAGE.PREVIEW_FAILED:
                return i18n._('Failed to preview tool path.');
            case CNC_LASER_STAGE.GENERATING_GCODE:
                return i18n._('Generating G-code... {{progress}}%', { progress: (100.0 * progress).toFixed(1) });
            case CNC_LASER_STAGE.GENERATE_GCODE_SUCCESS:
                return i18n._('Generated G-code successfully.');
            case CNC_LASER_STAGE.GENERATE_GCODE_FAILED:
                return i18n._('Failed to generate G-code.');
            case CNC_LASER_STAGE.UPLOADING_IMAGE:
                return i18n._('Loading object {{progress}}%', { progress: (100.0 * progress).toFixed(1) });
            case CNC_LASER_STAGE.UPLOAD_IMAGE_SUCCESS:
                return i18n._('Loaded object successfully.');
            case CNC_LASER_STAGE.UPLOAD_IMAGE_FAILED:
                return i18n._('Failed to load object.');
            case CNC_LASER_STAGE.PROCESSING_IMAGE:
                return i18n._('Processing image {{progress}}%', { progress: (100.0 * progress).toFixed(1) });
            case CNC_LASER_STAGE.PROCESS_IMAGE_SUCCESS:
                return i18n._('Process image successfully.');
            case CNC_LASER_STAGE.PROCESS_IMAGE_FAILED:
                return i18n._('Failed to process image.');
            default:
                return '';
        }
    }

    showContextMenu = (event) => {
        this.contextMenuRef.current.show(event);
    };

    render() {
        // const isModelSelected = !!this.props.selectedModelID;
        const isOnlySelectedOneModel = (this.props.selectedModelArray && this.props.selectedModelArray.length === 1);
        // const hasModel = this.props.hasModel;

        const estimatedTime = isOnlySelectedOneModel ? this.props.getEstimatedTime('selected') : this.props.getEstimatedTime('total');
        const notice = this.getNotice();
        const isEditor = this.props.page === PAGE_EDITOR;
        const contextMenuDisabled = !isOnlySelectedOneModel || !this.props.selectedModelArray[0].visible;

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
                <div className={styles['visualizer-top-right']}>
                    <VisualizerTopRight />
                </div>
                <div style={{
                    visibility: isEditor ? 'visible' : 'hidden'
                }}
                >
                    <SVGEditor
                        ref={this.svgCanvas}
                        size={this.props.size}
                        initContentGroup={this.props.initContentGroup}
                        scale={this.props.scale}
                        target={this.props.target}
                        updateTarget={this.props.updateTarget}
                        updateScale={this.props.updateScale}
                        SVGActions={this.props.SVGActions}
                        materials={this.props.materials}
                        insertDefaultTextVector={this.props.insertDefaultTextVector}
                        showContextMenu={this.showContextMenu}
                        onCreateElement={this.props.onCreateElement}
                        onSelectElements={this.props.onSelectElements}
                        onClearSelection={this.props.onClearSelection}
                        onResizeElement={this.props.onResizeElement}
                        onAfterResizeElement={this.props.onAfterResizeElement}
                        onMoveElement={this.props.onMoveElement}
                        onRotateElement={this.props.onRotateElement}
                        createText={this.props.createText}
                        updateTextTransformationAfterEdit={this.props.updateTextTransformationAfterEdit}
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
                        canOperateModel={false}
                        size={this.props.size}
                        backgroundGroup={this.props.backgroundGroup}
                        modelGroup={this.props.modelGroup}
                        toolPathModelGroupObject={this.props.toolPathModelGroup.object}
                        printableArea={this.printableArea}
                        cameraInitialPosition={new THREE.Vector3(0, 0, 300)}
                        cameraInitialTarget={new THREE.Vector3(0, 0, 0)}
                        onSelectModels={this.actions.onSelectModels}
                        onModelAfterTransform={noop}
                        onModelTransform={noop}
                        showContextMenu={this.showContextMenu}
                        scale={this.props.scale}
                        target={this.props.target}
                        updateTarget={this.props.updateTarget}
                        updateScale={this.props.updateScale}
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
                    id="laser"
                    menuItems={
                        [
                            {
                                type: 'item',
                                label: i18n._('Duplicate Selected Model'),
                                disabled: contextMenuDisabled,
                                onClick: this.actions.duplicateSelectedModel
                            },
                            {
                                type: 'item',
                                label: i18n._('Bring to Front'),
                                disabled: contextMenuDisabled,
                                onClick: this.actions.bringToFront
                            },
                            {
                                type: 'item',
                                label: i18n._('Send to Back'),
                                disabled: contextMenuDisabled,
                                onClick: this.actions.sendToBack
                            },
                            {
                                type: 'subMenu',
                                label: i18n._('Reference Position'),
                                disabled: contextMenuDisabled,
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
                                disabled: contextMenuDisabled,
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
                                disabled: contextMenuDisabled,
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
    const { size } = state.machine;

    const { background } = state.laser;
    // call canvas.updateTransformControl2D() when transformation changed or model selected changed

    const { SVGActions, scale, target, materials, page, selectedModelID, modelGroup, svgModelGroup, toolPathModelGroup, renderingTimestamp, stage, progress } = state.laser;
    const selectedModelArray = modelGroup.getSelectedModelArray();

    return {
        page,
        scale,
        target,
        SVGActions,
        size,
        materials,
        hasModel: modelGroup.hasModel(),
        selectedModelID,
        svgModelGroup,
        modelGroup,
        toolPathModelGroup,
        selectedModelArray,
        // model,
        backgroundGroup: background.group,
        renderingTimestamp,
        stage,
        progress
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        initContentGroup: (svgContentGroup) => dispatch(editorActions.initContentGroup('laser', svgContentGroup)),
        updateTarget: (target) => dispatch(editorActions.updateState('laser', { target })),
        updateScale: (scale) => dispatch(editorActions.updateState('laser', { scale })),
        getEstimatedTime: (type) => dispatch(editorActions.getEstimatedTime('laser', type)),
        getSelectedModel: () => dispatch(editorActions.getSelectedModel('laser')),
        bringSelectedModelToFront: () => dispatch(editorActions.bringSelectedModelToFront('laser')),
        sendSelectedModelToBack: () => dispatch(editorActions.sendSelectedModelToBack('laser')),
        arrangeAllModels2D: () => dispatch(editorActions.arrangeAllModels2D('laser')),
        insertDefaultTextVector: () => dispatch(editorActions.insertDefaultTextVector('laser')),
        onSetSelectedModelPosition: (position) => dispatch(editorActions.onSetSelectedModelPosition('laser', position)),
        onFlipSelectedModel: (flip) => dispatch(editorActions.onFlipSelectedModel('laser', flip)),
        selectTargetModel: (intersect) => dispatch(editorActions.selectModelInProcess('laser', intersect)),
        removeSelectedModel: () => dispatch(editorActions.removeSelectedModel('laser')),
        duplicateSelectedModel: () => dispatch(editorActions.duplicateSelectedModel('laser')),

        onCreateElement: (element) => dispatch(editorActions.createModelFromElement('laser', element)),
        onSelectElements: (elements) => dispatch(editorActions.selectElements('laser', elements)),
        onClearSelection: () => dispatch(editorActions.clearSelection('laser')),
        onResizeElement: (element, options) => dispatch(editorActions.resizeElement('laser', element, options)),
        onAfterResizeElement: (element) => dispatch(editorActions.afterResizeElement('laser', element)),
        onMoveElement: (element, options) => dispatch(editorActions.moveElement('laser', element, options)),
        onRotateElement: (element, options) => dispatch(editorActions.rotateElement('laser', element, options)),

        createText: (text) => dispatch(editorActions.createText('laser', text)),

        updateTextTransformationAfterEdit: (element, transformation) => dispatch(editorActions.updateModelTransformationByElement('laser', element, transformation))

        // onModelTransform: () => dispatch(editorActions.onModelTransform('laser')),
        // onModelAfterTransform: () => dispatch(editorActions.onModelAfterTransform('laser'))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Visualizer);
