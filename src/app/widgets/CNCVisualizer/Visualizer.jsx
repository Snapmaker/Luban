import noop from 'lodash/noop';
import isEqual from 'lodash/isEqual';
import React, { Component } from 'react';
import * as THREE from 'three';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import path from 'path';

import i18n from '../../lib/i18n';
import { controller } from '../../lib/controller';
import { humanReadableTime } from '../../lib/time-utils';
import ProgressBar from '../../components/ProgressBar';
import ContextMenu from '../../components/ContextMenu';
import Space from '../../components/Space';

import Canvas from '../../components/SMCanvas';
import PrintablePlate from '../CncLaserShared/PrintablePlate';
import SecondaryToolbar from '../CanvasToolbar/SecondaryToolbar';
import { actions as editorActions } from '../../flux/editor';
import styles from './styles.styl';
import VisualizerTopRight from '../CncLaserTopRight/VisualizerTopRight';
// eslint-disable-next-line no-unused-vars
import {
    DISPLAYED_TYPE_TOOLPATH,
    PAGE_EDITOR, PROCESS_MODE_GREYSCALE, PROCESS_MODE_MESH, PROCESS_MODE_VECTOR,
    SELECTEVENT
} from '../../constants';
import SVGEditor from '../../ui/SVGEditor';
import { CNC_LASER_STAGE } from '../../flux/editor/utils';
import modal from '../../lib/modal';


class Visualizer extends Component {
    static propTypes = {
        ...withRouter.propTypes,
        pathname: PropTypes.string,
        page: PropTypes.string.isRequired,
        materials: PropTypes.object,
        stage: PropTypes.number.isRequired,
        progress: PropTypes.number.isRequired,
        hasModel: PropTypes.bool.isRequired,

        coordinateMode: PropTypes.object.isRequired,
        coordinateSize: PropTypes.object.isRequired,
        size: PropTypes.object.isRequired,
        scale: PropTypes.number,
        target: PropTypes.object,
        // model: PropTypes.object,
        // selectedModelID: PropTypes.string,
        isChangedAfterGcodeGenerating: PropTypes.bool.isRequired,
        selectedModelArray: PropTypes.array,
        selectedToolPathModels: PropTypes.array,
        modelGroup: PropTypes.object.isRequired,
        SVGActions: PropTypes.object.isRequired,
        toolPathGroup: PropTypes.object.isRequired,
        displayedType: PropTypes.string.isRequired,

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
        selectModelInProcess: PropTypes.func.isRequired,
        removeSelectedModel: PropTypes.func.isRequired,
        duplicateSelectedModel: PropTypes.func.isRequired,
        // onModelTransform: PropTypes.func.isRequired,
        // onModelAfterTransform: PropTypes.func.isRequired,

        // editor actions
        onCreateElement: PropTypes.func.isRequired,
        onSelectElements: PropTypes.func.isRequired,
        onClearSelection: PropTypes.func.isRequired,
        onMoveSelectedElementsByKey: PropTypes.func.isRequired,
        createText: PropTypes.func.isRequired,
        updateTextTransformationAfterEdit: PropTypes.func.isRequired,
        getSelectedElementsUniformScalingState: PropTypes.func.isRequired,

        uploadImage: PropTypes.func.isRequired,
        switchToPage: PropTypes.func.isRequired,

        elementActions: PropTypes.shape({
            moveElementsStart: PropTypes.func.isRequired,
            moveElements: PropTypes.func.isRequired,
            moveElementsFinish: PropTypes.func.isRequired,
            resizeElementsStart: PropTypes.func.isRequired,
            resizeElements: PropTypes.func.isRequired,
            resizeElementsFinish: PropTypes.func.isRequired,
            rotateElementsStart: PropTypes.func.isRequired,
            rotateElements: PropTypes.func.isRequired,
            rotateElementsFinish: PropTypes.func.isRequired,
            moveElementsOnKeyDown: PropTypes.func.isRequired
        })
    };

    contextMenuRef = React.createRef();

    visualizerRef = React.createRef();

    printableArea = null;

    svgCanvas = React.createRef();

    canvas = React.createRef();

    fileInput = React.createRef();

