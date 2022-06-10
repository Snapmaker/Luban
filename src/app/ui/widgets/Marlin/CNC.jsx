import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { isNil, includes } from 'lodash';
import { actions as machineActions } from '../../../flux/machine';
import WorkSpeed from './WorkSpeed';
import i18n from '../../../lib/i18n';
import Switch from '../../components/Switch';
import {
    CONNECTION_TYPE_SERIAL,
    CONNECTION_TYPE_WIFI,
    WORKFLOW_STATE_PAUSED, WORKFLOW_STATE_RUNNING,
    WORKFLOW_STATUS_PAUSED,
    WORKFLOW_STATUS_RUNNING
} from '../../../constants';

class Printing extends PureComponent {
    static propTypes = {
        headStatus: PropTypes.bool,
        workflowStatus: PropTypes.string,
        workflowState: PropTypes.string,
        connectionType: PropTypes.string,
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
        isPrinting: () => {
            const { workflowStatus, workflowState, connectionType } = this.props;
            return (includes([WORKFLOW_STATUS_RUNNING, WORKFLOW_STATUS_PAUSED], workflowStatus) && connectionType === CONNECTION_TYPE_WIFI)
                || (includes([WORKFLOW_STATE_PAUSED, WORKFLOW_STATE_RUNNING], workflowState) && connectionType === CONNECTION_TYPE_SERIAL);
        }

    };

    getSnapshotBeforeUpdate(prevProps) {
        if (prevProps.headStatus !== this.props.headStatus && !isNil(this.props.headStatus)) {
            this.setState({
                headStatus: this.props.headStatus
            });
        }
        return prevProps;
    }

    componentDidUpdate() {

    }

    render() {
        const { headStatus } = this.state;
        const isPrinting = this.actions.isPrinting();
        return (
            <div>
                {isPrinting && <WorkSpeed />}
                <div className="sm-flex justify-space-between margin-vertical-8">
                    <span>{i18n._('key-unused-Toolhead')}</span>
                    <Switch
                        className="sm-flex-auto"
                        onClick={this.actions.onClickToolHead}
                        checked={headStatus}
                        disabled={isPrinting}
                    />
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    const { headStatus, workflowStatus, workflowState, connectionType } = machine;
    return {
        headStatus,
        workflowStatus,
        workflowState,
        connectionType
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        executeGcode: (gcode) => dispatch(machineActions.executeGcode(gcode))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Printing);
