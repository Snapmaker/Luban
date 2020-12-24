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

import { actions as cncActions } from '../../flux/cnc';

import { DIRECTION_BACK, DIRECTION_DOWN, DIRECTION_FRONT, DIRECTION_LEFT, DIRECTION_RIGHT, DIRECTION_UP } from '../../constants';

import i18n from '../../lib/i18n';
import styles from './styles.styl';

const texture = new TextureLoader().load('../images/wood.png');

const directionMatrixes = {
    [DIRECTION_FRONT]: new Matrix4(),
    [DIRECTION_BACK]: new Matrix4().makeRotationZ(Math.PI),
    [DIRECTION_LEFT]: new Matrix4().makeRotationZ(Math.PI / 2),
    [DIRECTION_RIGHT]: new Matrix4().makeRotationZ(-Math.PI / 2),
    [DIRECTION_UP]: new Matrix4().makeRotationX(Math.PI / 2),
    [DIRECTION_DOWN]: new Matrix4().makeRotationX(-Math.PI / 2)
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


const setMeshTransform = (mesh, transformation, direction = DIRECTION_FRONT) => {
    mesh.applyMatrix(new Matrix4().getInverse(mesh.matrix));
    mesh.applyMatrix(directionMatrixes[direction]);

    mesh.applyMatrix(new Matrix4().makeScale(transformation.scaleX, Math.abs(transformation.scaleY), transformation.scaleY));
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

    const size = getMeshSize(mesh);
    const radius = Math.sqrt(size.x ** 2 + size.y ** 2) / 2;
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
    mesh.applyMatrix(new Matrix4().makeRotationZ(-transformation.positionX / radius));
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
        transformation: PropTypes.object,
        machineSize: PropTypes.object,
        direction: PropTypes.string,
        updateStlVisualizer: PropTypes.func
    };

    environment = null;


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
            const { mesh, materials, transformation, direction, machineSize } = nextProps;
            if (mesh !== this.props.mesh || materials.isRotate !== this.props.materials.isRotate
                || transformation !== this.props.transformation || direction !== this.props.direction
            ) {
                mesh.remove(...mesh.children);
                mesh.material = new MeshPhongMaterial({ color: 0xa0a0a0, specular: 0xb0b0b0, shininess: 0 });
                setMeshTransform(mesh, transformation, direction);
                this.cameraInitialPosition = new Vector3(0, -machineSize.z * 1.3, 0);

                if (materials.isRotate) {
                    set4AxisMeshState(mesh, transformation, materials);

                    this.environment = new Env4Axis(mesh, materials);
                    this.worldTransform = new Matrix4().makeRotationY(Math.PI);
                } else {
                    const meshSize = getMeshSize(mesh);
                    const platSize = { x: machineSize.x, y: meshSize.y, z: machineSize.z };

                    set3AxisMeshState(mesh, transformation, platSize);

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
    const { modelGroup, materials } = state.cnc;
    const { size } = state.machine;
    let hasModel = false, mesh = null, transformation = null, direction = null;
    if (modelGroup.selectedModelArray.length === 1 && modelGroup.selectedModelArray[0].image3dObj) {
        const model = modelGroup.selectedModelArray[0];
        hasModel = true;
        mesh = model.image3dObj;
        transformation = model.transformation;
        direction = model.config.direction;
    }

    return {
        hasModel, mesh, materials, transformation, direction, machineSize: size
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateStlVisualizer: (val) => dispatch(cncActions.updateStlVisualizer(val))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Cnc3DVisualizer);
