import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';


class VisualizerInfo extends PureComponent {
    static propTypes = {
        state: PropTypes.shape({
            modelFileName: PropTypes.string,
            modelSizeX: PropTypes.number.isRequired,
            modelSizeY: PropTypes.number.isRequired,
            modelSizeZ: PropTypes.number.isRequired,
            filamentLength: PropTypes.number,
            filamentWeight: PropTypes.number,
            printTime: PropTypes.number
        })
    };

    getDescriptionOfSize() {
        const { modelSizeX, modelSizeY, modelSizeZ } = this.props.state;
        if (!modelSizeX) {
            return '';
        }
        return `${modelSizeX.toFixed(1)} x ${modelSizeY.toFixed(1)} x ${modelSizeZ.toFixed(1)} mm`;
    }

    getDescriptionOfFilament() {
        const { filamentLength, filamentWeight } = this.props.state;
        if (!filamentLength) {
            return '';
        }
        return `${filamentLength.toFixed(1)} m / ${filamentWeight.toFixed(1)} g`;
    }

    getDescriptionOfPrintTime() {
        const printTime = this.props.state.printTime;
        if (!printTime) {
            return '';
        }
        const hours = Math.floor(printTime / 3600);
        const minutes = Math.ceil((printTime - hours * 3600) / 60);
        return (hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`);
    }

    render() {
        const estimatedFilament = this.getDescriptionOfFilament();
        const estimatedTime = this.getDescriptionOfPrintTime();

        return (
            <React.Fragment>
                <p>{this.props.state.modelFileName}</p>
                <p>{this.getDescriptionOfSize()}</p>
                {estimatedFilament &&
                <p><span className="fa fa-bullseye" /> {this.getDescriptionOfFilament()}</p>
                }
                {estimatedTime &&
                <p><span className="fa fa-clock-o" /> {estimatedTime}</p>
                }
            </React.Fragment>
        );
    }
}

export default VisualizerInfo;
