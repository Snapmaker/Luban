// import isEqual from 'lodash/isEqual';
import { isEqual, some } from 'lodash';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';
import { Box3, Math as ThreeMath, Quaternion, Vector3 } from 'three';
import { EPSILON, HEAD_PRINTING, ROTATE_MODE, SCALE_MODE, TRANSLATE_MODE } from '../../../constants';
import { isDualExtruder } from '../../../constants/machines';
import { actions as machineActions } from '../../../flux/machine';
import { actions as operationHistoryActions } from '../../../flux/operation-history';
import { actions as printingActions } from '../../../flux/printing';
import { actions as settingsActions } from '../../../flux/setting';
import { logModelViewOperation } from '../../../lib/gaEvent';
import i18n from '../../../lib/i18n';

import { STEP_STAGE } from '../../../lib/manager/ProgressManager';
import { priorities, shortcutActions, ShortcutManager } from '../../../lib/shortcut';
import { ModelEvents } from '../../../models/events';

import scene from '../../../scene/Scene';
import ContextMenu from '../../components/ContextMenu';
import ProgressBar from '../../components/ProgressBar';
import Canvas from '../../components/SMCanvas';
import { emitUpdateControlInputEvent } from '../../components/SMCanvas/TransformControls';
import { PageMode } from '../../pages/PageMode';
import { repairModelPopup } from '../../views/repair-model/repair-model-popup';

import ModeToggleBtn from './ModeToggleBtn';
import PrintableCube from './PrintableCube';
import styles from './styles.styl';
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
// , MeshPhongMaterial, DoubleSide, Mesh, CylinderBufferGeometry

const initQuaternion = new Quaternion();

class Visualizer extends PureComponent {
    static propTypes = {
        isActive: PropTypes.bool.isRequired,
        series: PropTypes.string.isRequired,
        toolHead: PropTypes.object.isRequired,
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
        hasModel: PropTypes.bool.isRequired,
        leftBarOverlayVisible: PropTypes.bool.isRequired,
        displayedType: PropTypes.string,
        menuDisabledCount: PropTypes.number,
        enable3dpLivePreview: PropTypes.bool.isRequired,
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
        autoRotateSelectedModel: () => {
            this.props.autoRotateSelectedModel();
        },
        updateBoundingBox: () => {
            this.canvas.current.updateBoundingBox();
        },
        setTransformMode: (value) => {
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

        onAddModel: (model) => {
            this.props.recordAddOperation(model);

            // Call detection once model added
            // TODO: Refactor this function to printable area logic
            this.canvas.current.detectionLocation();
        },

        onMeshPositionChanged: () => {
            this.canvas.current.detectionLocation();
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
                callback: () => {
                    this.props.offsetGcodeLayers(1);
                }
            },
            'SHOWGCODELAYERS_MINUS': {
                keys: ['alt+down'],
                callback: () => {
                    this.props.offsetGcodeLayers(-1);
                }
            }
        }
    };


    constructor(props) {
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
        this.props.modelGroup.on(ModelEvents.AddModel, this.actions.onAddModel);
        this.props.modelGroup.on(ModelEvents.MeshPositionChanged, this.actions.onMeshPositionChanged);
    }

