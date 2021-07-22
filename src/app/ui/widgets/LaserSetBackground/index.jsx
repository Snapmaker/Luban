import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import SetBackground from './SetBackground';
import { MACHINE_HEAD_TYPE } from '../../../constants';


class LaserSetBackgroundWidget extends PureComponent {
    static propTypes = {
        isConnected: PropTypes.bool,
        hideModal: PropTypes.func.isRequired,
        headType: PropTypes.string
    };

    state = {
        showInstructions: false
    };

    actions = {
        showInstructions: () => {
            this.setState({ showInstructions: true });
        },
        hideInstructions: () => {
            this.setState({ showInstructions: false });
        }
    };


    render() {
        const { isConnected, headType, hideModal } = this.props;
        const state = this.state;
        const actions = this.actions;
        const isLaser = headType === MACHINE_HEAD_TYPE.LASER.value;

        return (
            <SetBackground
                showInstructions={state.showInstructions}
                hideModal={hideModal}
                isConnected={isConnected}
                isLaser={isLaser}
                actions={actions}
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

export default connect(mapStateToProps)(LaserSetBackgroundWidget);
