import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';
import isEqual from 'lodash/isEqual';
import { Vector3, Box3 } from 'three';

import { shortcutActions, priorities, ShortcutManager } from '../../../lib/shortcut';
import { EPSILON, HEAD_PRINTING } from '../../../constants';
import i18n from '../../../lib/i18n';
import modal from '../../../lib/modal';
import ProgressBar from '../../components/ProgressBar';
import ContextMenu from '../../components/ContextMenu';
import { Button } from '../../components/Buttons';
import Canvas from '../../components/SMCanvas';
import { actions as printingActions } from '../../../flux/printing';
import { actions as operationHistoryActions } from '../../../flux/operation-history';
import VisualizerLeftBar from './VisualizerLeftBar';
import VisualizerPreviewControl from './VisualizerPreviewControl';
import VisualizerBottomLeft from './VisualizerBottomLeft';
import VisualizerInfo from './VisualizerInfo';
import PrintableCube from './PrintableCube';
import styles from './styles.styl';
import { STEP_STAGE } from '../../../lib/manager/ProgressManager';

class Visualizer extends PureComponent {
    static propTypes = {
        isActive: PropTypes.bool.isRequired,
        size: PropTypes.object.isRequired,
        stage: PropTypes.number.isRequired,
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
        saveSupport: PropTypes.func.isRequired,
        clearAllManualSupport: PropTypes.func.isRequired,
        autoRotateSelectedModel: PropTypes.func.isRequired,
        layFlatSelectedModel: PropTypes.func.isRequired,
        scaleToFitSelectedModel: PropTypes.func.isRequired,
        resetSelectedModelTransformation: PropTypes.func.isRequired,
        progressStatesManager: PropTypes.object.isRequired,
        setRotationPlacementFace: PropTypes.func.isRequired
    };

    state = {
        isSupporting: false,
        defaultSupportSize: { x: 5, y: 5 }
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
            this.canvas.current.toFront();
        },
        toLeft: () => {
            this.canvas.current.toLeft();
        },
        toRight: () => {
            this.canvas.current.toRight();
        },
        toTop: () => {
            this.canvas.current.toTop();
        },
        toTopFrontRight: () => {
            this.canvas.current.toTopFrontRight();
        },
        onSelectModels: (intersect, selectEvent) => {
            this.props.selectMultiModel(intersect, selectEvent);
        },
        onModelBeforeTransform: () => {
            this.props.recordModelBeforeTransform(this.props.modelGroup);
        },
        onModelAfterTransform: (transformMode) => {
            this.actions.onModelTransform();
            this.props.recordModelAfterTransform(transformMode, this.props.modelGroup);
            this.props.onModelAfterTransform();
        },
        onModelTransform: () => {
            this.props.onModelTransform();
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
        arrangeAllModels: () => {
            this.props.arrangeAllModels();
        },
        layFlatSelectedModel: () => {
            this.props.layFlatSelectedModel();
        },
        scaleToFitSelectedModel: () => {
            this.props.scaleToFitSelectedModel();
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
            this.props.setTransformMode(value);
            this.canvas.current.setTransformMode(value);
        },
        onRotationPlacementSelect: (userData) => {
            this.props.setRotationPlacementFace(userData);
        }
    };

