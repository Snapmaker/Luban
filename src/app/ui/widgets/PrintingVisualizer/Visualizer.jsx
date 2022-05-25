import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';
// import isEqual from 'lodash/isEqual';
import { isEqual, find, some } from 'lodash';
import { Vector3, Box3, Math as ThreeMath, Quaternion } from 'three';
// , MeshPhongMaterial, DoubleSide, Mesh, CylinderBufferGeometry

import { shortcutActions, priorities, ShortcutManager } from '../../../lib/shortcut';
import {
    DUAL_EXTRUDER_TOOLHEAD_FOR_SM2,
    EPSILON,
    HEAD_PRINTING,
    ROTATE_MODE,
    SCALE_MODE,
    TRANSLATE_MODE
} from '../../../constants';
import i18n from '../../../lib/i18n';
import ProgressBar from '../../components/ProgressBar';
import ContextMenu from '../../components/ContextMenu';
import Canvas from '../../components/SMCanvas';
import { NumberInput as Input } from '../../components/Input';
import { actions as operationHistoryActions } from '../../../flux/operation-history';
import { actions as printingActions } from '../../../flux/printing';
import VisualizerLeftBar from './VisualizerLeftBar';
import VisualizerPreviewControl from './VisualizerPreviewControl';
import VisualizerBottomLeft from './VisualizerBottomLeft';
import VisualizerInfo from './VisualizerInfo';
import PrintableCube from './PrintableCube';
import styles from './styles.styl';
import { loadModelFailPopup, scaletoFitPopup, sliceFailPopup } from './VisualizerPopup';

import { STEP_STAGE } from '../../../lib/manager/ProgressManager';
import { emitUpdateControlInputEvent } from '../../components/SMCanvas/TransformControls';
import ModeToggleBtn from './ModeToggleBtn';
import { logModelViewOperation } from '../../../lib/gaEvent';
import VisualizerClippingControl from './VisualizerClippingControl';
// import { Polygons } from '../../../../server/lib/MeshProcess/Polygons';
import { polyOffset } from '../../../../shared/lib/clipper/cLipper-adapter';

const initQuaternion = new Quaternion();
const modeSuffix = {
    [ROTATE_MODE]: '°',
    [TRANSLATE_MODE]: 'mm',
    [SCALE_MODE]: '%'
};

const _path = [-111, 0, -111, -111, -111, -111, 0, -111, 0, -111, 111, -111, 111, -111, 111, 0, 111, 0, 111, 111, 111, 111, 0, 111, 0, 111, -111, 111, -111, 111, -111, 0];

const polygon = [];
for (let index = 0; index < _path.length; index += 2) {
    polygon.push({
        x: _path[index],
        y: _path[index + 1]
    });
}
const _paths = polyOffset([polygon], -10, 1);
const arr = _paths[0].reduce((p, c) => {
    p.push(c.x);
    p.push(c.y);
    return p;
}, []);
JSON.stringify(arr);

