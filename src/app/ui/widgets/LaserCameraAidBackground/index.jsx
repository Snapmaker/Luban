import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import SetBackground from './SetBackground';


class LaserAidBackgroundWidget extends PureComponent {
    static propTypes = {
        // isConnected: PropTypes.bool,
        hideModal: PropTypes.func.isRequired,
        materialThickness: PropTypes.number
    };

    state = {
        // showInstructions: false
    };

    render() {
        const { hideModal, materialThickness } = this.props;
        return (
            <SetBackground
                hideModal={hideModal}
                materialThickness={materialThickness}
            />
        );
    }
}
const mapStateToProps = (state) => {
    const { headType, isConnected } = state.machine;

    return {
        isConnected,
        headType
    };
};

export default connect(mapStateToProps)(LaserAidBackgroundWidget);
