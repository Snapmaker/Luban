import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';
import isEqual from 'lodash/isEqual';
import { Vector3, Box3 } from 'three';


import { shortcutActions, priorities, ShortcutManager } from '../../../lib/shortcut';
import { EPSILON } from '../../../constants';
import i18n from '../../../lib/i18n';
import modal from '../../../lib/modal';
import ProgressBar from '../../components/ProgressBar';
import ContextMenu from '../../components/ContextMenu';
import Canvas from '../../components/SMCanvas';
import { actions as printingActions, PRINTING_STAGE } from '../../../flux/printing';
import VisualizerLeftBar from './VisualizerLeftBar';
import VisualizerPreviewControl from './VisualizerPreviewControl';
import VisualizerBottomLeft from './VisualizerBottomLeft';
import VisualizerInfo from './VisualizerInfo';
import PrintableCube from './PrintableCube';
import styles from './styles.styl';

class Visualizer extends PureComponent {
    static propTypes = {
        isActive: PropTypes.bool.isRequired,
        size: PropTypes.object.isRequired,
        stage: PropTypes.number.isRequired,
        selectedModelArray: PropTypes.array,
        transformation: PropTypes.object,
        modelGroup: PropTypes.object.isRequired,
        hasModel: PropTypes.bool.isRequired,
        gcodeLineGroup: PropTypes.object.isRequired,
        transformMode: PropTypes.string.isRequired,
        progress: PropTypes.number.isRequired,
        displayedType: PropTypes.string.isRequired,
        renderingTimestamp: PropTypes.number.isRequired,
        inProgress: PropTypes.bool.isRequired,

        offsetGcodeLayers: PropTypes.func.isRequired,
        destroyGcodeLine: PropTypes.func.isRequired,
        selectMultiModel: PropTypes.func.isRequired,
        selectAllModels: PropTypes.func.isRequired,
        unselectAllModels: PropTypes.func.isRequired,
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
        resetSelectedModelTransformation: PropTypes.func.isRequired
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
        toBottom: () => {
            this.canvas.current.toBottom();
        },
        onSelectModels: (intersect, selectEvent) => {
            this.props.selectMultiModel(intersect, selectEvent);
        },
        onModelAfterTransform: () => {
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
            this.canvas.current.controls.updateBoundingBox();
        },
        setTransformMode: (value) => {
            this.props.setTransformMode(value);
            this.canvas.current.setTransformMode(value);
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
            this.canvas.current.controls.startSupportMode();
            const model = this.props.selectedModelArray[0];
            model.setVertexColors();
        },
        stopSupportMode: () => {
            this.setState({ isSupporting: false });
            this.supportActions.saveSupport();
            this.canvas.current.controls.stopSupportMode();
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
            const isSupportSelected = modelGroup.selectedModelArray.length > 0 && modelGroup.selectedModelArray[0].supportTag === true;
            if (isSupportSelected) {
                modelGroup.removeSelectedModel();
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
                if (!this.props.inProgress) {
                    this.props.removeSelectedModel();
                }
            },
            [shortcutActions.COPY]: () => {
                if (!this.props.inProgress) {
                    this.props.copy();
                }
            },
            [shortcutActions.PASTE]: () => {
                if (!this.props.inProgress) {
                    this.props.paste();
                }
            },
            [shortcutActions.DUPLICATE]: () => {
                if (!this.props.inProgress) {
                    this.props.duplicateSelectedModel();
                }
            },
            [shortcutActions.UNDO]: () => {
                if (!this.props.inProgress) {
                    this.props.undo();
                }
            },
            [shortcutActions.REDO]: () => {
                if (!this.props.inProgress) {
                    this.props.redo();
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
        this.canvas.current.resizeWindow();
        this.canvas.current.enable3D();
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
    }

    componentWillReceiveProps(nextProps) {
        const { size, transformMode, selectedModelArray, renderingTimestamp, modelGroup, stage } = nextProps;
        if (transformMode !== this.props.transformMode) {
            this.canvas.current.setTransformMode(transformMode);
            if (transformMode !== 'support') {
                this.supportActions.stopSupportMode();
            }
        }
        if (selectedModelArray !== this.props.selectedModelArray) {
            // selectedModelIDArray.forEach((modelID) => {
            //     const model = modelGroup.models.find(d => d.modelID === modelID);
            //     modelGroup.selectedGroup.add(model.meshObject);
            // });
            this.canvas.current.controls.updateBoundingBox();
            this.canvas.current.controls.attach(modelGroup.selectedGroup);

            this.supportActions.stopSupportMode();
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
            this.supportActions.stopSupportMode();
        }
        if (renderingTimestamp !== this.props.renderingTimestamp) {
            this.canvas.current.renderScene();
        }

        if (stage !== this.props.stage && stage === PRINTING_STAGE.LOAD_MODEL_FAILED) {
            modal({
                title: i18n._('Parse Error'),
                body: i18n._('Failed to load model.')
            });
        }
        if (stage !== this.props.stage && stage === PRINTING_STAGE.LOAD_MODEL_SUCCEED) {
            const modelSize = new Vector3();
            selectedModelArray[0].boundingBox.getSize(modelSize);
            const isLarge = ['x', 'y', 'x'].some((key) => modelSize[key] >= size[key]);

            if (isLarge) {
                const popupActions = modal({
                    title: i18n._('Scale to fit'),
                    body: (
                        <React.Fragment>
                            <p>{i18n._('Model’s size exceeds the machine’s maximum build volume.')}</p>
                            <p>{i18n._('Do you want scale model to fit machine?')}</p>
                        </React.Fragment>

                    ),

                    footer: (
                        <button
                            type="button"
                            className="btn sm-btn-default"
                            onClick={() => {
                                this.actions.scaleToFitSelectedModel();
                                popupActions.close();
                            }}
                        >
                            {i18n._('Yes')}
                        </button>


                    )
                });
            }
        }
    }

    getNotice() {
        const { stage, progress } = this.props;
        switch (stage) {
            case PRINTING_STAGE.EMPTY:
                return '';
            case PRINTING_STAGE.LOADING_MODEL:
                return i18n._('Loading model...');
            case PRINTING_STAGE.LOAD_MODEL_SUCCEED:
                return i18n._('Loaded model successfully.');
            case PRINTING_STAGE.LOAD_MODEL_FAILED:
                return i18n._('Failed to load model.');
            case PRINTING_STAGE.SLICE_PREPARING:
                return i18n._('Preparing for slicing...');
            case PRINTING_STAGE.SLICING:
                return i18n._('Slicing...{{progress}}%', { progress: (100.0 * progress).toFixed(1) });
            case PRINTING_STAGE.SLICE_SUCCEED:
                return i18n._('Sliced model successfully.');
            case PRINTING_STAGE.SLICE_FAILED:
                return i18n._('Failed to slice model.');
            case PRINTING_STAGE.PREVIEWING:
                return i18n._('Previewing G-code...{{progress}}%', { progress: (100.0 * progress).toFixed(1) });
            case PRINTING_STAGE.PREVIEW_SUCCEED:
                return i18n._('Previewed G-code successfully.');
            case PRINTING_STAGE.PREVIEW_FAILED:
                return i18n._('Failed to load G-code.');
            default:
                return '';
        }
    }

    showContextMenu = (event) => {
        this.contextMenuRef.current.show(event);
    };

    render() {
        const { size, hasModel, selectedModelArray, modelGroup, gcodeLineGroup, progress, displayedType, inProgress } = this.props;

        // const actions = this.actions;

        const isModelSelected = (selectedModelArray.length > 0);
        const isSingleSelected = (selectedModelArray.length === 1);
        const isSupportSelected = modelGroup.selectedModelArray.length > 0 && modelGroup.selectedModelArray[0].supportTag === true;
        const isModelDisplayed = (displayedType === 'model');
        const notice = this.getNotice();
        // let isSupporting = false;
        // if (this.canvas.current && this.canvas.current.controls.state === 4) {
        //     isSupporting = true;
        // }
        return (
            <div
                className={styles['printing-visualizer']}
                ref={this.visualizerRef}
            >
                <div className={styles['visualizer-left-bar']}>
                    <VisualizerLeftBar
                        inProgress={inProgress}
                        updateBoundingBox={this.actions.updateBoundingBox}
                        setTransformMode={this.actions.setTransformMode}
                        supportActions={this.supportActions}
                        defaultSupportSize={this.state.defaultSupportSize}
                        isSupporting={this.state.isSupporting}
                        arrangeAllModels={this.actions.arrangeAllModels}
                        scaleToFitSelectedModel={this.actions.scaleToFitSelectedModel}
                        autoRotateSelectedModel={this.actions.autoRotateSelectedModel}
                    />
                </div>

                <div className={styles['visualizer-bottom-left']}>
                    <VisualizerBottomLeft actions={this.actions} />
                </div>

                <div className={styles['visualizer-preview-control']}>
                    <VisualizerPreviewControl />
                </div>

                <div className={styles['visualizer-info']}>
                    <VisualizerInfo />
                </div>

                <div className={styles['visualizer-progress']}>
                    <ProgressBar tips={notice} progress={progress * 100} />
                </div>

                <div className={styles['canvas-wrapper']}>
                    <Canvas
                        ref={this.canvas}
                        inProgress={inProgress}
                        size={size}
                        modelGroup={modelGroup}
                        printableArea={this.printableArea}
                        cameraInitialPosition={new Vector3(0, -Math.max(size.x, size.y, size.z) * 2, size.z / 2)}
                        cameraInitialTarget={new Vector3(0, 0, size.z / 2)}
                        cameraUp={new Vector3(0, 0, 1)}
                        gcodeLineGroup={gcodeLineGroup}
                        supportActions={this.supportActions}
                        onSelectModels={this.actions.onSelectModels}
                        onModelAfterTransform={this.actions.onModelAfterTransform}
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
                                label: i18n._('Center Selected Model'),
                                disabled: inProgress || !isModelSelected || isSupportSelected,
                                onClick: this.actions.centerSelectedModel
                            },
                            {
                                type: 'item',
                                label: i18n._('Delete Selected Model'),
                                disabled: inProgress || !isModelSelected || isSupportSelected,
                                onClick: this.actions.deleteSelectedModel
                            },
                            {
                                type: 'item',
                                label: i18n._('Duplicate Selected Model'),
                                disabled: inProgress || !isModelSelected || isSupportSelected,
                                onClick: this.actions.duplicateSelectedModel
                            },
                            {
                                type: 'item',
                                label: i18n._('Reset Selected Model Transformation'),
                                disabled: inProgress || !isModelSelected || isSupportSelected,
                                onClick: this.actions.resetSelectedModelTransformation
                            },
                            {
                                type: 'item',
                                label: i18n._('Lay Flat Selected Model'),
                                disabled: inProgress || !isModelSelected || isSupportSelected,
                                onClick: this.actions.layFlatSelectedModel
                            },
                            {
                                type: 'item',
                                label: i18n._('Auto Rotate Selected Model'),
                                disabled: inProgress || !isModelSelected || isSupportSelected,
                                onClick: this.actions.autoRotateSelectedModel
                            },
                            {
                                type: 'item',
                                label: i18n._('Scale To Fit Selected Model'),
                                disabled: inProgress || !isModelSelected || isSupportSelected,
                                onClick: this.actions.scaleToFitSelectedModel
                            },
                            {
                                type: 'subMenu',
                                label: i18n._('Mirror Selected Model'),
                                disabled: inProgress || !isModelSelected || isSupportSelected,
                                items: [
                                    {
                                        type: 'item',
                                        label: i18n._('X Axis'),
                                        onClick: () => this.actions.mirrorSelectedModel('X')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Y Axis'),
                                        onClick: () => this.actions.mirrorSelectedModel('Y')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Z Axis'),
                                        onClick: () => this.actions.mirrorSelectedModel('Z')
                                    }
                                ]

                            },
                            {
                                type: 'separator'
                            },
                            {
                                type: 'item',
                                label: i18n._('Add Manual Support'),
                                disabled: inProgress || !isSingleSelected || isSupportSelected,
                                onClick: this.supportActions.startSupportMode
                            },
                            {
                                type: 'item',
                                label: i18n._('Delete Selected Support'),
                                disabled: inProgress || !isSupportSelected,
                                onClick: this.supportActions.clearSelectedSupport
                            },
                            {
                                type: 'item',
                                label: i18n._('Clear All Manual Support'),
                                disabled: false,
                                onClick: this.supportActions.clearAllManualSupport
                            },
                            {
                                type: 'separator'
                            },
                            {
                                type: 'item',
                                label: i18n._('Clear Heated Bed'),
                                disabled: inProgress || !hasModel || !isModelDisplayed,
                                onClick: this.actions.clearBuildPlate
                            },
                            {
                                type: 'item',
                                label: i18n._('Arrange All Models'),
                                disabled: inProgress || !hasModel || !isModelDisplayed,
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
    const printing = state.printing;
    const { size } = machine;
    // TODO: be to organized
    const { stage, modelGroup, hasModel, gcodeLineGroup, transformMode, progress, displayedType, renderingTimestamp, inProgress } = printing;
    return {
        isActive: ownProps.location.pathname.indexOf('3dp') > 0,
        stage,
        size,
        allModel: modelGroup.models,
        selectedModelArray: modelGroup.selectedModelArray,
        transformation: modelGroup.getSelectedModelTransformationForPrinting(),
        modelGroup,
        hasModel,
        gcodeLineGroup,
        transformMode,
        progress,
        displayedType,
        renderingTimestamp,
        inProgress
    };
};

const mapDispatchToProps = (dispatch) => ({
    destroyGcodeLine: () => dispatch(printingActions.destroyGcodeLine()),
    offsetGcodeLayers: (offset) => dispatch(printingActions.offsetGcodeLayers(offset)),
    selectMultiModel: (intersect, selectEvent) => dispatch(printingActions.selectMultiModel(intersect, selectEvent)),
    unselectAllModels: () => dispatch(printingActions.unselectAllModels()),
    selectAllModels: () => dispatch(printingActions.selectAllModels()),
    copy: () => dispatch(printingActions.copy()),
    paste: () => dispatch(printingActions.paste()),
    undo: () => dispatch(printingActions.undo()),
    redo: () => dispatch(printingActions.redo()),
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
    saveSupport: (model) => dispatch(printingActions.saveSupport(model))

});

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Visualizer));
