import React, { PureComponent } from 'react';
import path from 'path';
import * as THREE from 'three';
import PropTypes from 'prop-types';
import { STAGES_3DP } from '../../constants';

class VisualizerInfo extends PureComponent {
    static propTypes = {
        state: PropTypes.shape({
            filamentLength: PropTypes.number,
            filamentWeight: PropTypes.number,
            printTime: PropTypes.number,
            selectedModelBoundingBox: PropTypes.object,
            stage: PropTypes.number,
            selectedModel: PropTypes.object,
            gcodeLine: PropTypes.object,
            allModelBoundingBoxUnion: PropTypes.object
        })
    };

    getAllModelBoundingBoxUnionDes() {
        if (this.props.state.stage === STAGES_3DP.modelLoaded &&
            !this.props.state.selectedModel &&
            this.props.state.allModelBoundingBoxUnion) {
            const whd = new THREE.Vector3(0, 0, 0);
            this.props.state.allModelBoundingBoxUnion.getSize(whd);
            // width-depth-height
            return `${whd.x.toFixed(1)} x ${whd.z.toFixed(1)} x ${whd.y.toFixed(1)} mm`;
        }
        return '';
    }

    getModelPathDes() {
        if (this.props.state.stage === STAGES_3DP.modelLoaded &&
            this.props.state.selectedModel) {
            return path.basename(this.props.state.selectedModel.modelPath);
        }
        return '';
    }

    getModelBoundingBoxDes() {
        if (this.props.state.stage === STAGES_3DP.modelLoaded &&
            this.props.state.selectedModel &&
            this.props.state.selectedModelBoundingBox) {
            const whd = new THREE.Vector3(0, 0, 0);
            this.props.state.selectedModelBoundingBox.getSize(whd);
            // width-depth-height
            return `${whd.x.toFixed(1)} x ${whd.z.toFixed(1)} x ${whd.y.toFixed(1)} mm`;
        }
        return '';
    }

    getFilamentDes() {
        if (this.props.state.stage === STAGES_3DP.gcodeRendered &&
            this.props.state.gcodeLine) {
            const { filamentLength, filamentWeight } = this.props.state;
            if (!filamentLength || !filamentWeight) {
                return '';
            }
            return `${filamentLength.toFixed(1)} m / ${filamentWeight.toFixed(1)} g`;
        }
        return '';
    }

    getPrintTimeDes() {
        if (this.props.state.stage === STAGES_3DP.gcodeRendered &&
            this.props.state.gcodeLine) {
            const printTime = this.props.state.printTime;
            if (!printTime) {
                return '';
            }
            const hours = Math.floor(printTime / 3600);
            const minutes = Math.ceil((printTime - hours * 3600) / 60);
            return (hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`);
        }
        return '';
    }

    render() {
        const allModelBoundingBoxUnionDes = this.getAllModelBoundingBoxUnionDes();
        const modelPathDes = this.getModelPathDes();
        const modelBoxDes = this.getModelBoundingBoxDes();
        const estimatedFilamentDes = this.getFilamentDes();
        const estimatedTimeDes = this.getPrintTimeDes();
        return (
            <React.Fragment>
                {allModelBoundingBoxUnionDes &&
                <p><span />{allModelBoundingBoxUnionDes}</p>
                }
                {modelPathDes &&
                <p><span />{modelPathDes}</p>
                }
                {modelBoxDes &&
                <p><span />{modelBoxDes}</p>
                }
                {estimatedFilamentDes &&
                <p><span className="fa fa-bullseye" />{' ' + estimatedFilamentDes} </p>
                }
                {estimatedTimeDes &&
                <p><span className="fa fa-clock-o" />{' ' + estimatedTimeDes} </p>
                }
            </React.Fragment>
        );
    }
}

export default VisualizerInfo;
