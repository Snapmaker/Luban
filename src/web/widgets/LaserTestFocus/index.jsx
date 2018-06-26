import React, { PureComponent } from 'react';
import pubsub from 'pubsub-js';
import classNames from 'classnames';
import Widget from '../../components/Widget';
import {
    WidgetState,
    DefaultSortableHandle,
    DefaultMinimizeButton,
    DefaultDropdownButton
} from '../Common';
import TestFocus from './TestFocus';
import styles from '../styles.styl';
import controller from '../../lib/controller';
import {
    MARLIN
} from '../../constants';
import api from '../../api';

class LaserTestFocusWidget extends PureComponent {
    state = this.getInitialState();
    getInitialState() {
        return {
            isReady: false,
            isLaser: false,
            canClick: true
        };
    }
    constructor(props) {
        super(props);
        WidgetState.bind(this);
    }
    actions = {
        generateAndLoadGcode: (power, workSpeed) => {
            const params = {
                type: 'test-laser-focus',
                power: power,
                workSpeed: workSpeed,
                jogSpeed: 1500
            };
            api.generateGCode(params).then((res) => {
                const { gcode } = res.body;
                pubsub.publish('gcode:upload', { gcode: gcode, meta: { name: 'TestFocus' } });
            });
        },
        setLaserFocusZ: (value) => {
            const gcode = `G0 Z${value}`;
            controller.command('gcode', gcode);
        }
    };
    controllerEvents = {
        'serialport:open': (options) => {
            const { controllerType } = options;
            this.setState({
                isReady: controllerType === MARLIN
            });
        },
        'serialport:close': (options) => {
            const initialState = this.getInitialState();
            this.setState({ ...initialState });
        },
        'Marlin:state': (state) => {
            const headType = state.headType;
            const isLaser = (headType === 'LASER' || headType === 'LASER350' || headType === 'LASER1600');
            this.setState({
                isLaser: isLaser
            });
        },
        'workflow:state': (workflowState) => {
            // paused idle running
            this.setState({
                canClick: (workflowState === 'idle')
            });
        }
    };

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
        const state = {
            ...this.state
        };
        return (
            <Widget fullscreen={widgetState.fullscreen} style={{ display: (state.isLaser && state.isReady) ? 'block' : 'none' }}>
                <Widget.Header>
                    <Widget.Title>
                        <DefaultSortableHandle />
                        Fine Focus for Laser
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
                    <TestFocus state={state} actions={this.actions} />
                </Widget.Content>
            </Widget>
        );
    }
}

export default LaserTestFocusWidget;
