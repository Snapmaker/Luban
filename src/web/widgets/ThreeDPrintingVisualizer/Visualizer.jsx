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
import styles from './styles.styl';
import { ACTION_3DP_MODEL_MESH_PARSED, WEB_CACHE_IMAGE } from '../../constants';

class Visualizer extends PureComponent {
    modelMeshMaterial = new THREE.MeshPhongMaterial({ color: 0xe0e0e0, specular: 0xe0e0e0, shininess: 30 });

    state = {
        gcodeRenderedObject: undefined,

        modelGroup: undefined,
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

        _: 0 // placeholder
    };

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
            this.updateModelMeshOperateState();
        },
        onRedo: () => {
            this.state.undoMatrix4Array.push(this.state.redoMatrix4Array.pop());
            var matrix4 = this.state.undoMatrix4Array[this.state.undoMatrix4Array.length - 1];
            this.applyMatrixToModelMesh(matrix4);
            this.updateModelMeshOperateState();
        },
        onReset: () => {
            this.state.undoMatrix4Array.splice(1, this.state.undoMatrix4Array.length - 1);
            this.state.redoMatrix4Array = [];
            this.applyMatrixToModelMesh(this.state.undoMatrix4Array[0]);
            this.updateModelMeshOperateState();
        },

        // model operations
        onChangeMx: (value) => {
            if (this.state.modelMesh) {
                this.state.modelMesh.position.x = value;
                this.setState({
                    moveX: value
                });
            }
        },
        onAfterChangeMx: (value) => {
            if (this.state.modelMesh) {
                this.state.modelMesh.position.x = value;
                this.setState({
                    moveX: value
                });
                this.computeModelMeshSizeAndMoveToBottom();
                this.recordModdlMeshMatrix();
            }
        },
        onChangeMy: (value) => {
            if (this.state.modelMesh) {
                this.state.modelMesh.position.y = value;
                this.setState({
                    moveY: value
                });
            }
        },
        onAfterChangeMy: (value) => {
            if (this.state.modelMesh) {
                this.state.modelMesh.position.y = value;
                this.setState({
                    moveY: value
                });
                this.computeModelMeshSizeAndMoveToBottom();
                this.recordModdlMeshMatrix();
            }
        },
        onChangeMz: (value) => {
            if (this.state.modelMesh) {
                this.state.modelMesh.position.z = value;
                this.setState({
                    moveZ: value
                });
            }
        },
        onAfterChangeMz: (value) => {
            if (this.state.modelMesh) {
                this.state.modelMesh.position.z = value;
                this.setState({
                    moveZ: value
                });
                this.computeModelMeshSizeAndMoveToBottom();
                this.recordModdlMeshMatrix();
            }
        },
        onChangeS: (value) => {
            if (this.state.modelMesh) {
                this.state.modelMesh.scale.set(value, value, value);
                this.setState({
                    scale: value
                });
                //todo: update size -> (origin size) x this.state.scale
            }
        },
        onAfterChangeS: (value) => {
            if (this.state.modelMesh) {
                this.state.modelMesh.scale.set(value, value, value);
                this.setState({
                    scale: value
                });
                this.computeModelMeshSizeAndMoveToBottom();
                this.recordModdlMeshMatrix();
            }
        },
        onAfterChangeRx: (value) => {
            if (this.state.modelMesh) {
                this.state.modelMesh.rotation.x = -Math.PI * value / 180;
                this.setState({
                    rotateX: value
                });
                this.computeModelMeshSizeAndMoveToBottom();
                this.recordModdlMeshMatrix();
            }
        },
        onAfterChangeRy: (value) => {
            if (this.state.modelMesh) {
                this.state.modelMesh.rotation.z = -Math.PI * value / 180;
                this.setState({
                    rotateY: value
                });
                this.computeModelMeshSizeAndMoveToBottom();
                this.recordModdlMeshMatrix();
            }
        },
        onAfterChangeRz: (value) => {
            if (this.state.modelMesh) {
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
        },
        previewHide: (type) => {
            console.info(`preview hide ${type}`);
        }
    };

    subscriptions = [];

    componentDidMount() {
        this.subscriptions = [];
    }

    componentWillUnmount() {
        this.subscriptions.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        this.subscriptions = [];
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
                    <VisualizerCameraOperations actions={actions} />
                </div>

                <div className={styles['visualizer-preview-control']}>
                    <VisualizerPreviewControl actions={actions} state={state} />
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

        this.state.gcodeRenderedObject = undefined;
        this.state.undoMatrix4Array.push(this.state.modelMesh.matrix.clone());
        this.state.redoMatrix4Array = [];

        this.updateModelMeshOperateState();
        // //3.set state
        // this.setState({
        //     gcodeRenderedObject: undefined,
        //     // top left
        //     undoMatrix4Array: [this.state.modelMesh.matrix.clone()],
        //     redoMatrix4Array: [],
        //     // model operations
        //     moveX: 0,
        //     moveY: 0,
        //     moveZ: 0,
        //     scale: 1,
        //     rotateX: 0,
        //     rotateY: 0,
        //     rotateZ: 0
        // });

        pubsub.publish(ACTION_3DP_MODEL_MESH_PARSED);
    }
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
    }
    computeModelMeshSizeAndMoveToBottom = () => {
        if (!this.state.modelMesh) {
            return;
        }
        this.state.modelMesh.updateMatrix();
        let matrixLocal = this.state.modelMesh.matrix;
        //must use deepCopy
        let bufferGemotry = this.state.modelMesh.geometry.clone();
        bufferGemotry.computeBoundingBox();

        //Bakes matrix transform directly into vertex coordinates.
        bufferGemotry.applyMatrix(matrixLocal);
        bufferGemotry.computeBoundingBox();
        this.setState({
            modelSizeX: (bufferGemotry.boundingBox.max.x - bufferGemotry.boundingBox.min.x).toFixed(1),
            modelSizeY: (bufferGemotry.boundingBox.max.y - bufferGemotry.boundingBox.min.y).toFixed(1),
            modelSizeZ: (bufferGemotry.boundingBox.max.z - bufferGemotry.boundingBox.min.z).toFixed(1),
            minX: bufferGemotry.boundingBox.min.x,
            maxX: bufferGemotry.boundingBox.max.x,
            minY: bufferGemotry.boundingBox.min.y,
            maxY: bufferGemotry.boundingBox.max.y,
            minZ: bufferGemotry.boundingBox.min.z,
            maxZ: bufferGemotry.boundingBox.max.z
        });

        // bufferGemotry.computeBoundingBox();
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

        // let x = position.x;
        // let y = position.y;
        // let z = position.z;
        // //set ui
        // this.setState({
        //     moveX: x,
        //     moveY: y,
        //     moveZ: z,
        //     scale: this.state.modelMesh.scale.x,
        //     rotateX: this.state.modelMesh.rotation.x * 180 / Math.PI,
        //     rotateY: this.state.modelMesh.rotation.y * 180 / Math.PI,
        //     rotateZ: this.state.modelMesh.rotation.z * 180 / Math.PI
        // });
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
}

export default Visualizer;
