import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';

import controller from '../../lib/controller';
import i18n from '../../lib/i18n';
import Widget from '../../components/Widget';
import {
    WidgetState,
    WidgetConfig,
    SMSortableHandle,
    SMMinimizeButton,
    SMDropdownButton
} from '../../components/SMWidget';

import Printing from './Printing';
import Laser from './Laser';
import CNC from './CNC';
import {
    TEMPERATURE_MIN,
    TEMPERATURE_MAX,
    HEAD_3DP,
    HEAD_LASER,
    HEAD_CNC,
    HEAD_UNKNOWN
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
        widgetId: PropTypes.string.isRequired
    };

    config = new WidgetConfig(this.props.widgetId);

    state = this.getInitialState();

    actions = {
        toggleStatusSection: () => {
            this.setState({ statusSectionExpanded: !this.state.statusSectionExpanded });
        },
        toggleHeaterControlSection: () => {
            this.setState({ heaterControlSectionExpanded: !this.state.heaterControlSectionExpanded });
        },
        togglePowerSection: () => {
            this.setState({ powerSectionExpanded: !this.state.powerSectionExpanded });
        },
        toggleOverridesSection: () => {
            this.setState({ overridesSectionExpanded: !this.state.overridesSectionExpanded });
        },
        toggleMachineModalSection: () => {
            this.setState({ machineModalSectionExpanded: !this.state.machineModalSectionExpanded });
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

    constructor(props) {
        super(props);
        WidgetState.bind(this, this.config);
    }

    getInitialState() {
        return {
            // minimized: this.config.get('marlin.minimized'),
            // isFullscreen: false,
            isConnected: false,
            canClick: true, // Defaults to true
            headType: null,

            // section state
            statusSectionExpanded: this.config.get('statusSection.expanded'),
            machineModalSectionExpanded: this.config.get('machineModalSection.expanded'),
            heaterControlSectionExpanded: this.config.get('heaterControlSection.expanded'),
            powerSectionExpanded: this.config.get('powerSection.expanded'),
            overridesSectionExpanded: this.config.get('overridesSection.expanded'),

            // data
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

    componentDidUpdate() {
        this.config.set('minimized', this.state.minimized);

        this.config.set('statusSection.expanded', this.state.statusSectionExpanded);
        this.config.set('machineModalSection.expanded', this.state.machineModalSectionExpanded);
        this.config.set('heaterControlSection.expanded', this.state.heaterControlSectionExpanded);
        this.config.set('powerSection.expanded', this.state.powerSectionExpanded);
        this.config.set('overridesSection.expanded', this.state.overridesSectionExpanded);
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
        const { isConnected } = this.state;
        if (!isConnected) {
            return null;
        }
        const state = {
            ...this.state,
            canClick: !!this.state.port
        };
        const actions = this.actions;
        let headType = null;
        switch (this.state.controller.state.headType) {
            case '3DP':
                headType = HEAD_3DP;
                break;
            case 'LASER':
            case 'LASER350':
            case 'LASER1600':
                headType = HEAD_LASER;
                break;
            case 'CNC':
                headType = HEAD_CNC;
                break;
            default:
                headType = HEAD_UNKNOWN;
                break;
        }
        const title = (actions.is3DPrinting() && i18n._('3D Printer'))
            || (actions.isLaser() && i18n._('Laser'))
            || (actions.isCNC() && i18n._('CNC'))
            || 'Detecting...';

        return (
            <Widget fullscreen={state.fullscreen}>
                <Widget.Header>
                    <Widget.Title>
                        <SMSortableHandle />
                        {title}
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
                    {actions.is3DPrinting() && (
                        <Printing
                            headType={headType}
                            state={state}
                            actions={actions}
                        />
                    )}
                    {actions.isLaser() && (
                        <Laser
                            headType={headType}
                            state={state}
                            actions={actions}
                        />
                    )}
                    {actions.isCNC() && (
                        <CNC
                            headType={headType}
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
