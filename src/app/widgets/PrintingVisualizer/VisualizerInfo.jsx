import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';

import Space from '../../components/Space';


/**
 * display gcode info when "displayedType === 'gcode'"
 * display model bbox info when there is a model selected
 */
class VisualizerInfo extends PureComponent {
    static propTypes = {
        // model: PropTypes.object,
        selectedModelBBoxDes: PropTypes.string,
        displayedType: PropTypes.string.isRequired,
        printTime: PropTypes.number.isRequired,
        filamentLength: PropTypes.number.isRequired,
        filamentWeight: PropTypes.number.isRequired,
        selectedGroup: PropTypes.object
    };


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
        const { selectedGroup, displayedType, selectedModelBBoxDes } = this.props;
        if (displayedType === 'gcode') {
            const filamentDes = this.getFilamentDes();
            const printTimeDes = this.getPrintTimeDes();
            return (
                <React.Fragment>
                    <p>
                        <span className="fa fa-bullseye" />
                        <Space width={4} />
                        {filamentDes}
                    </p>
                    <p>
                        <span className="fa fa-clock-o" />
                        <Space width={4} />
                        {printTimeDes}
                    </p>
                </React.Fragment>
            );
        } else if (selectedGroup.children.length > 0) {
            return (
                <React.Fragment>
                    <p>
                        <span />
                        {selectedModelBBoxDes}
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
    const { modelGroup, displayedType, printTime, filamentLength, filamentWeight } = printing;
    return {
        selectedGroup: modelGroup.selectedGroup,
        displayedType,
        printTime,
        filamentLength,
        filamentWeight,
        selectedModelBBoxDes: modelGroup.getSelectedModelBBoxDes()
    };
};

export default connect(mapStateToProps)(VisualizerInfo);
