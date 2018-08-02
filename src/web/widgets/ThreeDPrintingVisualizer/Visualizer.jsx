import React, { PureComponent } from 'react';
import path from 'path';
import pubsub from 'pubsub-js';
import * as THREE from 'three';
import 'imports-loader?THREE=three!three/examples/js/loaders/STLLoader';
import 'imports-loader?THREE=three!three/examples/js/loaders/OBJLoader';
import jQuery from 'jquery';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import api from '../../api';
import Canvas from './Canvas';
import VisualizerTopLeft from './VisualizerTopLeft';
import VisualizerModelOperations from './VisualizerModelOperations';
import VisualizerCameraOperations from './VisualizerCameraOperations';
import VisualizerPreviewControl from './VisualizerPreviewControl';
import VisualizerInfo from './VisualizerInfo';
import styles from './styles.styl';
import GCodeRenderer from './GCodeRenderer';
import STLExporter from './STLExporter';
import ModelMesh from './ModelMesh';
import {
    STAGE_IDLE,
    STAGE_IMAGE_LOADED,
    ACTION_CHANGE_STAGE_3DP,
    ACTION_REQ_GENERATE_GCODE_3DP,
    ACTION_REQ_LOAD_GCODE_3DP,
    ACTION_REQ_EXPORT_GCODE_3DP,
    WEB_CACHE_IMAGE,
    ACTION_3DP_GCODE_OVERSTEP_CHANGE,
    STAGE_GENERATED
} from '../../constants';
import controller from '../../lib/controller';
import VisualizerProgressBar from './VisualizerProgressBar';

const MATERIAL_NORMAL = new THREE.MeshPhongMaterial({ color: 0xe0e0e0, specular: 0xe0e0e0, shininess: 30 });
const MATERIAL_OVERSTEPPED = new THREE.MeshBasicMaterial({ color: 0xda70d6 });

class Visualizer extends PureComponent {
    gcodeRenderer = new GCodeRenderer();
    // undo&redo
    undoModelMeshes = [];
    redoModelMeshes = [];

    state = {
        stage: STAGE_IDLE,

        modelSizeX: 0,
        modelSizeY: 0,
        modelSizeZ: 0,

        // multiple modelMesh group
        modelMeshGroup: new THREE.Group(),
        selectedModel: undefined,

        // translate/scale/rotate
        operateMode: 'translate',
        uniformScale: true,

        canUndo: false,
        canRedo: false,

        // model operations
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
        gcodeLine: undefined,
        layerCount: 0,
        layerCountDisplayed: 0,

        // progress bar
        progressTitle: '',
        progress: 0,

        _: 0 // placeholder
    };