    // all support related actions used in VisualizerModelTransformation & canvas.controls & contextmenu
    supportActions = {
        isSupporting: () => {
            return this.state.isSupporting;
        },
        startSupportMode: () => {
            this.props.destroyGcodeLine();
            this.actions.setTransformMode('support');
            this.setState({ isSupporting: true });
            this.canvas.current.startSupportMode();
            const model = this.props.selectedModelArray[0];
            model.setVertexColors();
        },
        stopSupportMode: () => {
            this.setState({ isSupporting: false });
            this.supportActions.saveSupport();
            this.canvas.current.stopSupportMode();
            const model = this.props.selectedModelArray[0];
            model && model.removeVertexColors();
        },
        moveSupport: (position) => {
            const { modelGroup } = this.props;
            if (!this._model) {
                this._model = modelGroup.addSupportOnSelectedModel(this.state.defaultSupportSize);
            }
            this._model.setSupportPosition(position);
        },
        saveSupport: () => {
            if (this._model) {
                this.props.saveSupport(this._model);
                this._model = null;
            }
        },
        setDefaultSupportSize: (size) => {
            let defaultSupportSize = this.state.defaultSupportSize;
            defaultSupportSize = { ...defaultSupportSize, ...size };
            this.setState({ defaultSupportSize });
        },
        clearSelectedSupport: () => {
            const { modelGroup } = this.props;
            // support can only be selected with supports
            const isSupportSelected = modelGroup.selectedModelArray.length > 0 && modelGroup.selectedModelArray[0].supportTag === true;
            if (isSupportSelected) {
                this.props.removeSelectedModel();
            }
        },
        clearAllManualSupport: () => {
            this.props.clearAllManualSupport();
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
        this.printableArea = new PrintableCube(size);
    }

    // hideContextMenu = () => {
    //     ContextMenu.hide();
    // };

    componentDidMount() {
        this.props.clearOperationHistory();
        this.canvas.current.resizeWindow();
        this.canvas.current.enable3D();
        this.setState({ defaultSupportSize: { x: 5, y: 5 } });
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
        this.props.modelGroup.on('add', this.props.recordAddOperation);
    }

    componentWillReceiveProps(nextProps) {
        const { size, transformMode, selectedModelArray, renderingTimestamp, modelGroup, stage } = nextProps;
        if (transformMode !== this.props.transformMode) {
            this.canvas.current.setTransformMode(transformMode);
            if (transformMode === 'rotate-placement') {
                this.canvas.current.setSelectedModelConvexMeshGroup(modelGroup.selectedModelConvexMeshGroup);
            } else if (transformMode !== 'support') {
                this.supportActions.stopSupportMode();
            }
        }
        if (selectedModelArray !== this.props.selectedModelArray) {
            // selectedModelIDArray.forEach((modelID) => {
            //     const model = modelGroup.models.find(d => d.modelID === modelID);
            //     modelGroup.selectedGroup.add(model.meshObject);
            // });
            this.canvas.current.updateBoundingBox();
            this.canvas.current.attach(modelGroup.selectedGroup);

            if (transformMode !== 'rotate-placement') {
                this.supportActions.stopSupportMode();
            }
            if (selectedModelArray.length === 1 && selectedModelArray[0].supportTag && !['translate', 'scale'].includes(transformMode)) {
                this.actions.setTransformMode('translate');
            }
        }

        if (!isEqual(size, this.props.size)) {
            this.printableArea.updateSize(size);
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
        if (renderingTimestamp !== this.props.renderingTimestamp) {
            this.canvas.current.renderScene();
        }

        if (stage !== this.props.stage && stage === STEP_STAGE.PRINTING_LOAD_MODEL_FAILED) {
            modal({
                cancelTitle: i18n._(''),
                title: i18n._('key-Printing/ContextMenu-Import Error'),
                body: i18n._('Failed to import this object. \nPlease select a supported file format.')
            });
        }
        if (stage !== this.props.stage && stage === STEP_STAGE.PRINTING_LOAD_MODEL_SUCCEED) {
            const modelSize = new Vector3();
            selectedModelArray[0].boundingBox.getSize(modelSize);
            const isLarge = ['x', 'y', 'z'].some((key) => modelSize[key] >= size[key]);

            if (isLarge) {
                const popupActions = modal({
                    title: i18n._('key-Printing/ContextMenu-Scale to Fit'),
                    body: (
                        <React.Fragment>
                            <p>{i18n._('key-Printing/ContextMenu-Model size has exceeded the printable area.')}</p>
                            <p>{i18n._('key-Printing/ContextMenu-Scale it to the maximum printable size?')}</p>
                        </React.Fragment>

                    ),

                    footer: (
                        <Button
                            priority="level-two"
                            type="primary"
                            width="96px"
                            className="margin-left-4"
                            onClick={() => {
                                this.actions.scaleToFitSelectedModel();
                                popupActions.close();
                            }}
                        >
                            {i18n._('key-Printing/ContextMenu-Scale')}
                        </Button>
                    )
                });
            }
        }
    }

    componentWillUnmount() {
        this.props.clearOperationHistory();
        this.props.modelGroup.off('add', this.props.recordAddOperation);
    }

    getNotice() {
        const { stage } = this.props;
        return this.props.progressStatesManager.getNotice(stage);
    }

    showContextMenu = (event) => {
        !this.props.leftBarOverlayVisible && this.contextMenuRef.current.show(event);
    };

    render() {
        const { size, selectedModelArray, modelGroup, gcodeLineGroup, inProgress, hasModel, displayedType } = this.props;

        const isModelSelected = (selectedModelArray.length > 0);
        const isMultipleModel = selectedModelArray.length > 1;
        const isSupportSelected = modelGroup.selectedModelArray.length > 0 && modelGroup.selectedModelArray[0].supportTag === true;
        const notice = this.getNotice();
        const progress = this.props.progress;
        const pasteDisabled = (modelGroup.clipboard.length === 0);
        return (
            <div
                className={styles['printing-visualizer']}
                ref={this.visualizerRef}
            >
                <VisualizerLeftBar
                    updateBoundingBox={this.actions.updateBoundingBox}
                    setTransformMode={this.actions.setTransformMode}
                    supportActions={this.supportActions}
                    defaultSupportSize={this.state.defaultSupportSize}
                    isSupporting={this.state.isSupporting}
                    scaleToFitSelectedModel={this.actions.scaleToFitSelectedModel}
                    autoRotateSelectedModel={this.actions.autoRotateSelectedModel}
                />
                <div className={styles['visualizer-bottom-left']}>
                    <VisualizerBottomLeft actions={this.actions} />
                </div>

                <div className={styles['visualizer-preview-control']}>
                    <VisualizerPreviewControl />
                </div>

                <div className={styles['visualizer-info']}>
                    <VisualizerInfo />
                </div>

                <ProgressBar tips={notice} progress={progress * 100} />

                <div className={styles['canvas-wrapper']}>
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
                        onModelTransform={this.actions.onModelTransform}
                        showContextMenu={this.showContextMenu}
                    />
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
                                onClick: this.actions.arrangeAllModels
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
    const { size } = machine;
    const { menuDisabledCount } = state.appbarMenu;
    // TODO: be to organized
    const {
        progressStatesManager,
        stage,
        modelGroup,
        hasModel,
        gcodeLineGroup,
        transformMode,
        progress,
        displayedType,
        renderingTimestamp,
        inProgress,
        enableShortcut,
        leftBarOverlayVisible
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
        leftBarOverlayVisible,
        isActive,
        stage,
        size,
        allModel: modelGroup.models,
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
        progressStatesManager
    };
};

const mapDispatchToProps = (dispatch) => ({
    recordAddOperation: (model) => dispatch(printingActions.recordAddOperation(model)),
    recordModelBeforeTransform: (modelGroup) => dispatch(printingActions.recordModelBeforeTransform(modelGroup)),
    recordModelAfterTransform: (transformMode, modelGroup) => dispatch(printingActions.recordModelAfterTransform(transformMode, modelGroup)),
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
    arrangeAllModels: () => dispatch(printingActions.arrangeAllModels()),
    onModelTransform: () => dispatch(printingActions.onModelTransform()),
    onModelAfterTransform: () => dispatch(printingActions.onModelAfterTransform()),
    updateSelectedModelTransformation: (transformation, newUniformScalingState) => dispatch(printingActions.updateSelectedModelTransformation(transformation, newUniformScalingState)),
    duplicateSelectedModel: () => dispatch(printingActions.duplicateSelectedModel()),
    layFlatSelectedModel: () => dispatch(printingActions.layFlatSelectedModel()),
    resetSelectedModelTransformation: () => dispatch(printingActions.resetSelectedModelTransformation()),
    autoRotateSelectedModel: () => dispatch(printingActions.autoRotateSelectedModel()),
    scaleToFitSelectedModel: () => dispatch(printingActions.scaleToFitSelectedModel()),
    setTransformMode: (value) => dispatch(printingActions.setTransformMode(value)),
    clearAllManualSupport: () => dispatch(printingActions.clearAllManualSupport()),
    saveSupport: (model) => dispatch(printingActions.saveSupport(model)),
    setRotationPlacementFace: (userData) => dispatch(printingActions.setRotationPlacementFace(userData))

});

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Visualizer));