    componentDidUpdate(prevProps) {
        const {
            size, stopArea, transformMode, selectedModelArray, renderingTimestamp, modelGroup, stage,
            promptTasks
        } = this.props;
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

    componentWillUnmount() {
        this.props.clearOperationHistory();
        this.props.modelGroup.off(ModelEvents.AddModel, this.actions.onAddModel);
        this.props.modelGroup.off(ModelEvents.MeshPositionChanged, this.actions.onMeshPositionChanged);
        window.removeEventListener('fit-view-in', this.actions.fitViewIn, false);
    }

    getNotice() {
        const { stage } = this.props;
        return this.props.progressStatesManager.getNotice(stage);
    }

    showContextMenu = (event) => {
        !this.props.leftBarOverlayVisible && this.contextMenuRef.current.show(event);
    };

    handleCancelSimplify = () => {
        const { selectedModelArray, simplifyOriginModelInfo: { sourceSimplifyName } } = this.props;
        this.props.loadSimplifyModel(selectedModelArray[0].modelID, sourceSimplifyName, true);
        this.props.resetSimplifyOriginModelInfo();
        this.props.setPageMode(PageMode.Default);
    };

    handleApplySimplify = () => {
        this.props.recordSimplifyModel();
        this.props.resetSimplifyOriginModelInfo();
        this.props.setPageMode(PageMode.Default);
    };

    handleUpdateSimplifyConfig = (type, percent) => {
        this.props.modelSimplify(type, percent);
    };

    checkoutModelsLocation = () => {
        // this.canvas.current.checkoutModelsLocation();
    };

    render() {
        const { toolHead, size, selectedModelArray, modelGroup, gcodeLineGroup, inProgress, hasModel, displayedType, transformMode } = this.props; // transformMode

        const isDual = isDualExtruder(toolHead.printingToolhead);
        const isModelSelected = (selectedModelArray.length > 0);
        const isModelHide = isModelSelected && !selectedModelArray[0].visible;
        const isMultipleModel = selectedModelArray.length > 1;

        const notice = this.getNotice();
        const progress = this.props.progress;
        const pasteDisabled = (modelGroup.clipboard.length === 0);
        const primeTowerSelected = selectedModelArray.length > 0 && some(selectedModelArray, { type: 'primeTower' });

        const menuItems = [
            {
                type: 'item',
                label: i18n._('key-Printing/ContextMenu-Cut'),
                disabled: inProgress || !isModelSelected,
                onClick: this.props.cut
            },
            {
                type: 'item',
                label: i18n._('key-Printing/ContextMenu-Copy'),
                disabled: inProgress || !isModelSelected,
                onClick: this.props.copy
            },
            {
                type: 'item',
                label: i18n._('key-Printing/ContextMenu-Paste'),
                disabled: inProgress || pasteDisabled,
                onClick: this.props.paste
            },
            {
                type: 'item',
                label: i18n._('key-Printing/ContextMenu-Duplicate'),
                disabled: inProgress || !isModelSelected,
                onClick: this.actions.duplicateSelectedModel
            },
            {
                type: 'separator'
            },
            {
                type: 'item',
                label: i18n._('key-Printing/ContextMenu-FitViewIn'),
                disabled: inProgress || !hasModel,
                onClick: this.actions.fitViewIn
            },
            {
                type: 'item',
                label: i18n._('key-Printing/ContextMenu-Hide'),
                disabled: inProgress || !isModelSelected,
                onClick: this.props.hideSelectedModel
            },
        ];

        if (isDual) {
            menuItems.push(...[
                {
                    type: 'separator'
                },
                {
                    type: 'item',
                    label: i18n._('key-Printing/ContextMenu-Assign model to left extruder'),
                    disabled: inProgress || !isModelSelected,
                    onClick: () => this.actions.setSelectedModelsExtruder('0'),
                },
                {
                    type: 'item',
                    label: i18n._('key-Printing/ContextMenu-Assign model to right extruder'),
                    disabled: inProgress || !isModelSelected,
                    onClick: () => this.actions.setSelectedModelsExtruder('1'),
                },
            ]);
        }

        menuItems.push(...[
            {
                type: 'separator'
            },
            {
                type: 'item',
                label: i18n._('key-Printing/ContextMenu-Reset Model Transformation'),
                disabled: inProgress || !isModelSelected,
                onClick: this.actions.resetSelectedModelTransformation
            },
            {
                type: 'item',
                label: i18n._('key-Printing/ContextMenu-Center Models'),
                disabled: inProgress || !isModelSelected,
                onClick: this.actions.centerSelectedModel
            },
            {
                type: 'item',
                label: i18n._('key-Printing/ContextMenu-Auto Rotate'),
                disabled: inProgress || !isModelSelected || isModelHide || isMultipleModel,
                onClick: this.actions.autoRotateSelectedModel
            },
            {
                type: 'item',
                label: i18n._('key-Printing/ContextMenu-Auto Arrange'),
                disabled: inProgress || !hasModel,
                onClick: () => {
                    this.actions.arrangeAllModels();
                }
            }
        ]);

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

                <div className={styles['visualizer-preview-control']}>
                    <VisualizerPreviewControl />
                    {
                        this.props.enable3dpLivePreview && (
                            <VisualizerClippingControl />
                        )
                    }
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
                <ContextMenu
                    ref={this.contextMenuRef}
                    id="3dp"
                    menuItems={menuItems}
                />
            </div>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const machine = state.machine;
    const { currentModalPath } = state.appbarMenu;
    const printing = state.printing;
    const { size, series, enable3dpLivePreview, toolHead } = machine;
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
        stopArea,
        simplifyOriginModelInfo
    } = printing;

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
        // machine
        toolHead,
        stopArea,
        leftBarOverlayVisible,
        isActive,
        stage,
        promptTasks,
        size,
        series,
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
        simplifyOriginModelInfo,
        enable3dpLivePreview
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
    repairSelectedModels: () => dispatch(printingActions.repairSelectedModels()),
    updatePromptDamageModel: (bool) => dispatch(machineActions.updatePromptDamageModel(bool)),
    setTransformMode: (value) => dispatch(printingActions.setTransformMode(value)),
    moveSupportBrush: (raycastResult) => dispatch(printingActions.moveSupportBrush(raycastResult)),
    applySupportBrush: (raycastResult) => dispatch(printingActions.applySupportBrush(raycastResult)),
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