    actions = {
        // topLeft
        onChangeFile: (event) => {
            const file = event.target.files[0];
            const formData = new FormData();
            formData.append('file', file);
            api.uploadFile(formData).then((res) => {
                const file = res.body;
                let modelFilePath = `${WEB_CACHE_IMAGE}/${file.filename}`;
                this.parseModel(modelFilePath);
            }).catch(() => {
                modal({
                    title: 'Parse File Error',
                    body: `Failed to parse model file ${file.filename}`
                });
            });
        },
        undo: () => {
            this.destroyGcodeLine();
            if (this.undoModelMeshes.length > 0) {
                const modelMesh = this.undoModelMeshes.pop();
                this.redoModelMeshes.push(modelMesh);
                modelMesh.undo(this.state.modelMeshGroup);
            }
            this.updateUndoRedoState();
        },
        redo: () => {
            this.destroyGcodeLine();
            if (this.redoModelMeshes.length > 0) {
                const modelMesh = this.redoModelMeshes.pop();
                this.undoModelMeshes.push(modelMesh);
                modelMesh.redo(this.state.modelMeshGroup);
            }
            this.updateUndoRedoState();
        },
        removeModelMesh: (modelMesh) => {
            this.undoModelMeshes.push(modelMesh);
            this.redoModelMeshes = [];
            modelMesh.removeFromParent();
            this.updateUndoRedoState();
        },
        onModelMeshTransformed: (modelMesh) => {
            // compare transform with last operated modelMesh
            const last = this.undoModelMeshes[this.undoModelMeshes.length - 1];
            modelMesh.updateMatrix();
            if (modelMesh === last &&
                modelMesh.matrix.equals(last.undoes[last.undoes.length - 1].matrix)) {
                return;
            }
            // 1. undo/redo
            this.undoModelMeshes.push(modelMesh);
            this.redoModelMeshes = [];
            modelMesh.onTransformed();
            this.updateUndoRedoState();
            // 2. compute size for all models
            // check MODEL_OVERSTEP
            // ACTION_3DP_MODEL_OVERSTEP_CHANGE
        },
        // preview
        showGcodeType: (type) => {
            this.gcodeRenderer.showType(type);
        },
        hideGcodeType: (type) => {
            this.gcodeRenderer.hideType(type);
        },
        showGcodeLayers: (value) => {
            value = (value > this.state.layerCount) ? this.state.layerCount : value;
            value = (value < 0) ? 0 : value;
            this.setState({
                layerCountDisplayed: value
            });
            this.gcodeRenderer.showLayers(value);
        },
        setSelectedModel: (model) => {
            this.state.modelMeshGroup.traverse((item) => {
                if (item instanceof THREE.Mesh) {
                    item.setSelected(model === item);
                }
            });
            this.setState({
                selectedModel: model,
                moveX: model ? model.position.x : 0,
                moveY: model ? model.position.y : 0,
                moveZ: model ? model.position.z : 0,
                scale: model ? model.scale.x : 0,
                rotateX: model ? model.rotation.x : 0,
                rotateY: model ? model.rotation.y : 0,
                rotateZ: model ? model.rotation.z : 0
            });
        },
        // setUniformScale: (value) => {
        //     this.setState({
        //         uniformScale: value
        //     });
        // },
        setOperateMode: (value) => {
            this.setState({
                operateMode: value
            });
        },
        selectedModelChange: () => {
            this.setState({
                moveX: this.state.selectedModel.position.x,
                moveY: this.state.selectedModel.position.y,
                moveZ: this.state.selectedModel.position.z,
                scale: this.state.selectedModel.scale.x,
                rotateX: this.state.selectedModel.rotation.x,
                rotateY: this.state.selectedModel.rotation.y,
                rotateZ: this.state.selectedModel.rotation.z
            });
        }
    };

