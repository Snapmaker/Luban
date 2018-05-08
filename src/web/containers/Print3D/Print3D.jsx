import React, { Component } from 'react';
import path from 'path';
import Slider from 'rc-slider';
import * as THREE from 'three';
import 'imports-loader?THREE=three!three/examples/js/controls/TransformControls';
import 'imports-loader?THREE=three!three/examples/js/controls/DragControls';
// import 'imports-loader?THREE=three!three/examples/js/controls/OrbitControls';
import 'imports-loader?THREE=three!three/examples/js/loaders/STLLoader';
import 'imports-loader?THREE=three!three/examples/js/loaders/OBJLoader';
import 'imports-loader?THREE=three!./STLExporter';
import 'imports-loader?THREE=three!./Print3dGcodeLoader';
import 'imports-loader?THREE=three!./MSRControls';
import { withRouter } from 'react-router-dom';
import api from '../../api';
import {
    WEB_CACHE_IMAGE
} from '../../constants';

import controller from '../../lib/controller';
import Print3dConfigManager from './Print3dConfigManager';

var TWEEN = require('@tweenjs/tween.js');

class Print3D extends Component {
    fileInputEl = null;
    constructor(props) {
        super(props);
        this.state = {
            //model
            modelFileName: undefined,
            modelUploadResult: undefined,
            modelParseProgress: undefined,
            modelParseResult: undefined,
            //gcode
            gcodeFileName: undefined,
            gcodeFilePath: undefined,
            gcodeParseProgress: undefined,
            //slice
            sliceResult: undefined,
            sliceProgress: undefined,
            printTime: undefined,
            filamentLength: undefined,
            filamentWeight: undefined,
            //operate model
            moveX: 0,
            moveY: 0,
            moveZ: 0,
            scale: 0,
            rotateX: 0,
            rotateY: 0,
            rotateZ: 0,
            //model size
            modelSizeX: undefined,
            modelSizeY: undefined,
            modelSizeZ: undefined,
            //render layer
            layerCount: 0,
            layerAmountVisible: 0,
            minX: 0,
            minY: 0,
            minZ: 0,
            maxX: 0,
            maxY: 0,
            maxZ: 0,
            //config bean
            curConBean: undefined,
            forPrintConfigPath: undefined
        };
        this.start = this.start.bind(this);
        this.stop = this.stop.bind(this);
        this.animate = this.animate.bind(this);
        this.addControls = this.addControls.bind(this);
        this.renderScene = this.renderScene.bind(this);

        this.parseModel = this.parseModel.bind(this);
        this.parseStl = this.parseStl.bind(this);
        this.parseObj = this.parseObj.bind(this);

        this.addEmptyPrintSpaceToGroup = this.addEmptyPrintSpaceToGroup.bind(this);
        this.renderGcode = this.renderGcode.bind(this);

        this.clingModelToBottom = this.clingModelToBottom.bind(this);
        this.updateModelSizeAndClingToBottom = this.updateModelSizeAndClingToBottom.bind(this);

        this.onLoadModelError = this.onLoadModelError.bind(this);
        this.onLoadModelProgress = this.onLoadModelProgress.bind(this);
        this.onLoadModelSucceed = this.onLoadModelSucceed.bind(this);
        this.addBufferGemotryToModelGroup = this.addBufferGemotryToModelGroup.bind(this);
        this.addCubeToSceneAtZeroPoint = this.addCubeToSceneAtZeroPoint.bind(this);

        this.canExecuteUndo = this.canExecuteUndo.bind(this);
        this.canExecuteRedo = this.canExecuteRedo.bind(this);
        this.canExecuteReset = this.canExecuteReset.bind(this);
        this.operateCompleted = this.operateCompleted.bind(this);
        this.setOperateUI = this.setOperateUI.bind(this);
    }
    componentDidMount() {
        this.addControllerEvents();
        //about threejs
        const width = window.innerWidth / 2;
        const height = window.innerHeight - 64;
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
        this.camera.position.set(0, 0, 550);
        this.camera.lookAt(new THREE.Vector3(0, 0, 0));

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setClearColor(new THREE.Color(0xE8E8E8), 1.0);
        this.renderer.setSize(width, height);
        this.renderer.shadowMapEnabled = true;

        this.scene = new THREE.Scene();
        this.scene.add(this.camera);
        this.group = new THREE.Group();
        this.modelGroup = new THREE.Group();
        this.gcodeGroup = new THREE.Group();
        this.group.add(this.modelGroup);
        this.group.add(this.gcodeGroup);
        this.modelGroup.position.set(0, -125 / 2, 0);
        this.gcodeGroup.position.set(-125 / 2, -125 / 2, 125 / 2);
        this.scene.add(this.group);
        this.modelMaterial = new THREE.MeshPhongMaterial({ color: 0xe0e0e0, specular: 0xe0e0e0, shininess: 30 });
        this.scene.add(new THREE.HemisphereLight(0x000000, 0xe0e0e0));
        // this.scene.add(new THREE.AmbientLight('#ff0000'));
        this.modelMesh = undefined;
        this.gcodeRenderedObject = undefined;
        document.getElementById('WebGL-output').appendChild(this.renderer.domElement);
        this.start();

        this.addEmptyPrintSpaceToGroup();
        this.addCubeToSceneAtZeroPoint();
        this.print3dGcodeLoader = new THREE.Print3dGcodeLoader();
        this.msrControls = undefined;
        this.addControls();

        this.undoMatrix4Array = [];
        this.redoMatrix4Array = [];
        //config
        this.configManager = new Print3dConfigManager();
        this.configBeanArr = undefined;
    }
    start() {
        if (!this.frameId) {
            this.frameId = requestAnimationFrame(this.animate);
        }
    }
    stop() {
        cancelAnimationFrame(this.frameId);
    }
    animate() {
        this.renderScene();
        this.frameId = window.requestAnimationFrame(this.animate);
        TWEEN.update();
    }
    renderScene() {
        this.renderer.render(this.scene, this.camera);
    }
    addControls() {
        this.msrControls = new THREE.MSRControls(this.group, this.camera, this.renderer.domElement);
    }
    addEmptyPrintSpaceToGroup() {
        // add 6 sides(GridHelper) of print space
        let size = 125;
        let divisions = 1;

        let bottom = new THREE.GridHelper(size, divisions * 10);
        bottom.position.set(0, -size / 2, 0);
        bottom.material.opacity = 0.25;
        bottom.material.transparent = true;
        this.group.add(bottom);

        let top = new THREE.GridHelper(size, divisions);
        top.position.set(0, size / 2, 0);
        this.group.add(top);

        let left = new THREE.GridHelper(size, divisions);
        left.rotateZ(Math.PI / 2);
        left.position.set(-size / 2, 0, 0);
        this.group.add(left);

        let right = new THREE.GridHelper(size, divisions);
        right.rotateZ(Math.PI / 2);
        right.position.set(size / 2, 0, 0);
        this.group.add(right);

        let front = new THREE.GridHelper(size, divisions);
        front.rotateX(Math.PI / 2);
        front.position.set(0, 0, size / 2);
        this.group.add(front);

        let back = new THREE.GridHelper(size, divisions);
        back.rotateX(Math.PI / 2);
        back.position.set(0, 0, -size / 2);
        this.group.add(back);

        for (let k = 0; k < this.group.children.length; k += 1) {
            if (this.group.children[k] instanceof THREE.GridHelper) {
                this.group.children[k].material.opacity = 0.25;
                this.group.children[k].material.transparent = true;
            }
        }
        var axis = new THREE.AxesHelper(50);
        axis.position.set(0, 0, 0);
        this.group.add(axis);
    }
    addCubeToSceneAtZeroPoint() {
        var boxGeometry = new THREE.BoxGeometry(5, 5, 5);
        for (var i = 0; i < boxGeometry.faces.length; i += 2) {
            var hex = Math.random() * 0xffffff;
            boxGeometry.faces[i].color.setHex(hex);
            boxGeometry.faces[i + 1].color.setHex(hex);
        }
        var material = new THREE.MeshBasicMaterial({ vertexColors: THREE.FaceColors, overdraw: 0.5 });
        let mCube = new THREE.Mesh(boxGeometry, material);
        mCube.position.set(-125 / 2, -125 / 2, 125 / 2);
        mCube.name = 'mCube';
        this.scene.add(mCube);
    }

