import React, { PureComponent } from 'react';
import { Color, HemisphereLight, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import PropTypes from 'prop-types';


class Thumbnail extends PureComponent {
    static propTypes = {
        modelGroup: PropTypes.object.isRequired,
        toolPathModelGroup: PropTypes.object.isRequired
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
        const width = 720;
        const height = 480;

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
        this.object = this.props.toolPathModelGroup.toolPathObjs.clone();
        const boundingBox = this.props.modelGroup.getAllBoundingBox();
        const y = (boundingBox.max.y + boundingBox.min.y) / 2;
        const x = (boundingBox.max.x + boundingBox.min.x) / 2;
        const z = 0;
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

        this.renderScene();

        return this.renderer.domElement.toDataURL();
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