class Visualizer extends PureComponent {
    static propTypes = {
        isActive: PropTypes.bool.isRequired,
        size: PropTypes.object.isRequired,
        stage: PropTypes.number.isRequired,
        promptTasks: PropTypes.array.isRequired,
        selectedModelArray: PropTypes.array,
        transformation: PropTypes.object,
        modelGroup: PropTypes.object.isRequired,
        gcodeLineGroup: PropTypes.object.isRequired,
        transformMode: PropTypes.string.isRequired,
        progress: PropTypes.number.isRequired,
        renderingTimestamp: PropTypes.number.isRequired,
        inProgress: PropTypes.bool.isRequired,
        hasModel: PropTypes.bool.isRequired,
        leftBarOverlayVisible: PropTypes.bool.isRequired,
        displayedType: PropTypes.string,
        menuDisabledCount: PropTypes.number,
        clippingOutlines: PropTypes.object,
        // allModel: PropTypes.array,

        hideSelectedModel: PropTypes.func.isRequired,
        recordAddOperation: PropTypes.func.isRequired,
        recordModelBeforeTransform: PropTypes.func.isRequired,
        recordModelAfterTransform: PropTypes.func.isRequired,
        clearOperationHistory: PropTypes.func.isRequired,
        offsetGcodeLayers: PropTypes.func.isRequired,
        destroyGcodeLine: PropTypes.func.isRequired,
        selectMultiModel: PropTypes.func.isRequired,
        selectAllModels: PropTypes.func.isRequired,
        unselectAllModels: PropTypes.func.isRequired,
        cut: PropTypes.func.isRequired,
        copy: PropTypes.func.isRequired,
        paste: PropTypes.func.isRequired,
        undo: PropTypes.func.isRequired,
        redo: PropTypes.func.isRequired,
        removeSelectedModel: PropTypes.func.isRequired,
        removeAllModels: PropTypes.func.isRequired,
        arrangeAllModels: PropTypes.func.isRequired,
        onModelTransform: PropTypes.func.isRequired,
        onModelAfterTransform: PropTypes.func.isRequired,
        updateSelectedModelTransformation: PropTypes.func.isRequired,
        duplicateSelectedModel: PropTypes.func.isRequired,
        setTransformMode: PropTypes.func.isRequired,
        moveSupportBrush: PropTypes.func.isRequired,
        applySupportBrush: PropTypes.func.isRequired,
        autoRotateSelectedModel: PropTypes.func.isRequired,
        layFlatSelectedModel: PropTypes.func.isRequired,
        scaleToFitSelectedModel: PropTypes.func.isRequired,
        resetSelectedModelTransformation: PropTypes.func.isRequired,
        progressStatesManager: PropTypes.object.isRequired,
        setRotationPlacementFace: PropTypes.func.isRequired,
        enablePrimeTower: PropTypes.bool,
        primeTowerHeight: PropTypes.number.isRequired,
        printingToolhead: PropTypes.string,
        stopArea: PropTypes.object,
        controlAxis: PropTypes.array,
        controlInputValue: PropTypes.object,
        controlMode: PropTypes.string,
        displayModel: PropTypes.func
    };

    printableArea = null;

    contextMenuRef = React.createRef();

    visualizerRef = React.createRef();

    canvas = React.createRef();