    //************* on click ************
    //model
    onClickUploadModel() {
        this.fileInputEl.value = null;
        this.fileInputEl.click();
    }
    onClickParseCurModel() {
        let modelFilePath = `${WEB_CACHE_IMAGE}/${this.state.modelFileName}`;
        this.parseModel(modelFilePath);
    }
    //slice
    onClickSliceCurModel() {
        if (this.state.curConBean) {
            console.log('start slice : modelFileName = ' + this.state.modelFileName + ' configFilePath = ' + this.state.forPrintConfigPath);
            this.slice(this.state.modelFileName, this.state.forPrintConfigPath);
        }
    }
    //gcode
    onClickRenderGcode() {
        console.log('gcode onClickRenderGcode:' + this.state.gcodeFilePath);
        this.renderGcode(this.state.gcodeFilePath);
    }
    //visiblity
    onClickShowGcode() {
        this.modelGroup.visible = false;
        this.gcodeGroup.visible = true;
    }
    onClickShowModel() {
        this.modelGroup.visible = true;
        this.gcodeGroup.visible = false;
    }
    onClickShowBoth() {
        this.modelGroup.visible = true;
        this.gcodeGroup.visible = true;
    }
    actions = {
        onChangeFile: (event) => {
            const files = event.target.files;
            const formData = new FormData();
            formData.append('file', files[0]);

            api.uploadFile(formData).then((res) => {
                const file = res.body;
                this.setState({
                    modelFileName: `${file.filename}`,
                    modelUploadResult: 'ok'
                });
            });
        }
    }
    //************* slice ************
    slice(modelFileName, configPath) {
        let param = {
            modelFileName: modelFileName,
            configFilePath: configPath
        };
        controller.print3DSlice(param);
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
        },
        'print3D:gcode-slice-progress': (sliceProgress) => {
            this.setState({
                sliceProgress: sliceProgress
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
    //************* life cycle ************
    componentWillUnmount() {
        this.stop();
        this.removeControllerEvents();
    }
    //************* model ************
    parseModel(modelPath) {
        if (path.extname(modelPath).toString().toLowerCase() === '.stl') {
            this.parseStl(modelPath);
        } else if (path.extname(modelPath).toString().toLowerCase() === '.obj') {
            this.parseObj(modelPath);
        }
    }
    onLoadModelSucceed(bufferGemotry) {
        this.addBufferGemotryToModelGroup(bufferGemotry);
        this.updateModelSizeAndClingToBottom();
        this.redoMatrix4Array = [];
        this.undoMatrix4Array = [];
        this.modelMesh.updateMatrix();
        this.undoMatrix4Array.push(this.modelMesh.matrix.clone());
    }
    onLoadModelProgress(event) {
        let progress = event.loaded / event.total;
        this.setState({
            modelParseProgress: progress
        });
    }
    onLoadModelError(event) {
        this.setState({
            modelParseProgress: -1,
            modelParseResult: 'error'
        });
    }
    addBufferGemotryToModelGroup(bufferGemotry) {
        if (this.modelMesh) {
            this.modelGroup.remove(this.modelMesh);
            //todo : dispose gemotry
        }
        //1.preprocess Gemotry
        //step-1: rotate x 90 degree
        bufferGemotry.rotateX(-Math.PI / 2);

        //step-2: set to symmetry
        bufferGemotry.computeBoundingBox();
        let x = -(bufferGemotry.boundingBox.max.x + bufferGemotry.boundingBox.min.x) / 2;
        let y = -(bufferGemotry.boundingBox.max.y + bufferGemotry.boundingBox.min.y) / 2;
        let z = -(bufferGemotry.boundingBox.max.z + bufferGemotry.boundingBox.min.z) / 2;
        bufferGemotry.translate(x, y, z);
        bufferGemotry.computeBoundingBox();

        //2.new mesh
        // var material = new THREE.MeshPhongMaterial({ color: 0xff5533, specular: 0x111111, shininess: 200 });
        this.modelMesh = new THREE.Mesh(bufferGemotry, this.modelMaterial);
        this.modelMesh.position.set(0, 0, 0);
        // this.modelMesh.rotation.set(0, -Math.PI / 2, 0);
        this.modelMesh.scale.set(1, 1, 1);
        this.modelMesh.castShadow = true;
        this.modelMesh.receiveShadow = true;
        this.modelMesh.name = 'modelMesh';
        this.modelGroup.add(this.modelMesh);
        this.setState({
            modelParseProgress: 1,
            modelParseResult: 'ok'
        });
    }
    parseStl(modelPath) {
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
    parseObj(modelPath) {
        console.log('parseObj:' + modelPath);
        let loader = new THREE.OBJLoader();
        loader.load(
            modelPath,
            //return container. container has several meshs(a mesh is one of line/mesh/point). mesh uses BufferGeometry
            (container) => {
                //there is a bug when merge two BufferGeometries :
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
    //************* gcode ************
    //todo : render gcode must not be in UI thread
    renderGcode(gcodePath) {
        this.print3dGcodeLoader.load(
            gcodePath,
            (object) => {
                if (this.gcodeRenderedObject) {
                    this.gcodeGroup.remove(this.gcodeRenderedObject);
                }
                this.gcodeRenderedObject = object;
                this.gcodeGroup.add(this.gcodeRenderedObject);
                // this.gcodeRenderedObject.position.set(-125/2, 0, -125);
                this.setState({
                    layerCount: this.print3dGcodeLoader.layerCount,
                    layerAmountVisible: this.print3dGcodeLoader.layerCount
                });
                this.print3dGcodeLoader.showLayers(this.state.layerAmountVisible);
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
    //************* operate model ************
    //move
    onChangeMx(value) {
        if (this.modelMesh) {
            this.modelMesh.position.x = value;
            this.setState({
                moveX: value
            });
        }
    }
    onAfterChangeMx(value) {
        this.updateModelSizeAndClingToBottom();
        this.operateCompleted();
    }
    onChangeMy(value) {
        if (this.modelMesh) {
            this.modelMesh.position.y = value;
            this.setState({
                moveY: value
            });
        }
    }
    onAfterChangeMy(value) {
        this.updateModelSizeAndClingToBottom();
        this.operateCompleted();
    }
    onChangeMz(value) {
        if (this.modelMesh) {
            this.modelMesh.position.z = value;
            this.setState({
                moveZ: value
            });
        }
    }
    onAfterChangeMz(value) {
        this.updateModelSizeAndClingToBottom();
        this.operateCompleted();
    }
    //scale
    onChangeS(value) {
        if (this.modelMesh) {
            this.modelMesh.scale.set(value, value, value);
            this.setState({
                scale: value
            });
            //todo: update size -> (origin size) x this.state.scale
        }
    }
    onAfterChangeS(value) {
        if (this.modelMesh) {
            this.modelMesh.scale.set(value, value, value);
            this.updateModelSizeAndClingToBottom();
            this.operateCompleted();
            this.setState({
                scale: value
            });
        }
    }
    //rotate
    onChangeRx(value) {
        if (this.modelMesh) {
            this.modelMesh.rotation.x = -Math.PI * value / 180;
            this.setState({
                rotateX: value
            });
        }
    }
    onAfterChangeRx(value) {
        if (this.modelMesh) {
            this.updateModelSizeAndClingToBottom();
            this.operateCompleted();
            this.setState({
                rotateX: value
            });
        }
    }
    onChangeRy(value) {
        if (this.modelMesh) {
            this.modelMesh.rotation.z = -Math.PI * value / 180;
            this.setState({
                rotateY: value
            });
        }
    }
    onAfterChangeRy(value) {
        if (this.modelMesh) {
            this.modelMesh.rotation.z = -Math.PI * value / 180;
            this.updateModelSizeAndClingToBottom();
            this.operateCompleted();
            this.setState({
                rotateY: value
            });
        }
    }
    onChangeRz(value) {
        if (this.modelMesh) {
            this.modelMesh.rotation.y = Math.PI * value / 180;
            this.setState({
                rotateZ: value
            });
        }
    }
    onAfterChangeRz(value) {
        if (this.modelMesh) {
            this.modelMesh.rotation.y = Math.PI * value / 180;
            this.updateModelSizeAndClingToBottom();
            this.operateCompleted();
            this.setState({
                rotateZ: value
            });
        }
    }
    //calculate model size
    clingModelToBottom(bufferGemotry) {
        bufferGemotry.computeBoundingBox();
        this.modelMesh.position.y += (-bufferGemotry.boundingBox.min.y);
    }
    updateModelSizeAndClingToBottom() {
        if (!this.modelMesh) {
            return;
        }
        this.modelMesh.updateMatrix();
        let matrixLocal = this.modelMesh.matrix;
        //must use deepCopy
        let bufferGemotry = this.modelMesh.geometry.clone();
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
        this.clingModelToBottom(bufferGemotry);
    }
    render() {
        const style = this.props.style;
        const actions = { ...this.actions };
        return (
            <div style={style}>
                <div>
                    <input
                        ref={(node) => {
                            this.fileInputEl = node;
                        }}
                        type="file"
                        accept={'.stl, .obj'}
                        style={{ display: 'none' }}
                        multiple={false}
                        onChange={actions.onChangeFile}
                    />
                    <div id="div1" style={{ float: 'left', 'background': '#e0e0e0', padding: '5px 5px 5px 5px' }}>
                        <p>***** model *****</p>
                        <button onClick={::this.onClickUploadModel}>
                            upload model
                        </button>
                        <p>{'name : ' + this.state.modelFileName}</p>
                        <p>{'upload result : ' + this.state.modelUploadResult}</p>
                        <button onClick={::this.onClickParseCurModel}>
                            parse current model
                        </button>
                        <p>{'parse result : ' + this.state.modelParseResult}</p>
                        <p>{'parse progress : ' + this.state.modelParseProgress}</p>
                        <p>***** slice *****</p>
                        <button onClick={::this.onClickSliceCurModel}>
                            slice current model
                        </button>
                        <p>{'slice result : ' + this.state.sliceResult}</p>
                        <p>{'slice progress : ' + this.state.sliceProgress}</p>
                        <p>{'print time : ' + this.state.printTime}</p>
                        <p>{'filament length : ' + this.state.filamentLength}</p>
                        <p>{'filament weight : ' + this.state.filamentWeight}</p>
                        <p>***** gcode *****</p>
                        <button onClick={::this.onClickRenderGcode}>
                            render gcode
                        </button>
                        <p>{'gcode file name : ' + this.state.gcodeFileName}</p>
                        <p>{'gcode path : ' + this.state.gcodeFilePath}</p>
                        <p>{'gcode parse progress : ' + this.state.gcodeParseProgress}</p>
                        <p>***** visiblity *****</p>
                        <button onClick={::this.onClickShowGcode}>
                            show gcode
                        </button>
                        <button onClick={::this.onClickShowModel}>
                            show model
                        </button>
                        <button onClick={::this.onClickShowBoth}>
                            show both
                        </button>
                    </div>
                    <div id="div2" style={{ float: 'right', 'background': '#e0e0e0', padding: '5px 5px 5px 5px' }}>
                        <p>***** move *****</p>
                        <p> X : {this.state.moveX}</p>
                        <Slider
                            style={{ padding: 0 }}
                            value={this.state.moveX}
                            min={-62.5}
                            max={62.5}
                            step={0.01}
                            onChange={::this.onChangeMx}
                            onAfterChange={::this.onAfterChangeMx}
                        />
                        <p> Y : {this.state.moveY}</p>
                        <Slider
                            style={{ padding: 0 }}
                            value={this.state.moveY}
                            min={-62.5}
                            max={62.5}
                            step={0.01}
                            onChange={::this.onChangeMy}
                            onAfterChange={::this.onAfterChangeMy}
                        />
                        <p> Z : {this.state.moveZ}</p>
                        <Slider
                            style={{ padding: 0 }}
                            value={this.state.moveZ}
                            min={-62.5}
                            max={62.5}
                            step={0.01}
                            onChange={::this.onChangeMz}
                            onAfterChange={::this.onAfterChangeMz}
                        />
                        <p>***** scale *****</p>
                        <p> Scale : {this.state.scale}</p>
                        <Slider
                            style={{ padding: 0 }}
                            value={this.state.scale}
                            min={0.1}
                            max={5}
                            step={0.01}
                            onChange={::this.onChangeS}
                            onAfterChange={::this.onAfterChangeS}
                        />
                        <p>***** rotate *****</p>
                        <p> X : {this.state.rotateX}</p>
                        <Slider
                            style={{ padding: 0 }}
                            value={this.state.rotateX}
                            min={-180}
                            max={180}
                            step={0.1}
                            onChange={::this.onChangeRx}
                            onAfterChange={::this.onAfterChangeRx}
                        />
                        <p> Y : {this.state.rotateY}</p>
                        <Slider
                            style={{ padding: 0 }}
                            value={this.state.rotateY}
                            min={-180}
                            max={180}
                            step={0.1}
                            onChange={::this.onChangeRy}
                            onAfterChange={::this.onAfterChangeRy}
                        />
                        <p> Z : {this.state.rotateZ}</p>
                        <Slider
                            style={{ padding: 0 }}
                            value={this.state.rotateZ}
                            min={-180}
                            max={180}
                            step={0.1}
                            onChange={::this.onChangeRz}
                            onAfterChange={::this.onAfterChangeRz}
                        />
                    </div>
                    <div id="div3" style={{ float: 'right', 'background': '#ffe0e0', padding: '5px 5px 5px 5px' }}>
                        <p>********** size ***********</p>
                        <p> X : {this.state.modelSizeX}</p>
                        <p> Y : {this.state.modelSizeY}</p>
                        <p> Z : {this.state.modelSizeZ}</p>
                        <p> {this.state.minX.toFixed(1)}-{this.state.maxX.toFixed(1)}</p>
                        <p> {this.state.minY.toFixed(1)}-{this.state.maxY.toFixed(1)}</p>
                        <p> {this.state.minZ.toFixed(1)}-{this.state.maxZ.toFixed(1)}</p>
                        <button onClick={::this.saveToStl}>
                            save to stl
                        </button>
                    </div>
                    <div id="div4" style={{ float: 'right', 'background': '#ffe0ff', padding: '5px 5px 5px 5px' }}>
                        {0}---{this.state.layerAmountVisible}---{this.state.layerCount}
                        <Slider
                            style={{ padding: 0 }}
                            defaultValue={0}
                            min={0}
                            max={this.state.layerCount}
                            step={1}
                            onChange={::this.onChangeShowLayer}
                        />
                        <input type="checkbox" onChange={::this.onChangeWallInner} /> WALL_INNER <br></br>
                        <input type="checkbox" onChange={::this.onChangeWallOuter} /> WALL_OUTER <br></br>
                        <input type="checkbox" onChange={::this.onChangeSkin} /> SKIN <br></br>
                        <input type="checkbox" onChange={::this.onChangeSkirt} /> SKIRT <br></br>
                        <input type="checkbox" onChange={::this.onChangeSupport} /> SUPPORT <br></br>
                        <input type="checkbox" onChange={::this.onChangeFill} /> FILL <br></br>
                        <input type="checkbox" onChange={::this.onChangeUnknown} /> UNKNOWN <br></br>
                        <input type="checkbox" onChange={::this.onChangeTravel} /> Travel <br></br>
                    </div>
                    <div id="div5" style={{ float: 'right', 'background': '#e0e0e0', padding: '5px 5px 5px 5px' }}>
                        <button onClick={::this.zoomIn}>
                            zoom in
                        </button>
                        <br></br>
                        <button onClick={::this.zoomOut}>
                            zoom out
                        </button>
                        <br></br>
                        <button onClick={::this.toLeft}>
                            toLeft
                        </button>
                        <br></br>
                        <button onClick={::this.toRight}>
                            toRight
                        </button>
                        <br></br>
                        <button onClick={::this.toTop}>
                            toTop
                        </button>
                        <br></br>
                        <button onClick={::this.toBottom}>
                            toBottom
                        </button>
                        <br></br>
                        <button onClick={::this.resetPrintSpace}>
                            reset
                        </button>
                    </div>
                    <div id="div6" style={{ float: 'right', 'background': '#e0e0e0', padding: '5px 5px 5px 5px' }}>
                        <button onClick={::this.undo}>
                            undo
                        </button>
                        <button onClick={::this.redo}>
                            redo
                        </button>
                        <button onClick={::this.reset}>
                            reset
                        </button>
                    </div>
                    <div id="div7" style={{ float: 'right', 'background': '#ffe0ff', padding: '5px 5px 5px 5px' }}>
                        <div>
                            <p>********** config ***********</p>
                            <button onClick={::this.onClickFastPrint}>
                                FastPrint
                            </button>
                            <button onClick={::this.onClickNormalQuality}>
                                NormalQuality
                            </button>
                            <button onClick={::this.onClickHighQuality}>
                                HighQuality
                            </button>
                            <button onClick={::this.onClickCustom}>
                                Custom
                            </button>
                            <label>materials</label>
                            <select id="materials" onChange={::this.onChangeMaterials}>
                                <option value="PLA" selected="selected">PLA</option>
                                <option value="ABS">ABS</option>
                            </select>
                            <label>adhesion</label>
                            <select id="adhesion" onChange={::this.onChangeAdhesion}>
                                <option value="skit">skit</option>
                                <option value="brim">brim</option>
                                <option value="raft">raft</option>
                                <option value="none" selected="selected">none</option>
                            </select>
                            <label>support</label>
                            <select id="support" onChange={::this.onChangeSupport2}>
                                <option value="touch buildplate">touch buildplate</option>
                                <option value="everywhere">everywhere</option>
                                <option value="none" selected="selected">none</option>
                            </select>
                            <br></br>
                            <button onClick={::this.loadConfig}>
                                load config
                            </button>
                            <button onClick={::this.configRename}>
                                Rename
                            </button>
                            <button onClick={::this.configDuplicate}>
                                Duplicate
                            </button>
                            <button onClick={::this.configRemove}>
                                Remove
                            </button>
                            <button onClick={::this.configUpdate}>
                                update
                            </button>
                            <button onClick={::this.setLayerH02}>
                                setLayerH02
                            </button>
                            <button onClick={::this.setLayerH10}>
                                setLayerH10
                            </button>
                            <button onClick={::this.saveForPrint}>
                                saveForPrint
                            </button>
                            <p>{'for print config: ' + this.state.forPrintConfigPath}</p>
                            <p>{'cur config: ' + (this.state.curConBean === undefined ? '' : this.state.curConBean.jsonObj.name)}</p>
                            <p> config name : {this.state.curConBean === undefined ? '' : this.state.curConBean.jsonObj.name}</p>
                            <p> layer height : {this.state.curConBean === undefined ? '' : this.state.curConBean.jsonObj.overrides.layer_height.default_value}</p>
                            <p> initial layer height : {this.state.curConBean === undefined ? '' : this.state.curConBean.jsonObj.overrides.layer_height_0.default_value}</p>
                            <p> print speed : {this.state.curConBean === undefined ? '' : this.state.curConBean.jsonObj.overrides.speed_print.default_value}</p>
                        </div>
                    </div>
                    <div id="WebGL-output" style={{ float: 'right', 'background': '#eeeeee', padding: '5px 5px 5px 5px' }}> </div>
                </div>

            </div>
        );
    }
    onChangeWallInner(event) {
        if (event.target.checked) {
            this.print3dGcodeLoader.showType('WALL-INNER');
        } else {
            this.print3dGcodeLoader.hideType('WALL-INNER');
        }
    }
    onChangeWallOuter(event) {
        if (event.target.checked) {
            this.print3dGcodeLoader.showType('WALL-OUTER');
        } else {
            this.print3dGcodeLoader.hideType('WALL-OUTER');
        }
    }
    onChangeSkin(event) {
        if (event.target.checked) {
            this.print3dGcodeLoader.showType('SKIN');
        } else {
            this.print3dGcodeLoader.hideType('SKIN');
        }
    }
    onChangeSkirt(event) {
        if (event.target.checked) {
            this.print3dGcodeLoader.showType('SKIRT');
        } else {
            this.print3dGcodeLoader.hideType('SKIRT');
        }
    }
    onChangeSupport(event) {
        if (event.target.checked) {
            this.print3dGcodeLoader.showType('SUPPORT');
        } else {
            this.print3dGcodeLoader.hideType('SUPPORT');
        }
    }
    onChangeFill(event) {
        if (event.target.checked) {
            this.print3dGcodeLoader.showType('FILL');
        } else {
            this.print3dGcodeLoader.hideType('FILL');
        }
    }
    onChangeUnknown(event) {
        if (event.target.checked) {
            this.print3dGcodeLoader.showType('UNKNOWN');
        } else {
            this.print3dGcodeLoader.hideType('UNKNOWN');
        }
    }
    onChangeTravel(event) {
        if (event.target.checked) {
            this.print3dGcodeLoader.showType('Travel');
        } else {
            this.print3dGcodeLoader.hideType('Travel');
        }
    }
    onChangeShowLayer(value) {
        this.setState({
            layerAmountVisible: value
        });
        this.print3dGcodeLoader.showLayers(this.state.layerAmountVisible);
    }
    saveToStl() {
        var exporter = new THREE.STLExporter();
        var output = exporter.parse(this.modelGroup);
        var blob = new Blob([output], { type: 'text/plain' });
        var fileOfBlob = new File([blob], 'output.stl');
        const formData = new FormData();
        formData.append('file', fileOfBlob);
        api.uploadFile(formData).then((res) => {
            const file = res.body;
            this.setState({
                modelFileName: `${file.filename}`,
                modelUploadResult: 'ok'
            });
        });
    }
    zoomIn() {
        if (this.camera.position.z <= 100) {
            return;
        }
        let property = { z: this.camera.position.z };
        let target = { z: this.camera.position.z - 100 };
        let tween = new TWEEN.Tween(property).to(target, 1000);
        tween.onUpdate(() => {
            this.camera.position.z = property.z;
        });
        tween.start();
    }
    zoomOut() {
        if (this.camera.position.z >= 900) {
            return;
        }
        let property = { z: this.camera.position.z };
        let target = { z: this.camera.position.z + 100 };
        let tween = new TWEEN.Tween(property).to(target, 1000);
        tween.onUpdate(() => {
            this.camera.position.z = property.z;
        });
        tween.start();
    }
    toLeft() {
        let delta = Math.PI / 2 + (this.group.rotation.y / (Math.PI / 2) - parseInt(this.group.rotation.y / (Math.PI / 2), 0)) * (Math.PI / 2);
        //handle precision of float
        delta = (delta < 0.01) ? (Math.PI / 2) : delta;
        let property = {
            propertyA: this.group.rotation.x,
            propertyB: this.group.rotation.y,
            propertyC: this.group.rotation.z
        };
        var target = {
            propertyA: 0,
            propertyB: this.group.rotation.y - delta,
            propertyC: 0
        };
        var tween = new TWEEN.Tween(property).to(target, 1000);
        tween.onUpdate(() => {
            this.group.rotation.x = property.propertyA;
            this.group.rotation.y = property.propertyB;
            this.group.rotation.z = property.propertyC;
        });
        tween.start();
    }
    toRight() {
        var delta = Math.PI / 2 - (this.group.rotation.y / (Math.PI / 2) - parseInt(this.group.rotation.y / (Math.PI / 2), 0)) * (Math.PI / 2);
        //handle precision of float
        delta = (delta < 0.01) ? (Math.PI / 2) : delta;
        let property = {
            propertyA: this.group.rotation.x,
            propertyB: this.group.rotation.y,
            propertyC: this.group.rotation.z
        };
        var target = {
            propertyA: 0,
            propertyB: this.group.rotation.y + delta,
            propertyC: 0
        };
        var tween = new TWEEN.Tween(property).to(target, 1000);
        tween.onUpdate(() => {
            this.group.rotation.x = property.propertyA;
            this.group.rotation.y = property.propertyB;
            this.group.rotation.z = property.propertyC;
        });
        tween.start();
    }
    toTop() {
        var delta = Math.PI / 2 - (this.group.rotation.x / (Math.PI / 2) - parseInt(this.group.rotation.x / (Math.PI / 2), 0)) * (Math.PI / 2);
        //handle precision of float
        delta = (delta < 0.01) ? (Math.PI / 2) : delta;
        let property = {
            propertyA: this.group.rotation.x,
            propertyB: this.group.rotation.y,
            propertyC: this.group.rotation.z
        };
        var target = {
            propertyA: this.group.rotation.x + delta,
            propertyB: 0,
            propertyC: 0
        };
        var tween = new TWEEN.Tween(property).to(target, 1000);
        tween.onUpdate(() => {
            this.group.rotation.x = property.propertyA;
            this.group.rotation.y = property.propertyB;
            this.group.rotation.z = property.propertyC;
        });
        tween.start();
    }
    toBottom() {
        var delta = Math.PI / 2 + (this.group.rotation.x / (Math.PI / 2) - parseInt(this.group.rotation.x / (Math.PI / 2), 0)) * (Math.PI / 2);
        //handle precision of float
        delta = (delta < 0.01) ? (Math.PI / 2) : delta;
        //handle precision of float
        delta = (delta < 0.01) ? (Math.PI / 2) : delta;
        let property = {
            propertyA: this.group.rotation.x,
            propertyB: this.group.rotation.y,
            propertyC: this.group.rotation.z
        };
        var target = {
            propertyA: this.group.rotation.x - delta,
            propertyB: 0,
            propertyC: 0
        };
        var tween = new TWEEN.Tween(property).to(target, 1000);
        tween.onUpdate(() => {
            this.group.rotation.x = property.propertyA;
            this.group.rotation.y = property.propertyB;
            this.group.rotation.z = property.propertyC;
        });
        tween.start();
    }
    resetPrintSpace() {

    }
    //undo + redo
    undo() {
        if (!this.canExecuteUndo()) {
            console.log('Can not execute undo');
            return;
        }
        this.redoMatrix4Array.push(this.undoMatrix4Array.pop());
        var matrix4 = this.undoMatrix4Array[this.undoMatrix4Array.length - 1];
        this.setOperateUI(matrix4);
    }
    redo() {
        if (!this.canExecuteRedo()) {
            console.log('Can not execute redo');
            return;
        }
        this.undoMatrix4Array.push(this.redoMatrix4Array.pop());
        var matrix4 = this.undoMatrix4Array[this.undoMatrix4Array.length - 1];
        this.setOperateUI(matrix4);
    }
    reset() {
        if (!this.canExecuteReset()) {
            console.log('Can not execute reset');
            return;
        }
        this.undoMatrix4Array.splice(1, this.undoMatrix4Array.length - 1);
        this.redoMatrix4Array = [];

        var matrix4 = this.undoMatrix4Array[0];
        this.setOperateUI(matrix4);
    }
    canExecuteUndo() {
        if (!this.modelMesh) {
            return false;
        }
        if (this.undoMatrix4Array.length <= 1) {
            return false;
        }
        return true;
    }
    canExecuteRedo() {
        if (!this.modelMesh) {
            return false;
        }
        if (this.redoMatrix4Array.length === 0) {
            return false;
        }
        return true;
    }
    canExecuteReset() {
        return this.canExecuteUndo() || this.canExecuteRedo();
    }
    operateCompleted() {
        if (this.modelMesh) {
            this.modelMesh.updateMatrix();
            if (this.modelMesh.matrix.equals(this.undoMatrix4Array[this.undoMatrix4Array.length - 1])) {
                console.log('operation is no diff');
            } else {
                this.undoMatrix4Array.push(this.modelMesh.matrix.clone());
                this.redoMatrix4Array = [];
            }
        }
    }
    setOperateUI(matrix4) {
        //set model
        var position = new THREE.Vector3();
        var quaternion = new THREE.Quaternion();
        var scale = new THREE.Vector3();
        matrix4.decompose(position, quaternion, scale);
        this.modelMesh.position.set(position.x, position.y, position.z);
        this.modelMesh.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
        this.modelMesh.scale.set(scale.x, scale.y, scale.z);

        var x = position.x;
        var y = position.y;
        var z = position.z;
        //set ui
        this.setState({
            moveX: x,
            moveY: y,
            moveZ: z,
            scale: this.modelMesh.scale.x,
            rotateX: this.modelMesh.rotation.x * 180 / Math.PI,
            rotateY: this.modelMesh.rotation.y * 180 / Math.PI,
            rotateZ: this.modelMesh.rotation.z * 180 / Math.PI
        });
    }
    //config
    loadConfig() {
        this.configManager.loadConfigs((err, beanArr) => {
            if (err) {
                console.log('loadConfig err' + JSON.stringify(err));
            } else {
                console.log('loadConfig succeed');
                this.configBeanArr = beanArr;
                this.setState({
                    curConBean: this.configBeanArr[0]
                });
            }
        });
    }
    onChangeMaterials(event) {
        console.log(event.target.value);
        if (event.target.value.toLowerCase() === 'abs') {
            this.configManager.setMaterial_ABS();
        } else if (event.target.value.toLowerCase() === 'pla') {
            this.configManager.setMaterial_PLA();
        } else {
            console.log('unknow material');
        }
    }
    onChangeAdhesion(event) {
        console.log(event.target.value);
        if (event.target.value.toLowerCase() === 'skit') {
            this.configManager.setAdhesion_skirt();
        } else if (event.target.value.toLowerCase() === 'brim') {
            this.configManager.setAdhesion_brim();
        } else if (event.target.value.toLowerCase() === 'raft') {
            this.configManager.setAdhesion_raft();
        } else if (event.target.value.toLowerCase() === 'none') {
            this.configManager.setAdhesion_none();
        } else {
            console.log('unknow adhesion');
        }
    }
    onChangeSupport2(event) {
        console.log(event.target.value);
        if (event.target.value.toLowerCase() === 'touch buildplate') {
            this.configManager.setSupport_buildplate();
        } else if (event.target.value.toLowerCase() === 'everywhere') {
            this.configManager.setSupport_everywhere();
        } else if (event.target.value.toLowerCase() === 'none') {
            this.configManager.setSupport_none();
        } else {
            console.log('unknow Support');
        }
    }
    onClickFastPrint(event) {
        if (this.configBeanArr) {
            for (var bean of this.configBeanArr) {
                if (bean.jsonObj.name.toLowerCase() === 'fast print') {
                    this.setState({
                        curConBean: bean
                    });
                    return;
                }
            }
        }
    }
    onClickNormalQuality(event) {
        if (this.configBeanArr) {
            for (var bean of this.configBeanArr) {
                if (bean.jsonObj.name.toLowerCase() === 'normal quality') {
                    this.setState({
                        curConBean: bean
                    });
                    return;
                }
            }
        }
    }
    onClickHighQuality(event) {
        if (this.configBeanArr) {
            for (var bean of this.configBeanArr) {
                if (bean.jsonObj.name.toLowerCase() === 'high quality') {
                    this.setState({
                        curConBean: bean
                    });
                    return;
                }
            }
        }
    }
    onClickCustom(event) {
        if (this.configBeanArr) {
            for (var bean of this.configBeanArr) {
                if (bean.jsonObj.name.toLowerCase() === 'custom') {
                    this.setState({
                        curConBean: bean
                    });
                    return;
                }
            }
        }
    }
    configRename() {
        if (this.state.curConBean) {
            this.configManager.rename(this.state.curConBean.jsonObj.name, 'custom-2', (err) => {
                if (err) {
                    console.log(err.message);
                } else {
                    console.log('rename succeed');
                }
            });
        }
    }
    configDuplicate() {
        if (this.state.curConBean) {
            this.configManager.duplicate(this.state.curConBean.jsonObj.name, this.state.curConBean.jsonObj.name + ' copy', (err) => {
                if (err) {
                    console.log(err.message);
                } else {
                    console.log('Duplicate succeed');
                }
            });
        }
    }
    configRemove() {
        if (this.state.curConBean) {
            this.configManager.remove(this.state.curConBean.jsonObj.name, (err) => {
                if (err && err.message) {
                    console.log(err.message);
                } else {
                    console.log('remove succeed');
                }
            });
        }
    }
    configUpdate() {
        if (this.state.curConBean) {
            this.configManager.saveModificationToFile(this.state.curConBean.jsonObj.name, (err) => {
                if (err && err.message) {
                    console.log(err.message);
                } else {
                    console.log('update succeed');
                }
            });
        }
    }
    setLayerH10() {
        if (this.state.curConBean) {
            this.state.curConBean.jsonObj.overrides.layer_height.default_value = 10;
            this.forceUpdate();
        }
    }
    setLayerH02() {
        if (this.state.curConBean) {
            this.state.curConBean.jsonObj.overrides.layer_height.default_value = 0.2;
            this.forceUpdate();
        }
    }
    saveForPrint() {
        if (this.state.curConBean) {
            this.configManager.saveForPrint(this.state.curConBean.jsonObj.name, (err, filePath) => {
                if (err && err.message) {
                    console.log(err.message);
                } else {
                    console.log('saveForPrint succeed');
                    this.setState({
                        forPrintConfigPath: filePath
                    });
                }
            });
        }
    }
}

export default withRouter(Print3D);
