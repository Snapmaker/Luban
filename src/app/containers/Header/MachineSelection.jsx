import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { actions as machineActions } from '../../flux/machine';
import MachineSelectModal from '../../modals/modal-machine-select';
import { CONNECTION_STATUS_CONNECTED } from '../../constants';

class MachineSelection extends Component {
    static propTypes = {
        series: PropTypes.string.isRequired,
        headType: PropTypes.string,
        canReselectMachine: PropTypes.bool,
        connectionStatus: PropTypes.string,

        updateMachineState: PropTypes.func.isRequired
    };

    actions= {
        onClick: () => {
            const { series, headType, connectionStatus } = this.props;
            MachineSelectModal({
                series,
                headType,
                hasHead: connectionStatus === CONNECTION_STATUS_CONNECTED,
                onConfirm: (seriesT, headTypeT) => {
                    this.props.updateMachineState({
                        series: seriesT,
                        headType: headTypeT
                    });
                }
            });
        }
    };

    render() {
        const { canReselectMachine, connectionStatus } = this.props;
        const disabled = connectionStatus === CONNECTION_STATUS_CONNECTED && !canReselectMachine;
        return (
            <div style={{
                height: '100%',
                position: 'absolute'
            }}
            >
                <span style={{
                    borderLeft: '1px solid #777'
                }}
                />
                <button
                    style={{
                        backgroundColor: '#f8f8f8',
                        fontSize: '18px',
                        height: '100%'
                    }}
                    disabled={disabled}
                    type="button"
                    className="btn"
                    onClick={this.actions.onClick}
                >{this.props.series}
                </button>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const { series, headType, canReselectMachine, connectionStatus } = state.machine;
    return {
        series,
        headType,
        canReselectMachine,
        connectionStatus
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateMachineState: (state) => dispatch(machineActions.updateMachineState(state))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(MachineSelection);
