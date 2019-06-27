import React, { PureComponent } from 'react';
import path from 'path';
import { connect } from 'react-redux';
import * as THREE from 'three';
import PropTypes from 'prop-types';
import { actions as printingActions } from '../../flux/printing';


/**
 * display gcode info when "displayedType === 'gcode'"
 * display model bbox info when there is a model selected
 */
class VisualizerInfo extends PureComponent {
    static propTypes = {
        // model: PropTypes.object,
        selectedModelID: PropTypes.string,
        displayedType: PropTypes.string.isRequired,
        printTime: PropTypes.number.isRequired,
        filamentLength: PropTypes.number.isRequired,
        filamentWeight: PropTypes.number.isRequired,
        boundingBox: PropTypes.object.isRequired,

        getSelectedModelOriginalName: PropTypes.func.isRequired
    };

    /*
    getSelectedModelPathDes() {
        const { model } = this.props;
        if (model) {
            return path.basename(model.modelName);
        }
        return '';
    }
    */

    getSelectedModelPathDes() {
        const { selectedModelID } = this.props;
        if (selectedModelID) {
            const originalName = this.props.getSelectedModelOriginalName();
            return path.basename(originalName);
        }
        return '';
    }

    getSelectedModelBBoxDes() {
        const { selectedModelID, boundingBox } = this.props;
        if (selectedModelID) {
            const whd = new THREE.Vector3(0, 0, 0);
            boundingBox.getSize(whd);
            // width-depth-height
            return `${whd.x.toFixed(1)} x ${whd.z.toFixed(1)} x ${whd.y.toFixed(1)} mm`;
        }
        return '';
    }

    getFilamentDes() {
        const { filamentLength, filamentWeight } = this.props;
        if (!filamentLength || !filamentWeight) {
            return '';
        }
        return `${filamentLength.toFixed(1)} m / ${filamentWeight.toFixed(1)} g`;
    }

    getPrintTimeDes() {
        const { printTime } = this.props;
        if (!printTime) {
            return '';
        }
        const hours = Math.floor(printTime / 3600);
        const minutes = Math.ceil((printTime - hours * 3600) / 60);
        return (hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`);
    }

    render() {
        const { selectedModelID, displayedType } = this.props;
        if (displayedType === 'gcode') {
            const filamentDes = this.getFilamentDes();
            const printTimeDes = this.getPrintTimeDes();
            return (
                <React.Fragment>
                    <p>
                        <span className="fa fa-bullseye" />
                        {filamentDes}
                    </p>
                    <p>
                        <span className="fa fa-clock-o" />
                        {printTimeDes}
                    </p>
                </React.Fragment>
            );
        } else if (selectedModelID) {
            const selectedModelPathDes = this.getSelectedModelPathDes();
            const selectedModelBoxDes = this.getSelectedModelBBoxDes();
            return (
                <React.Fragment>
                    <p>
                        <span />
                        {selectedModelPathDes}
                    </p>
                    <p>
                        <span />
                        {selectedModelBoxDes}
                    </p>
                </React.Fragment>
            );
        } else {
            return null;
        }
    }
}

const mapStateToProps = (state) => {
    const printing = state.printing;
    const { selectedModelID, displayedType, printTime, filamentLength, filamentWeight, boundingBox } = printing;

    return {
        selectedModelID,
        displayedType,
        printTime,
        filamentLength,
        filamentWeight,
        boundingBox
    };
};

const mapDispatchToProps = (dispatch) => ({
    getSelectedModelOriginalName: () => dispatch(printingActions.getSelectedModelOriginalName())
});

export default connect(mapStateToProps, mapDispatchToProps)(VisualizerInfo);
