import {
    Vector3, Matrix4, MeshPhongMaterial, TextureLoader
    // DoubleSide, CylinderGeometry,Mesh
} from 'three';

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';

import Canvas from './Canvas';
import Env3Axis from './Env3Axis';
import Env4Axis from './Env4Axis';
import { convertSVGPointToLogicalPoint } from '../../../lib/numeric-utils';
import { actions as cncActions } from '../../../flux/cnc';

import {
    BACK,
    BOTTOM,
    FRONT,
    LEFT,
    RIGHT,
    TOP,
    DEFAULT_LUBAN_HOST,
    SVG_MOVE_MINI_DISTANCE
} from '../../../constants';

import i18n from '../../../lib/i18n';
import { actions as editorActions } from '../../../flux/editor';
// import styles from './styles.styl';

const texture = new TextureLoader().load(`${DEFAULT_LUBAN_HOST}/resources/images/wood.png`);

const getModelTransformation = (t, size, coordinateMode, coordinateSize) => {
    const posDiff = {
        x: 0,
        y: 0
    };
    if (coordinateMode) {
        posDiff.x = coordinateMode.setting.sizeMultiplyFactor.x * coordinateSize.x / 2;
        posDiff.y = coordinateMode.setting.sizeMultiplyFactor.y * coordinateSize.y / 2;
    }
    return {
        positionX: t.x - size.x - posDiff.x,
        positionY: -t.y + size.y - posDiff.y,
        positionZ: 0,
        scaleX: t.scaleX ?? 1,
        scaleY: t.scaleY ?? 1,
        scaleZ: 1,
        rotationX: 0,
        rotationY: 0,
        rotationZ: -t.angle / 180 * Math.PI,
        width: t.width * t.scaleX,
        height: t.height * t.scaleY
    };
};

const directionMatrixes = {
    [FRONT]: new Matrix4(),
    [BACK]: new Matrix4().makeRotationZ(Math.PI),
    [LEFT]: new Matrix4().makeRotationZ(Math.PI / 2),
    [RIGHT]: new Matrix4().makeRotationZ(-Math.PI / 2),
    [TOP]: new Matrix4().makeRotationX(Math.PI / 2),
    [BOTTOM]: new Matrix4().makeRotationX(-Math.PI / 2)
};

const placementMatrixes = {
    [FRONT]: new Matrix4().makeRotationX(Math.PI / 2),
    [BACK]: new Matrix4().makeRotationX(-Math.PI / 2),
    [LEFT]: new Matrix4().makeRotationY(-Math.PI / 2),
    [RIGHT]: new Matrix4().makeRotationY(Math.PI / 2),
    [TOP]: new Matrix4().makeRotationY(Math.PI),
    [BOTTOM]: new Matrix4()
};

const getMeshBbox = (mesh) => {
    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrix);
    geometry.computeBoundingBox();
    const bbox = geometry.boundingBox;
    return bbox;
};

const getMeshSize = (mesh) => {
    const bbox = getMeshBbox(mesh);
    const size = {
        x: bbox.max.x - bbox.min.x,
        y: bbox.max.y - bbox.min.y,
        z: bbox.max.z - bbox.min.z
    };
    return size;
};


const setMeshTransform = (mesh, sourceScale, transformation, isRotate, direction = FRONT, placement = BOTTOM) => {
    mesh.applyMatrix4(new Matrix4().copy(mesh.matrix).invert());
    mesh.applyMatrix4(isRotate ? placementMatrixes[placement] : directionMatrixes[direction]);

    mesh.applyMatrix4(new Matrix4().makeScale(transformation.scaleX * sourceScale, Math.abs(transformation.scaleY * sourceScale), transformation.scaleY * sourceScale));
};


const set3AxisMeshState = (mesh, transformation, platSize) => {
    const { positionX: x, positionY: z, rotationZ, width, height } = transformation;
    mesh.position.set(x, 0, z);
    mesh.applyMatrix4(new Matrix4().makeRotationY(-rotationZ));
    // mesh.rotation.set(0, -rotationZ, 0);
    if (Math.abs(x) + width / 2 > platSize.x / 2 || Math.abs(z) + height / 2 > platSize.z / 2) {
        const material = new MeshPhongMaterial({ color: 0xff0000, specular: 0xb0b0b0, shininess: 0 });
        mesh.material = material;
    }
};

const set4AxisMeshState = async (mesh, transformation, materials, coordinateSize, isOverStepped) => {
    mesh.material = new MeshPhongMaterial(
        {
            color: '#ffffff',
            shininess: 0,
            map: texture
        }
    );

    const radius = transformation.width / Math.PI / 2;
    // const meshCylinder = new Mesh(
    //     new CylinderGeometry(radius, radius, size.z, 64),
    //     new MeshPhongMaterial({
    //         opacity: 0.5,
    //         transparent: true,
    //         color: 0xa0a0a0,
    //         specular: 0xb0b0b0,
    //         shininess: 1,
    //         side: DoubleSide
    //     })
    // );
    // meshCylinder.rotateX(Math.PI / 2);
    // mesh.add(
    //     meshCylinder
    // );
    mesh.applyMatrix4(new Matrix4().makeRotationY(-transformation.rotationZ));
    mesh.position.set(0, 0, materials.length / 2 - transformation.positionY - coordinateSize.y / 2);
    mesh.updateMatrix();
    if (radius) {
        mesh.applyMatrix4(new Matrix4().makeRotationZ(-transformation.positionX / radius));
    }

    if (radius > materials.diameter / 2 || isOverStepped) {
        const material = new MeshPhongMaterial({ color: 0xff0000, specular: 0xb0b0b0, shininess: 0 });
        mesh.material = material;
    }
};

