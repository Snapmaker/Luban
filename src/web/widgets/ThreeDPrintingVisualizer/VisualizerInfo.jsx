import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';


class VisualizerInfo extends PureComponent {
    static propTypes = {
        state: PropTypes.shape({
            modelFileName: PropTypes.string
        })
    };

    render() {
        const state = this.props.state;
        return (
            <React.Fragment>
                <p>{state.modelFileName}</p>
                <p>46.3 x 37.9 x 43.4 mm</p>
                <p>Estimated Filament Use: 3.2m / 10g</p>
                <p>Estimated Time: 3h 2min</p>
            </React.Fragment>
        );
    }
}

export default VisualizerInfo;
