import React, { PureComponent } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import i18n from '../../lib/i18n';
import Widget from '../../components/Widget';
import {
    WidgetState,
    SMSortableHandle,
    SMMinimizeButton,
    SMDropdownButton
} from '../../components/SMWidget';
import styles from '../styles.styl';
import SetBackground from './SetBackground';
import { MACHINE_HEAD_TYPE } from '../../constants';


class LaserSetBackgroundWidget extends PureComponent {
    static propTypes = {
        isConnected: PropTypes.bool,
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

    constructor(props) {
        super(props);
        WidgetState.bind(this);
    }


    render() {
        const { isConnected, headType } = this.props;
        const state = this.state;
        const actions = this.actions;
        const isLaser = headType === MACHINE_HEAD_TYPE.LASER.value;

        return (
            <Widget fullscreen={state.fullscreen}>
                <Widget.Header>
                    <Widget.Title>
                        <SMSortableHandle />
                        {i18n._('Set Laser Background')}
                    </Widget.Title>
                    <Widget.Controls className="sortable-filter">
                        <Widget.Button onClick={this.actions.showInstructions}>
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
                    <SetBackground
                        showInstructions={state.showInstructions}
                        isConnected={isConnected}
                        isLaser={isLaser}
                        actions={actions}
                    />
                </Widget.Content>
            </Widget>
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
