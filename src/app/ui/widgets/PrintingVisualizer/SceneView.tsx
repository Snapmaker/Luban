import { isEqual, some } from 'lodash';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';
import { Box3, Quaternion, Math as ThreeMath, Vector3 } from 'three';

import { EPSILON, HEAD_PRINTING, ROTATE_MODE, SCALE_MODE, TRANSLATE_MODE } from '../../../constants';
import { actions as machineActions } from '../../../flux/machine';
import { actions as operationHistoryActions } from '../../../flux/operation-history';
import { actions as printingActions } from '../../../flux/printing';
import sceneActions from '../../../flux/printing/actions-scene';
import { actions as settingsActions } from '../../../flux/setting';
import { logModelViewOperation } from '../../../lib/gaEvent';
import i18n from '../../../lib/i18n';
import { STEP_STAGE } from '../../../lib/manager/ProgressManager';
import { ModelEvents } from '../../../models/events';
import scene, { SceneEvent } from '../../../scene/Scene';
import ProgressBar from '../../components/ProgressBar';
import Canvas from '../../components/SMCanvas';
import { emitUpdateControlInputEvent } from '../../components/SMCanvas/TransformControls';
import { toast } from '../../components/Toast';
import { PageMode } from '../../pages/PageMode';
import { repairModelPopup } from '../../views/repair-model/repair-model-popup';
import { SceneToast } from '../../views/toasts/SceneToast';
import ModeToggleBtn from './ModeToggleBtn';
import PrintableCube from './PrintableCube';
import VisualizerBottomLeft from './VisualizerBottomLeft';
import VisualizerClippingControl from './VisualizerClippingControl';
import VisualizerInfo from './VisualizerInfo';
import VisualizerLeftBar from './VisualizerLeftBar';
import {
    loadModelFailPopup,
    repairModelFailPopup,
    scaletoFitPopup,
    sliceFailPopup,
} from './VisualizerPopup';
import VisualizerPreviewControl from './VisualizerPreviewControl';
import SceneContextMenu from './components/SceneContextMenu';
import SceneShortcuts from './components/SceneShortcuts';
import styles from './styles.styl';
import MeshColoringControl from '../../../scene/controls/MeshColoringControl';

const initQuaternion = new Quaternion();

/**
 * SceneView.
 *
 * FIXME:
 *  1. Refactor sub-components
 *  2. Change this component to functional component
 */
