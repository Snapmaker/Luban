import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';

import controller from '../../lib/controller';
import i18n from '../../lib/i18n';
import Widget from '../../components/Widget';
import { WidgetConfig } from '../../components/SMWidget';

import Printing from './Printing';
import Laser from './Laser';
import CNC from './CNC';
import {
    TEMPERATURE_MIN,
    TEMPERATURE_MAX
} from './constants';
import styles from './index.styl';

const normalizeToRange = (n, min, max) => {
    if (n < min) {
        return min;
    }
    if (n > max) {
        return max;
    }
    return n;
};

class MarlinWidget extends PureComponent {
    static propTypes = {
        widgetId: PropTypes.string.isRequired,
        sortable: PropTypes.object
    };

    config = new WidgetConfig(this.props.widgetId);

    state = this.getInitialState();

    actions = {
        toggleFullscreen: () => {
            const { minimized, isFullscreen } = this.state;
            this.setState({
                minimized: isFullscreen ? minimized : false,
                isFullscreen: !isFullscreen
            });
        },
        toggleMinimized: () => {
            const { minimized } = this.state;
            this.setState({ minimized: !minimized });
        },
        onStatusPadEnabled: () => {
            this.setState({ statusPadEnabled: !this.state.statusPadEnabled });
        },
        onHeaterControlEnabled: () => {
            this.setState({ heaterControlEnabled: !this.state.heaterControlEnabled });
        },
        onPowerControlEnabled: () => {
            this.setState({ powerControlEnabled: !this.state.powerControlEnabled });
        },
        onOverridesEnabled: () => {
            this.setState({ overridesEnabled: !this.state.overridesEnabled });
        },
        changeNozzleTemperature: (nozzleTemperature) => {
            nozzleTemperature = normalizeToRange(nozzleTemperature, TEMPERATURE_MIN, TEMPERATURE_MAX);
            this.setState({ nozzleTemperature: nozzleTemperature });
        },
        changeBedTemperature: (bedTemperature) => {
            bedTemperature = normalizeToRange(bedTemperature, TEMPERATURE_MIN, TEMPERATURE_MAX);
            this.setState({ bedTemperature: bedTemperature });
        },
        is3DPrinting: () => {
            return (this.state.controller.state.headType === '3DP');
        },
        isLaser: () => {
            return (this.state.controller.state.headType === 'LASER'
                || this.state.controller.state.headType === 'LASER350'
                || this.state.controller.state.headType === 'LASER1600');
        },
        isCNC: () => {
            return (this.state.controller.state.headType === 'CNC');
        },
        toggleToolHead: () => {
            if (this.state.controller.state.headStatus === 'on') {
                controller.command('gcode', 'M5');
            } else {
                controller.command('gcode', 'M3');
            }
        }
    };

    controllerEvents = {
        'serialport:open': (options) => {
            const { port } = options;
            this.setState({
                ...this.getInitialState(),
                isConnected: true,
                port: port
            });
        },
        'serialport:close': () => {
            this.setState({ ...this.getInitialState() });
        },
        'Marlin:state': (state) => {
            this.setState({
                controller: {
                    ...this.state.controller,
                    state: state
                }
            });
        },
        'Marlin:settings': (settings) => {
            this.setState({
                controller: {
                    ...this.state.controller,
                    settings: settings
                }
            });
        }
    };

    getInitialState() {
        return {
            minimized: false,
            isFullscreen: false,
            isConnected: false,
            canClick: true, // Defaults to true
            statusPadEnabled: true,
            heaterControlEnabled: true,
            powerControlEnabled: true,
            overridesEnabled: true,
            port: controller.port,
            nozzleTemperature: 30,
            bedTemperature: 30,
            controller: {
                state: controller.state,
                settings: controller.settings
            }
        };
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
        const { minimized, isFullscreen, isConnected } = this.state;

        const state = {
            ...this.state,
            canClick: !!this.state.port
        };
        const actions = this.actions;

        if (!isConnected) {
            return null;
        }

        const title = (this.actions.is3DPrinting() && i18n._('3D Printer'))
            || (this.actions.isLaser() && i18n._('Laser'))
            || (this.actions.isCNC() && i18n._('CNC'))
            || 'Detecting...';

        return (
            <Widget fullscreen={isFullscreen}>
                <Widget.Header>
                    <Widget.Title>
                        <Widget.Sortable className={this.props.sortable.handleClassName}>
                            <i className="fa fa-bars" />
                            <span className="space" />
                        </Widget.Sortable>
                        <span>{title}</span>
                    </Widget.Title>
                    <Widget.Controls className={this.props.sortable.filterClassName}>
                        <Widget.Button
                            disabled={isFullscreen}
                            title={minimized ? i18n._('Expand') : i18n._('Collapse')}
                            onClick={actions.toggleMinimized}
                        >
                            <i
                                className={classNames(
                                    'fa',
                                    { 'fa-chevron-up': !minimized },
                                    { 'fa-chevron-down': minimized }
                                )}
                            />
                        </Widget.Button>
                        <Widget.DropdownButton
                            title={i18n._('More')}
                            toggle={<i className="fa fa-ellipsis-v" />}
                            onSelect={(eventKey) => {
                                if (eventKey === 'fullscreen') {
                                    actions.toggleFullscreen();
                                }
                            }}
                        >
                            <Widget.DropdownMenuItem eventKey="fullscreen">
                                <i
                                    className={classNames(
                                        'fa',
                                        'fa-fw',
                                        { 'fa-expand': !isFullscreen },
                                        { 'fa-compress': isFullscreen }
                                    )}
                                />
                                <span className="space space-sm" />
                                {!isFullscreen ? i18n._('Enter Full Screen') : i18n._('Exit Full Screen')}
                            </Widget.DropdownMenuItem>
                        </Widget.DropdownButton>
                    </Widget.Controls>
                </Widget.Header>
                <Widget.Content
                    className={classNames(
                        styles['widget-content'],
                        { [styles.hidden]: minimized }
                    )}
                >
                    {this.actions.is3DPrinting() && (
                        <Printing
                            state={state}
                            actions={actions}
                        />
                    )}
                    {this.actions.isLaser() && (
                        <Laser
                            state={state}
                            actions={actions}
                        />
                    )}
                    {this.actions.isCNC() && (
                        <CNC
                            state={state}
                            actions={actions}
                        />
                    )}
                </Widget.Content>
            </Widget>
        );
    }
}

export default MarlinWidget;
