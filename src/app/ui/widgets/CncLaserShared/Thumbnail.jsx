import React, { PureComponent } from 'react';
import { Box3, Color, HemisphereLight, PerspectiveCamera, Scene, Vector3 } from 'three';
import PropTypes from 'prop-types';

import ThreeUtils from '../../../scene/three-extensions/ThreeUtils';
import WebGLRendererWrapper from '../../../scene/three-extensions/WebGLRendererWrapper';
import { SnapmakerArtisanMachine } from '../../../machines';

class Thumbnail extends PureComponent {
    static propTypes = {
        toolPathGroup: PropTypes.object.isRequired
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


        this.renderer = new WebGLRendererWrapper({ antialias: true, preserveDrawingBuffer: true });
        this.renderer = new WebGLRendererWrapper({
            antialias: true,
            preserveDrawingBuffer: true,
            alpha: true,
            clearColor: new Color(0xffffff),
        });
        this.renderer.setSize(width, height);

        this.scene = new Scene();
        this.scene.add(this.camera);

        this.scene.add(new HemisphereLight(0x000000, 0xe0e0e0));

        this.node.current.appendChild(this.renderer.domElement);
        this.renderScene();
    }

    componentWillUnmount() {
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }
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

    getThumbnail(series) {
        if (series === SnapmakerArtisanMachine.identifier) {
            this.camera.aspect = 600 / 600;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(600, 600);
        }
        this.object && (this.scene.remove(this.object));

        this.object = this.props.toolPathGroup.getThumbnailObject();
        this.object.visible = true;
        const boundingBox = ThreeUtils.computeBoundingBox(this.object);
        const y = (boundingBox.max.y + boundingBox.min.y) / 2;
        const x = (boundingBox.max.x + boundingBox.min.x) / 2;
        const z = 0;
        this.object.position.x += -x;
        this.object.position.y += -y;
        this.object.position.z += -z;

        const bbbx = new Box3();
        bbbx.expandByObject(this.object);
        const rz = Math.max(
            bbbx.max.x - bbbx.min.x,
            bbbx.max.y - bbbx.min.y,
            bbbx.max.z - bbbx.min.z
        );
        const p = rz / 2 / Math.tan(22.5 / 180 * Math.PI);

        this.camera.position.copy(new Vector3(0, 0, (p)));
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