class Visualizer extends PureComponent {
    public static propTypes = {
        series: PropTypes.string.isRequired,
        size: PropTypes.object.isRequired,
        stage: PropTypes.number.isRequired,
        promptTasks: PropTypes.array.isRequired,
        selectedModelArray: PropTypes.array,
        modelGroup: PropTypes.object.isRequired,
        gcodeLineGroup: PropTypes.object.isRequired,
        transformMode: PropTypes.string.isRequired,
        progress: PropTypes.number.isRequired,
        renderingTimestamp: PropTypes.number.isRequired,
        inProgress: PropTypes.bool.isRequired,
        leftBarOverlayVisible: PropTypes.bool.isRequired,
        displayedType: PropTypes.string,
        enable3dpLivePreview: PropTypes.bool.isRequired,
        // allModel: PropTypes.array,

        recordAddOperation: PropTypes.func.isRequired,
        recordModelBeforeTransform: PropTypes.func.isRequired,
        recordModelAfterTransform: PropTypes.func.isRequired,
        clearOperationHistory: PropTypes.func.isRequired,
        // offsetGcodeLayers: PropTypes.func.isRequired,
        destroyGcodeLine: PropTypes.func.isRequired,
        selectMultiModel: PropTypes.func.isRequired,
        selectAllModels: PropTypes.func.isRequired,
        unselectAllModels: PropTypes.func.isRequired,
        // copy: PropTypes.func.isRequired,
        // undo: PropTypes.func.isRequired,
        // redo: PropTypes.func.isRequired,
        removeAllModels: PropTypes.func.isRequired,
        arrangeAllModels: PropTypes.func.isRequired,
        onModelTransform: PropTypes.func.isRequired,
        onModelAfterTransform: PropTypes.func.isRequired,
        updateSelectedModelTransformation: PropTypes.func.isRequired,
        setTransformMode: PropTypes.func.isRequired,
        moveBrush: PropTypes.func.isRequired,
        applySupportBrush: PropTypes.func.isRequired,
        autoRotateSelectedModel: PropTypes.func.isRequired,
        layFlatSelectedModel: PropTypes.func.isRequired,
        scaleToFitSelectedModel: PropTypes.func.isRequired,
        resetSelectedModelTransformation: PropTypes.func.isRequired,
        progressStatesManager: PropTypes.object.isRequired,
        setRotationPlacementFace: PropTypes.func.isRequired,
        repairSelectedModels: PropTypes.func.isRequired,
        updatePromptDamageModel: PropTypes.func.isRequired,
        stopArea: PropTypes.object,
        displayModel: PropTypes.func,
        pageMode: PropTypes.string.isRequired,
        setPageMode: PropTypes.func.isRequired,
        simplifyOriginModelInfo: PropTypes.object,
        loadSimplifyModel: PropTypes.func,
        modelSimplify: PropTypes.func,
        resetSimplifyOriginModelInfo: PropTypes.func,
        recordSimplifyModel: PropTypes.func,
        setSelectedModelsExtruder: PropTypes.func,
        updateState: PropTypes.func,

        // dev tools
        downloadLogs: PropTypes.func.isRequired,
        resetPrintConfigurations: PropTypes.func.isRequired,
    };

    public printableArea = null;

    public contextMenuRef2 = React.createRef();

    public canvas = React.createRef();

    public actions = {
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
            if (this.props.pageMode !== PageMode.Default) {
                return;
            }
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
        autoRotateSelectedModel: () => {
            this.props.autoRotateSelectedModel();
        },
        updateBoundingBox: () => {
            this.canvas.current.updateBoundingBox();
        },
        setTransformMode: (value) => {
            this.props.setTransformMode(value);
            this.canvas.current.setTransformMode(value);
        },
        setHoverFace: (value) => {
            if (!this.props.selectedModelArray.length) return;
            this.canvas.current.setHoverFace(value);
            this.canvas.current.renderScene();
        },
        onRotationPlacementSelect: (userData) => {
            this.props.setRotationPlacementFace(userData);
        },
        controlInputTransform: (mode, axis, data, controlInputValue) => {
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
                this.checkoutModelsLocation();
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
                this.checkoutModelsLocation();
                emitUpdateControlInputEvent({
                    controlValue: {
                        mode,
                        data: {
                            ...controlInputValue,
                            [axis]: Number(data)
                        }
                    }
                });
            }
        },




