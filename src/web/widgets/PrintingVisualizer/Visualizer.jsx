import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import isEqual from 'lodash/isEqual';
import * as THREE from 'three';
import { EPSILON } from '../../constants';
import i18n from '../../lib/i18n';
import VisualizerProgressBar from './VisualizerProgressBar';
import VisualizerTopLeft from './VisualizerTopLeft';
import VisualizerModelTransformation from './VisualizerModelTransformation';
import VisualizerCameraOperations from './VisualizerCameraOperations';
import VisualizerPreviewControl from './VisualizerPreviewControl';
import VisualizerInfo from './VisualizerInfo';
import ContextMenu from '../../components/ContextMenu';
import { Canvas, PrintableCube } from '../Canvas';
import styles from './styles.styl';
import SecondaryToolbar from '../CanvasToolbar/SecondaryToolbar';
import { actions as workspaceActions } from '../../reducers/workspace';
import { actions as printingActions } from '../../reducers/printing';
import { simulateMouseEvent } from '../../lib/utils';


class Visualizer extends PureComponent {
    static propTypes = {
        size: PropTypes.object.isRequired,
        activeDefinition: PropTypes.object.isRequired,
        addGcode: PropTypes.func.isRequired,
        clearGcode: PropTypes.func.isRequired,
        model: PropTypes.object,
        modelGroup: PropTypes.object.isRequired,
        hasModel: PropTypes.bool.isRequired,
        gcodeLineGroup: PropTypes.object.isRequired,
        transformMode: PropTypes.string.isRequired,
        progress: PropTypes.number.isRequired,
        progressTitle: PropTypes.string.isRequired
    };

    printableArea = null;
    contextMenuRef = React.createRef();

    visualizerRef = React.createRef();
    canvas = React.createRef();

    modelGroup = null;

    state = {
        stage: STAGES_3DP.noModel,
        // translate/scale/rotate
        transformMode: 'translate',
        // slice info
        printTime: 0,
        filamentLength: 0,
        filamentWeight: 0,
        // G-code
        gcodePath: '',
        gcodeLineGroup: new THREE.Group(),
        gcodeLine: null,
        layerCount: 0,
        layerCountDisplayed: 0,
        gcodeTypeInitialVisibility: {},
        // progress bar
        progressTitle: '',
        progress: 0,

        hasModel: false,
        selectedModel: null,

        _: 0 // placeholder
    };

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

