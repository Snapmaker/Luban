import React, { PureComponent } from 'react';
import path from 'path';
import pubsub from 'pubsub-js';
import * as THREE from 'three';
import api from '../../api';
import Canvas from './Canvas';
import VisualizerTopLeft from './VisualizerTopLeft';
import VisualizerModelOperations from './VisualizerModelOperations';
import VisualizerCameraOperations from './VisualizerCameraOperations';
import VisualizerPreviewControl from './VisualizerPreviewControl';
import VisualizerInfo from './VisualizerInfo';
import styles from './styles.styl';
import { ACTION_3DP_GCODE_RENDERED, ACTION_3DP_MODEL_MESH_PARSED, WEB_CACHE_IMAGE, WEB_CURA_CONFIG_DIR } from '../../constants';
import controller from '../../lib/controller';

class Visualizer extends PureComponent {
    modelMeshMaterial = new THREE.MeshPhongMaterial({ color: 0xe0e0e0, specular: 0xe0e0e0, shininess: 30 });
    print3dGcodeLoader = new THREE.Print3dGcodeLoader();

    state = {
        stage: 0,

        modelMesh: undefined,
        modelFileName: undefined,

        undoMatrix4Array: [],
        redoMatrix4Array: [],

        //model operations
        moveX: 0,
        moveY: 0,
        moveZ: 0,
        scale: 1,
        rotateX: 0,
        rotateY: 0,
        rotateZ: 0,

        _: 0, // placeholder

        //slice
        printTime: undefined,
        filamentLength: undefined,
        filamentWeight: undefined,

        //model size
        modelSizeX: undefined,
        modelSizeY: undefined,
        modelSizeZ: undefined,
        //gcode
        gcodeRenderedObject: undefined,
        layerCount: 0,
        layerAmountVisible: 0,
        //visibity
        isModelMeshVisible: false,
        isGcodeRenderedObjectVisible: false
    };
    destroyGcodeRenderedObject = () => {
        if (this.state.gcodeRenderedObject) {
            this.state.gcodeRenderedObject.visible = false;
            this.state.gcodeRenderedObject = undefined;
        }
    }
    actions = {
        //topLeft
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
            this.state.redoMatrix4Array.push(this.state.undoMatrix4Array.pop());
            var matrix4 = this.state.undoMatrix4Array[this.state.undoMatrix4Array.length - 1];
            this.applyMatrixToModelMesh(matrix4);
            this.computeModelMeshSizeAndMoveToBottom();
            this.updateModelMeshOperateState();
        },
        onRedo: () => {
            // this.state.undoMatrix4Array.push(this.state.redoMatrix4Array.pop());
            // var matrix4 = this.state.undoMatrix4Array[this.state.undoMatrix4Array.length - 1];
            // this.applyMatrixToModelMesh(matrix4);
            // this.computeModelMeshSizeAndMoveToBottom();
            // this.updateModelMeshOperateState();
            this.slice();
        },
        onReset: () => {
            this.state.undoMatrix4Array.splice(1, this.state.undoMatrix4Array.length - 1);
            this.state.redoMatrix4Array = [];
            this.applyMatrixToModelMesh(this.state.undoMatrix4Array[0]);
            this.computeModelMeshSizeAndMoveToBottom();
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
                //todo: update size -> (origin size) x this.state.scale
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
                this.computeModelMeshSizeAndMoveToBottom();
                this.recordModdlMeshMatrix();
            }
        },
        onAfterChangeRx: (value) => {
            this.destroyGcodeRenderedObject();
            if (this.state.modelMesh) {
                this.state.modelMesh.visible = true;
                this.state.modelMesh.rotation.x = -Math.PI * value / 180;
                this.setState({
                    rotateX: value
                });
                this.computeModelMeshSizeAndMoveToBottom();
                this.recordModdlMeshMatrix();
            }
        },
        onAfterChangeRy: (value) => {
            this.destroyGcodeRenderedObject();
            if (this.state.modelMesh) {
                this.state.modelMesh.visible = true;
                this.state.modelMesh.rotation.z = -Math.PI * value / 180;
                this.setState({
                    rotateY: value
                });
                this.computeModelMeshSizeAndMoveToBottom();
                this.recordModdlMeshMatrix();
            }
        },
        onAfterChangeRz: (value) => {
            this.destroyGcodeRenderedObject();
            if (this.state.modelMesh) {
                this.state.modelMesh.visible = true;
                this.state.modelMesh.rotation.y = Math.PI * value / 180;
                this.setState({
                    rotateZ: value
                });
                this.computeModelMeshSizeAndMoveToBottom();
                this.recordModdlMeshMatrix();
            }
        },

        // preview
        previewShow: (type) => {
            console.info(`preview show ${type}`);
            this.print3dGcodeLoader.showType(type);
        },
        previewHide: (type) => {
            console.info(`preview hide ${type}`);
            this.print3dGcodeLoader.hideType(type);
        },
        onChangeShowLayer: (value) => {
            console.log('show layer:' + value);
            this.setState({
                layerAmountVisible: value
            });
            this.print3dGcodeLoader.showLayers(this.state.layerAmountVisible);
        }
    };

    subscriptions = [];

    componentDidMount() {
        this.subscriptions = [];
        this.addControllerEvents();
    }

    componentWillUnmount() {
        this.subscriptions.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        this.subscriptions = [];
        this.removeControllerEvents();
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

                <div className={styles['visualizer-preview-control']} style={{ display: (this.state.gcodeRenderedObject) ? 'block' : 'none' }}>
                    <VisualizerPreviewControl actions={actions} state={state} />
                </div>

                <div className={styles['visualizer-info']}>
                    <VisualizerInfo state={state} />
                </div>

                <div className={styles.canvas}>
                    <Canvas state={state} />
                </div>
            </React.Fragment>
        );
    }

    //************* model ************
    parseModel = (modelPath) => {
        if (path.extname(modelPath).toString().toLowerCase() === '.stl') {
            this.parseStl(modelPath);
        } else if (path.extname(modelPath).toString().toLowerCase() === '.obj') {
            this.parseObj(modelPath);
        }
    }
    onLoadModelSucceed = (bufferGemotry) => {
        //1.preprocess Gemotry
        //step-1: rotate x 90 degree
        bufferGemotry.rotateX(-Math.PI / 2);

        //step-2: set bufferGemotry to symmetry
        bufferGemotry.computeBoundingBox();
        let x = -(bufferGemotry.boundingBox.max.x + bufferGemotry.boundingBox.min.x) / 2;
        let y = -(bufferGemotry.boundingBox.max.y + bufferGemotry.boundingBox.min.y) / 2;
        let z = -(bufferGemotry.boundingBox.max.z + bufferGemotry.boundingBox.min.z) / 2;
        bufferGemotry.translate(x, y, z);
        bufferGemotry.computeBoundingBox();

        //2.new modelMesh
        this.state.modelMesh = new THREE.Mesh(bufferGemotry, this.modelMeshMaterial);
        this.state.modelMesh.position.set(0, 0, 0);
        this.state.modelMesh.scale.set(1, 1, 1);
        this.state.modelMesh.castShadow = true;
        this.state.modelMesh.receiveShadow = true;
        this.state.modelMesh.name = 'modelMesh';

        this.computeModelMeshSizeAndMoveToBottom();
        this.state.modelMesh.updateMatrix();

        this.state.undoMatrix4Array.push(this.state.modelMesh.matrix.clone());
        this.state.redoMatrix4Array = [];

        this.updateModelMeshOperateState();

        this.destroyGcodeRenderedObject();
        pubsub.publish(ACTION_3DP_MODEL_MESH_PARSED);
    };
    onLoadModelProgress = (event) => {
        let progress = event.loaded / event.total;
        this.setState({
            modelParseProgress: progress
        });
    }
    onLoadModelError = (event) => {
        this.setState({
            modelParseProgress: -1,
            modelParseResult: 'error'
        });
    }
    parseStl = (modelPath) => {
        console.log('parseStl:' + modelPath);
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
    parseObj = (modelPath) => {
        console.log('parseObj:' + modelPath);
        let loader = new THREE.OBJLoader();
        loader.load(
            modelPath,
            //return container. container has several meshs(a mesh is one of line/mesh/point). mesh uses BufferGeometry
            (container) => {
                //there is a problem when merge two BufferGeometries :
                //https://stackoverflow.com/questions/36450612/how-to-merge-two-buffergeometries-in-one-buffergeometry-in-three-js
                //so use Geometry to merge
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

                //BufferGeometry is an efficient alternative to Geometry
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
    };
    computeModelMeshSizeAndMoveToBottom = () => {
        if (!this.state.modelMesh) {
            return;
        }
        //after modelMesh operated(move/scale/rotate), but modelMesh.geometry is not changed
        //so need to call: bufferGemotry.applyMatrix(matrixLocal);
        //then call: bufferGemotry.computeBoundingBox(); to get operated modelMesh BoundingBox
        this.state.modelMesh.updateMatrix();
        let matrixLocal = this.state.modelMesh.matrix;

        //must use deepCopy, if not, modelMesh will be changed by matrix
        let bufferGemotry = this.state.modelMesh.geometry.clone();

        //Bakes matrix transform directly into vertex coordinates.
        bufferGemotry.applyMatrix(matrixLocal);
        bufferGemotry.computeBoundingBox();
        this.setState({
            modelSizeX: bufferGemotry.boundingBox.max.x - bufferGemotry.boundingBox.min.x,
            modelSizeY: bufferGemotry.boundingBox.max.y - bufferGemotry.boundingBox.min.y,
            modelSizeZ: bufferGemotry.boundingBox.max.z - bufferGemotry.boundingBox.min.z,
            minX: bufferGemotry.boundingBox.min.x,
            maxX: bufferGemotry.boundingBox.max.x,
            minY: bufferGemotry.boundingBox.min.y,
            maxY: bufferGemotry.boundingBox.max.y,
            minZ: bufferGemotry.boundingBox.min.z,
            maxZ: bufferGemotry.boundingBox.max.z
        });

        //move to bottom
        this.state.modelMesh.position.y += (-bufferGemotry.boundingBox.min.y);
    }
    recordModdlMeshMatrix = () => {
        if (this.state.modelMesh) {
            this.state.modelMesh.updateMatrix();
            if (this.state.modelMesh.matrix.equals(this.state.undoMatrix4Array[this.state.undoMatrix4Array.length - 1])) {
                console.log('Matrix is no diff');
            } else {
                this.state.undoMatrix4Array.push(this.state.modelMesh.matrix.clone());
                this.state.redoMatrix4Array = [];
            }
        }
    }
    applyMatrixToModelMesh = (matrix4) => {
        //decompose Matrix and apply to modelMesh
        //do not use Object3D.applyMatrix(matrix : Matrix4)
        //because applyMatrix is cccumulated
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
    }
    //************* slice ************
    slice = () => {
        //1.save to stl
        console.log('save to stl');
        var exporter = new THREE.STLExporter();
        var output = exporter.parse(this.state.modelMesh);
        var blob = new Blob([output], { type: 'text/plain' });
        var fileOfBlob = new File([blob], this.state.modelFileName);
        const formData = new FormData();
        formData.append('file', fileOfBlob);
        api.uploadFile(formData).then((res) => {
            const file = res.body;
            this.setState({
                modelFileName: `${file.filename}`,
                modelUploadResult: 'ok'
            });
            //2.slice
            let configFilePath = `${WEB_CURA_CONFIG_DIR}/${'fast_print.def.json'}`;
            console.log('start slice : modelFileName = ' + this.state.modelFileName + ' configFilePath = ' + configFilePath);
            let param = {
                modelFileName: this.state.modelFileName,
                configFilePath: configFilePath
            };
            controller.print3DSlice(param);
        });
    }
    controllerEvents = {
        'print3D:gcode-generated': (args) => {
            console.log('@ args:' + JSON.stringify(args));
            this.setState({
                sliceProgress: 1,
                gcodeFileName: args.gcodeFileName,
                gcodeFilePath: `${WEB_CACHE_IMAGE}/${args.gcodeFileName}`,
                printTime: args.printTime,
                filamentLength: args.filamentLength,
                filamentWeight: args.filamentWeight,
                sliceResult: 'ok'
            });
            if (this.state.modelMesh) {
                this.state.modelMesh.visible = false;
            }
            this.renderGcode(this.state.gcodeFilePath);
        },
        'print3D:gcode-slice-progress': (sliceProgress) => {
            console.log('sliceProgress:' + sliceProgress);
            this.setState({
                sliceProgress: sliceProgress
            });
        }
    };
    addControllerEvents = () => {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.on(eventName, callback);
        });
    }
    removeControllerEvents = () => {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.off(eventName, callback);
        });
    }
    //************* gcode ************
    //todo : render gcode must not be in UI thread
    renderGcode = (gcodePath) => {
        console.log('render gcode:' + gcodePath);
        this.print3dGcodeLoader.load(
            gcodePath,
            (object) => {
                this.state.gcodeRenderedObject = object;
                this.state.gcodeRenderedObject.name = 'gcodeRenderedObject';
                this.setState({
                    layerCount: this.print3dGcodeLoader.layerCount,
                    layerAmountVisible: this.print3dGcodeLoader.layerCount
                });
                console.log('layerCount:' + this.state.layerCount);
                console.log('Visible:' + this.state.layerAmountVisible);
                this.print3dGcodeLoader.showLayers(this.state.layerAmountVisible);
                pubsub.publish(ACTION_3DP_GCODE_RENDERED);
            },
            (event) => {
                let progress = event.loaded / event.total;
                console.log('parse gcode progress:' + progress);
            },
            (event) => {
                console.log('parse gcode error');
            }
        );
    }
}

export default Visualizer;
