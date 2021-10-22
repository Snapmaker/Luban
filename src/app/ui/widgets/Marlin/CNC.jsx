import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import _ from 'lodash';
import { actions as machineActions } from '../../../flux/machine';
import WorkSpeed from './WorkSpeed';
import i18n from '../../../lib/i18n';
import Switch from '../../components/Switch';
import { WORKFLOW_STATUS_PAUSED, WORKFLOW_STATUS_RUNNING } from '../../../constants';

class Printing extends PureComponent {
    static propTypes = {
        headStatus: PropTypes.bool,
        workflowStatus: PropTypes.string,
        executeGcode: PropTypes.func.isRequired
    };

    state = {
        headStatus: this.props.headStatus
    };

    actions = {
        onClickToolHead: () => {
            if (this.state.headStatus) {
                this.props.executeGcode('M5');
            } else {
                this.props.executeGcode('M3 P100');
            }
            this.setState({
                headStatus: !this.state.headStatus
            });
        },
        isWorking: () => {
            const { workflowStatus } = this.props;
            return _.includes([WORKFLOW_STATUS_RUNNING, WORKFLOW_STATUS_PAUSED], workflowStatus);
        }
    };

    render() {
        const { headStatus } = this.state;
        const { workflowStatus } = this.props;
        const isWorking = this.actions.isWorking();
        return (
            <div>
                {workflowStatus === 'running' && <WorkSpeed />}
                {workflowStatus !== 'running' && (
                    <div className="sm-flex justify-space-between margin-vertical-8">
                        <span>{i18n._('key-unused-Toolhead')}</span>
                        <Switch
                            className="sm-flex-auto"
                            onClick={this.actions.onClickToolHead}
                            checked={headStatus}
                            disabled={isWorking}
                        />
                    </div>
                )}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    const { headStatus, workflowStatus } = machine;
    return {
        headStatus,
        workflowStatus
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        executeGcode: (gcode) => dispatch(machineActions.executeGcode(gcode))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Printing);
