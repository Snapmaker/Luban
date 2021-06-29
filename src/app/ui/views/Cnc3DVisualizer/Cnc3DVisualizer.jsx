import { Vector3, Matrix4, MeshPhongMaterial, TextureLoader
    // DoubleSide, CylinderGeometry,Mesh
} from 'three';

import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';

import Canvas from './Canvas';
import Env3Axis from './Env3Axis';
import Env4Axis from './Env4Axis';

import { actions as cncActions } from '../../../flux/cnc';

import {
    BACK,
    BOTTOM,
    FRONT,
    LEFT,
    RIGHT,
    TOP
} from '../../../constants';

import i18n from '../../../lib/i18n';
import styles from './styles.styl';

const texture = new TextureLoader().load('../resources/images/wood.png');

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
    geometry.applyMatrix(mesh.matrix);
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
    mesh.applyMatrix(new Matrix4().getInverse(mesh.matrix));
    mesh.applyMatrix(isRotate ? placementMatrixes[placement] : directionMatrixes[direction]);

    mesh.applyMatrix(new Matrix4().makeScale(transformation.scaleX * sourceScale, Math.abs(transformation.scaleY * sourceScale), transformation.scaleY * sourceScale));
};


const set3AxisMeshState = (mesh, transformation, platSize) => {
    const { positionX: x, positionY: z, width, height } = transformation;
    mesh.position.set(x, 0, z);
    if (Math.abs(x) + width / 2 > platSize.x / 2 || Math.abs(z) + height / 2 > platSize.z / 2) {
        const material = new MeshPhongMaterial({ color: 0xff0000, specular: 0xb0b0b0, shininess: 0 });
        mesh.material = material;
    }
};

const set4AxisMeshState = async (mesh, transformation, materials) => {
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

    mesh.position.set(0, 0, materials.length / 2 - transformation.positionY);
    mesh.updateMatrix();
    if (radius) {
        mesh.applyMatrix(new Matrix4().makeRotationZ(-transformation.positionX / radius));
    }

    if (radius > materials.diameter / 2) {
        const material = new MeshPhongMaterial({ color: 0xff0000, specular: 0xb0b0b0, shininess: 0 });
        mesh.material = material;
    }
};

class Cnc3DVisualizer extends PureComponent {
    static propTypes = {
        hasModel: PropTypes.bool,
        mesh: PropTypes.object,
        materials: PropTypes.object,
        sourceScale: PropTypes.number,
        transformation: PropTypes.object,
        machineSize: PropTypes.object,
        direction: PropTypes.string,
        placement: PropTypes.string,
        updateStlVisualizer: PropTypes.func,
        coordinateMode: PropTypes.object,
        coordinateSize: PropTypes.object
    };

    environment = null;

    cameraInitialPosition = null;

    state = {
        show: true
    };

    actions = {
        hideCnc3DVisualizer: () => {
            this.props.updateStlVisualizer({ show: false });
        }
    };

    componentWillReceiveProps(nextProps) {
        if (nextProps.hasModel) {
            const { mesh, materials, sourceScale, transformation, direction, placement, machineSize, coordinateSize, coordinateMode } = nextProps;
            if (mesh !== this.props.mesh || materials.isRotate !== this.props.materials.isRotate
                || materials.diameter !== this.props.materials.diameter
                || materials.length !== this.props.materials.length
                || transformation !== this.props.transformation || direction !== this.props.direction
                || this.props.coordinateSize !== coordinateSize
                || this.props.coordinateMode !== coordinateMode
            ) {
                const t = getModelTransformation(transformation, machineSize, coordinateMode, coordinateSize);
                mesh.remove(...mesh.children);
                mesh.material = new MeshPhongMaterial({ color: 0xa0a0a0, specular: 0xb0b0b0, shininess: 0 });

                setMeshTransform(mesh, sourceScale, t, materials.isRotate, direction, placement);
                if (!this.cameraInitialPosition || machineSize.z !== this.props.machineSize.z) {
                    this.cameraInitialPosition = new Vector3(0, -machineSize.z * 1.3, 0);
                }

                if (materials.isRotate) {
                    set4AxisMeshState(mesh, t, materials);

                    this.environment = new Env4Axis(mesh, materials);
                    this.worldTransform = new Matrix4().makeRotationY(Math.PI);
                } else {
                    const meshSize = getMeshSize(mesh);
                    const platSize = { x: coordinateSize?.x ?? machineSize.x, y: meshSize.y, z: coordinateSize?.y ?? machineSize.z };

                    set3AxisMeshState(mesh, t, platSize);

                    this.environment = new Env3Axis(platSize);
                    this.worldTransform = new Matrix4();
                }
            }
        }
    }

    render() {
        const { mesh, hasModel } = this.props;
        const { show } = this.state;
        return (
            <React.Fragment>
                {hasModel && (
                    <div
                        className={classNames(styles['manager-content'])}
                        style={{ position: 'fixed', top: '58px', right: '370px' }}
                    >
                        {show && (

                            <div

                                style={{
                                    backgroundColor: '#fff',
                                    width: '400px',
                                    height: '260px',
                                    boxShadow: '0px 4px 12px 0px rgba(115, 115, 115, 0.5)' }}
                            >
                                <button
                                    type="button"
                                    style={{
                                        border: 'none',
                                        backgroundColor: '#ffffff00',
                                        fontSize: '16px',
                                        color: '#838383',
                                        position: 'absolute',
                                        right: '8px',
                                        top: '8px'
                                    }}
                                    onClick={() => this.setState({ show: false })}
                                >
                                    <i

                                        className="fa fa-close"


                                    />
                                </button>

                                <Canvas
                                    mesh={mesh}
                                    environment={this.environment}
                                    cameraInitialPosition={this.cameraInitialPosition}
                                    worldTransform={this.worldTransform}
                                />
                            </div>

                        )}
                        {!show && (
                            <button
                                type="button"
                                className="sm-btn-small"
                                onClick={() => this.setState({ show: true })}
                            >
                                {i18n._('Model View')}
                            </button>
                        )}
                    </div>
                )}


            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const { modelGroup, materials, SVGActions, coordinateMode, coordinateSize } = state.cnc;
    const { size } = state.machine;
    let hasModel = false, mesh = null, transformation = null, direction = null, placement = null, sourceScale = null;
    if (modelGroup.selectedModelArray.length === 1 && modelGroup.selectedModelArray[0].image3dObj) {
        const model = modelGroup.selectedModelArray[0];
        hasModel = true;
        mesh = model.image3dObj;
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
        coordinateSize
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateStlVisualizer: (val) => dispatch(cncActions.updateStlVisualizer(val))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Cnc3DVisualizer);