    actions = {
        // canvas
        zoomIn: () => {
            this.canvas.current.zoomIn();
        },
        zoomOut: () => {
            this.canvas.current.zoomOut();
        },
        toFront: () => {
            logModelViewOperation(HEAD_PRINTING, 'front');
            this.canvas.current.toFront();
        },
        toLeft: () => {
            logModelViewOperation(HEAD_PRINTING, 'left');
            this.canvas.current.toLeft();
        },
        toRight: () => {
            logModelViewOperation(HEAD_PRINTING, 'right');
            this.canvas.current.toRight();
        },
        toTop: () => {
            logModelViewOperation(HEAD_PRINTING, 'top');
            this.canvas.current.toTop();
        },
        toTopFrontRight: () => {
            logModelViewOperation(HEAD_PRINTING, 'isometric');
            this.canvas.current.toTopFrontRight();
        },
        fitViewIn: () => {
            if (this.props.selectedModelArray.length !== 0) {
                const { x, y, z } = this.props.modelGroup.getSelectedModelBBoxWHD();
                const selectedGroupBsphereRadius = Math.sqrt(x * x + y * y + z * z) / 2;
                this.canvas.current.fitViewIn(this.props.modelGroup.selectedGroup.position, selectedGroupBsphereRadius);
            } else {
                this.props.modelGroup.selectAllModels();
                const { x, y, z } = this.props.modelGroup.getSelectedModelBBoxWHD();
                const selectedGroupBsphereRadius = Math.sqrt(x * x + y * y + z * z) / 2;
                if (selectedGroupBsphereRadius > 0.000001) {
                    this.canvas.current.fitViewIn(this.props.modelGroup.selectedGroup.position, selectedGroupBsphereRadius);
                }
                this.props.modelGroup.unselectAllModels();
            }
        },
        onSelectModels: (intersect, selectEvent) => {
            this.props.selectMultiModel(intersect, selectEvent);
        },
        onModelBeforeTransform: () => {
            this.props.recordModelBeforeTransform(this.props.modelGroup);
        },
        onModelAfterTransform: (transformMode, axis) => {
            this.props.onModelTransform();
            this.props.recordModelAfterTransform(transformMode, this.props.modelGroup, axis);
            this.props.onModelAfterTransform();
        },
        // context menu
        centerSelectedModel: () => {
            this.props.updateSelectedModelTransformation({ positionX: 0, positionY: 0 });
            this.actions.updateBoundingBox();
            this.props.onModelAfterTransform();
        },

        deleteSelectedModel: () => {
            this.props.removeSelectedModel();
        },
        duplicateSelectedModel: () => {
            this.props.duplicateSelectedModel();
        },
        resetSelectedModelTransformation: () => {
            this.props.resetSelectedModelTransformation();
        },
        clearBuildPlate: () => {
            this.props.removeAllModels();
        },
        arrangeAllModels: (angle, offset, padding) => {
            this.props.arrangeAllModels(angle, offset, padding);
        },
        layFlatSelectedModel: () => {
            this.props.layFlatSelectedModel();
        },
        scaleToFitSelectedModel: (models) => {
            this.props.scaleToFitSelectedModel(models);
        },
        mirrorSelectedModel: (value) => {
            switch (value) {
                case 'X':
                    this.props.updateSelectedModelTransformation({
                        scaleX: this.props.transformation.scaleX * -1
                    }, false);
                    break;
                case 'Y':
                    this.props.updateSelectedModelTransformation({
                        scaleY: this.props.transformation.scaleY * -1
                    }, false);
                    break;
                case 'Z':
                    this.props.updateSelectedModelTransformation({
                        scaleZ: this.props.transformation.scaleZ * -1
                    }, false);
                    break;
                default:
                    break;
            }
        },
        autoRotateSelectedModel: () => {
            this.props.autoRotateSelectedModel();
        },
        updateBoundingBox: () => {
            this.canvas.current.updateBoundingBox();
        },
        setTransformMode: (value) => {
            console.log('-------------------- ', value);
            this.props.setTransformMode(value);
            this.canvas.current.setTransformMode(value);
            document.getElementById('control-input') && (document.getElementById('control-input').style.display = 'none');
            document.getElementById('control-input-2') && (document.getElementById('control-input-2').style.display = 'none');
        },
        setHoverFace: (value) => {
            if (!this.props.selectedModelArray.length) return;
            this.canvas.current.setHoverFace(value);
            this.canvas.current.renderScene();
        },
        onRotationPlacementSelect: (userData) => {
            this.props.setRotationPlacementFace(userData);
        },
        controlInputTransform: (mode, axis, data) => {
            if (mode === ROTATE_MODE) {
                this.props.recordModelBeforeTransform(this.props.modelGroup);
                const _rotateAxis = new Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
                const quaternion = new Quaternion().setFromAxisAngle(_rotateAxis, ThreeMath.degToRad(Number(data)));
                initQuaternion.copy(this.props.selectedModelArray[0].meshObject.quaternion);
                this.props.selectedModelArray[0].meshObject.quaternion.copy(quaternion).multiply(initQuaternion).normalize();
                this.props.modelGroup.onModelAfterTransform();
                this.props.recordModelAfterTransform('rotate', this.props.modelGroup);
                this.props.destroyGcodeLine();
                this.props.displayModel();
            } else {
                let newTransformation = {};
                if (mode === TRANSLATE_MODE) {
                    newTransformation = {
                        [`position${axis.toUpperCase()}`]: Number(data)
                    };
                } else if (mode === SCALE_MODE) {
                    newTransformation = {
                        [`scale${axis.toUpperCase()}`]: Number(data / 100)
                    };
                }
                this.props.updateSelectedModelTransformation(newTransformation);
                emitUpdateControlInputEvent({
                    controlValue: {
                        mode,
                        data: {
                            ...this.props.controlInputValue,
                            [axis]: Number(data)
                        }
                    }
                });
            }
        }
    };

