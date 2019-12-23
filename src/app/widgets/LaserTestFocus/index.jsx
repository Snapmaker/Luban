import React, { PureComponent } from 'react';
import classNames from 'classnames';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import i18n from '../../lib/i18n';
import Widget from '../../components/Widget';
import {
    WidgetState,
    SMSortableHandle,
    SMMinimizeButton,
    SMDropdownButton
} from '../../components/SMWidget';
import styles from '../styles.styl';
import TestFocus from './TestFocus';
import { MACHINE_HEAD_TYPE } from '../../constants';


class LaserTestFocusWidget extends PureComponent {
    static propTypes = {
        headType: PropTypes.string,
        isConnected: PropTypes.bool.isRequired
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
    }

    render() {
        const state = this.state;
        const actions = this.actions;

        if (!this.props.isConnected || !(this.props.headType === MACHINE_HEAD_TYPE.LASER.value)) {
            return null;
        }

        return (
            <Widget fullscreen={state.fullscreen}>
                <Widget.Header>
                    <Widget.Title>
                        <SMSortableHandle />
                        {i18n._('Fine Tune Work Origin')}
                    </Widget.Title>
                    <Widget.Controls className="sortable-filter">
                        <Widget.Button
                            onClick={this.actions.showInstructions}
                        >
                            <i className="fa fa-info" />
                        </Widget.Button>
                        <SMMinimizeButton state={state} actions={actions} />
                        <SMDropdownButton state={state} actions={actions} />
                    </Widget.Controls>
                </Widget.Header>
                <Widget.Content
                    className={classNames(
                        styles['widget-content'],
                        { [styles.hidden]: state.minimized }
                    )}
                >
                    <TestFocus
                        isConnected={state.isConnected}
                        showInstructions={state.showInstructions}
                        actions={this.actions}
                    />
                </Widget.Content>
            </Widget>
        );
    }
}
const mapStateToProps = (state) => {
    const { headType, isConnected } = state.machine;
    return {
        headType: headType,
        isConnected
    };
};
export default connect(mapStateToProps)(LaserTestFocusWidget);
