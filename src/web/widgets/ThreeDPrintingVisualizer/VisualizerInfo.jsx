import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';


class VisualizerInfo extends PureComponent {
    static propTypes = {
        state: PropTypes.shape({
            modelFileName: PropTypes.string
        })
    };

    getDescriptionOfPrintTime() {
        if (!this.props.state.printTime) {
            return '';
        }
        let printTime = this.props.state.printTime;
        let hours = Math.floor(printTime / 3600);
        let minutes = Math.ceil((printTime - hours * 3600) / 60);
        return 'Estimated Time: ' + ((hours > 0) ? (hours + ' h ' + minutes + ' min') : (minutes + ' min'));
    }

    getDescriptionOfSize() {
        if (!this.props.state.modelSizeX ||
            !this.props.state.modelSizeY ||
            !this.props.state.modelSizeZ) {
            return '';
        }
        return this.props.state.modelSizeX.toFixed(1) +
            ' x ' +
            this.props.state.modelSizeY.toFixed(1) +
            ' x ' +
            this.props.state.modelSizeZ.toFixed(1) +
            ' mm';
    }

    getDescriptionOfFilament() {
        if (!this.props.state.filamentLength || !this.props.state.filamentLength) {
            return '';
        }
        return 'Estimated Filament Use: ' +
            this.props.state.filamentLength.toFixed(1) +
            'm / ' +
            this.props.state.filamentWeight.toFixed(1) +
            'g';
    }

    render() {
        return (
            <React.Fragment>
                <p>{this.props.state.modelFileName}</p>
                <p>{this.getDescriptionOfSize()}</p>
                <p>{this.getDescriptionOfFilament()}</p>
                <p>{this.getDescriptionOfPrintTime()}</p>
            </React.Fragment>
        );
    }
}

export default VisualizerInfo;
