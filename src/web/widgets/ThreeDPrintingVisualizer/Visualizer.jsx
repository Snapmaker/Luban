import React, { PureComponent } from 'react';
import path from 'path';
import pubsub from 'pubsub-js';
import * as THREE from 'three';
import 'imports-loader?THREE=three!three/examples/js/loaders/STLLoader';
import 'imports-loader?THREE=three!three/examples/js/loaders/OBJLoader';
import jQuery from 'jquery';
import api from '../../api';
import Canvas from './Canvas';
import VisualizerTopLeft from './VisualizerTopLeft';
import VisualizerModelOperations from './VisualizerModelOperations';
import VisualizerCameraOperations from './VisualizerCameraOperations';
import VisualizerPreviewControl from './VisualizerPreviewControl';
import VisualizerInfo from './VisualizerInfo';
import styles from './styles.styl';
import Print3dGcodeLoader from './Print3dGcodeLoader';
import STLExporter from './STLExporter';

import {
    STAGE_IDLE,
    STAGE_IMAGE_LOADED,
    STAGE_GENERATED,
    ACTION_CHANGE_STAGE_3DP,
    ACTION_REQ_GENERATE_GCODE_3DP,
    ACTION_REQ_LOAD_GCODE_3DP,
    ACTION_REQ_EXPORT_GCODE_3DP,
    WEB_CACHE_IMAGE,
    ACTION_3DP_MODEL_OVERSTEP_CHANGE,
    ACTION_3DP_GCODE_OVERSTEP_CHANGE
} from '../../constants';
import controller from '../../lib/controller';
import VisualizerProgressBar from './VisualizerProgressBar';


class Visualizer extends PureComponent {
    modelMeshMaterialNormal = new THREE.MeshPhongMaterial({ color: 0xe0e0e0, specular: 0xe0e0e0, shininess: 30 });
    modelMeshMaterialOversteped = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    modelMeshOversteped = false;

    print3dGcodeLoader = new Print3dGcodeLoader();

    state = {
        stage: STAGE_IDLE,

        modelMesh: undefined,
        modelFileName: undefined,
        modelSizeX: 0,
        modelSizeY: 0,
        modelSizeZ: 0,

        undoMatrix4Array: [],
        redoMatrix4Array: [],

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
        gcodeRenderedObject: undefined,
        layerCount: 0,
        layerAmountVisible: 0,
        // visibility
        isModelMeshVisible: false,
        isGcodeRenderedObjectVisible: false,

        // progress bar
        progress: 0,

        _: 0 // placeholder
    };