class Cnc3DVisualizer extends Component {
    static propTypes = {
        hasModel: PropTypes.bool,
        show: PropTypes.bool.isRequired,
        mesh: PropTypes.object,
        materials: PropTypes.object,
        sourceScale: PropTypes.number,
        transformation: PropTypes.object,
        machineSize: PropTypes.object,
        direction: PropTypes.string,
        placement: PropTypes.string,
        updateStlVisualizer: PropTypes.func,
        selectTargetModel: PropTypes.func,
        coordinateMode: PropTypes.object,
        coordinateSize: PropTypes.object,
        visible: PropTypes.bool,
        selectedModel: PropTypes.object,
        progress: PropTypes.number
    };

    state = {
        environment: null,
        cameraInitialPosition: null
    };

    actions = {
        hideCnc3DVisualizer: () => {
            this.props.updateStlVisualizer({ show: false });
        }
    };

    componentDidUpdate() {
    }

    getSnapshotBeforeUpdate(prevProps) {
        if (this.props.hasModel) {
            const { selectedModel, mesh, materials, sourceScale, transformation, direction, placement, machineSize, coordinateSize, coordinateMode } = this.props;
            if (mesh !== prevProps.mesh || materials.isRotate !== prevProps.materials.isRotate
                || materials.diameter !== prevProps.materials.diameter
                || materials.length !== prevProps.materials.length
                || transformation !== prevProps.transformation || direction !== prevProps.direction
                || prevProps.coordinateSize !== coordinateSize
                || prevProps.coordinateMode !== coordinateMode
                || prevProps.placement !== placement
            ) {
                const t = getModelTransformation(transformation, machineSize, coordinateMode, coordinateSize);
                mesh.remove(...mesh.children);
                mesh.material = new MeshPhongMaterial({ color: 0xa0a0a0, specular: 0xb0b0b0, shininess: 0 });
                setMeshTransform(mesh, sourceScale, t, materials.isRotate, direction, placement);
                if (!this.cameraInitialPosition || machineSize.z !== prevProps.machineSize.z) {
                    this.setState({
                        cameraInitialPosition: new Vector3(0, -machineSize.z * 1.3, 0)
                    });
                }
                if (materials.isRotate) {
                    const logicPosition = convertSVGPointToLogicalPoint(transformation, machineSize);
                    let isOverStepped = false;
                    const actualHeight = transformation.height * transformation.scaleY / 2;
                    if ((logicPosition.y - actualHeight) < 0 - SVG_MOVE_MINI_DISTANCE || (logicPosition.y + actualHeight) > coordinateSize.y + SVG_MOVE_MINI_DISTANCE) {
                        isOverStepped = true;
                    }

                    set4AxisMeshState(mesh, t, materials, coordinateSize, isOverStepped);
                    this.setState({
                        environment: new Env4Axis(mesh, materials)
                    });
                    this.worldTransform = new Matrix4().makeRotationY(Math.PI);
                } else {
                    const meshSize = getMeshSize(mesh);
                    const platSize = { x: coordinateSize?.x ?? machineSize.x, y: meshSize.y, z: coordinateSize?.y ?? machineSize.z };

                    set3AxisMeshState(mesh, t, platSize);
                    this.setState({
                        environment: new Env3Axis(platSize)
                    });
                    this.worldTransform = new Matrix4();
                }
            }
            if (this.props.progress !== prevProps.progress && this.props.progress === 1) {
                this.props.selectTargetModel('cnc', selectedModel);
            }
        }
        return prevProps;
    }

    render() {
        const { mesh, hasModel, show, visible } = this.props;
        return (
            <React.Fragment>
                {hasModel && (
                    <div
                        style={{ position: 'fixed', top: '74px', right: '376px' }}
                    >
                        {show && (
                            <div className={classNames(
                                'border-default-grey-1',
                                // 'margin-top-16',
                                'module-default-shadow',
                                'border-radius-8',
                                'background-color-white'
                            )}
                            >
                                <div className="sm-flex height-40 border-bottom-normal padding-horizontal-16">
                                    <span className="sm-flex-width heading-3">{i18n._('key-Cnc/Stl3dview-STL 3D View')}</span>
                                </div>
                                <div className="padding-vertical-4 padding-horizontal-4 'background-color-white">
                                    <Canvas
                                        mesh={mesh}
                                        environment={this.state.environment}
                                        cameraInitialPosition={this.state.cameraInitialPosition}
                                        worldTransform={this.worldTransform}
                                        visible={visible}
                                    />
                                </div>
                            </div>

                        )}
                    </div>
                )}


            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const { modelGroup, materials, SVGActions, coordinateMode, coordinateSize, progress } = state.cnc;
    const { size } = state.machine;
    const selectedModel = modelGroup.getSelectedModel();
    let hasModel = false, mesh = null, transformation = null, direction = null, placement = null, sourceScale = null, visible = true;
    if (modelGroup.selectedModelArray.length === 1 && modelGroup.selectedModelArray[0].image3dObj) {
        const model = modelGroup.selectedModelArray[0];
        hasModel = true;
        mesh = model.image3dObj;
        visible = model.visible;
        transformation = SVGActions.getSelectedElementsTransformation();
        direction = model.config.direction;
        placement = model.config.placement;
        sourceScale = model.scale;
    }

    return {
        hasModel,
        mesh,
        materials,
        sourceScale,
        transformation,
        direction,
        placement,
        machineSize: size,
        coordinateMode,
        coordinateSize,
        visible,
        selectedModel,
        progress
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateStlVisualizer: (val) => dispatch(cncActions.updateStlVisualizer(val)),
        selectTargetModel: (headType, model) => dispatch(editorActions.selectTargetModel(headType, model)),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Cnc3DVisualizer);