        /**
         * Set selected model(s) extruder to extruderId ('0' or '1').
         *
         * @param extruderId
         */
        setSelectedModelsExtruder: (extruderId) => {
            this.props.setSelectedModelsExtruder({
                shell: extruderId,
                infill: extruderId,
            });
        },
    };

    /**
     * 1) Check if any model go out of bounds, toast to notify user.
     */
    public checkModelsOutOfHeatedBedBounds = () => {
        // toast.dismiss();

        const modelGroup = this.props.modelGroup;

        const avaiableModels = modelGroup.getSelectedModelsForHotZoneCheck();

        // Check if any model(s) excceeds heated bed zone
        const hasOverstepped = avaiableModels.some((model) => {
            return model.overstepped;
        });

        if (hasOverstepped) {
            toast(
                <SceneToast
                    type="warning"
                    text={i18n._('key-Printing/This is the non printable area')}
                />
            );
            return;
        }

        // Check if any model(s) excceeds hot zone
        const printableArea = this.printableArea;
        if (printableArea.isPointInShape) {
            if (avaiableModels.length > 0) {
                let hasOversteppedHotArea = false;
                avaiableModels.forEach((model) => {
                    const bbox = model.boundingBox;
                    const points = [
                        bbox.max,
                        bbox.min,
                        new Vector3(bbox.max.x, bbox.min.y, 0),
                        new Vector3(bbox.min.x, bbox.max.y, 0),
                    ];
                    const inHotArea = points.every((point) => {
                        return printableArea.isPointInShape(point);
                    });
                    model.hasOversteppedHotArea = !inHotArea;
                    if (!inHotArea) {
                        hasOversteppedHotArea = true;
                    }
                });
                if (hasOversteppedHotArea) {
                    toast(
                        <SceneToast
                            type="info"
                            text={i18n._('key-Printing/Place the model within the High-temperature Zone to get a temperature higher than 80℃.')}
                        />
                    );
                }
            }
        }
    };

    public onAddModel = (model) => {
        this.props.recordAddOperation(model);

        this.checkModelsOutOfHeatedBedBounds();
    };

    public onMeshPositionChanged = () => {
        this.checkModelsOutOfHeatedBedBounds();
    };

    // all support related actions used in VisualizerModelTransformation & canvas.controls & contextmenu
    public supportActions = {
        moveBrush: (raycastResult) => {
            this.props.moveBrush(raycastResult);
        },
        applySupportBrush: (raycastResult) => {
            this.props.applySupportBrush(raycastResult);
        },
    };

    public constructor(props) {
        super(props);
        const size = props.size;
        const stopArea = props.stopArea;
        const series = props.series;
        this.printableArea = new PrintableCube(series, size, stopArea);

        // TODO: Move the creation of build volume to scene
        scene.setBuildVolume(this.printableArea);
    }

    // hideContextMenu = () => {
    //     ContextMenu.hide();
    // };

    // canvas: Canvas
    public onSceneCreated = (canvas) => {
        const modelGroup = this.props.modelGroup;

        // configure control manager
        const controlManager = canvas.getControlManager();
        scene.setControlManager(controlManager);

        const meshColoringControl = new MeshColoringControl(canvas.getCamera(), modelGroup);
        controlManager.registerControl('mesh-coloring', meshColoringControl);

        scene.on(SceneEvent.MeshChanged, () => {
            canvas.renderScene();
        });

        scene.on(SceneEvent.MeshPositionChanged, () => {
            canvas.renderScene();
        });
    };

    public componentDidMount() {
        this.props.clearOperationHistory();

        this.canvas.current.resizeWindow();
        this.canvas.current.enable3D();
        // this.setState({ defaultSupportSize: { x: 5, y: 5 } });
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

        this.props.modelGroup.on(ModelEvents.AddModel, this.onAddModel);
        this.props.modelGroup.on(ModelEvents.MeshPositionChanged, this.onMeshPositionChanged);
    }

    public componentDidUpdate(prevProps) {
        const {
            size, stopArea, transformMode, selectedModelArray, renderingTimestamp, modelGroup, stage,
            promptTasks
        } = this.props;


        if (transformMode !== prevProps.transformMode) {
            this.canvas.current.setTransformMode(transformMode);

            if (prevProps.transformMode === 'support-edit') {
                this.canvas.current.stopSupportMode();
            }
            if (prevProps.transformMode === 'mesh-coloring') {
                this.canvas.current.stopMeshColoringMode();
            }

            if (transformMode === 'rotate-placement') {
                this.canvas.current.setSelectedModelConvexMeshGroup(modelGroup.selectedModelConvexMeshGroup);
            } else if (transformMode === 'support-edit') {
                this.canvas.current.startSupportMode();
            } else if (transformMode === 'mesh-coloring') {
                this.canvas.current.startMeshColoringMode();
            }
        }
        if (selectedModelArray !== prevProps.selectedModelArray) {
            // selectedModelIDArray.forEach((modelID) => {
            //     const model = modelGroup.models.find(d => d.modelID === modelID);
            //     modelGroup.selectedGroup.add(model.meshObject);
            // });
            // TODO: Performance optimization test
            const prevSelectedKey = prevProps.selectedModelArray.map((i) => {
                return i.modelID;
            }).sort().join('');
            const SelectedKey = selectedModelArray.map((i) => {
                return i.modelID;
            }).sort().join('');
            if (SelectedKey !== prevSelectedKey || transformMode !== prevProps.transformMode) {
                this.canvas.current.updateBoundingBox();
                this.canvas.current.attach(modelGroup.selectedGroup);
            }

            if (selectedModelArray.length === 1 && selectedModelArray[0].supportTag && !['translate', 'scale'].includes(transformMode)) {
                this.actions.setTransformMode('translate');
            }
        }

        if (!isEqual(size, prevProps.size)) {
            this.printableArea.updateSize(this.props.series, size, stopArea);
            const { gcodeLineGroup } = this.props;

            modelGroup.updateBoundingBox(new Box3(
                new Vector3(-size.x / 2 - EPSILON, -size.y / 2 - EPSILON, -EPSILON),
                new Vector3(size.x / 2 + EPSILON, size.y / 2 + EPSILON, size.z + EPSILON)
            ));

            // Re-position model group
            gcodeLineGroup.position.set(-size.x / 2, -size.y / 2, 0);
            this.canvas.current.setCamera(new Vector3(0, -Math.max(size.x, size.y, size.z) * 2, size.z / 2), new Vector3(0, 0, size.z / 2));
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
                    promptTasks.filter(item => item.status === 'load-model-fail').forEach(item => {
                        loadModelFailPopup(item.originalName);
                    });
                    promptTasks.filter(item => item.status === 'needScaletoFit').forEach(item => {
                        scaletoFitPopup(item.model).then(() => {
                            modelGroup.selectModelById(item.model.modelID);
                            this.actions.scaleToFitSelectedModel([item.model]);
                        });
                    });
                    const needRepairModels = promptTasks.filter(item => item.status === 'need-repair-model').map((i) => {
                        return i.model;
                    });
                    if (needRepairModels.length) {
                        repairModelPopup(needRepairModels).then((ignore) => {
                            modelGroup.unselectAllModels();
                            modelGroup.addModelToSelectedGroup(...needRepairModels);
                            this.props.repairSelectedModels();
                            this.props.updatePromptDamageModel(!ignore);
                        }).catch((ignore) => {
                            this.props.updatePromptDamageModel(!ignore);
                        });
                    }
                } else if (stage === STEP_STAGE.PRINTING_SLICE_FAILED) {
                    sliceFailPopup()
                        .then((res) => {
                            if (res === 'reset') {
                                this.props.resetPrintConfigurations();
                            } else if (res === 'download-logs') {
                                this.props.downloadLogs();
                            }
                        });
                } else if (stage === STEP_STAGE.PRINTING_REPAIRING_MODEL) {
                    const models = promptTasks.filter(item => item.status === 'repair-model-fail');
                    if (models.length) {
                        repairModelFailPopup(models, () => {
                            this.props.updateState({ stage: STEP_STAGE.EMPTY });
                        });
                    }
                }
            }
        }

        this.canvas.current.renderScene();
    }

    public componentWillUnmount() {
        this.props.clearOperationHistory();
        this.props.modelGroup.off(ModelEvents.AddModel, this.onAddModel);
        this.props.modelGroup.off(ModelEvents.MeshPositionChanged, this.onMeshPositionChanged);
        window.removeEventListener('fit-view-in', this.actions.fitViewIn, false);
    }

    public getNotice() {
        const { stage } = this.props;
        return this.props.progressStatesManager.getNotice(stage);
    }

    public showContextMenu = (event) => {
        if (!this.props.leftBarOverlayVisible) {
            this.contextMenuRef2.current.show(event);
        }
    };

    public handleCancelSimplify = () => {
        const { selectedModelArray, simplifyOriginModelInfo: { sourceSimplifyName } } = this.props;
        this.props.loadSimplifyModel(selectedModelArray[0].modelID, sourceSimplifyName, true);
        this.props.resetSimplifyOriginModelInfo();
        this.props.setPageMode(PageMode.Default);
    };

    public handleApplySimplify = () => {
        this.props.recordSimplifyModel();
        this.props.resetSimplifyOriginModelInfo();
        this.props.setPageMode(PageMode.Default);
    };

    public handleUpdateSimplifyConfig = (type, percent) => {
        this.props.modelSimplify(type, percent);
    };

    public checkoutModelsLocation = () => {
        // this.canvas.current.checkoutModelsLocation();
    };

    public render() {
        const { size, selectedModelArray, modelGroup, gcodeLineGroup, inProgress, displayedType, transformMode } = this.props; // transformMode

        const notice = this.getNotice();
        const progress = this.props.progress;
        const primeTowerSelected = selectedModelArray.length > 0 && some(selectedModelArray, { type: 'primeTower' });

        return (
            <div>
                <div className={styles['canvas-container']}>
                    <Canvas
                        ref={this.canvas}
                        onSceneCreated={this.onSceneCreated}
                        inProgress={inProgress}
                        size={size}
                        modelGroup={modelGroup}
                        displayedType={displayedType}
                        printableArea={this.printableArea}
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
                        onControlInputTransform={this.actions.controlInputTransform}
                    />
                </div>

                <VisualizerLeftBar
                    fitViewIn={this.actions.fitViewIn}
                    updateBoundingBox={this.actions.updateBoundingBox}
                    setTransformMode={this.actions.setTransformMode}
                    autoRotateSelectedModel={this.actions.autoRotateSelectedModel}
                    setHoverFace={this.actions.setHoverFace}
                    arrangeAllModels={this.actions.arrangeAllModels}
                    pageMode={this.props.pageMode}
                    setPageMode={this.props.setPageMode}
                    handleApplySimplify={this.handleApplySimplify}
                    handleCancelSimplify={this.handleCancelSimplify}
                    handleUpdateSimplifyConfig={this.handleUpdateSimplifyConfig}
                    handleCheckModelLocation={this.checkoutModelsLocation}
                />

                <div className={styles['visualizer-bottom-left']}>
                    <VisualizerBottomLeft actions={this.actions} />
                </div>

                <div className={styles['visualizer-info']}>
                    <VisualizerInfo />
                </div>

                <div className={styles['visualizer-preview-control']}>
                    <VisualizerPreviewControl />
                    {
                        this.props.enable3dpLivePreview && (
                            <VisualizerClippingControl />
                        )
                    }
                </div>

                <ModeToggleBtn />


                <ProgressBar tips={notice} progress={progress * 100} />

                {/* Context Menu */}
                <SceneContextMenu
                    ref={this.contextMenuRef2}
                    canvas={this.canvas}
                />

                {/* Shortcuts */}
                <SceneShortcuts />
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    const printing = state.printing;
    const { size, series, enable3dpLivePreview } = machine;
    // TODO: be to organized
    const {
        progressStatesManager,
        stage,
        promptTasks,
        modelGroup,
        gcodeLineGroup,
        transformMode,
        progress,
        displayedType,
        renderingTimestamp,
        inProgress,
        leftBarOverlayVisible,
        stopArea,
        simplifyOriginModelInfo
    } = printing;

    return {
        // machine
        stopArea,
        leftBarOverlayVisible,
        stage,
        promptTasks,
        size,
        series,
        selectedModelArray: modelGroup.selectedModelArray,
        transformation: modelGroup.getSelectedModelTransformationForPrinting(),
        modelGroup,
        gcodeLineGroup,
        transformMode,
        progress,
        displayedType,
        renderingTimestamp,
        inProgress,
        progressStatesManager,
        simplifyOriginModelInfo,
        enable3dpLivePreview
    };
};

const mapDispatchToProps = (dispatch) => ({
    recordAddOperation: (model) => dispatch(printingActions.recordAddOperation(model)),
    recordModelBeforeTransform: (modelGroup) => dispatch(printingActions.recordModelBeforeTransform(modelGroup)),
    recordModelAfterTransform: (transformMode, modelGroup, axis) => dispatch(printingActions.recordModelAfterTransform(transformMode, modelGroup, null, axis)),
    clearOperationHistory: () => dispatch(operationHistoryActions.clear(HEAD_PRINTING)),

    destroyGcodeLine: () => dispatch(printingActions.destroyGcodeLine()),
    // offsetGcodeLayers: (offset) => dispatch(printingActions.offsetGcodeLayers(offset)),
    selectMultiModel: (intersect, selectEvent) => dispatch(printingActions.selectMultiModel(intersect, selectEvent)),
    unselectAllModels: () => dispatch(printingActions.unselectAllModels()),
    selectAllModels: () => dispatch(printingActions.selectAllModels()),
    // copy: () => dispatch(printingActions.copy()),
    // undo: () => dispatch(printingActions.undo(HEAD_PRINTING)),
    // redo: () => dispatch(printingActions.redo(HEAD_PRINTING)),
    removeAllModels: () => dispatch(printingActions.removeAllModels()),
    arrangeAllModels: (angle = 45, offset = 1, padding = 0) => dispatch(printingActions.arrangeAllModels(angle, offset, padding)),
    onModelTransform: () => dispatch(printingActions.onModelTransform()),
    onModelAfterTransform: () => dispatch(printingActions.onModelAfterTransform()),
    updateSelectedModelTransformation: (transformation, newUniformScalingState) => {
        return dispatch(printingActions.updateSelectedModelTransformation(transformation, newUniformScalingState));
    },
    layFlatSelectedModel: () => dispatch(printingActions.layFlatSelectedModel()),
    resetSelectedModelTransformation: () => dispatch(printingActions.resetSelectedModelTransformation()),
    autoRotateSelectedModel: () => dispatch(printingActions.autoRotateSelectedModel()),
    scaleToFitSelectedModel: (models) => dispatch(printingActions.scaleToFitSelectedModel(models)),
    repairSelectedModels: () => dispatch(printingActions.repairSelectedModels()),
    updatePromptDamageModel: (bool) => dispatch(machineActions.updatePromptDamageModel(bool)),
    setTransformMode: (value) => dispatch(printingActions.setTransformMode(value)),
    moveBrush: (raycastResult) => dispatch(sceneActions.moveBrush(raycastResult)),
    applySupportBrush: (raycastResult) => dispatch(sceneActions.applySupportBrush(raycastResult)),
    setRotationPlacementFace: (userData) => dispatch(printingActions.setRotationPlacementFace(userData)),
    displayModel: () => dispatch(printingActions.displayModel()),
    loadSimplifyModel: (modelID, modelOutputName, isCancelSimplify) => dispatch(printingActions.loadSimplifyModel({
        modelID,
        modelOutputName,
        isCancelSimplify
    })),
    modelSimplify: (type, percent) => dispatch(printingActions.modelSimplify(type, percent)),
    resetSimplifyOriginModelInfo: () => dispatch(printingActions.resetSimplifyOriginModelInfo()),
    recordSimplifyModel: () => dispatch(printingActions.recordSimplifyModel()),

    setSelectedModelsExtruder: (extruderConfig) => dispatch(printingActions.updateSelectedModelsExtruder(extruderConfig)),

    // TODO: you should not expose updateState to JSX
    updateState: (obj) => dispatch(printingActions.updateState(obj)),

    downloadLogs: () => dispatch(settingsActions.downloadLogs()),
    resetPrintConfigurations: () => dispatch(settingsActions.resetPrintConfigurations()),
});

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Visualizer));
