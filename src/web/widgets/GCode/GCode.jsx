import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import GCodeStats from './GCodeStats';

class GCode extends PureComponent {
    static propTypes = {
        state: PropTypes.object,
        actions: PropTypes.object
    };

    render() {
        return (
            <GCodeStats {...this.props} />
        );
    }
}

export default GCode;
