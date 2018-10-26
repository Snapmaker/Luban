import React, { Component } from 'react';
import * as THREE from 'three';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Canvas from '../Canvas/Canvas';


class Visualizer extends Component {
    static propTypes = {
        source: PropTypes.object.isRequired,
        target: PropTypes.object.isRequired
    };

    state = {
        modelGroup: new THREE.Group()
    };

    componentWillReceiveProps(nextProps) {
        const { processed, width, height, anchor } = { ...nextProps.source, ...nextProps.target };
        // FIXME: callback twice
        // if any changed, update modelGroup
        // not support multi-models
        this.state.modelGroup.remove(...this.state.modelGroup.children);
        const geometry = new THREE.PlaneGeometry(width, height);
        const texture = new THREE.TextureLoader().load(processed);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
            opacity: 0.75,
            transparent: true
        });
        const mesh = new THREE.Mesh(geometry, material);
        let position = new THREE.Vector3(0, 0, 0);
        switch (anchor) {
            case 'Center':
            case 'Center Left':
            case 'Center Right':
                position = new THREE.Vector3(0, 0, 0);
                break;
            case 'Bottom Left':
                position = new THREE.Vector3(width / 2, height / 2, 0);
                break;
            case 'Bottom Middle':
                position = new THREE.Vector3(0, height / 2, 0);
                break;
            case 'Bottom Right':
                position = new THREE.Vector3(-width / 2, height / 2, 0);
                break;
            case 'Top Left':
                position = new THREE.Vector3(width / 2, -height / 2, 0);
                break;
            case 'Top Middle':
                position = new THREE.Vector3(0, -height / 2, 0);
                break;
            case 'Top Right':
                position = new THREE.Vector3(-width / 2, -height / 2, 0);
                break;
            default:
                break;
        }
        mesh.position.copy(position);
        this.state.modelGroup.add(mesh);
    }

    render() {
        return (
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
                <Canvas
                    mode="laser"
                    modelGroup={this.state.modelGroup}
                    transformMode="translate"
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        source: state.laser.source,
        target: state.laser.target
    };
};

export default connect(mapStateToProps)(Visualizer);