    updateUndoRedoState() {
        this.setState({
            canUndo: this.undoModelMeshes.length > 0,
            canRedo: this.redoModelMeshes.length > 0,
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
                progressTitle: i18n._('Slice finished.')
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
                progressTitle: i18n._('Parse G-code finished.')
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
                progressTitle: i18n._('Parse G-code error: ') + JSON.stringify(err)
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
    }

    componentWillUnmount() {
        this.subscriptions.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        this.subscriptions = [];
        this.removeControllerEvents();
    }

    parseModel(modelPath) {
        const extension = path.extname(modelPath).toString().toLowerCase();
        if (extension === '.stl') {
            this.parseStl(modelPath);
        } else if (extension === '.obj') {
            this.parseObj(modelPath);
        }
    }
    onLoadModelSucceed = (bufferGemotry, modelPath) => {
        // step-0: destroy gcode line
        this.destroyGcodeLine();

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
        modelMesh.checkBoundary();
        modelMesh.onInitialized();

        this.state.modelMeshGroup.add(modelMesh);
        modelMesh.onAddedToParent();

        // step-4: show all models
        this.state.modelMeshGroup.visible = true;

        // step-4: others
        this.setState({
            stage: STAGE_IMAGE_LOADED,
            progress: 100,
            progressTitle: i18n._('Load model succeed.')
        });
        pubsub.publish(ACTION_CHANGE_STAGE_3DP, { stage: STAGE_IMAGE_LOADED });

        // step-5: undo&redo
        this.undoModelMeshes.push(modelMesh);
        this.updateUndoRedoState();
    };

    onLoadModelProgress = (event) => {
        const progress = event.loaded / event.total;
        this.setState({
            progress: progress * 100,
            progressTitle: i18n._('Loading model...')
        });
    };
    onLoadModelError = () => {
        this.setState({
            progress: 0,
            progressTitle: i18n._('Load model failed.')
        });
    };
    parseStl(modelPath) {
        new THREE.STLLoader().load(
            modelPath,
            (geometry) => {
                geometry.computeVertexNormals();
                geometry.normalizeNormals();
                this.onLoadModelSucceed(geometry, modelPath);
            },
            (event) => {
                this.onLoadModelProgress(event);
            },
            (event) => {
                this.onLoadModelError(event);
            }
        );
    }

    parseObj(modelPath) {
        new THREE.OBJLoader().load(
            modelPath,
            // return container. container has several meshs(a mesh is one of line/mesh/point). mesh uses BufferGeometry
            (container) => {
                let geometry = new THREE.Geometry();
                container.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        if (child.geometry && child.geometry instanceof THREE.BufferGeometry) {
                            let ge = new THREE.Geometry();
                            ge.fromBufferGeometry(child.geometry);
                            geometry.merge(ge);
                        }
                    }
                });

                // container has several meshs, DragControls only affect "modelGroup.children"
                // var dragcontrols = new THREE.DragControls( modelGroup.children, camera,renderer.domElement );
                // so  1.need to merge all geometries to one geometry   2.new a Mesh and add it to modelGroup

                // if 'modelGroup.add( container )', can not drag the container
                // reason: container is Group and not implement '.raycast ( raycaster, intersects )'
                // the Object3D implemented '.raycast' such as 'Mesh'  can be affected by DragControls

                // if add every child(it is mesh) to modelGroup, only can drag a child, as seen, drag a piece of obj model
                // must drag the whole obj model rather than a piece of it.

                // BufferGeometry is an efficient alternative to Geometry
                let bufferGeometry = new THREE.BufferGeometry();
                bufferGeometry.fromGeometry(geometry);
                this.onLoadModelSucceed(geometry, modelPath);
            },
            (event) => {
                this.onLoadModelProgress(event);
            },
            (event) => {
                this.onLoadModelError(event);
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
        const output = exporter.parse(this.state.modelMeshGroup);
        const blob = new Blob([output], { type: 'text/plain' });
        // const fileOfBlob = new File([blob], this.state.modelFileName);
        const fileOfBlob = new File([blob], 'walker.stl');
        const formData = new FormData();
        formData.append('file', fileOfBlob);
        api.uploadFile(formData).then((res) => {
            const file = res.body;
            this.setState({
                modelFileName: `${file.filename}`,
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

                const { line, layerCount, visibleLayerCount, bounds } = { ...result };
                this.destroyGcodeLine();
                this.state.gcodeLineGroup.add(line);
                this.setState({
                    layerCount: layerCount,
                    layerCountDisplayed: visibleLayerCount - 1,
                    gcodeLine: line,
                    stage: STAGE_GENERATED,
                    progress: 100,
                    progressTitle: i18n._('G-code rendered.')
                }, () => {
                    this.gcodeRenderer.showLayers(this.state.layerCountDisplayed);
                    pubsub.publish(ACTION_CHANGE_STAGE_3DP, { stage: STAGE_GENERATED });
                });
                const { minX, minY, minZ, maxX, maxY, maxZ } = { ...bounds };
                this.checkGcodeBoundary(minX, minY, minZ, maxX, maxY, maxZ);

                // hide all models and unselected
                this.state.modelMeshGroup.visible = false;
                this.state.selectedModel = undefined;
            }
        );
    }

    destroyGcodeLine() {
        this.state.gcodeLineGroup.remove(...this.state.gcodeLineGroup.children);
        this.setState({
            gcodeLine: undefined
        });
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

                <div className={styles['visualizer-model-operations']}>
                    <VisualizerModelOperations actions={actions} state={state} />
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