    // all support related actions used in VisualizerModelTransformation & canvas.controls & contextmenu
    supportActions = {
        startSupportMode: () => {
            this.props.destroyGcodeLine();
            this.actions.setTransformMode('support');
            this.canvas.current.startSupportMode();
            // const model = this.props.selectedModelArray[0];
            // model.setVertexColors();
        },
        stopSupportMode: () => {
            // this.supportActions.saveSupport();
            this.canvas.current.stopSupportMode();
            // const model = this.props.selectedModelArray[0];
            // model && model.removeVertexColors();
        },
        moveSupport: (raycastResult) => {
            this.props.moveSupportBrush(raycastResult);
        },
        applyBrush: (raycastResult) => {
            this.props.applySupportBrush(raycastResult);
        }
    };


    shortcutHandler = {
        title: this.constructor.name,
        isActive: () => this.props.isActive,

        priority: priorities.VIEW,
        shortcuts: {
            [shortcutActions.SELECTALL]: this.props.selectAllModels,
            [shortcutActions.UNSELECT]: this.props.unselectAllModels,
            [shortcutActions.DELETE]: () => {
                if (!this.props.inProgress && !(this.props.menuDisabledCount > 0)) {
                    this.actions.deleteSelectedModel();
                }
            },
            [shortcutActions.COPY]: () => {
                if (!this.props.inProgress && !(this.props.menuDisabledCount > 0)) {
                    this.props.copy();
                }
            },
            [shortcutActions.PASTE]: () => {
                if (!this.props.inProgress && !(this.props.menuDisabledCount > 0)) {
                    this.props.paste();
                }
            },
            [shortcutActions.DUPLICATE]: () => {
                if (!this.props.inProgress && !(this.props.menuDisabledCount > 0)) {
                    this.actions.duplicateSelectedModel();
                }
            },
            [shortcutActions.UNDO]: () => {
                if (!this.props.inProgress && !(this.props.menuDisabledCount > 0)) {
                    this.props.undo();
                }
            },
            [shortcutActions.REDO]: () => {
                if (!this.props.inProgress && !(this.props.menuDisabledCount > 0)) {
                    this.props.redo();
                }
            },
            [shortcutActions.CUT]: () => {
                if (!this.props.inProgress && !(this.props.menuDisabledCount > 0)) {
                    this.props.cut();
                }
            },
            // optimize: accelerate when continuous click
            'SHOWGCODELAYERS_ADD': {
                keys: ['alt+up'],
                callback: () => { this.props.offsetGcodeLayers(1); }
            },
            'SHOWGCODELAYERS_MINUS': {
                keys: ['alt+down'],
                callback: () => { this.props.offsetGcodeLayers(-1); }
            }
        }
    };


    constructor(props) {
        super(props);
        const size = props.size;
        const stopArea = props.stopArea;
        this.printableArea = new PrintableCube(size, stopArea);
    }

    // hideContextMenu = () => {
    //     ContextMenu.hide();
    // };

    componentDidMount() {
        this.props.clearOperationHistory();
        this.canvas.current.resizeWindow();
        this.canvas.current.enable3D();
        // this.setState({ defaultSupportSize: { x: 5, y: 5 } });
        ShortcutManager.register(this.shortcutHandler);
        window.addEventListener(
            'hashchange',
            (event) => {
                if (event.newURL.endsWith('3dp') && this.canvas.current) {
                    this.canvas.current.resizeWindow();
                }
            },
            false
        );

        window.addEventListener(
            'fit-view-in',
            this.actions.fitViewIn,
            false
        );
        this.props.modelGroup.on('add', this.props.recordAddOperation);
    }