        this.modelGroup = new ModelGroup(new THREE.Box3(
            new THREE.Vector3(-size.x / 2 - EPSILON, -EPSILON, -size.z / 2 - EPSILON),
            new THREE.Vector3(size.x / 2 + EPSILON, size.y + EPSILON, size.z / 2 + EPSILON)
        ));
        this.modelGroup.addChangeListener((args) => {
            const { hasModel, model } = args;
            this.setState({
                hasModel: hasModel,
                selectedModel: model
            });
        });
    }

    uploadAndParseFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        api.uploadFile(formData).then((res) => {
            const file = res.body;
            const modelPath = `${WEB_CACHE_IMAGE}/${file.filename}`;
            this.parseModel(file.name, modelPath);
        }).catch(() => {
            modal({
                title: i18n._('Parse File Error'),
                body: i18n._('Failed to parse image file {{filename}}', { filename: file.filename })
            });
        });
    }

    subscriptions = [];

    controllerEvents = {
        'print3D:gcode-generated': (args) => {
            this.setState({
                gcodeFileName: args.gcodeFileName,
                gcodePath: `${WEB_CACHE_IMAGE}/${args.gcodeFileName}`,
                printTime: args.printTime,
                filamentLength: args.filamentLength,
                filamentWeight: args.filamentWeight,
                progress: 100,
                progressTitle: i18n._('Slicing completed.')
            });
            controller.print3DParseGcode({ fileName: args.gcodeFileName });
        },
        'print3D:gcode-slice-progress': (sliceProgress) => {
            this.setState({
                progress: 100.0 * sliceProgress,
                progressTitle: i18n._('Slicing {{progress}}%', { progress: (100.0 * sliceProgress).toFixed(1) })
            });
        },
        'print3D:gcode-slice-err': (err) => {
            this.setState({
                progress: 0,
                progressTitle: i18n._('Slice error: ') + JSON.stringify(err)
            });
        },
        // parse gcode
        'print3D:gcode-parsed': (jsonFileName) => {
            this.setState({
                progress: 100.0,
                progressTitle: i18n._('Parsed G-code successfully.')
            });
            this.renderGcode(jsonFileName);
        },
        'print3D:gcode-parse-progress': (progress) => {
            this.setState({
                progress: 100.0 * progress,
                progressTitle: i18n._('Parsing G-code...')
            });
        },
        'print3D:gcode-parse-err': (err) => {
            this.setState({
                progress: 0,
                progressTitle: i18n._('Failed to parse G-code: ') + JSON.stringify(err)
            });
        }
    };

    keyEventHandlers = {
        'DELETE': (event) => {
            this.modelGroup.removeSelectedModel();
        },
        'JOG': (event, { axis, direction }) => {
            if (this.state.stage === STAGES_3DP.gcodeRendered && axis === 'y') {
                this.actions.showGcodeLayers(this.state.layerCountDisplayed + direction);
            }
        }
    };

    addControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.on(eventName, callback);
        });
        Object.keys(this.keyEventHandlers).forEach(eventName => {
            const callback = this.keyEventHandlers[eventName];
            combokeys.on(eventName, callback);
        });
    }

    removeControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.off(eventName, callback);
        });
        Object.keys(this.keyEventHandlers).forEach(eventName => {
            const callback = this.keyEventHandlers[eventName];
            combokeys.removeListener(eventName, callback);
        });
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
        this.visualizerRef.current.addEventListener('mousedown', this.hideProgressBar, false);
        this.visualizerRef.current.addEventListener('wheel', this.hideContextMenu, false);
        this.visualizerRef.current.addEventListener('contextmenu', this.showContextMenu, false);

        this.visualizerRef.current.addEventListener('mouseup', (e) => {
            const event = simulateMouseEvent(e, 'contextmenu');
            this.visualizerRef.current.dispatchEvent(event);
        }, false);
    }

    componentWillReceiveProps(nextProps) {
        const { size, transformMode, model } = nextProps;
        this.canvas.current.setTransformMode(transformMode);
        if (!model) {
            this.canvas.current.detachSelectedModel();
        }
        if (!isEqual(size, this.props.size)) {
            const size = size;
            this.printableArea.updateSize(size);
            const { modelGroup, gcodeLineGroup } = this.props;
            modelGroup.updateBoundingBox(new THREE.Box3(
                new THREE.Vector3(-size.x / 2 - EPSILON, -EPSILON, -size.z / 2 - EPSILON),
                new THREE.Vector3(size.x / 2 + EPSILON, size.y + EPSILON, size.z / 2 + EPSILON)
            ));
            modelGroup.position.copy(new THREE.Vector3(0, -size.z / 2, 0));
            gcodeLineGroup.position.copy(new THREE.Vector3(-size.x / 2, -size.z / 2, size.y / 2));
        }
    }

    componentWillUnmount() {
        this.visualizerRef.current.removeEventListener('mousedown', this.hideContextMenu, false);
        this.visualizerRef.current.removeEventListener('mousedown', this.hideProgressBar, false);
        this.visualizerRef.current.removeEventListener('wheel', this.hideContextMenu, false);
        this.visualizerRef.current.removeEventListener('contextmenu', this.showContextMenu, false);
    }

    render() {
        const { size, hasModel, model, modelGroup, gcodeLineGroup, progress, progressTitle } = this.props;
        const actions = this.actions;

        const cameraInitialPosition = new THREE.Vector3(0, 0, Math.max(size.x, size.y, size.z) * 2);
        const isModelSelected = !!model;
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

                {isModelSelected && (
                    <div className={styles['visualizer-progress-bar']}>
                        <VisualizerProgressBar title={state.progressTitle} progress={state.progress} />
                    </div>
                )}
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
                                disabled: !isModelSelected,
                                onClick: actions.centerSelectedModel
                            },
                            {
                                type: 'item',
                                label: i18n._('Delete Selected Model'),
                                disabled: !isModelSelected,
                                onClick: actions.deleteSelectedModel
                            },
                            {
                                type: 'item',
                                label: i18n._('Duplicate Selected Model'),
                                disabled: !isModelSelected,
                                onClick: actions.duplicateSelectedModel
                            },
                            {
                                type: 'item',
                                label: i18n._('Reset Selected Model Transformation'),
                                disabled: !isModelSelected,
                                onClick: actions.resetSelectedModelTransformation
                            },
                            {
                                type: 'item',
                                label: i18n._('Lay Flat Selected Model'),
                                disabled: !isModelSelected,
                                onClick: actions.layFlatSelectedModel
                            },
                            {
                                type: 'separator'
                            },
                            {
                                type: 'item',
                                label: i18n._('Clear Build Plate'),
                                disabled: !hasModel,
                                onClick: actions.clearBuildPlate
                            },
                            {
                                type: 'item',
                                label: i18n._('Arrange All Models'),
                                disabled: !hasModel,
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
    const { size } = machine;
    const { model, modelGroup, hasModel, gcodeLineGroup, transformMode, progress, progressTitle, activeDefinition } = printing;

    return {
        size,
        activeDefinition,
        model,
        modelGroup,
        hasModel,
        gcodeLineGroup,
        transformMode,
        progress,
        progressTitle
    };
};

const mapDispatchToProps = (dispatch) => ({
    addGcode: (name, gcode, renderMethod) => dispatch(workspaceActions.addGcode(name, gcode, renderMethod)),
    clearGcode: () => dispatch(workspaceActions.clearGcode()),
    uploadFile3d: (file, onError) => dispatch(printingActions.uploadFile3d(file, onError)),
    generateGcode: (modelName, modelFileName, configFilePath) => dispatch(printingActions.generateGcode(modelName, modelFileName, configFilePath)),
});


export default connect(mapStateToProps, mapDispatchToProps)(Visualizer);
