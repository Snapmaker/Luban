import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

class VisualizerInfo extends PureComponent {
    static propTypes = {
        state: PropTypes.shape({
            filamentLength: PropTypes.number,
            filamentWeight: PropTypes.number,
            printTime: PropTypes.number,
            modelsBoundingBox: PropTypes.object
        })
    };

    state = this.getInitialState();
    getInitialState() {
        return {
            modelsName: '',
            length: 0,
            height: 0,
            depth: 0
        };
    }
    getDescriptionOfSize() {
        const { length, height, depth } = this.state;
        if (length * height * depth === 0) {
            return '';
        }
        return `${length.toFixed(1)} x ${height.toFixed(1)} x ${depth.toFixed(1)} mm`;
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

    componentWillReceiveProps(nextProps) {
        if (JSON.stringify(nextProps.state.modelsBoundingBox) !== JSON.stringify(this.props.state.modelsBoundingBox)) {
            const box = nextProps.state.modelsBoundingBox;
            this.setState({
                length: box.max.x - box.min.x,
                height: box.max.y - box.min.y,
                depth: box.max.z - box.min.z
            });
        }
    }

    render() {
        const estimatedFilament = this.getDescriptionOfFilament();
        const estimatedTime = this.getDescriptionOfPrintTime();

        return (
            <React.Fragment>
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
