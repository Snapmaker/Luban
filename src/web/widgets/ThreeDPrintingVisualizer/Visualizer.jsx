import React, { PureComponent } from 'react';
import FileSaver from 'file-saver';
import path from 'path';
import pubsub from 'pubsub-js';
import * as THREE from 'three';
import jQuery from 'jquery';
import {
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
import ContextMenu from './ContextMenu';
import { Canvas, PrintableCube } from '../Canvas';
import styles from './styles.styl';
import SecondaryToolbar from '../CanvasToolbar/SecondaryToolbar';

const MODEL_GROUP_POSITION = new THREE.Vector3(0, -125 / 2, 0);
const GCODE_LINE_GROUP_POSITION = new THREE.Vector3(-125 / 2, -125 / 2, 125 / 2);

const MATERIAL_NORMAL = new THREE.MeshPhongMaterial({ color: 0xe0e0e0, specular: 0xb0b0b0, shininess: 30 });
const MATERIAL_OVERSTEPPED = new THREE.MeshPhongMaterial({
    color: 0xff0000,
    shininess: 30,
    transparent: true,
    opacity: 0.6
});


class Visualizer extends PureComponent {
    gcodeRenderer = new GCodeRenderer();

    contextMenuDomElement = null;
    visualizerDomElement = null;

    canvas = null;
    printableArea = new PrintableCube();

    modelGroup = new ModelGroup(new THREE.Box3(new THREE.Vector3(-125 / 2, -0.1, -125 / 2), new THREE.Vector3(125 / 2, 125, 125 / 2)));

    state = {
        stage: STAGES_3DP.noModel,
        // translate/scale/rotate
        transformMode: 'translate',
        // slice info
        printTime: 0,
        filamentLength: 0,
        filamentWeight: 0,
        // G-code
        gcodeLineGroup: new THREE.Group(),
        gcodeLine: null,
        layerCount: 0,
        layerCountDisplayed: 0,
        gcodeTypeInitialVisibility: {},
        // progress bar
        progressTitle: '',
        progress: 0,
        // context menu
        contextMenuVisible: false,
        contextMenuTop: '0px',
        contextMenuLeft: '0px',

        _: 0 // placeholder
    };

    constructor(props) {
        super(props);
        this.modelGroup.addChangeListener((args, isChanging) => {
            const { hasModel, isAnyModelOverstepped } = args;

            if (!isChanging) {
                this.destroyGcodeLine();
            }

            if (hasModel) {
                this.actions.setStageToModelLoaded();
            } else {
                this.actions.setStageToNoModel();
            }

            if (isAnyModelOverstepped) {
                pubsub.publish(ACTION_3DP_MODEL_OVERSTEP_CHANGE, { overstepped: isAnyModelOverstepped });
            }
        });
    }

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
                this.canvas.setTransformMode(value);
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
        hideContextMenu: () => {
            this.setState({ contextMenuVisible: false });
        },
        // canvas
        zoomIn: () => {
            this.canvas.zoomIn();
        },
        zoomOut: () => {
            this.canvas.zoomOut();
        },
        autoFocus: () => {
            this.canvas.autoFocus();
        },
        toLeft: () => {
            this.canvas.toLeft();
        },
        toRight: () => {
            this.canvas.toRight();
        },
        toTop: () => {
            this.canvas.toTop();
        },
        toBottom: () => {
            this.canvas.toBottom();
        }
    };

    uploadAndParseFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        api.uploadFile(formData).then((res) => {
            const file = res.body;
            const modelPath = `${WEB_CACHE_IMAGE}/${file.filename}`;
            this.parseModel(modelPath);
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

    showContextMenu = (event) => {
        // this.contextMenuDomElement.parentNode.offsetHeight will return 0 if no css associated with parentNode
        // https://stackoverflow.com/questions/32438642/clientwidth-and-clientheight-report-zero-while-getboundingclientrect-is-correct
        const offsetX = event.offsetX;
        const offsetY = event.offsetY;
        let top = null;
        let left = null;
        if (offsetX + this.contextMenuDomElement.offsetWidth + 5 < this.contextMenuDomElement.parentNode.offsetWidth) {
            left = (offsetX + 5) + 'px';
        } else {
            left = (offsetX - this.contextMenuDomElement.offsetWidth - 5) + 'px';
        }
        if (offsetY + this.contextMenuDomElement.offsetHeight + 5 < this.contextMenuDomElement.parentNode.offsetHeight) {
            top = (offsetY + 5) + 'px';
        } else {
            top = (offsetY - this.contextMenuDomElement.offsetHeight - 5) + 'px';
        }
        this.setState({
            contextMenuVisible: true,
            contextMenuTop: top,
            contextMenuLeft: left
        });
    };

    onMouseUp = (event) => {
        if (event.button === THREE.MOUSE.RIGHT) {
            this.showContextMenu(event);
        } else {
            this.actions.hideContextMenu();
        }
    };

    onHashChange = () => {
        this.actions.hideContextMenu();
    };

    componentDidMount() {
        // canvas
        this.canvas.resizeWindow();
        this.canvas.enable3D();
        window.addEventListener(
            'hashchange',
            (event) => {
                if (event.newURL.endsWith('3dp')) {
                    this.canvas.resizeWindow();
                }
            },
            false
        );
        this.state.gcodeLineGroup.position.copy(GCODE_LINE_GROUP_POSITION);
        this.modelGroup.position.copy(MODEL_GROUP_POSITION);

        this.visualizerDomElement.addEventListener('mouseup', this.onMouseUp, false);
        this.visualizerDomElement.addEventListener('wheel', this.actions.hideContextMenu, false);
        window.addEventListener('hashchange', this.onHashChange, false);
        this.gcodeRenderer.loadShaderMaterial();
        this.subscriptions = [
            pubsub.subscribe(ACTION_REQ_GENERATE_GCODE_3DP, (msg, configFilePath) => {
                this.slice(configFilePath);
            }),
            pubsub.subscribe(ACTION_REQ_LOAD_GCODE_3DP, () => {
                const gcodePath = this.state.gcodePath;
                document.location.href = '/#/workspace';
                window.scrollTo(0, 0);
                jQuery.get(gcodePath, (result) => {
                    pubsub.publish('gcode:upload', { gcode: result, meta: { name: gcodePath } });
                });
            }),
            pubsub.subscribe(ACTION_REQ_EXPORT_GCODE_3DP, () => {
                const gcodePath = this.state.gcodePath;
                const filename = path.basename(gcodePath);
                document.location.href = '/api/gcode/download_cache?filename=' + filename;
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

    componentWillUnmount() {
        this.subscriptions.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        this.subscriptions = [];
        this.removeControllerEvents();
        this.visualizerDomElement.removeEventListener('mouseup', this.onMouseUp, false);
        this.visualizerDomElement.removeEventListener('wheel', this.actions.hideContextMenu, false);
        window.removeEventListener('hashchange', this.onHashChange, false);
    }

    parseModel(modelPath) {
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
                const model = new Model(bufferGemotry, MATERIAL_NORMAL, MATERIAL_OVERSTEPPED, modelPath);
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
                this.setState({
                    progress: 0,
                    progressTitle: i18n._('Failed to load model.')
                });
            }
        );
    }

    slice = (configFilePath) => {
        // 1.export model to string(stl format) and upload it
        this.setState({
            progress: 0,
            progressTitle: i18n._('Pre-processing model...')
        });
        const output = new ModelExporter().parseToBinaryStl(this.modelGroup);
        const blob = new Blob([output], { type: 'text/plain' });
        // gcode name is: stlFileName(without ext) + '_' + timeStamp + '.gcode'
        let stlFileName = 'combined.stl';
        if (this.modelGroup.getModels().length === 1) {
            const modelPath = this.modelGroup.getModels()[0].modelPath;
            const basenameWithoutExt = path.basename(modelPath, path.extname(modelPath));
            stlFileName = basenameWithoutExt + '.stl';
        }
        const fileOfBlob = new File([blob], stlFileName);
        const formData = new FormData();
        formData.append('file', fileOfBlob);
        api.uploadFile(formData).then((res) => {
            const file = res.body;
            this.setState({
                modelUploadResult: 'ok'
            });
            this.setState({
                progress: 0,
                progressTitle: i18n._('Preparing for slicing...')
            });
            // 2.slice
            const params = {
                modelFileName: `${file.filename}`,
                configFilePath: configFilePath
            };
            controller.print3DSlice(params);
        });
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
        const boundaryMax = 125;
        const widthOverstepped = (minX < 0 || maxX > boundaryMax);
        const heightOverstepped = (minZ < 0 || maxZ > boundaryMax);
        const depthOverstepped = (minY < 0 || maxY > boundaryMax);
        const overstepped = widthOverstepped || heightOverstepped || depthOverstepped;
        pubsub.publish(ACTION_3DP_GCODE_OVERSTEP_CHANGE, { overstepped: overstepped });
    }

    render() {
        const state = this.state;
        const actions = this.actions;

        return (
            <div
                className={styles.visualizer}
                ref={(node) => {
                    this.visualizerDomElement = node;
                }}
            >
                <div className={styles['visualizer-top-left']}>
                    <VisualizerTopLeft actions={actions} modelGroup={this.modelGroup} />
                </div>

                <div className={styles['visualizer-model-transformation']}>
                    <VisualizerModelTransformation state={state} actions={actions} modelGroup={this.modelGroup} />
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
                        ref={node => {
                            this.canvas = node;
                        }}
                        modelGroup={this.modelGroup}
                        printableArea={this.printableArea}
                        enabledTransformModel={true}
                        modelInitialRotation={new THREE.Euler(Math.PI / 180 * 15)}
                        cameraInitialPosition={new THREE.Vector3(0, 0, 300)}
                        gcodeLineGroup={this.state.gcodeLineGroup}
                    />
                </div>
                <div className={styles['canvas-footer']}>
                    <SecondaryToolbar actions={this.actions} />
                </div>
                <div
                    ref={(node) => {
                        this.contextMenuDomElement = node;
                    }}
                    className={styles['context-menu']}
                    style={{
                        visibility: state.contextMenuVisible ? 'visible' : 'hidden',
                        top: this.state.contextMenuTop,
                        left: this.state.contextMenuLeft
                    }}
                >
                    <ContextMenu modelGroup={this.modelGroup} />
                </div>
            </div>
        );
    }
}

export default Visualizer;
