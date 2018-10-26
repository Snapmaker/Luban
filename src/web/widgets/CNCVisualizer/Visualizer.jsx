import React, { Component } from 'react';
import * as THREE from 'three';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import Canvas from '../Canvas/Canvas';
import i18n from '../../lib/i18n';
import { actions } from '../../reducers/modules/cnc';
import UploadControl from './UploadControl';
import modal from '../../lib/modal';


class Visualizer extends Component {
    static propTypes = {
        // from redux
        imageParams: PropTypes.object.isRequired,
        anchor: PropTypes.string.isRequired,
        uploadImage: PropTypes.func.isRequired
    };

    modelGroup = new THREE.Group();

    actions = {
        onChangeFile: (event) => {
            const file = event.target.files[0];
            this.props.uploadImage(file, () => {
                modal({
                    title: i18n._('Parse Image Error'),
                    body: i18n._('Failed to parse image file {{}}', { filename: file.name })
                });
            });
        }
    };

    componentDidMount() {
        this.updateModel(this.props.imageParams, this.props.anchor);
    }

    componentWillReceiveProps(nextProps) {
        this.updateModel(nextProps.imageParams, nextProps.anchor);
    }

    updateModel(imageParams, anchor) {
        // FIXME: callback several times
        // if any changed, update modelGroup
        // not support multi-models
        const { imageSrc, sizeWidth, sizeHeight } = imageParams;
        this.modelGroup.remove(...this.modelGroup.children);
        const geometry = new THREE.PlaneGeometry(sizeWidth, sizeHeight);
        const texture = new THREE.TextureLoader().load(imageSrc);
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
                position = new THREE.Vector3(sizeWidth / 2, sizeHeight / 2, 0);
                break;
            case 'Bottom Middle':
                position = new THREE.Vector3(0, sizeHeight / 2, 0);
                break;
            case 'Bottom Right':
                position = new THREE.Vector3(-sizeWidth / 2, sizeHeight / 2, 0);
                break;
            case 'Top Left':
                position = new THREE.Vector3(sizeWidth / 2, -sizeHeight / 2, 0);
                break;
            case 'Top Middle':
                position = new THREE.Vector3(0, -sizeHeight / 2, 0);
                break;
            case 'Top Right':
                position = new THREE.Vector3(-sizeWidth / 2, -sizeHeight / 2, 0);
                break;
            default:
                break;
        }
        mesh.position.copy(position);
        this.modelGroup.add(mesh);
    }

    render() {
        return (
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
                <div style={{ position: 'absolute', top: '15px', left: '15px' }}>
                    <UploadControl
                        onChangeFile={this.actions.onChangeFile}
                    />
                </div>
                <Canvas
                    mode="cnc"
                    modelGroup={this.modelGroup}
                    transformMode="translate"
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        imageParams: state.cnc.imageParams,
        anchor: state.cnc.pathParams.anchor
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        uploadImage: (file, onFailure) => dispatch(actions.uploadImage(file, onFailure))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Visualizer);
