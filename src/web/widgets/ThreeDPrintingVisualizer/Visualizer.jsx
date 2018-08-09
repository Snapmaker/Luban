import React, { PureComponent } from 'react';
import path from 'path';
import pubsub from 'pubsub-js';
import * as THREE from 'three';
import 'imports-loader?THREE=three!three/examples/js/loaders/STLLoader';
import 'imports-loader?THREE=three!three/examples/js/loaders/OBJLoader';
import jQuery from 'jquery';
import {
    WEB_CACHE_IMAGE,
    ACTION_REQ_GENERATE_GCODE_3DP,
    ACTION_REQ_LOAD_GCODE_3DP,
    ACTION_REQ_EXPORT_GCODE_3DP,
    ACTION_3DP_GCODE_OVERSTEP_CHANGE,
    ACTION_3DP_MODEL_OVERSTEP_CHANGE,
    ACTION_CHANGE_STAGE_3DP,
    STAGES_3DP
} from '../../constants';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import controller from '../../lib/controller';
import api from '../../api';
import STLExporter from '../../components/three-extensions/STLExporter';
import VisualizerProgressBar from './VisualizerProgressBar';
import VisualizerTopLeft from './VisualizerTopLeft';
import VisualizerModelTransformation from './VisualizerModelTransformation';
import VisualizerCameraOperations from './VisualizerCameraOperations';
import VisualizerPreviewControl from './VisualizerPreviewControl';
import VisualizerInfo from './VisualizerInfo';
import Canvas from './Canvas';
import ModelLoader from './ModelLoader';
import GCodeRenderer from './GCodeRenderer';
import ModelMesh from './ModelMesh';
import styles from './styles.styl';


const MATERIAL_NORMAL = new THREE.MeshPhongMaterial({ color: 0xe0e0e0, specular: 0xe0e0e0, shininess: 30 });
const MATERIAL_OVERSTEPPED = new THREE.MeshBasicMaterial({ color: 0xda70d6 });

class Visualizer extends PureComponent {
    gcodeRenderer = new GCodeRenderer();
    // undo&redo
    undoModels = [];
    redoModels = [];
    state = this.getInitialState();

    getInitialState() {
        return {
            stage: STAGES_3DP.noModel,

            modelsBoundingBox: {
                min: {
                    x: 0,
                    y: 0,
                    z: 0
                },
                max: {
                    x: 0,
                    y: 0,
                    z: 0
                }
            },

            // multiple model group
            modelGroup: new THREE.Group(),
            selectedModel: null,
            modelsName: 'combined.stl',

            // translate/scale/rotate
            transformMode: 'translate',

            canUndo: false,
            canRedo: false,

            // selected model state
            moveX: 0,
            moveY: 0,
            moveZ: 0,
            scale: 1,
            rotateX: 0,
            rotateY: 0,
            rotateZ: 0,

            // slice
            printTime: 0,
            filamentLength: 0,
            filamentWeight: 0,

            // G-code
            gcodeLineGroup: new THREE.Group(),
            gcodeLine: null,

            layerCount: 0,
            layerCountDisplayed: 0,

            // progress bar
            progressTitle: '',
            progress: 0,

            _: 0 // placeholder
        };
    }