    actions = {
        // topLeft
        onChangeFile: (event) => {
            const files = event.target.files;
            const formData = new FormData();
            formData.append('file', files[0]);

            api.uploadFile(formData).then((res) => {
                const file = res.body;
                this.setState({
                    modelFileName: file.filename
                });
                let modelFilePath = `${WEB_CACHE_IMAGE}/${this.state.modelFileName}`;
                this.parseModel(modelFilePath);
            });
        },
        onUndo: () => {
            this.destroyGcodeRenderedObject();
            if (this.state.modelMesh) {
                this.state.modelMesh.visible = true;
            }
            this.state.redoMatrix4Array.push(this.state.undoMatrix4Array.pop());
            const matrix4 = this.state.undoMatrix4Array[this.state.undoMatrix4Array.length - 1];
            this.applyMatrixToModelMesh(matrix4);
            this.computeModelMeshSizeAndMoveToBottom(() => {
                this.checkModelMeshBoundary();
            });
            this.updateModelMeshOperateState();
        },
        onRedo: () => {
            this.destroyGcodeRenderedObject();
            if (this.state.modelMesh) {
                this.state.modelMesh.visible = true;
            }
            this.state.undoMatrix4Array.push(this.state.redoMatrix4Array.pop());
            const matrix4 = this.state.undoMatrix4Array[this.state.undoMatrix4Array.length - 1];
            this.applyMatrixToModelMesh(matrix4);
            this.computeModelMeshSizeAndMoveToBottom(() => {
                this.checkModelMeshBoundary();
            });
            this.updateModelMeshOperateState();
        },
        onReset: () => {
            this.destroyGcodeRenderedObject();
            if (this.state.modelMesh) {
                this.state.modelMesh.visible = true;
            }
            this.state.undoMatrix4Array.splice(1, this.state.undoMatrix4Array.length - 1);
            this.state.redoMatrix4Array = [];
            this.applyMatrixToModelMesh(this.state.undoMatrix4Array[0]);
            this.computeModelMeshSizeAndMoveToBottom(() => {
                this.checkModelMeshBoundary();
            });
            this.updateModelMeshOperateState();
        },

        // model operations
        onChangeMx: (value) => {
            this.destroyGcodeRenderedObject();
            if (this.state.modelMesh) {
                this.state.modelMesh.visible = true;
                this.state.modelMesh.position.x = value;
                this.setState({
                    moveX: value
                });
                this.checkModelMeshBoundary();
            }
        },
        onAfterChangeMx: (value) => {
            this.destroyGcodeRenderedObject();
            if (this.state.modelMesh) {
                this.state.modelMesh.visible = true;
                this.state.modelMesh.position.x = value;
                this.setState({
                    moveX: value
                });
                this.computeModelMeshSizeAndMoveToBottom();
                this.recordModdlMeshMatrix();
                this.checkModelMeshBoundary();
            }
        },
        onChangeMy: (value) => {
            this.destroyGcodeRenderedObject();
            if (this.state.modelMesh) {
                this.state.modelMesh.visible = true;
                this.state.modelMesh.position.y = value;
                this.setState({
                    moveY: value
                });
                this.checkModelMeshBoundary();
            }
        },
        onAfterChangeMy: (value) => {
            this.destroyGcodeRenderedObject();
            if (this.state.modelMesh) {
                this.state.modelMesh.visible = true;
                this.state.modelMesh.position.y = value;
                this.setState({
                    moveY: value
                });
                this.computeModelMeshSizeAndMoveToBottom();
                this.recordModdlMeshMatrix();
                this.checkModelMeshBoundary();
            }
        },
        onChangeMz: (value) => {
            this.destroyGcodeRenderedObject();
            if (this.state.modelMesh) {
                this.state.modelMesh.visible = true;
                this.state.modelMesh.position.z = value;
                this.setState({
                    moveZ: value
                });
                this.checkModelMeshBoundary();
            }
        },
        onAfterChangeMz: (value) => {
            this.destroyGcodeRenderedObject();
            if (this.state.modelMesh) {
                this.state.modelMesh.visible = true;
                this.state.modelMesh.position.z = value;
                this.setState({
                    moveZ: value
                });
                this.computeModelMeshSizeAndMoveToBottom();
                this.recordModdlMeshMatrix();
                this.checkModelMeshBoundary();
            }
        },
        onChangeS: (value) => {
            this.destroyGcodeRenderedObject();
            if (this.state.modelMesh) {
                this.state.modelMesh.visible = true;
                this.state.modelMesh.scale.set(value, value, value);
                this.setState({
                    scale: value
                });
                // TODO: update size -> (origin size) x this.state.scale
            }
        },
        onAfterChangeS: (value) => {
            this.destroyGcodeRenderedObject();
            if (this.state.modelMesh) {
                this.state.modelMesh.visible = true;
                this.state.modelMesh.scale.set(value, value, value);
                this.setState({
                    scale: value
                });
                this.computeModelMeshSizeAndMoveToBottom(() => {
                    this.checkModelMeshBoundary();
                });
                this.recordModdlMeshMatrix();
            }
        },
        onChangeRx: (value) => {
            this.destroyGcodeRenderedObject();
            if (this.state.modelMesh) {
                this.state.modelMesh.visible = true;
                if (this.state.rotateX !== value) {
                    this.state.modelMesh.rotation.x = Math.PI * value / 180;
                    this.setState({
                        rotateX: value
                    });
                }
            }
        },
        onAfterChangeRx: (value) => {
            this.destroyGcodeRenderedObject();
            if (this.state.modelMesh) {
                this.state.modelMesh.visible = true;
                this.state.modelMesh.rotation.x = Math.PI * value / 180;
                this.setState({
                    rotateX: value
                });
                this.computeModelMeshSizeAndMoveToBottom(() => {
                    this.checkModelMeshBoundary();
                });
                this.recordModdlMeshMatrix();
            }
        },
        onChangeRy: (value) => {
            this.destroyGcodeRenderedObject();
            if (this.state.modelMesh) {
                this.state.modelMesh.visible = true;
                if (this.state.rotateY !== value) {
                    this.state.modelMesh.rotation.y = Math.PI * value / 180;
                    this.setState({
                        rotateY: value
                    });
                }
            }
        },
        onAfterChangeRy: (value) => {
            this.destroyGcodeRenderedObject();
            if (this.state.modelMesh) {
                this.state.modelMesh.visible = true;
                this.state.modelMesh.rotation.y = Math.PI * value / 180;
                this.setState({
                    rotateY: value
                });
                this.computeModelMeshSizeAndMoveToBottom(() => {
                    this.checkModelMeshBoundary();
                });
                this.recordModdlMeshMatrix();
            }
        },
        onChangeRz: (value) => {
            this.destroyGcodeRenderedObject();
            if (this.state.modelMesh) {
                this.state.modelMesh.visible = true;
                if (this.state.rotateZ !== value) {
                    this.state.modelMesh.rotation.z = Math.PI * value / 180;
                    this.setState({
                        rotateZ: value
                    });
                }
            }
        },
        onAfterChangeRz: (value) => {
            this.destroyGcodeRenderedObject();
            if (this.state.modelMesh) {
                this.state.modelMesh.visible = true;
                this.state.modelMesh.rotation.z = Math.PI * value / 180;
                this.setState({
                    rotateZ: value
                });
                this.computeModelMeshSizeAndMoveToBottom(() => {
                    this.checkModelMeshBoundary();
                });
                this.recordModdlMeshMatrix();
            }
        },

        // preview
        previewShow: (type) => {
            this.print3dGcodeLoader.showType(type);
        },
        previewHide: (type) => {
            this.print3dGcodeLoader.hideType(type);
        },
        onChangeShowLayer: (value) => {
            // reach layerCount, hide
            value = (value === this.state.layerCount) ? 0 : value;
            this.setState({
                layerAmountVisible: value
            });
            this.print3dGcodeLoader.showLayers(value);
        }
    };

