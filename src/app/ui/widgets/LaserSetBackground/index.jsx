import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import SetBackground from './SetBackground';
import { HEAD_LASER } from '../../../constants';
import { getCurrentHeadType } from '../../../lib/url-utils';



class LaserSetBackgroundWidget extends PureComponent {
    static propTypes = {
        isConnected: PropTypes.bool,
        hideModal: PropTypes.func.isRequired
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
        const { isConnected, hideModal } = this.props;
        const state = this.state;
        const actions = this.actions;
        const headType = getCurrentHeadType(window.location.href);
        const isLaser = headType === HEAD_LASER;

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
    const { isConnected } = state.workspace;

    return {
        isConnected,
    };
};

export default connect(mapStateToProps)(LaserSetBackgroundWidget);
