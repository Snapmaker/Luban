import path from 'path';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import isEqual from 'lodash/isEqual';
import FileSaver from 'file-saver';
import pubsub from 'pubsub-js';
import * as THREE from 'three';
import jQuery from 'jquery';
import {
    EPSILON,
    WEB_CACHE_IMAGE,
    ACTION_REQ_GENERATE_GCODE_3DP,
    ACTION_REQ_LOAD_GCODE_3DP,
    ACTION_REQ_EXPORT_GCODE_3DP,
    ACTION_3DP_GCODE_OVERSTEP_CHANGE,
    ACTION_3DP_MODEL_OVERSTEP_CHANGE,
    ACTION_CHANGE_STAGE_3DP,
    ACTION_3DP_EXPORT_MODEL,
    ACTION_3DP_LOAD_MODEL,
    STAGES_3DP
} from '../../constants';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import controller from '../../lib/controller';
import api from '../../api';
import configManager from '../Print3dConfigManager';
import VisualizerProgressBar from './VisualizerProgressBar';
import VisualizerTopLeft from './VisualizerTopLeft';
import VisualizerModelTransformation from './VisualizerModelTransformation';
import VisualizerCameraOperations from './VisualizerCameraOperations';
import VisualizerPreviewControl from './VisualizerPreviewControl';
import VisualizerInfo from './VisualizerInfo';
import ModelLoader from './ModelLoader';
import ModelExporter from './ModelExporter';
import GCodeRenderer from './GCodeRenderer';
import Model from './Model';
import ModelGroup from './ModelGroup';
import ContextMenu from '../../components/ContextMenu';
import { Canvas, PrintableCube } from '../Canvas';
import styles from './styles.styl';
import SecondaryToolbar from '../CanvasToolbar/SecondaryToolbar';
import combokeys from '../../lib/combokeys';
import { actions as workspaceActions } from '../../reducers/workspace';
import { pathWithRandomSuffix } from '../../../shared/lib/random-utils';


const MATERIAL_NORMAL = new THREE.MeshPhongMaterial({ color: 0xe0e0e0, specular: 0xb0b0b0, shininess: 30 });
const MATERIAL_OVERSTEPPED = new THREE.MeshPhongMaterial({
    color: 0xff0000,
    shininess: 30,
    transparent: true,
    opacity: 0.6
});


class Visualizer extends PureComponent {
    static propTypes = {
        size: PropTypes.object.isRequired,
        activeDefinition: PropTypes.object.isRequired,
        addGcode: PropTypes.func.isRequired,
        clearGcode: PropTypes.func.isRequired
    };

    gcodeRenderer = new GCodeRenderer();

    contextMenuDomElement = React.createRef();
    visualizerDomElement = React.createRef();

    canvas = React.createRef();

