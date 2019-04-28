import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import isEqual from 'lodash/isEqual';
import * as THREE from 'three';
import { EPSILON } from '../../constants';
import i18n from '../../lib/i18n';
import { simulateMouseEvent } from '../../lib/utils';
import ProgressBar from '../../components/ProgressBar';
import ContextMenu from '../../components/ContextMenu';
import { Canvas, PrintableCube } from '../Canvas';
import SecondaryToolbar from '../CanvasToolbar/SecondaryToolbar';
import { actions as workspaceActions } from '../../reducers/workspace';
import { actions as printingActions, PRINTING_STAGE } from '../../reducers/printing';
import VisualizerTopLeft from './VisualizerTopLeft';
import VisualizerModelTransformation from './VisualizerModelTransformation';
import VisualizerCameraOperations from './VisualizerCameraOperations';
import VisualizerPreviewControl from './VisualizerPreviewControl';
import VisualizerInfo from './VisualizerInfo';
import styles from './styles.styl';

class Visualizer extends PureComponent {
    static propTypes = {
        size: PropTypes.object.isRequired,
        stage: PropTypes.number.isRequired,
        activeDefinition: PropTypes.object.isRequired,
        addGcode: PropTypes.func.isRequired,
        clearGcode: PropTypes.func.isRequired,
        model: PropTypes.object,
        modelGroup: PropTypes.object.isRequired,
        hasModel: PropTypes.bool.isRequired,
        gcodeLineGroup: PropTypes.object.isRequired,
        transformMode: PropTypes.string.isRequired,
        progress: PropTypes.number.isRequired,
        displayedType: PropTypes.string.isRequired
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
        autoFocus: () => {
            this.canvas.current.autoFocus();
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
        onSelectModel: (model) => {
            this.props.modelGroup.selectModel(model);
        },
        onUnselectAllModels: () => {
            this.props.modelGroup.unselectAllModels();
        },
        onModelAfterTransform: () => {
            this.props.modelGroup.onModelAfterTransform();
        },
        onModelTransform: () => {
            this.props.modelGroup.onModelTransform();
        },
        // context menu
        centerSelectedModel: () => {
            this.props.modelGroup.updateSelectedModelTransformation({ positionX: 0, positionZ: 0 });
            this.props.modelGroup.onModelAfterTransform();
        },
        deleteSelectedModel: () => {
            this.props.modelGroup.removeSelectedModel();
        },
        duplicateSelectedModel: () => {
            this.props.modelGroup.multiplySelectedModel(1);
        },
        resetSelectedModelTransformation: () => {
            this.props.modelGroup.resetSelectedModelTransformation();
        },
        clearBuildPlate: () => {
            this.props.modelGroup.removeAllModels();
        },
        arrangeAllModels: () => {
            this.props.modelGroup.arrangeAllModels();
        },
        layFlatSelectedModel: () => {
            this.props.modelGroup.layFlatSelectedModel();
        }
    };

    constructor(props) {
        super(props);
        const size = props.size;
        this.printableArea = new PrintableCube(size);
    }

    hideContextMenu = () => {
        ContextMenu.hide();
    };

    showContextMenu = (event) => {
        this.contextMenuRef.current.show(event);
    };

    componentDidMount() {
        this.canvas.current.resizeWindow();
        this.canvas.current.enable3D();
        window.addEventListener(
            'hashchange',
            (event) => {
                if (event.newURL.endsWith('3dp')) {
                    this.canvas.current.resizeWindow();
                }
            },
            false
        );

        this.visualizerRef.current.addEventListener('mousedown', this.hideContextMenu, false);
        this.visualizerRef.current.addEventListener('wheel', this.hideContextMenu, false);
        this.visualizerRef.current.addEventListener('contextmenu', this.showContextMenu, false);

        this.visualizerRef.current.addEventListener('mouseup', (e) => {
            const event = simulateMouseEvent(e, 'contextmenu');
            this.visualizerRef.current.dispatchEvent(event);
        }, false);
    }

    componentWillReceiveProps(nextProps) {
        const { size, transformMode, model } = nextProps;

        if (transformMode !== this.props.transformMode) {
            this.canvas.current.setTransformMode(transformMode);
        }

        if (!model) {
            this.canvas.current.detachSelectedModel();
        }

        if (!isEqual(size, this.props.size)) {
            this.printableArea.updateSize(size);
            const { modelGroup, gcodeLineGroup } = this.props;
            modelGroup.updateBoundingBox(new THREE.Box3(
                new THREE.Vector3(-size.x / 2 - EPSILON, -EPSILON, -size.y / 2 - EPSILON),
                new THREE.Vector3(size.x / 2 + EPSILON, size.z + EPSILON, size.y / 2 + EPSILON)
            ));
            modelGroup.position.copy(new THREE.Vector3(0, -size.z / 2, 0));
            gcodeLineGroup.position.copy(new THREE.Vector3(-size.x / 2, -size.z / 2, size.y / 2));
        }
    }

    componentWillUnmount() {
        this.visualizerRef.current.removeEventListener('mousedown', this.hideContextMenu, false);
        this.visualizerRef.current.removeEventListener('wheel', this.hideContextMenu, false);
        this.visualizerRef.current.removeEventListener('contextmenu', this.showContextMenu, false);
    }

    getNotice() {
        const { stage, progress } = this.props;
        switch (stage) {
            case PRINTING_STAGE.EMPTY:
                return '';
            case PRINTING_STAGE.LOADING_MODEL:
                return i18n._('Loading model...');
            case PRINTING_STAGE.LOAD_MODEL_SUCCEED:
                return i18n._('Load model successfully.');
            case PRINTING_STAGE.LOAD_MODEL_FAILED:
                return i18n._('Failed to load model.');
            case PRINTING_STAGE.SLICE_PREPARING:
                return i18n._('Preparing for slicing...');
            case PRINTING_STAGE.SLICING:
                return i18n._('Slicing...{{progress}}%', { progress: (100.0 * progress).toFixed(1) });
            case PRINTING_STAGE.SLICE_SUCCEED:
                return i18n._('Slice completed.');
            case PRINTING_STAGE.SLICE_FAILED:
                return i18n._('Slice failed.');
            case PRINTING_STAGE.PREVIEWING:
                return i18n._('Previewing G-code...');
            case PRINTING_STAGE.PREVIEW_SUCCEED:
                return i18n._('Previewed G-code successfully.');
            case PRINTING_STAGE.PREVIEW_FAILED:
                return i18n._('Failed to load G-code.');
            default:
                return '';
        }
    }

    render() {
        const { size, hasModel, model, modelGroup, gcodeLineGroup, progress, displayedType } = this.props;
        const actions = this.actions;

        const cameraInitialPosition = new THREE.Vector3(0, 0, Math.max(size.x, size.y, size.z) * 2);
        const isModelSelected = !!model;
        const isModelDisplayed = (displayedType === 'model');

        const notice = this.getNotice();

        return (
            <div
                className={styles.visualizer}
                ref={this.visualizerRef}
            >
                <div className={styles['visualizer-top-left']}>
                    <VisualizerTopLeft />
                </div>

                <div className={styles['visualizer-model-transformation']}>
                    <VisualizerModelTransformation />
                </div>

                <div className={styles['visualizer-camera-operations']}>
                    <VisualizerCameraOperations actions={actions} />
                </div>

                <div className={styles['visualizer-preview-control']}>
                    <VisualizerPreviewControl />
                </div>

                <div className={styles['visualizer-info']}>
                    <VisualizerInfo />
                </div>

                <div className={styles['visualizer-notice']}>
                    <p>{notice}</p>
                </div>
                <div className={styles['visualizer-progress']}>
                    <ProgressBar progress={progress * 100} />
                </div>

                <div className={styles['canvas-content']} style={{ top: 0 }}>
                    <Canvas
                        ref={this.canvas}
                        size={size}
                        modelGroup={modelGroup}
                        printableArea={this.printableArea}
                        enabledTransformModel={true}
                        modelInitialRotation={new THREE.Euler(Math.PI / 180 * 15)}
                        cameraInitialPosition={cameraInitialPosition}
                        gcodeLineGroup={gcodeLineGroup}
                        onSelectModel={actions.onSelectModel}
                        onUnselectAllModels={actions.onUnselectAllModels}
                        onModelAfterTransform={actions.onModelAfterTransform}
                        onModelTransform={actions.onModelTransform}
                    />
                </div>
                <div className={styles['canvas-footer']}>
                    <SecondaryToolbar actions={this.actions} />
                </div>
                <ContextMenu
                    ref={this.contextMenuRef}
                    id="3dp"
                    menuItems={
                        [
                            {
                                type: 'item',
                                label: i18n._('Center Selected Model'),
                                disabled: !isModelSelected || !isModelDisplayed,
                                onClick: actions.centerSelectedModel
                            },
                            {
                                type: 'item',
                                label: i18n._('Delete Selected Model'),
                                disabled: !isModelSelected || !isModelDisplayed,
                                onClick: actions.deleteSelectedModel
                            },
                            {
                                type: 'item',
                                label: i18n._('Duplicate Selected Model'),
                                disabled: !isModelSelected || !isModelDisplayed,
                                onClick: actions.duplicateSelectedModel
                            },
                            {
                                type: 'item',
                                label: i18n._('Reset Selected Model Transformation'),
                                disabled: !isModelSelected || !isModelDisplayed,
                                onClick: actions.resetSelectedModelTransformation
                            },
                            {
                                type: 'item',
                                label: i18n._('Lay Flat Selected Model'),
                                disabled: !isModelSelected || !isModelDisplayed,
                                onClick: actions.layFlatSelectedModel
                            },
                            {
                                type: 'separator'
                            },
                            {
                                type: 'item',
                                label: i18n._('Clear Build Plate'),
                                disabled: !hasModel || !isModelDisplayed,
                                onClick: actions.clearBuildPlate
                            },
                            {
                                type: 'item',
                                label: i18n._('Arrange All Models'),
                                disabled: !hasModel || !isModelDisplayed,
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
    const printing = state.printing;
    const { size } = machine.machineSetting;
    // TODO: be to organized
    const { stage, model, modelGroup, hasModel, gcodeLineGroup, transformMode, progress, activeDefinition, displayedType } = printing;

    return {
        stage,
        size,
        activeDefinition,
        model,
        modelGroup,
        hasModel,
        gcodeLineGroup,
        transformMode,
        progress,
        displayedType
    };
};

const mapDispatchToProps = (dispatch) => ({
    addGcode: (name, gcode, renderMethod) => dispatch(workspaceActions.addGcode(name, gcode, renderMethod)),
    clearGcode: () => dispatch(workspaceActions.clearGcode()),
    generateGcode: (modelName, modelFileName, configFilePath) => dispatch(printingActions.generateGcode(modelName, modelFileName, configFilePath)),
});


export default connect(mapStateToProps, mapDispatchToProps)(Visualizer);
