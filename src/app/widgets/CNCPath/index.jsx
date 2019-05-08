import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import i18n from '../../lib/i18n';
import Widget from '../../components/Widget';
import {
    WidgetState,
    SMSortableHandle,
    SMMinimizeButton,
    SMDropdownButton
} from '../../components/SMWidget';
import CNCPath from './CNCPath';
import styles from '../styles.styl';


class CNCPathWidget extends PureComponent {
    static propTypes = {
        widgetId: PropTypes.string.isRequired
    };

    constructor(props) {
        super(props);
        WidgetState.bind(this);
    }

    render() {
        const state = this.state;
        const actions = this.actions;

        return (
            <Widget fullscreen={state.fullscreen}>
                <Widget.Header>
                    <Widget.Title>
                        <SMSortableHandle />
                        {i18n._('Configurations')}
                    </Widget.Title>
                    <Widget.Controls className="sortable-filter">
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
                    <CNCPath />
                </Widget.Content>
            </Widget>
        );
    }
}

export default CNCPathWidget;