    printableArea = null;

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
        // topLeft
        onChangeFile: (event) => {
            const file = event.target.files[0];
            this.uploadAndParseFile(file);
        },
        // preview
        showGcodeType: (type) => {
            this.gcodeRenderer.showType(type);
        },
        hideGcodeType: (type) => {
            this.gcodeRenderer.hideType(type);
        },
        showGcodeLayers: (count) => {
            count = (count > this.state.layerCount) ? this.state.layerCount : count;
            count = (count < 0) ? 0 : count;
            this.setState({
                layerCountDisplayed: count
            });
            this.gcodeRenderer.showLayers(count);
        },
        // transform
        setTransformMode: (value) => {
            this.setState({
                transformMode: value
            }, () => {
                this.canvas.current.setTransformMode(value);
            });
        },
        // change stage
        setStageToNoModel: () => {
            this.setState({
                stage: STAGES_3DP.noModel,
                progress: 0,
                progressTitle: ''
            });
            pubsub.publish(ACTION_CHANGE_STAGE_3DP, { stage: STAGES_3DP.noModel });
        },
        setStageToModelLoaded: () => {
            this.modelGroup.visible = true;
            this.state.gcodeLineGroup.visible = false;
            this.setState({
                stage: STAGES_3DP.modelLoaded,
                progress: 100,
                progressTitle: i18n._('Loaded model successfully.')
            });
            pubsub.publish(ACTION_CHANGE_STAGE_3DP, { stage: STAGES_3DP.modelLoaded });
        },
        setStageToGcodeRendered: () => {
            this.modelGroup.visible = false;
            this.state.gcodeLineGroup.visible = true;
            this.setState({
                stage: STAGES_3DP.gcodeRendered
            });
            pubsub.publish(ACTION_CHANGE_STAGE_3DP, { stage: STAGES_3DP.gcodeRendered });
        },
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
            this.modelGroup.selectModel(model);
        },
        onUnselectAllModels: () => {
            this.modelGroup.unselectAllModels();
        },
        onModelAfterTransform: () => {
            this.modelGroup.onModelAfterTransform();
        },
        onModelTransform: () => {
            this.modelGroup.onModelTransform();
        },
        // context menu
        centerSelectedModel: () => {
            this.modelGroup.updateSelectedModelTransformation({ posX: 0, posZ: 0 }, true);
        },
        deleteSelectedModel: () => {
            this.modelGroup.removeSelectedModel();
        },
        duplicateSelectedModel: () => {
            this.modelGroup.multiplySelectedModel(1);
        },
        resetSelectedModelTransformation: () => {
            this.modelGroup.resetSelectedModelTransformation();
        },
        clearBuildPlate: () => {
            this.modelGroup.removeAllModels();
        },
        arrangeAllModels: () => {
            this.modelGroup.arrangeAllModels();
        },
        layFlatSelectedModel: () => {
            this.modelGroup.layFlatSelectedModel();
        }
    };

    constructor(props) {
        super(props);

        const size = props.size;

        configManager.updateSize(size);

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

    onMouseUp = (event) => {
        if (event.button === THREE.MOUSE.RIGHT) {
            this.contextMenuDomElement.current.show(event);
        }
    };

    onHashChange = () => {
        this.modelGroup.unselectAllModels();
    };

    componentDidMount() {
        const size = this.props.size;
        this.modelGroup.position.copy(new THREE.Vector3(0, -size.z / 2, 0));
        this.state.gcodeLineGroup.position.copy(new THREE.Vector3(-size.x / 2, -size.z / 2, size.y / 2));

        this.modelGroup.addChangeListener((args, isChanging) => {
            const { model, hasModel, isAnyModelOverstepped } = args;
            if (!model) {
                this.canvas.current.detachSelectedModel();
            }
            if (!isChanging) {
                this.destroyGcodeLine();
            }

            if (hasModel) {
                this.actions.setStageToModelLoaded();
            } else {
                this.actions.setStageToNoModel();
            }

            pubsub.publish(ACTION_3DP_MODEL_OVERSTEP_CHANGE, { overstepped: isAnyModelOverstepped });
        });

        // canvas
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

        this.visualizerDomElement.current.addEventListener('mouseup', this.onMouseUp, false);
        this.visualizerDomElement.current.addEventListener('wheel', this.hideContextMenu, false);
        window.addEventListener('hashchange', this.onHashChange, false);
        this.gcodeRenderer.loadShaderMaterial();
        this.subscriptions = [
            pubsub.subscribe(ACTION_REQ_GENERATE_GCODE_3DP, () => {
                this.slice();
            }),
            pubsub.subscribe(ACTION_REQ_LOAD_GCODE_3DP, () => {
                const gcodePath = this.state.gcodePath;
                document.location.href = '/#/workspace';
                window.scrollTo(0, 0);
                const filename = path.basename(gcodePath);
                jQuery.get(gcodePath, (result) => {
                    this.props.clearGcode();
                    this.props.addGcode(filename, result);
                });
            }),
            pubsub.subscribe(ACTION_REQ_EXPORT_GCODE_3DP, () => {
                const gcodePath = this.state.gcodePath;
                const filename = path.basename(gcodePath);
                jQuery.get(gcodePath, (data) => {
                    const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
                    const savedFilename = pathWithRandomSuffix(filename);
                    FileSaver.saveAs(blob, savedFilename, true);
                });
            }),
            pubsub.subscribe(ACTION_3DP_EXPORT_MODEL, (msg, params) => {
                const format = params.format;
                const isBinary = params.isBinary;

                const output = new ModelExporter().parse(
                    this.modelGroup,
                    format,
                    isBinary
                );
                if (!output) {
                    // export error
                    return;
                }
                const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
                let fileName = 'export';
                if (format === 'stl') {
                    if (isBinary === true) {
                        fileName += '_binary';
                    } else {
                        fileName += '_ascii';
                    }
                }
                fileName += ('.' + format);
                FileSaver.saveAs(blob, fileName, true);
            }),
            pubsub.subscribe(ACTION_3DP_LOAD_MODEL, (msg, file) => {
                this.uploadAndParseFile(file);
            })
        ];
        this.addControllerEvents();
    }

    componentWillReceiveProps(nextProps) {
        if (!isEqual(nextProps.size, this.props.size)) {
            const size = nextProps.size;

            configManager.updateSize(size);

            this.printableArea.updateSize(size);

            this.modelGroup.updateBoundingBox(new THREE.Box3(
                new THREE.Vector3(-size.x / 2 - EPSILON, -EPSILON, -size.z / 2 - EPSILON),
                new THREE.Vector3(size.x / 2 + EPSILON, size.y + EPSILON, size.z / 2 + EPSILON)
            ));

            this.modelGroup.position.copy(new THREE.Vector3(0, -size.z / 2, 0));
            this.state.gcodeLineGroup.position.copy(new THREE.Vector3(-size.x / 2, -size.z / 2, size.y / 2));
        }
    }

    componentWillUnmount() {
        this.subscriptions.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        this.subscriptions = [];
        this.removeControllerEvents();
        this.visualizerDomElement.current.removeEventListener('mouseup', this.onMouseUp, false);
        this.visualizerDomElement.current.removeEventListener('wheel', this.hideContextMenu, false);
        window.removeEventListener('hashchange', this.onHashChange, false);
    }

    parseModel(modelName, modelPath) {
        new ModelLoader().load(
            modelPath,
            (bufferGemotry) => {
                // step-1: rotate x 90 degree
                bufferGemotry.rotateX(-Math.PI / 2);

                // step-2: make to x:[-a, a]  z:[-b, b]  y:[-c, c]
                bufferGemotry.computeBoundingBox();
                const box3 = bufferGemotry.boundingBox;
                let x = -(box3.max.x + box3.min.x) / 2;
                let y = -(box3.max.y + box3.min.y) / 2;
                let z = -(box3.max.z + box3.min.z) / 2;
                bufferGemotry.translate(x, y, z);

                // step-3: new model and add to Canvas
                const model = new Model(bufferGemotry, MATERIAL_NORMAL, MATERIAL_OVERSTEPPED, modelName, modelPath);
                model.castShadow = false;
                model.receiveShadow = false;

                this.modelGroup.addModel(model);
                this.destroyGcodeLine();
            },
            (progress) => {
                this.setState({
                    progress: progress * 100,
                    progressTitle: i18n._('Loading model...')
                });
            },
            (err) => {
                console.error(err);
                this.setState({
                    progress: 0,
                    progressTitle: i18n._('Failed to load model.')
                });
            }
        );
    }

    finalizeActiveDefinition = (activeDefinition) => {
        const definition = {
            definitionId: 'working',
            name: 'Working Profile',
            inherits: 'fdmprinter',
            settings: {},
            ownKeys: []
        };

        Object.keys(activeDefinition.settings).forEach(key => {
            const setting = activeDefinition.settings[key];

            if (setting.from !== 'fdmprinter') {
                definition.settings[key] = {
                    label: setting.label,
                    default_value: setting.default_value
                };
                definition.ownKeys.push(key);
            }
        });

        return definition;
    };

    slice = async () => {
        // 1.export model to string(stl format) and upload it
        this.setState({
            progress: 0,
            progressTitle: i18n._('Pre-processing model...')
        });

        // Prepare STL file
        // gcode name is: stlFileName(without ext) + '_' + timeStamp + '.gcode'
        let stlFileName = 'combined.stl';
        if (this.modelGroup.getModels().length === 1) {
            const modelPath = this.modelGroup.getModels()[0].modelPath;
            const basenameWithoutExt = path.basename(modelPath, path.extname(modelPath));
            stlFileName = basenameWithoutExt + '.stl';
        }

        const output = new ModelExporter().parseToBinaryStl(this.modelGroup);
        const blob = new Blob([output], { type: 'text/plain' });
        const fileOfBlob = new File([blob], stlFileName);

        const formData = new FormData();
        formData.append('file', fileOfBlob);
        const modelRes = await api.uploadFile(formData);

        // Prepare definition file
        const finalDefinition = this.finalizeActiveDefinition(this.props.activeDefinition);
        const configFilePath = '../CuraEngine/Config/working.def.json';
        await api.printingConfigs.createDefinition(finalDefinition);

        this.setState({
            progress: 0,
            progressTitle: i18n._('Preparing for slicing...')
        });

        // 2.slice
        const params = {
            modelName: modelRes.body.name,
            modelFileName: modelRes.body.filename,
            configFilePath
        };
        controller.print3DSlice(params);
    };

    renderGcode(jsonFileName) {
        const filePath = `${WEB_CACHE_IMAGE}/${jsonFileName}`;
        const loader = new THREE.FileLoader();
        loader.load(
            filePath,
            (data) => {
                const dataObj = JSON.parse(data);
                const result = this.gcodeRenderer.render(dataObj);

                // destroy last line
                this.destroyGcodeLine();
                const { line, layerCount, visibleLayerCount, bounds, gcodeTypeVisibility } = { ...result };
                this.state.gcodeLineGroup.add(line);

                this.setState({
                    layerCount: layerCount,
                    layerCountDisplayed: visibleLayerCount - 1,
                    gcodeTypeInitialVisibility: gcodeTypeVisibility,
                    progress: 100,
                    gcodeLine: line,
                    progressTitle: i18n._('Rendered G-code successfully.')
                }, () => {
                    this.gcodeRenderer.showLayers(this.state.layerCountDisplayed);
                });
                const { minX, minY, minZ, maxX, maxY, maxZ } = { ...bounds };
                this.checkGcodeBoundary(minX, minY, minZ, maxX, maxY, maxZ);

                this.actions.setStageToGcodeRendered();
            }
        );
    }

    destroyGcodeLine() {
        if (this.state.gcodeLine) {
            this.state.gcodeLineGroup.remove(this.state.gcodeLine);
            this.state.gcodeLine.geometry.dispose();
            this.state.gcodeLine = null;
        }
    }

    checkGcodeBoundary(minX, minY, minZ, maxX, maxY, maxZ) {
        const EPSILON = 1;
        const size = this.props.size;
        const widthOverstepped = (minX < -EPSILON || maxX > size.x + EPSILON);
        const depthOverstepped = (minY < -EPSILON || maxY > size.y + EPSILON);
        const heightOverstepped = (minZ < -EPSILON || maxZ > size.z + EPSILON);
        const overstepped = widthOverstepped || heightOverstepped || depthOverstepped;
        pubsub.publish(ACTION_3DP_GCODE_OVERSTEP_CHANGE, { overstepped: overstepped });
    }

    render() {
        const { size } = this.props;
        const state = this.state;
        const actions = this.actions;

        const cameraInitialPosition = new THREE.Vector3(0, 0, Math.max(size.x, size.y, size.z) * 2);
        const isModelSelected = !!state.selectedModel;
        const hasModel = state.hasModel;
        return (
            <div
                className={styles.visualizer}
                ref={this.visualizerDomElement}
            >
                <div className={styles['visualizer-top-left']}>
                    <VisualizerTopLeft actions={actions} modelGroup={this.modelGroup} />
                </div>

                <div className={styles['visualizer-model-transformation']}>
                    <VisualizerModelTransformation
                        size={this.props.size}
                        state={state}
                        actions={actions}
                        modelGroup={this.modelGroup}
                    />
                </div>

                <div className={styles['visualizer-camera-operations']}>
                    <VisualizerCameraOperations actions={actions} />
                </div>

                <div className={styles['visualizer-preview-control']}>
                    <VisualizerPreviewControl actions={actions} state={state} />
                </div>

                <div className={styles['visualizer-info']}>
                    <VisualizerInfo state={state} modelGroup={this.modelGroup} />
                </div>

                <div className={styles['visualizer-progress-bar']}>
                    <VisualizerProgressBar title={state.progressTitle} progress={state.progress} />
                </div>
                <div className={styles['canvas-content']} style={{ top: 0 }}>
                    <Canvas
                        ref={this.canvas}
                        size={this.props.size}
                        modelGroup={this.modelGroup}
                        printableArea={this.printableArea}
                        enabledTransformModel={true}
                        modelInitialRotation={new THREE.Euler(Math.PI / 180 * 15)}
                        cameraInitialPosition={cameraInitialPosition}
                        gcodeLineGroup={this.state.gcodeLineGroup}
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
                    ref={this.contextMenuDomElement}
                    id="3dp"
                    items={
                        [
                            {
                                name: i18n._('Center Selected Model'),
                                disabled: !isModelSelected,
                                onClick: actions.centerSelectedModel
                            },
                            {
                                name: i18n._('Delete Selected Model'),
                                disabled: !isModelSelected,
                                onClick: actions.deleteSelectedModel
                            },
                            {
                                name: i18n._('Duplicate Selected Model'),
                                disabled: !isModelSelected,
                                onClick: actions.duplicateSelectedModel
                            },
                            {
                                name: i18n._('Reset Selected Model Transformation'),
                                disabled: !isModelSelected,
                                onClick: actions.resetSelectedModelTransformation
                            },
                            {
                                name: i18n._('Lay Flat Selected Model'),
                                disabled: !isModelSelected,
                                onClick: actions.layFlatSelectedModel
                            },
                            'separator',
                            {
                                name: i18n._('Clear Build Plate'),
                                disabled: !hasModel,
                                onClick: actions.clearBuildPlate
                            },
                            {
                                name: i18n._('Arrange All Models'),
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

    return {
        size: machine.size,
        activeDefinition: printing.activeDefinition
    };
};

const mapDispatchToProps = (dispatch) => ({
    addGcode: (name, gcode, renderMethod) => dispatch(workspaceActions.addGcode(name, gcode, renderMethod)),
    clearGcode: () => dispatch(workspaceActions.clearGcode())
});


export default connect(mapStateToProps, mapDispatchToProps)(Visualizer);
