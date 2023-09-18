import { WorkflowStatus } from '@snapmaker/luban-platform';
import _ from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';

import SocketEvent from '../../../communication/socket-events';
import { CONNECTION_TYPE_WIFI, } from '../../../constants';
import { controller } from '../../../communication/socket-communication';
import i18n from '../../../lib/i18n';
import AttributeContainer from './components/AttributeContainer';


class WorkSpeed extends React.PureComponent {
    static propTypes = {
        workflowStatus: PropTypes.string,
        connectionType: PropTypes.string,
        toolHead: PropTypes.string.isRequired,
    };


    state = {
        workSpeedValue: 100
    };

    actions = {
        isWifiPrinting: () => {
            const { workflowStatus, connectionType } = this.props;
            return _.includes([WorkflowStatus.Running, WorkflowStatus.Paused], workflowStatus)
                && connectionType === CONNECTION_TYPE_WIFI;
        },
        onClickWorkSpeed: (value) => {
            this.setState({
                workSpeedValue: value
            });
            controller.emitEvent(SocketEvent.SetSpeedFactor, {
                workSpeedValue: value,
                toolHead: this.props.toolHead,
            });
        }
    };

    render() {
        const { workSpeedValue } = this.state;
        const actions = this.actions;
        return (
            <AttributeContainer
                handleSubmit={(value) => { actions.onClickWorkSpeed(value); }}
                initValue={workSpeedValue}
                title={i18n._('key-Workspace/Marlin-Work Speed')}
                suffix="%"
                inputMax={500}
                inputMin={1}
            >
                <div className="width-44 sm-flex align-center margin-left-16 ">
                    <span>{workSpeedValue} %</span>
                </div>
            </AttributeContainer>
        );
    }
}

const mapStateToProps = (state) => {
    const { workflowStatus, connectionType, server } = state.workspace;
    const { toolHead } = state.workspace;

    return {
        workflowStatus,
        connectionType,
        server,
        toolHead
    };
};


const mapDispatchToProps = () => {
    return {
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(WorkSpeed);
