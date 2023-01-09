import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import i18n from '../../../lib/i18n';
import {
    WidgetState
} from '../../components/SMWidget';
import TestFocus from './TestFocus';
import { HEAD_LASER } from '../../../constants';


class LaserTestFocusWidget extends PureComponent {
    static propTypes = {
        headType: PropTypes.string,
        widgetActions: PropTypes.object.isRequired,
        isConnected: PropTypes.bool.isRequired,
        workflowState: PropTypes.string,
        connectionType: PropTypes.string,
        series: PropTypes.string
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

    constructor(props) {
        super(props);
        WidgetState.bind(this);
        // Todo, add to widget state?
        props.widgetActions.setTitle(i18n._('key-Workspace/Fine-tuneWorkOrigin-Fine-tune Work Origin'));
    }

    componentDidMount() {
        const { isConnected, headType, connectionType, series } = this.props;
        if (headType === HEAD_LASER && isConnected && connectionType === 'serial' && (series === 'Original' || series === 'Original Long Z-axis')) {
            this.props.widgetActions.setDisplay(true);
        } else {
            this.props.widgetActions.setDisplay(false);
        }
    }

    componentDidUpdate(prevProps) {
        const { isConnected, headType, workflowState, connectionType, series } = this.props;
        if (
            isConnected !== prevProps.isConnected
            || headType !== prevProps.headType
            || workflowState !== prevProps.workflowState
            || connectionType !== prevProps.connectionType
            || series !== prevProps.series
        ) {
            if (headType === HEAD_LASER && isConnected && connectionType === 'serial' && (series === 'Original' || series === 'Original Long Z-axis')) {
                this.props.widgetActions.setDisplay(true);
            } else {
                this.props.widgetActions.setDisplay(false);
            }
        }
    }

    render() {
        const state = this.state;
        // const actions = this.actions;

        if (!(this.props.headType === HEAD_LASER)) {
            return null;
        }

        return (
            <TestFocus
                isConnected={this.props.isConnected}
                workflowState={this.props.workflowState}
                showInstructions={state.showInstructions}
                actions={this.actions}
            />
        );
    }
}
const mapStateToProps = (state) => {
    const { isConnected, workflowState, connectionType } = state.machine;
    const { headType, series } = state.workspace;

    return {
        headType: headType,
        isConnected,
        workflowState,
        connectionType,
        series
    };
};
export default connect(mapStateToProps)(LaserTestFocusWidget);
