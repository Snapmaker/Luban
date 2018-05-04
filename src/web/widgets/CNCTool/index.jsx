import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Widget from '../../components/Widget';
import {
    WidgetState,
    DefaultSortableHandle,
    DefaultMinimizeButton,
    DefaultDropdownButton
} from '../Common';
import ToolParameters from './ToolParameters';
import styles from './styles.styl';


// TODO: High-Order Component for CNCToolWidget and CNCPathWidget.
class CNCToolWidget extends PureComponent {
    static propTypes = {
        widgetId: PropTypes.string.isRequired
    };
    state = {};

    constructor(props) {
        super(props);
        WidgetState.bind(this);
    }

    render() {
        const widgetState = this.state.widgetState;

        return (
            <Widget fullscreen={widgetState.fullscreen}>
                <Widget.Header>
                    <Widget.Title>
                        <DefaultSortableHandle />
                        Carving Tool
                    </Widget.Title>
                    <Widget.Controls className="sortable-filter">
                        <DefaultMinimizeButton widgetState={widgetState} />
                        <DefaultDropdownButton widgetState={widgetState} />
                    </Widget.Controls>
                </Widget.Header>
                <Widget.Content
                    className={classNames(
                        styles['widget-content'],
                        { [styles.hidden]: widgetState.minimized }
                    )}
                >
                    <ToolParameters />
                </Widget.Content>
            </Widget>
        );
    }
}

export default CNCToolWidget;