    subscriptions = [];

    controllerEvents = {
        'print3D:gcode-generated': (args) => {
            this.setState({
                gcodeFileName: args.gcodeFileName,
                gcodePath: `${WEB_CACHE_IMAGE}/${args.gcodeFileName}`,
                printTime: args.printTime,
                filamentLength: args.filamentLength,
                filamentWeight: args.filamentWeight
            });
            if (this.state.modelMesh) {
                this.state.modelMesh.visible = false;
            }
            this.renderGcode(this.state.gcodePath);
        },
        'print3D:gcode-slice-progress': (sliceProgress) => {
            this.setState({
                progress: 100.0 * sliceProgress
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

    onLoadModelSucceed = (bufferGemotry) => {
        // 1.preprocess Gemotry
        // step-1: rotate x 90 degree
        bufferGemotry.rotateX(-Math.PI / 2);

        // step-2: set bufferGemotry to symmetry
        bufferGemotry.computeBoundingBox();
        let x = -(bufferGemotry.boundingBox.max.x + bufferGemotry.boundingBox.min.x) / 2;
        let y = -(bufferGemotry.boundingBox.max.y + bufferGemotry.boundingBox.min.y) / 2;
        let z = -(bufferGemotry.boundingBox.max.z + bufferGemotry.boundingBox.min.z) / 2;
        bufferGemotry.translate(x, y, z);
        bufferGemotry.computeBoundingBox();

        // 2.new modelMesh
        this.state.modelMesh = new THREE.Mesh(bufferGemotry, this.modelMeshMaterialNormal);
        this.state.modelMesh.position.set(0, 0, 0);
        this.state.modelMesh.scale.set(1, 1, 1);
        this.state.modelMesh.castShadow = true;
        this.state.modelMesh.receiveShadow = true;
        this.state.modelMesh.name = 'modelMesh';

        this.computeModelMeshSizeAndMoveToBottom(() => {
            this.checkModelMeshBoundary();
        });
        this.state.modelMesh.updateMatrix();

        this.state.undoMatrix4Array.push(this.state.modelMesh.matrix.clone());
        this.state.redoMatrix4Array = [];

        this.updateModelMeshOperateState();

        this.destroyGcodeRenderedObject();

        this.setState({ stage: STAGE_IMAGE_LOADED });
        pubsub.publish(ACTION_CHANGE_STAGE_3DP, { stage: STAGE_IMAGE_LOADED });
    };
    onLoadModelProgress = (event) => {
        let progress = event.loaded / event.total;
        this.setState({
            progress: progress * 100
        });
    };
    onLoadModelError = (event) => {
        this.setState({
            progress: 0
        });
    };
    parseStl(modelPath) {
        let loader = new THREE.STLLoader();
        loader.load(
            modelPath,
            (geometry) => {
                this.onLoadModelSucceed(geometry);
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
        let loader = new THREE.OBJLoader();
        loader.load(
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
                this.onLoadModelSucceed(geometry);
            },
            (event) => {
                this.onLoadModelProgress(event);
            },
            (event) => {
                this.onLoadModelError(event);
            }
        );
    }
    computeModelMeshSizeAndMoveToBottom = (callback) => {
        if (!this.state.modelMesh) {
            return;
        }
        // after modelMesh operated(move/scale/rotate), but modelMesh.geometry is not changed
        // so need to call: bufferGemotry.applyMatrix(matrixLocal);
        // then call: bufferGemotry.computeBoundingBox(); to get operated modelMesh BoundingBox
        this.state.modelMesh.updateMatrix();
        let matrixLocal = this.state.modelMesh.matrix;

        // must use deepCopy, if not, modelMesh will be changed by matrix
        let bufferGemotry = this.state.modelMesh.geometry.clone();

        // Bakes matrix transform directly into vertex coordinates.
        bufferGemotry.applyMatrix(matrixLocal);
        bufferGemotry.computeBoundingBox();
        this.setState({
            modelSizeX: bufferGemotry.boundingBox.max.x - bufferGemotry.boundingBox.min.x,
            modelSizeY: bufferGemotry.boundingBox.max.y - bufferGemotry.boundingBox.min.y,
            modelSizeZ: bufferGemotry.boundingBox.max.z - bufferGemotry.boundingBox.min.z
        }, () => {
            if (typeof callback === 'function') {
                callback();
            }
        });

        // move to bottom
        this.state.modelMesh.position.y += (-bufferGemotry.boundingBox.min.y);
    }
    recordModdlMeshMatrix = () => {
        if (this.state.modelMesh) {
            this.state.modelMesh.updateMatrix();
            if (!this.state.modelMesh.matrix.equals(this.state.undoMatrix4Array[this.state.undoMatrix4Array.length - 1])) {
                this.state.undoMatrix4Array.push(this.state.modelMesh.matrix.clone());
                this.state.redoMatrix4Array = [];
            }
        }
    }
    applyMatrixToModelMesh = (matrix4) => {
        // decompose Matrix and apply to modelMesh
        // do not use Object3D.applyMatrix(matrix : Matrix4)
        // because applyMatrix is cccumulated
        let position = new THREE.Vector3();
        let quaternion = new THREE.Quaternion();
        let scale = new THREE.Vector3();
        matrix4.decompose(position, quaternion, scale);
        this.state.modelMesh.position.set(position.x, position.y, position.z);
        this.state.modelMesh.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
        this.state.modelMesh.scale.set(scale.x, scale.y, scale.z);
    }
    updateModelMeshOperateState = () => {
        this.setState({
            moveX: this.state.modelMesh.position.x,
            moveY: this.state.modelMesh.position.y,
            moveZ: this.state.modelMesh.position.z,
            scale: this.state.modelMesh.scale.x,
            rotateX: this.state.modelMesh.rotation.x * 180 / Math.PI,
            rotateY: this.state.modelMesh.rotation.y * 180 / Math.PI,
            rotateZ: this.state.modelMesh.rotation.z * 180 / Math.PI
        });
    };

    slice = (configFilePath) => {
        // 1.save to stl
        const exporter = new STLExporter();
        const output = exporter.parse(this.state.modelMesh);
        const blob = new Blob([output], { type: 'text/plain' });
        const fileOfBlob = new File([blob], this.state.modelFileName);
        const formData = new FormData();
        formData.append('file', fileOfBlob);
        api.uploadFile(formData).then((res) => {
            const file = res.body;
            this.setState({
                modelFileName: `${file.filename}`,
                modelUploadResult: 'ok'
            });
            // 2.slice
            // let configFilePath = `${WEB_CURA_CONFIG_DIR}/${'fast_print.def.json'}`;
            let param = {
                modelFileName: this.state.modelFileName,
                configFilePath: configFilePath
            };
            controller.print3DSlice(param);
        });
    }

    // todo : render gcode must not be in UI thread
    renderGcode(gcodePath) {
        this.print3dGcodeLoader.load(
            gcodePath,
            (object) => {
                object.name = 'gcodeRenderedObject';
                this.setState({
                    layerCount: this.print3dGcodeLoader.layerCount,
                    layerAmountVisible: this.print3dGcodeLoader.layerCount
                });
                this.print3dGcodeLoader.showLayers(this.state.layerAmountVisible);

                this.setState({
                    stage: STAGE_GENERATED,
                    gcodeRenderedObject: object
                });
                pubsub.publish(ACTION_CHANGE_STAGE_3DP, { stage: STAGE_GENERATED });
                this.checkGcodeBoundary(
                    this.print3dGcodeLoader.minX,
                    this.print3dGcodeLoader.minY,
                    this.print3dGcodeLoader.minZ,
                    this.print3dGcodeLoader.maxX,
                    this.print3dGcodeLoader.maxY,
                    this.print3dGcodeLoader.maxZ
                );
            },
            (event) => {
                // let progress = event.loaded / event.total;
                // console.log('parse gcode progress:' + progress);
            },
            (event) => {}
        );
    }

    destroyGcodeRenderedObject() {
        if (this.state.gcodeRenderedObject) {
            this.state.gcodeRenderedObject.visible = false;
            this.state.gcodeRenderedObject = undefined;
        }
    }

    //must call after computeModelMeshSizeAndMoveToBottom()
    //and must call in callback of setState in computeModelMeshSizeAndMoveToBottom(),
    //so get the real time value of this.state.modelSize
    checkModelMeshBoundary() {
        if (this.state.modelMesh) {
            const boundaryLength = 125 / 2;
            //width
            const minWidth = this.state.modelMesh.position.x - this.state.modelSizeX / 2;
            const maxWidth = this.state.modelMesh.position.x + this.state.modelSizeX / 2;
            //height
            //model mesh always cling to bottom
            const maxHeight = this.state.modelSizeY;
            //depth
            const minDepth = this.state.modelMesh.position.z - this.state.modelSizeZ / 2;
            const maxDepth = this.state.modelMesh.position.z + this.state.modelSizeZ / 2;
            //todo: change material of print cube side
            const widthOverstepped = (minWidth < -boundaryLength || maxWidth > boundaryLength);
            const heightOverstepped = (maxHeight > boundaryLength * 2);
            const depthOverstepped = (minDepth < -boundaryLength || maxDepth > boundaryLength);
            const overstepped = widthOverstepped || heightOverstepped || depthOverstepped;
            if (overstepped !== this.modelMeshOversteped) {
                this.modelMeshOversteped = overstepped;
                pubsub.publish(ACTION_3DP_MODEL_OVERSTEP_CHANGE, { overstepped: overstepped });
                this.state.modelMesh.material = overstepped ? this.modelMeshMaterialOversteped : this.modelMeshMaterialNormal;
            }
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
                    <VisualizerProgressBar progress={state.progress} />
                </div>

                <div className={styles.canvas}>
                    <Canvas state={state} />
                </div>
            </React.Fragment>
        );
    }
}

export default Visualizer;