    componentDidUpdate(prevProps) {
        const { size, stopArea, transformMode, selectedModelArray, renderingTimestamp, modelGroup, stage, primeTowerHeight, enablePrimeTower, printingToolhead, promptTasks } = this.props;
        if (transformMode !== prevProps.transformMode) {
            this.canvas.current.setTransformMode(transformMode);
            if (transformMode === 'rotate-placement') {
                this.canvas.current.setSelectedModelConvexMeshGroup(modelGroup.selectedModelConvexMeshGroup);
            } else if (transformMode !== 'support-edit') {
                // this.supportActions.stopSupportMode();
                this.canvas.current.stopSupportMode();
            } else if (transformMode === 'support-edit') {
                this.canvas.current.startSupportMode();
            }
        }
        if (selectedModelArray !== prevProps.selectedModelArray) {
            // selectedModelIDArray.forEach((modelID) => {
            //     const model = modelGroup.models.find(d => d.modelID === modelID);
            //     modelGroup.selectedGroup.add(model.meshObject);
            // });
            this.canvas.current.updateBoundingBox();
            this.canvas.current.attach(modelGroup.selectedGroup);

            if (selectedModelArray.length === 1 && selectedModelArray[0].supportTag && !['translate', 'scale'].includes(transformMode)) {
                this.actions.setTransformMode('translate');
            }
        }

        if (!isEqual(size, prevProps.size)) {
            this.printableArea.updateSize(size, stopArea);
            const { gcodeLineGroup } = this.props;

            modelGroup.updateBoundingBox(new Box3(
                new Vector3(-size.x / 2 - EPSILON, -size.y / 2 - EPSILON, -EPSILON),
                new Vector3(size.x / 2 + EPSILON, size.y / 2 + EPSILON, size.z + EPSILON)
            ));

            // Re-position model group
            gcodeLineGroup.position.set(-size.x / 2, -size.y / 2, 0);
            this.canvas.current.setCamera(new Vector3(0, -Math.max(size.x, size.y, size.z) * 2, size.z / 2), new Vector3(0, 0, size.z / 2));
            if (transformMode !== 'rotate-placement') {
                this.supportActions.stopSupportMode();
            }
        }
        if (!isEqual(stopArea, prevProps.stopArea)) {
            this.printableArea.updateStopArea(stopArea);
        }

        if (renderingTimestamp !== prevProps.renderingTimestamp) {
            this.canvas.current.renderScene();
        }

        if (stage !== prevProps.stage) {
            if (promptTasks.length > 0) {
                if (stage === STEP_STAGE.PRINTING_LOAD_MODEL_COMPLETE) {
                    promptTasks.filter(item => item.status === 'fail').forEach(item => {
                        loadModelFailPopup(item.originalName);
                    });
                    promptTasks.filter(item => item.status === 'needScaletoFit').forEach(item => {
                        scaletoFitPopup(item.model).then(() => {
                            modelGroup.selectModelById(item.model.modelID);
                            this.actions.scaleToFitSelectedModel([item.model]);
                        });
                    });
                } else if (stage === STEP_STAGE.PRINTING_SLICE_FAILED) {
                    sliceFailPopup();
                }
            }
        }

        if (enablePrimeTower !== prevProps.enablePrimeTower && printingToolhead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2) {
            modelGroup.primeTower.visible = enablePrimeTower;
        }
        if (!Number.isNaN(primeTowerHeight) && !Number.isNaN(this.props.primeTowerHeight) && primeTowerHeight !== prevProps.primeTowerHeight) {
            const primeTowerModel = modelGroup.primeTower;
            if (primeTowerModel) {
                primeTowerModel.updateTransformation({
                    scaleZ: primeTowerHeight / 1
                });
                primeTowerModel.stickToPlate();
                this.canvas.current.renderScene();
            }
        }
        this.canvas.current.renderScene();
    }

    componentWillUnmount() {
        this.props.clearOperationHistory();
        this.props.modelGroup.off('add', this.props.recordAddOperation);
        window.removeEventListener('fit-view-in', this.actions.fitViewIn, false);
    }

    getNotice() {
        const { stage } = this.props;
        return this.props.progressStatesManager.getNotice(stage);
    }