    actions = {
        // topLeft
        onChangeFile: (event) => {
            const file = event.target.files[0];
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
        // undo/redo/remove
        undo: () => {
            if (this.undoModels.length > 0) {
                const model = this.undoModels.pop();
                this.redoModels.push(model);
                model.undo(this.state.modelGroup);
            }
            this.updateUndoRedoState();
            this.destroyGcodeLine();
            if (this.state.modelGroup.children.length === 0) {
                this.actions.setStageToNoModel();
            } else {
                this.actions.setStageToModelLoaded();
            }
            this.checkModelsOverstepped();
            this.computeModelsSize();
        },
        redo: () => {
            if (this.redoModels.length > 0) {
                const model = this.redoModels.pop();
                this.undoModels.push(model);
                model.redo(this.state.modelGroup);
            }
            this.updateUndoRedoState();
            this.destroyGcodeLine();
            if (this.state.modelGroup.children.length === 0) {
                this.actions.setStageToNoModel();
            } else {
                this.actions.setStageToModelLoaded();
            }
            this.checkModelsOverstepped();
            this.computeModelsSize();
        },
        removeModelFromParent: (model) => {
            this.undoModels.push(model);
            this.redoModels = [];
            model.removeFromParent();
            this.updateUndoRedoState();
            this.destroyGcodeLine();
            if (this.state.modelGroup.children.length === 0) {
                this.actions.setStageToNoModel();
            } else {
                this.actions.setStageToModelLoaded();
            }
            this.checkModelsOverstepped();
            this.computeModelsSize();
        },
        // transform models
        setTransformMode: (value) => {
            this.setState({
                transformMode: value
            });
        },
        onModelTransform: () => {
            // position/rotate/scale changing
            this.setState({
                moveX: this.state.selectedModel.position.x,
                moveY: this.state.selectedModel.position.y,
                moveZ: this.state.selectedModel.position.z,
                scale: this.state.selectedModel.scale.x,
                rotateX: this.state.selectedModel.rotation.x,
                rotateY: this.state.selectedModel.rotation.y,
                rotateZ: this.state.selectedModel.rotation.z
            });
        },
        onModelAfterTransform: () => {
            this.state.selectedModel.clingToBottom();
            this.state.selectedModel.checkOverstepped();
            // position/rotate/scale changed
            // 0. compare with last
            const lastModel = this.undoModels[this.undoModels.length - 1];
            this.state.selectedModel.updateMatrix();
            if (this.state.selectedModel === lastModel &&
                this.state.selectedModel.matrix.equals(lastModel.undoes[lastModel.undoes.length - 1].matrix)) {
                return;
            }
            // 1. undo/redo
            this.undoModels.push(this.state.selectedModel);
            this.redoModels = [];
            this.state.selectedModel.onTransformed();
            this.updateUndoRedoState();
            // 2. other
            this.destroyGcodeLine();
            this.checkModelsOverstepped();
            this.computeModelsSize();
        },
        onModelSelected: (model) => {
            this.state.modelGroup.traverse((item) => {
                if (item instanceof ModelMesh) {
                    item.setSelected(model === item);
                }
            });
            this.setState({
                selectedModel: model,
                moveX: model.position.x,
                moveY: model.position.y,
                moveZ: model.position.z,
                scale: model.scale.x,
                rotateX: model.rotation.x,
                rotateY: model.rotation.y,
                rotateZ: model.rotation.z
            });
        },
        onModelUnselected: () => {
            this.state.modelGroup.traverse((item) => {
                if (item instanceof ModelMesh) {
                    item.setSelected(false);
                }
            });
            this.setState({
                selectedModel: null
            });
        },
        // change stage
        setStageToNoModel: () => {
            this.state.modelGroup.visible = false;
            this.state.gcodeLineGroup.visible = false;
            this.setState({
                stage: STAGES_3DP.noModel,
                selectedModel: null
            });
            this.actions.onModelUnselected();
            pubsub.publish(ACTION_CHANGE_STAGE_3DP, { stage: STAGES_3DP.noModel });
        },
        setStageToModelLoaded: () => {
            this.state.modelGroup.visible = true;
            this.state.gcodeLineGroup.visible = false;
            this.setState({
                stage: STAGES_3DP.modelLoaded,
                progress: 100,
                progressTitle: i18n._('Loaded model successfully.')
            });
            pubsub.publish(ACTION_CHANGE_STAGE_3DP, { stage: STAGES_3DP.modelLoaded });
        },
        setStageToGcodeRendered: () => {
            this.state.modelGroup.visible = false;
            this.state.gcodeLineGroup.visible = true;
            this.setState({
                stage: STAGES_3DP.gcodeRendered,
                selectedModel: null
            });
            this.actions.onModelUnselected();
            pubsub.publish(ACTION_CHANGE_STAGE_3DP, { stage: STAGES_3DP.gcodeRendered });
        }
    };

    checkModelsOverstepped() {
        let overstepped = false;
        this.state.modelGroup.traverse((item) => {
            if (item instanceof ModelMesh) {
                overstepped = overstepped || item.checkOverstepped();
            }
        });
        this.modelMeshOversteped = overstepped;
        pubsub.publish(ACTION_3DP_MODEL_OVERSTEP_CHANGE, { overstepped: overstepped });
    }

    computeModelsSize() {
        if (this.state.modelGroup.children.length === 0) {
            this.setState({
                modelsBoundingBox: {
                    min: {
                        x: 0,
                        y: 0,
                        z: 0
                    },
                    max: {
                        x: 0,
                        y: 0,
                        z: 0
                    }
                }
            });
            return;
        }
        const boundingBox = {
            min: {
                x: Number.MAX_VALUE,
                y: Number.MAX_VALUE,
                z: Number.MAX_VALUE
            },
            max: {
                x: Number.MIN_VALUE,
                y: Number.MIN_VALUE,
                z: Number.MIN_VALUE
            }
        };
        this.state.modelGroup.traverse((item) => {
            if (item instanceof ModelMesh) {
                const box = item.computeBoundingBox();
                boundingBox.min.x = Math.min(box.min.x, boundingBox.min.x);
                boundingBox.min.y = Math.min(box.min.y, boundingBox.min.y);
                boundingBox.min.z = Math.min(box.min.z, boundingBox.min.z);

                boundingBox.max.x = Math.max(box.max.x, boundingBox.max.x);
                boundingBox.max.y = Math.max(box.max.y, boundingBox.max.y);
                boundingBox.max.z = Math.max(box.max.z, boundingBox.max.z);
            }
        });
        this.setState({
            modelsBoundingBox: boundingBox
        });
    }
    updateUndoRedoState() {
        this.setState({
            canUndo: this.undoModels.length > 0,
            canRedo: this.redoModels.length > 0,
            moveX: this.state.selectedModel ? this.state.selectedModel.position.x : 0,
            moveY: this.state.selectedModel ? this.state.selectedModel.position.y : 0,
            moveZ: this.state.selectedModel ? this.state.selectedModel.position.z : 0,
            scale: this.state.selectedModel ? this.state.selectedModel.scale.x : 0,
            rotateX: this.state.selectedModel ? this.state.selectedModel.rotation.x : 0,
            rotateY: this.state.selectedModel ? this.state.selectedModel.rotation.y : 0,
            rotateZ: this.state.selectedModel ? this.state.selectedModel.rotation.z : 0
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

    componentDidMount() {
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
            })
        ];
        this.addControllerEvents();
        this.actions.setStageToNoModel();
    }

    componentWillUnmount() {
        this.subscriptions.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        this.subscriptions = [];
        this.removeControllerEvents();
    }

    parseModel(modelPath) {
        new ModelLoader().load(
            modelPath,
            (bufferGemotry) => {
                // step-1: rotate x 90 degree
                bufferGemotry.rotateX(-Math.PI / 2);

                // step-2: set bufferGemotry to symmetry
                bufferGemotry.computeBoundingBox();
                let x = -(bufferGemotry.boundingBox.max.x + bufferGemotry.boundingBox.min.x) / 2;
                let y = -(bufferGemotry.boundingBox.max.y + bufferGemotry.boundingBox.min.y) / 2;
                let z = -(bufferGemotry.boundingBox.max.z + bufferGemotry.boundingBox.min.z) / 2;
                bufferGemotry.translate(x, y, z);
                bufferGemotry.computeBoundingBox();

                // step-3: new modelMesh and add to Canvas
                const modelMesh = new ModelMesh(bufferGemotry, MATERIAL_NORMAL, MATERIAL_OVERSTEPPED, modelPath);
                // todo: find suitable position
                modelMesh.position.set(0, 0, 0);
                modelMesh.scale.set(1, 1, 1);
                modelMesh.castShadow = true;
                modelMesh.receiveShadow = true;
                modelMesh.clingToBottom();
                modelMesh.checkOverstepped();
                modelMesh.onInitialized();

                this.state.modelGroup.add(modelMesh);
                modelMesh.onAddedToParent();

                // step-6: undo&redo
                this.undoModels.push(modelMesh);
                this.updateUndoRedoState();
                this.destroyGcodeLine();

                // only change stage when load succeed
                this.actions.setStageToModelLoaded();

                this.checkModelsOverstepped();
                this.computeModelsSize();
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
        const exporter = new STLExporter();
        const output = exporter.parse(this.state.modelGroup);
        const blob = new Blob([output], { type: 'text/plain' });
        const fileOfBlob = new File([blob], this.state.modelsName);
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
                const { line, layerCount, visibleLayerCount, bounds } = { ...result };
                this.state.gcodeLineGroup.add(line);

                this.setState({
                    layerCount: layerCount,
                    layerCountDisplayed: visibleLayerCount - 1,
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
            <React.Fragment>
                <div className={styles['visualizer-top-left']}>
                    <VisualizerTopLeft actions={actions} state={state} />
                </div>

                <div className={styles['visualizer-model-transformation']}>
                    <VisualizerModelTransformation actions={actions} state={state} />
                </div>

                <div className={styles['visualizer-camera-operations']}>
                    <VisualizerCameraOperations />
                </div>

                <div className={styles['visualizer-preview-control']}>
                    <VisualizerPreviewControl actions={actions} state={state} />
                </div>

                <div className={styles['visualizer-info']}>
                    <VisualizerInfo state={state} />
                </div>

                <div className={styles['visualizer-progress-bar']}>
                    <VisualizerProgressBar title={state.progressTitle} progress={state.progress} />
                </div>

                <div className={styles.canvas}>
                    <Canvas actions={actions} state={state} />
                </div>
            </React.Fragment>
        );
    }
}

export default Visualizer;
