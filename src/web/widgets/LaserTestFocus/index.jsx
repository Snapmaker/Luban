import React, { PureComponent } from 'react';
import classNames from 'classnames';
import i18n from '../../lib/i18n';
import Widget from '../../components/Widget';
import {
    WidgetState,
    DefaultSortableHandle,
    DefaultMinimizeButton,
    DefaultDropdownButton
} from '../Common';
import controller from '../../lib/controller';
import styles from '../styles.styl';
import TestFocus from './TestFocus';


class LaserTestFocusWidget extends PureComponent {
    state = {
        isConnected: false,
        isLaser: false,
        showInstructions: false
    };

    controllerEvents = {
        'serialport:open': () => {
            this.setState({ isConnected: true });
        },
        'serialport:close': () => {
            this.setState({ isConnected: false });
        },
        'Marlin:state': (state) => {
            const headType = state.headType;
            const isLaser = (headType === 'LASER' || headType === 'LASER350' || headType === 'LASER1600');
            this.setState({ isLaser });
        }
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

    componentDidMount() {
        this.addControllerEvents();
    }

    componentWillUnmount() {
        this.removeControllerEvents();
    }

    addControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.on(eventName, callback);
        });
    }

    removeControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.off(eventName, callback);
        });
    }

    render() {
        const widgetState = this.state.widgetState;
        const state = this.state;

        if (!state.isLaser || !state.isConnected) {
            return null;
        }

        return (
            <Widget fullscreen={widgetState.fullscreen}>
                <Widget.Header>
                    <Widget.Title>
                        <DefaultSortableHandle />
                        {i18n._('Fine Tune Work Origin')}
                    </Widget.Title>
                    <Widget.Controls className="sortable-filter">
                        <Widget.Button
                            onClick={this.actions.showInstructions}
                        >
                            <i className="fa fa-info" />
                        </Widget.Button>
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
                    <TestFocus state={state} actions={this.actions} />
                </Widget.Content>
            </Widget>
        );
    }
}

export default LaserTestFocusWidget;
