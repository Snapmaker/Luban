import React, { PureComponent } from 'react';
import { Color, HemisphereLight, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import PropTypes from 'prop-types';


class Thumbnail extends PureComponent {
    static propTypes = {
        modelGroup: PropTypes.object.isRequired
        // thumbnail: PropTypes.string.isRequired
    };

    state = {
        dataURL: ''
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

    getThumbnail() {
        this.object && (this.scene.remove(this.object));
        this.object = this.props.modelGroup.object.clone();
        const boundingBox = this.props.modelGroup.getAllBoundingBox();
        const y = (boundingBox.max.y - boundingBox.min.y) / 2;
        const x = (boundingBox.max.x + boundingBox.min.x) / 2;
        const z = (boundingBox.max.z + boundingBox.min.z) / 2;
        let rz = Math.max(
            boundingBox.max.y - boundingBox.min.y,
            boundingBox.max.x - boundingBox.min.x,
            boundingBox.max.z - boundingBox.min.z
        );
        rz = rz * Math.tan(Math.PI / 12) + rz;
        rz = rz * Math.tan(Math.PI / 6) + rz;
        for (const child of this.object.children) {
            child.position.x += -x;
            child.position.y += -y;
            child.position.z += -z;
        }
        this.object.rotation.y -= Math.PI / 6;
        this.object.rotation.x += Math.PI / 12;
        this.camera.position.copy(new Vector3(0, 0, rz));
        this.object.visible = true;
        this.scene.add(this.object);

        this.renderScene();

        const toDataURL = this.renderer.domElement.toDataURL();
        this.setState({
            dataURL: toDataURL
        });

        return toDataURL;
    }

    getDataURL() {
        return this.state.dataURL;
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
