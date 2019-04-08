import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import i18n from '../../lib/i18n';
import Widget from '../../components/Widget';
import {
    WidgetState,
    DefaultSortableHandle,
    DefaultMinimizeButton,
    DefaultDropdownButton
} from '../WidgetCreator';
import LaserParameters from './LaserParameters';
import styles from './styles.styl';


class LaserParamsWidget extends PureComponent {
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
                        {i18n._('Preview Settings')}
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
                    <LaserParameters />
                </Widget.Content>
            </Widget>
        );
    }
}

export default LaserParamsWidget;
