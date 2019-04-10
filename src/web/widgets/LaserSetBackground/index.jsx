import React, { PureComponent } from 'react';
import classNames from 'classnames';
import i18n from '../../lib/i18n';
import Widget from '../../components/Widget';
import {
    WidgetState,
    SMSortableHandle,
    SMMinimizeButton,
    SMDropdownButton
} from '../../components/SMWidget';
import controller from '../../lib/controller';
import styles from '../styles.styl';
import SetBackground from './SetBackground';


class LaserSetBackgroundWidget extends PureComponent {
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
        const state = this.state;
        const actions = this.actions;

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
                    <SetBackground state={state} actions={actions} />
                </Widget.Content>
            </Widget>
        );
    }
}

export default LaserSetBackgroundWidget;
