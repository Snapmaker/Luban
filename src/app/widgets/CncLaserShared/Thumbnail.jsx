import React, { PureComponent } from 'react';
import { Color, HemisphereLight, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import PropTypes from 'prop-types';


class Thumbnail extends PureComponent {
    static propTypes = {
        modelGroup: PropTypes.object.isRequired
        // thumbnail: PropTypes.string.isRequired
    };

    state = {
    };

    node = React.createRef();

    constructor(props) {
        super(props);
        // threejs
        this.camera = null;
        this.renderer = null;
        this.scene = null;
        this.object = null;
    }


    componentDidMount() {
        const width = 300;
        const height = 200;

        this.camera = new PerspectiveCamera(45, width / height, 0.1, 10000);
        this.camera.position.copy(new Vector3(0, 120, 500));


        this.renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        this.renderer.setClearColor(new Color(0xfafafa), 1);
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;

        this.scene = new Scene();
        this.scene.add(this.camera);

        this.scene.add(new HemisphereLight(0x000000, 0xe0e0e0));

        this.node.current.appendChild(this.renderer.domElement);
        this.renderScene();
    }

    // componentDidUpdate(prevProps) {
    //     if (this.props.minimized !== prevProps.minimized) {
    //         const width = this.getVisibleWidth();
    //         const height = this.getVisibleHeight();
    //         this.renderer.setSize(width, height);
    //         this.renderScene();
    //     }
    // }
    //
    // getVisibleWidth() {
    //     return this.node.current.parentElement.clientWidth;
    // }
    //
    // getVisibleHeight() {
    //     return this.node.current.parentElement.clientHeight;
    // }

    getThumbnail() {
        this.object && (this.scene.remove(this.object));
        this.object = this.props.modelGroup.object.clone();
        const models = this.props.modelGroup.models;
        const boundingBox = { max: { x: null, y: null, z: null }, min: { x: null, y: null, z: null } };
        for (const model of models) {
            const modelBoundingBox = {
                max: {
                    x: model.transformation.positionX + model.transformation.width / 2,
                    y: model.transformation.positionY + model.transformation.height / 2,
                    z: 0
                },
                min: {
                    x: model.transformation.positionX - model.transformation.width / 2,
                    y: model.transformation.positionY - model.transformation.height / 2,
                    z: 0
                }
            };
            boundingBox.max.x = boundingBox.max.x ? Math.max(boundingBox.max.x, modelBoundingBox.max.x) : modelBoundingBox.max.x;
            boundingBox.max.y = boundingBox.max.y ? Math.max(boundingBox.max.y, modelBoundingBox.max.y) : modelBoundingBox.max.y;
            boundingBox.max.z = boundingBox.max.z ? Math.max(boundingBox.max.z, modelBoundingBox.max.z) : modelBoundingBox.max.z;
            boundingBox.min.x = boundingBox.min.x ? Math.min(boundingBox.min.x, modelBoundingBox.min.x) : modelBoundingBox.min.x;
            boundingBox.min.y = boundingBox.min.y ? Math.min(boundingBox.min.y, modelBoundingBox.min.y) : modelBoundingBox.min.y;
            boundingBox.min.z = boundingBox.min.z ? Math.min(boundingBox.min.z, modelBoundingBox.min.z) : modelBoundingBox.min.z;
        }
        const y = (boundingBox.max.y + boundingBox.min.y) / 2;
        const x = (boundingBox.max.x + boundingBox.min.x) / 2;
        const z = (boundingBox.max.z + boundingBox.min.z) / 2;
        const rz = Math.max(
            boundingBox.max.y - boundingBox.min.y,
            boundingBox.max.x - boundingBox.min.x,
            boundingBox.max.z - boundingBox.min.z
        );
        this.object.position.x += -x;
        this.object.position.y += -y;
        this.object.position.z += -z;
        this.camera.position.copy(new Vector3(0, 0, rz + 20));
        this.scene.add(this.object);
        console.log(this.scene);

        this.renderScene();

        const dataURL = this.renderer.domElement.toDataURL();
        console.log(dataURL);
        models[0].gcodeConfig.thumbnail = dataURL;

        return dataURL;
    }

    renderScene() {
        this.renderer.render(this.scene, this.camera);
    }

    render() {
        return (
            <div
                style={{
                    position: 'absolute',
                    display: 'none'
                    // top: 0
                }}
                ref={this.node}
            />
        );
    }
}


export default Thumbnail;