    actions = {
        onChangeFile: (event) => {
            const file = event.target.files[0];
            const extname = path.extname(file.name).toLowerCase();
            let uploadMode;
            if (extname.toLowerCase() === '.svg') {
                uploadMode = PROCESS_MODE_VECTOR;
            } else if (extname.toLowerCase() === '.dxf') {
                uploadMode = PROCESS_MODE_VECTOR;
            } else if (extname.toLowerCase() === '.stl') {
                uploadMode = PROCESS_MODE_MESH;
            } else {
                uploadMode = PROCESS_MODE_GREYSCALE;
            }

            // Switch to PAGE_EDITOR page if new image being uploaded
            this.props.switchToPage(PAGE_EDITOR);

            this.props.uploadImage(file, uploadMode, () => {
                modal({
                    title: i18n._('Parse Error'),
                    body: i18n._('Failed to parse image file {{filename}}.', { filename: file.name })
                });
            });
        },
        onClickToUpload: () => {
            this.fileInput.current.value = null;
            this.fileInput.current.click();
        },

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
            this.canvas.current.setCameraOnTop();
            this.props.updateScale(1);

            const { coordinateMode, coordinateSize } = this.props;
            const target = {
                x: 0,
                y: 0
            };
            target.x += coordinateSize.x / 2 * coordinateMode.setting.sizeMultiplyFactor.x;
            target.y += coordinateSize.y / 2 * coordinateMode.setting.sizeMultiplyFactor.y;

            target.x /= 1.5;
            target.y /= 1.5;
            this.props.updateTarget(target);
        },
        onSelectModels: (intersect, selectEvent) => {
            this.props.selectModelInProcess(intersect, selectEvent);
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

        if (!isEqual(nextProps.size, this.props.size) || !isEqual(nextProps.materials, this.props.materials)) {
            const { size, materials } = nextProps;
            this.printableArea.updateSize(size, materials);
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

        if (renderingTimestamp !== this.props.renderingTimestamp) {
            this.canvas.current.renderScene();
        }

        if (nextProps.displayedType !== this.props.displayedType) {
            if (nextProps.displayedType === DISPLAYED_TYPE_TOOLPATH) {
                this.canvas.current.controls.disableClick();
            } else {
                this.canvas.current.controls.enableClick();
            }
        }
        if (nextProps.selectedToolPathModels !== this.props.selectedToolPathModels) {
            this.canvas.current.controls.detach();
            for (const selectedToolPathModel of nextProps.selectedToolPathModels) {
                this.canvas.current.controls.attach(selectedToolPathModel.meshObject, SELECTEVENT.ADDSELECT);
            }
        }

        if (nextProps.coordinateMode !== this.props.coordinateMode) {
            const { size, materials, coordinateMode } = nextProps;
            this.printableArea = new PrintablePlate(size, materials, coordinateMode);
        }

        if (nextProps.coordinateSize !== this.props.coordinateSize) {
            this.printableArea = new PrintablePlate(nextProps.coordinateSize, nextProps.materials, nextProps.coordinateMode);
        }
    }

    getNotice() {
        const { stage, progress } = this.props;
        switch (stage) {
            case CNC_LASER_STAGE.EMPTY:
                return '';
            case CNC_LASER_STAGE.GENERATING_TOOLPATH:
                return i18n._('Generating toolpath... {{progress}}%', { progress: (100.0 * progress).toFixed(1) });
            case CNC_LASER_STAGE.GENERATE_TOOLPATH_SUCCESS:
                return i18n._('Generated toolpath successfully.');
            case CNC_LASER_STAGE.GENERATE_TOOLPATH_FAILED:
                return i18n._('Failed to generate toolpath.');
            case CNC_LASER_STAGE.PREVIEWING:
                return i18n._('Previewing toolpath...');
            case CNC_LASER_STAGE.PREVIEW_SUCCESS:
                return i18n._('Previewed toolpath successfully');
            case CNC_LASER_STAGE.RE_PREVIEW:
                return i18n._('Please preview again');
            case CNC_LASER_STAGE.PREVIEW_FAILED:
                return i18n._('Failed to preview toolpath.');
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
                return i18n._('Processing object {{progress}}%', { progress: (100.0 * progress).toFixed(1) });
            case CNC_LASER_STAGE.PROCESS_IMAGE_SUCCESS:
                return i18n._('Processed object successfully.');
            case CNC_LASER_STAGE.PROCESS_IMAGE_FAILED:
                return i18n._('Failed to process object.');
            default:
                return '';
        }
    }

    showContextMenu = (event) => {
        if (this.props.modelGroup.selectedModelArray.length > 1) {
            return;
        }
        if (this.props.page !== PAGE_EDITOR) {
            return;
        }
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
        // const isModelSelected = !!this.props.selectedModelID;
        const isOnlySelectedOneModel = (this.props.selectedModelArray && this.props.selectedModelArray.length === 1);
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

        const estimatedTime = this.props.displayedType === DISPLAYED_TYPE_TOOLPATH && !this.props.isChangedAfterGcodeGenerating ? this.props.getEstimatedTime('selected') : '';
        const notice = this.getNotice();
        const isEditor = this.props.page === PAGE_EDITOR;
        const contextMednuDisabled = !isOnlySelectedOneModel || !this.props.selectedModelArray[0].visible;
        const { displayedType } = this.props;

        return (
            <div
                ref={this.visualizerRef}
            >
                {(!isEditor && displayedType === DISPLAYED_TYPE_TOOLPATH) && (
                    <div>
                        <VisualizerTopRight
                            headType="cnc"
                        />
                    </div>
                )}
                <div style={{
                    visibility: (isEditor || displayedType !== DISPLAYED_TYPE_TOOLPATH) ? 'visible' : 'hidden'
                }}
                >
                    <SVGEditor
                        isActive={this.props.pathname.indexOf('cnc') > 0 && isEditor}
                        ref={this.svgCanvas}
                        editable={isEditor}
                        size={this.props.size}
                        initContentGroup={this.props.initContentGroup}
                        scale={this.props.scale}
                        target={this.props.target}
                        coordinateMode={this.props.coordinateMode}
                        coordinateSize={this.props.coordinateSize}
                        updateTarget={this.props.updateTarget}
                        updateScale={this.props.updateScale}
                        SVGActions={this.props.SVGActions}
                        materials={this.props.materials}
                        insertDefaultTextVector={this.props.insertDefaultTextVector}
                        showContextMenu={this.showContextMenu}
                        onCreateElement={this.props.onCreateElement}
                        onSelectElements={this.props.onSelectElements}
                        onClearSelection={this.props.onClearSelection}
                        elementActions={this.props.elementActions}
                        editorActions={this.actions}
                        getSelectedElementsUniformScalingState={this.props.getSelectedElementsUniformScalingState}
                        onMoveSelectedElementsByKey={this.props.onMoveSelectedElementsByKey}
                        createText={this.props.createText}
                        updateTextTransformationAfterEdit={this.props.updateTextTransformationAfterEdit}
                        use3DVisualizer
                        onChangeFile={this.actions.onChangeFile}
                        onClickToUpload={this.actions.onClickToUpload}
                        fileInput={this.fileInput}
                        allowedFiles=".svg, .png, .jpg, .jpeg, .bmp, .dxf, .stl"
                    />
                </div>
                <div
                    className={styles['canvas-content']}
                    style={{
                        visibility: (!isEditor && displayedType === DISPLAYED_TYPE_TOOLPATH) ? 'visible' : 'hidden'
                    }}
                >
                    <Canvas
                        ref={this.canvas}
                        canOperateModel={false}
                        size={this.props.size}
                        modelGroup={this.props.modelGroup}
                        toolPathGroupObject={this.props.toolPathGroup.object}
                        printableArea={this.printableArea}
                        cameraInitialPosition={new THREE.Vector3(0, 0, 300)}
                        cameraInitialTarget={new THREE.Vector3(0, 0, 0)}
                        onSelectModels={this.actions.onSelectModels}
                        onModelAfterTransform={noop}
                        onModelTransform={noop}
                        showContextMenu={this.showContextMenu}
                        scale={this.props.scale}
                        target={this.props.target}
                        coordinateMode={this.props.coordinateMode}
                        coordinateSize={this.props.coordinateSize}
                        updateTarget={this.props.updateTarget}
                        updateScale={this.props.updateScale}
                        transformSourceType="2D"
                    />
                </div>
                <div className={styles['canvas-footer']}>
                    <SecondaryToolbar
                        zoomIn={this.actions.zoomIn}
                        zoomOut={this.actions.zoomOut}
                        toFront={this.actions.autoFocus}
                    />
                </div>
                {estimatedTime && (
                    <div className={styles['visualizer-info']}>
                        <span className="fa fa-clock-o" />
                        <Space width={4} />
                        {humanReadableTime(estimatedTime)}
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
                                disabled: contextMednuDisabled,
                                onClick: this.actions.duplicateSelectedModel
                            },
                            {
                                type: 'item',
                                label: i18n._('Bring to Front'),
                                disabled: contextMednuDisabled,
                                onClick: this.actions.bringToFront
                            },
                            {
                                type: 'item',
                                label: i18n._('Send to Back'),
                                disabled: contextMednuDisabled,
                                onClick: this.actions.sendToBack
                            },
                            {
                                type: 'subMenu',
                                label: i18n._('Reference Position'),
                                disabled: contextMednuDisabled,
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
                                disabled: contextMednuDisabled,
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
                                disabled: contextMednuDisabled,
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

const mapStateToProps = (state, ownProps) => {
    // call canvas.updateTransformControl2D() when transformation changed or model selected changed
    const { size } = state.machine;
    const { page, materials, modelGroup, toolPathGroup, displayedType, hasModel, isChangedAfterGcodeGenerating,
        renderingTimestamp, stage, progress, SVGActions, scale, target, coordinateMode, coordinateSize } = state.cnc;
    const selectedModelArray = modelGroup.getSelectedModelArray();
    const selectedModelID = modelGroup.getSelectedModel().modelID;
    const selectedToolPathModels = modelGroup.getSelectedToolPathModels();

    return {
        // switch pages trigger pathname change
        pathname: ownProps.location.pathname,
        page,
        scale,
        target,
        materials,
        size,
        coordinateMode,
        coordinateSize,
        // model,
        modelGroup,
        SVGActions,
        displayedType,
        toolPathGroup,
        selectedModelArray,
        selectedToolPathModels,
        selectedModelID,
        hasModel,
        renderingTimestamp,
        isChangedAfterGcodeGenerating,
        stage,
        progress
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        initContentGroup: (svgContentGroup) => dispatch(editorActions.initContentGroup('cnc', svgContentGroup)),
        updateTarget: (target) => dispatch(editorActions.updateState('cnc', { target })),
        updateScale: (scale) => dispatch(editorActions.updateState('cnc', { scale })),
        getEstimatedTime: (type) => dispatch(editorActions.getEstimatedTime('cnc', type)),
        getSelectedModel: () => dispatch(editorActions.getSelectedModel('cnc')),
        bringSelectedModelToFront: () => dispatch(editorActions.bringSelectedModelToFront('cnc')),
        insertDefaultTextVector: () => dispatch(editorActions.insertDefaultTextVector('cnc')),
        sendSelectedModelToBack: () => dispatch(editorActions.sendSelectedModelToBack('cnc')),
        arrangeAllModels2D: () => dispatch(editorActions.arrangeAllModels2D('cnc')),
        onSetSelectedModelPosition: (position) => dispatch(editorActions.onSetSelectedModelPosition('cnc', position)),
        onFlipSelectedModel: (flip) => dispatch(editorActions.onFlipSelectedModel('cnc', flip)),
        selectModelInProcess: (intersect, selectEvent) => dispatch(editorActions.selectModelInProcess('cnc', intersect, selectEvent)),
        duplicateSelectedModel: () => dispatch(editorActions.duplicateSelectedModel('cnc')),
        removeSelectedModel: () => dispatch(editorActions.removeSelectedModel('cnc')),

        onCreateElement: (element) => dispatch(editorActions.createModelFromElement('cnc', element)),
        onSelectElements: (elements) => dispatch(editorActions.selectElements('cnc', elements)),
        onClearSelection: () => dispatch(editorActions.clearSelection('cnc')),
        onMoveSelectedElementsByKey: () => dispatch(editorActions.moveElementsOnKeyUp('cnc')),
        getSelectedElementsUniformScalingState: () => dispatch(editorActions.getSelectedElementsUniformScalingState('cnc')),

        createText: (text) => dispatch(editorActions.createText('cnc', text)),
        updateTextTransformationAfterEdit: (element, transformation) => dispatch(editorActions.updateModelTransformationByElement('cnc', element, transformation)),

        uploadImage: (file, mode, onFailure) => dispatch(editorActions.uploadImage('cnc', file, mode, onFailure)),
        switchToPage: (page) => dispatch(editorActions.switchToPage('cnc', page)),

        elementActions: {
            moveElementsStart: (elements, options) => dispatch(editorActions.moveElementsStart('cnc', elements, options)),
            moveElements: (elements, options) => dispatch(editorActions.moveElements('cnc', elements, options)),
            moveElementsFinish: (elements, options) => dispatch(editorActions.moveElementsFinish('cnc', elements, options)),
            resizeElementsStart: (elements, options) => dispatch(editorActions.resizeElementsStart('cnc', elements, options)),
            resizeElements: (elements, options) => dispatch(editorActions.resizeElements('cnc', elements, options)),
            resizeElementsFinish: (elements, options) => dispatch(editorActions.resizeElementsFinish('cnc', elements, options)),
            rotateElementsStart: (elements, options) => dispatch(editorActions.rotateElementsStart('cnc', elements, options)),
            rotateElements: (elements, options) => dispatch(editorActions.rotateElements('cnc', elements, options)),
            rotateElementsFinish: (elements, options) => dispatch(editorActions.rotateElementsFinish('cnc', elements, options)),
            moveElementsOnKeyDown: (options) => dispatch(editorActions.moveElementsOnKeyDown('cnc', null, options))
        }
        // onModelTransform: () => dispatch(editorActions.onModelTransform('cnc')),
        // onModelAfterTransform: () => dispatch(editorActions.onModelAfterTransform('cnc'))
    };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Visualizer));
