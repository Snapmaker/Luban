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
            stage: PropTypes.number,
            gcodeLine: PropTypes.object
        }),
        modelGroup: PropTypes.object.isRequired
    };

    state = {
        selectedModel: null,
        selectedModelBBox: new THREE.Box3(new THREE.Vector3(), new THREE.Vector3()),
        modelsBBox: new THREE.Box3(new THREE.Vector3(), new THREE.Vector3())
    };

    constructor(props) {
        super(props);
        this.props.modelGroup.addChangeListener((args) => {
            const { modelsBBox, model } = args;

            const selectedModel = model;
            let selectedModelBBox = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
            if (selectedModel) {
                selectedModel.computeBoundingBox();
                selectedModelBBox = selectedModel.boundingBox;
            }
            this.setState({
                selectedModel: selectedModel,
                selectedModelBBox: selectedModelBBox,
                modelsBBox: modelsBBox
            });
        });
    }

    getModelsBBoxDes() {
        if (!this.state.selectedModel && this.state.modelsBBox) {
            const whd = new THREE.Vector3(0, 0, 0);
            this.state.modelsBBox.getSize(whd);
            // width-depth-height
            return `${whd.x.toFixed(1)} x ${whd.z.toFixed(1)} x ${whd.y.toFixed(1)} mm`;
        }
        return '';
    }

    getSelectedModelPathDes() {
        if (this.state.selectedModel) {
            return path.basename(this.state.selectedModel.modelName);
        }
        return '';
    }

    getSelectedModelBBoxDes() {
        if (this.state.selectedModel && this.state.selectedModelBBox) {
            const whd = new THREE.Vector3(0, 0, 0);
            this.state.selectedModelBBox.getSize(whd);
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
        const modelsBBoxDes = this.getModelsBBoxDes();
        const selectedModelPathDes = this.getSelectedModelPathDes();
        const selectedModelBoxDes = this.getSelectedModelBBoxDes();
        const filamentDes = this.getFilamentDes();
        const printTimeDes = this.getPrintTimeDes();
        return (
            <React.Fragment>
                {modelsBBoxDes &&
                <p><span />{modelsBBoxDes}</p>
                }
                {selectedModelPathDes &&
                <p><span />{selectedModelPathDes}</p>
                }
                {selectedModelBoxDes &&
                <p><span />{selectedModelBoxDes}</p>
                }
                {filamentDes &&
                <p><span className="fa fa-bullseye" />{' ' + filamentDes} </p>
                }
                {printTimeDes &&
                <p><span className="fa fa-clock-o" />{' ' + printTimeDes} </p>
                }
            </React.Fragment>
        );
    }
}

export default VisualizerInfo;
