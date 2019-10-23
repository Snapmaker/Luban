import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';

import { connect } from 'react-redux';
import controller from '../../lib/controller';
import i18n from '../../lib/i18n';

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
import { actions as widgetActions } from '../../flux/widget';

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
        setTitle: PropTypes.func.isRequired,
        setDisplay: PropTypes.func.isRequired,

        statusSectionExpanded: PropTypes.bool.isRequired,
        machineModalSectionExpanded: PropTypes.bool.isRequired,
        heaterControlSectionExpanded: PropTypes.bool.isRequired,
        powerSectionExpanded: PropTypes.bool.isRequired,
        overridesSectionExpanded: PropTypes.bool.isRequired,

        updateWidgetState: PropTypes.func.isRequired
    };

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
        },

        onToggleFullscreen: () => {
            const { fullscreen, minimized } = this.state;
            this.setState({
                fullscreen: !fullscreen,
                minimized: fullscreen ? minimized : false
            });
        },
        onToggleMinimized: () => {
            this.setState({
                minimized: !this.state.minimized
            });
        },
        setTitle: () => {
            const actions = this.actions;
            const title = (actions.is3DPrinting() && i18n._('3D Printer'))
                || (actions.isLaser() && i18n._('Laser'))
                || (actions.isCNC() && i18n._('CNC'))
                || 'Detecting...';
            this.props.setTitle(title);
        }
    };

    controllerEvents = {
        'serialport:open': (options) => {
            const { port, dataSource } = options;
            if (dataSource === 'workspace') {
                this.setState({
                    ...this.getInitialState(),
                    isConnected: true,
                    port: port
                });
            }
        },
        'serialport:close': (options) => {
            const { dataSource } = options;
            if (dataSource === 'workspace') {
                this.setState({ ...this.getInitialState() });
            }
        },
        'Marlin:state': (state, dataSource) => {
            if (dataSource === 'workspace') {
                this.setState({
                    controller: {
                        ...this.state.controller,
                        state
                    }
                });
            }
        },
        'Marlin:settings': (settings, dataSource) => {
            if (dataSource === 'workspace') {
                this.setState({
                    controller: {
                        ...this.state.controller,
                        settings
                    }
                });
            }
        }
    };

    constructor(props) {
        super(props);
        this.props.setDisplay(false);
    }

    getInitialState() {
        return {
            isConnected: false,
            canClick: true, // Defaults to true
            headType: null,

            // section state
            statusSectionExpanded: this.props.statusSectionExpanded,
            machineModalSectionExpanded: this.props.machineModalSectionExpanded,
            heaterControlSectionExpanded: this.props.heaterControlSectionExpanded,
            powerSectionExpanded: this.props.powerSectionExpanded,
            overridesSectionExpanded: this.props.overridesSectionExpanded,

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
        this.props.updateWidgetState(this.props.widgetId, {
            minimized: this.state.minimized,
            fullscreen: this.state.fullscreen,
            statusSection: {
                expanded: this.state.statusSectionExpanded
            },
            machineModalSection: {
                expanded: this.state.machineModalSectionExpanded
            },
            heaterControlSection: {
                expanded: this.state.heaterControlSectionExpanded
            },
            powerSection: {
                expanded: this.state.powerSectionExpanded
            },
            overridesSection: {
                expanded: this.state.overridesSectionExpanded
            }
        });
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

        return (
            <div>
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
            </div>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const { widgets } = state.widget;
    const { widgetId } = ownProps;
    const {
        statusSection,
        machineModalSection,
        heaterControlSection,
        powerSection,
        overridesSection
    } = widgets[widgetId];
    const statusSectionExpanded = statusSection.expanded;
    const machineModalSectionExpanded = machineModalSection.expanded;
    const heaterControlSectionExpanded = heaterControlSection.expanded;
    const powerSectionExpanded = powerSection.expanded;
    const overridesSectionExpanded = overridesSection.expanded;

    return {
        statusSectionExpanded,
        machineModalSectionExpanded,
        heaterControlSectionExpanded,
        powerSectionExpanded,
        overridesSectionExpanded
    };
};
const mapDispatchToProps = (dispatch) => {
    return {
        updateWidgetState: (widgetId, value) => dispatch(widgetActions.updateWidgetState(widgetId, '', value))
    };
};
export default connect(mapStateToProps, mapDispatchToProps)(MarlinWidget);