    showContextMenu = (event) => {
        !this.props.leftBarOverlayVisible && this.contextMenuRef.current.show(event);
    }

    render() {
        const { size, selectedModelArray, modelGroup, gcodeLineGroup, inProgress, hasModel, displayedType, transformMode } = this.props; // transformMode

        const isModelSelected = (selectedModelArray.length > 0);
        const isMultipleModel = selectedModelArray.length > 1;
        const isSupportSelected = modelGroup.selectedModelArray.length > 0 && modelGroup.selectedModelArray[0].supportTag === true;
        const notice = this.getNotice();
        const progress = this.props.progress;
        const pasteDisabled = (modelGroup.clipboard.length === 0);
        const primeTowerSelected = selectedModelArray.length > 0 && some(selectedModelArray, { type: 'primeTower' });
        return (
            <div
                className={styles['printing-visualizer']}
                ref={this.visualizerRef}
            >
                <VisualizerLeftBar
                    fitViewIn={this.actions.fitViewIn}
                    updateBoundingBox={this.actions.updateBoundingBox}
                    setTransformMode={this.actions.setTransformMode}
                    supportActions={this.supportActions}
                    autoRotateSelectedModel={this.actions.autoRotateSelectedModel}
                    setHoverFace={this.actions.setHoverFace}
                    arrangeAllModels={this.actions.arrangeAllModels}
                />
                <div className={styles['visualizer-bottom-left']}>
                    <VisualizerBottomLeft actions={this.actions} />
                </div>

                <div className={styles['visualizer-preview-control']}>
                    <VisualizerPreviewControl />
                    <VisualizerClippingControl />
                </div>

                <ModeToggleBtn />

                <div className={styles['visualizer-info']}>
                    <VisualizerInfo />
                </div>

                <ProgressBar tips={notice} progress={progress * 100} />

                <div className={styles['canvas-wrapper']} style={{ position: 'relative' }}>
                    <Canvas
                        ref={this.canvas}
                        inProgress={inProgress}
                        size={size}
                        modelGroup={modelGroup}
                        displayedType={displayedType}
                        printableArea={this.printableArea}
                        clippingOutlines={this.props.clippingOutlines}
                        cameraInitialPosition={new Vector3(0, -Math.max(size.x, size.y, size.z) * 2, size.z / 2)}
                        cameraInitialTarget={new Vector3(0, 0, size.z / 2)}
                        cameraUp={new Vector3(0, 0, 1)}
                        gcodeLineGroup={gcodeLineGroup}
                        supportActions={this.supportActions}
                        onSelectModels={this.actions.onSelectModels}
                        onModelAfterTransform={this.actions.onModelAfterTransform}
                        onRotationPlacementSelect={this.actions.onRotationPlacementSelect}
                        onModelBeforeTransform={this.actions.onModelBeforeTransform}
                        showContextMenu={this.showContextMenu}
                        primeTowerSelected={primeTowerSelected}
                        transformMode={transformMode}
                    />
                    {!(this.props.controlMode === TRANSLATE_MODE && this.props.controlAxis[0] === 'z') && (
                        <div className={`canvas-input position-ab border-${this.props.controlAxis[0]} translate-animation-3`} id="control-input" style={{ display: 'none' }}>
                            <Input
                                size="small"
                                placeholder="0"
                                value={this.props.controlInputValue ? this.props.controlInputValue[this.props.controlAxis[0]] : null}
                                suffix={modeSuffix[this.props.controlMode]}
                                allowUndefined
                                prefix={`${this.props.controlAxis[0].toUpperCase()}:`}
                                onPressEnter={(event) => {
                                    this.actions.controlInputTransform(this.props.controlMode, this.props.controlAxis[0], event.target.value);
                                }}
                            />
                        </div>
                    )}
                    {this.props.controlAxis[1] && (
                        <div className={`canvas-input position-ab border-${this.props.controlAxis[1]} translate-animation-3`} id="control-input-2">
                            <Input
                                size="small"
                                placeholder="0"
                                value={this.props.controlInputValue ? this.props.controlInputValue[this.props.controlAxis[1]] : null}
                                suffix={modeSuffix[this.props.controlMode]}
                                prefix={`${this.props.controlAxis[1].toUpperCase()}:`}
                                allowUndefined
                                onPressEnter={(event) => {
                                    this.actions.controlInputTransform(this.props.controlMode, this.props.controlAxis[1], event.target.value);
                                }}
                            />
                        </div>
                    )}
                </div>
                <ContextMenu
                    ref={this.contextMenuRef}
                    id="3dp"
                    menuItems={
                        [
                            {
                                type: 'item',
                                label: i18n._('key-Printing/ContextMenu-Cut'),
                                disabled: inProgress || !isModelSelected || isSupportSelected,
                                onClick: this.props.cut
                            },
                            {
                                type: 'item',
                                label: i18n._('key-Printing/ContextMenu-Copy'),
                                disabled: inProgress || !isModelSelected || isSupportSelected,
                                onClick: this.props.copy
                            },
                            {
                                type: 'item',
                                label: i18n._('key-Printing/ContextMenu-Paste'),
                                disabled: inProgress || isSupportSelected || pasteDisabled,
                                onClick: this.props.paste
                            },
                            {
                                type: 'item',
                                label: i18n._('key-Printing/ContextMenu-Duplicate'),
                                disabled: inProgress || !isModelSelected || isSupportSelected,
                                onClick: this.actions.duplicateSelectedModel
                            },
                            {
                                type: 'separator'
                            },
                            {
                                type: 'item',
                                label: i18n._('key-Printing/ContextMenu-FitViewIn'),
                                disabled: inProgress || !hasModel || isSupportSelected,
                                onClick: this.actions.fitViewIn
                            },
                            {
                                type: 'item',
                                label: i18n._('key-Printing/ContextMenu-Hide'),
                                disabled: inProgress || !isModelSelected || isSupportSelected,
                                onClick: this.props.hideSelectedModel
                            },
                            {
                                type: 'separator'
                            },
                            {
                                type: 'item',
                                label: i18n._('key-Printing/ContextMenu-Reset Model Transformation'),
                                disabled: inProgress || !isModelSelected || isSupportSelected,
                                onClick: this.actions.resetSelectedModelTransformation
                            },
                            {
                                type: 'item',
                                label: i18n._('key-Printing/ContextMenu-Center Models'),
                                disabled: inProgress || !isModelSelected || isSupportSelected,
                                onClick: this.actions.centerSelectedModel
                            },
                            {
                                type: 'item',
                                label: i18n._('key-Printing/ContextMenu-Auto Rotate'),
                                disabled: inProgress || !isModelSelected || isSupportSelected || isMultipleModel,
                                onClick: this.actions.autoRotateSelectedModel
                            },
                            {
                                type: 'item',
                                label: i18n._('key-Printing/ContextMenu-Auto Arrange'),
                                disabled: inProgress || !hasModel || isSupportSelected,
                                onClick: () => {
                                    this.actions.arrangeAllModels();
                                }
                            }
                        ]
                    }
                />
            </div>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const machine = state.machine;
    const { currentModalPath } = state.appbarMenu;
    const printing = state.printing;
    const { size, toolHead: { printingToolhead } } = machine;
    const { menuDisabledCount } = state.appbarMenu;
    // TODO: be to organized
    const {
        progressStatesManager,
        stage,
        promptTasks,
        modelGroup,
        hasModel,
        gcodeLineGroup,
        transformMode,
        progress,
        displayedType,
        renderingTimestamp,
        inProgress,
        enableShortcut,
        leftBarOverlayVisible,
        primeTowerHeight,
        qualityDefinitions,
        defaultQualityId,
        stopArea,
        clippingOutlines
    } = printing;
    const activeQualityDefinition = find(qualityDefinitions, { definitionId: defaultQualityId });
    const enablePrimeTower = activeQualityDefinition?.settings?.prime_tower_enable?.default_value;
    let isActive = true;
    if (enableShortcut) {
        if (!currentModalPath && ownProps.location.pathname.indexOf(HEAD_PRINTING) > 0) {
            isActive = true;
        } else {
            isActive = false;
        }
    } else {
        isActive = false;
    }

    return {
        stopArea,
        leftBarOverlayVisible,
        isActive,
        stage,
        promptTasks,
        size,
        selectedModelArray: modelGroup.selectedModelArray,
        transformation: modelGroup.getSelectedModelTransformationForPrinting(),
        modelGroup,
        hasModel,
        menuDisabledCount,
        gcodeLineGroup,
        transformMode,
        progress,
        displayedType,
        renderingTimestamp,
        inProgress,
        progressStatesManager,
        enablePrimeTower,
        primeTowerHeight,
        printingToolhead,
        clippingOutlines
    };
};

const mapDispatchToProps = (dispatch) => ({
    recordAddOperation: (model) => dispatch(printingActions.recordAddOperation(model)),
    recordModelBeforeTransform: (modelGroup) => dispatch(printingActions.recordModelBeforeTransform(modelGroup)),
    recordModelAfterTransform: (transformMode, modelGroup, axis) => dispatch(printingActions.recordModelAfterTransform(transformMode, modelGroup, null, axis)),
    clearOperationHistory: () => dispatch(operationHistoryActions.clear(HEAD_PRINTING)),

    hideSelectedModel: () => dispatch(printingActions.hideSelectedModel()),
    destroyGcodeLine: () => dispatch(printingActions.destroyGcodeLine()),
    offsetGcodeLayers: (offset) => dispatch(printingActions.offsetGcodeLayers(offset)),
    selectMultiModel: (intersect, selectEvent) => dispatch(printingActions.selectMultiModel(intersect, selectEvent)),
    unselectAllModels: () => dispatch(printingActions.unselectAllModels()),
    selectAllModels: () => dispatch(printingActions.selectAllModels()),
    cut: () => dispatch(printingActions.cut()),
    copy: () => dispatch(printingActions.copy()),
    paste: () => dispatch(printingActions.paste()),
    undo: () => dispatch(printingActions.undo(HEAD_PRINTING)),
    redo: () => dispatch(printingActions.redo(HEAD_PRINTING)),
    removeSelectedModel: () => dispatch(printingActions.removeSelectedModel()),
    removeAllModels: () => dispatch(printingActions.removeAllModels()),
    arrangeAllModels: (angle = 45, offset = 1, padding = 0) => dispatch(printingActions.arrangeAllModels(angle, offset, padding)),
    onModelTransform: () => dispatch(printingActions.onModelTransform()),
    onModelAfterTransform: () => dispatch(printingActions.onModelAfterTransform()),
    updateSelectedModelTransformation: (transformation, newUniformScalingState) => {
        return dispatch(printingActions.updateSelectedModelTransformation(transformation, newUniformScalingState));
    },
    duplicateSelectedModel: () => dispatch(printingActions.duplicateSelectedModel()),
    layFlatSelectedModel: () => dispatch(printingActions.layFlatSelectedModel()),
    resetSelectedModelTransformation: () => dispatch(printingActions.resetSelectedModelTransformation()),
    autoRotateSelectedModel: () => dispatch(printingActions.autoRotateSelectedModel()),
    scaleToFitSelectedModel: (models) => dispatch(printingActions.scaleToFitSelectedModel(models)),
    setTransformMode: (value) => dispatch(printingActions.setTransformMode(value)),
    moveSupportBrush: (raycastResult) => dispatch(printingActions.moveSupportBrush(raycastResult)),
    applySupportBrush: (raycastResult) => dispatch(printingActions.applySupportBrush(raycastResult)),
    setRotationPlacementFace: (userData) => dispatch(printingActions.setRotationPlacementFace(userData)),
    displayModel: () => dispatch(printingActions.displayModel())
});

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Visualizer));
