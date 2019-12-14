import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';

import { connect } from 'react-redux';
import { controller } from '../../lib/controller';
import i18n from '../../lib/i18n';

import Printing from './Printing';
import Laser from './Laser';
import CNC from './CNC';
import {
    PROTOCOL_TEXT,
    TEMPERATURE_MIN,
    TEMPERATURE_MAX,
    SPEED_FACTOR_MIN,
    SPEED_FACTOR_MAX,
    HEAD_3DP,
    HEAD_LASER,
    HEAD_CNC,
    HEAD_UNKNOWN,
    MACHINE_HEAD_TYPE, CONNECTION_TYPE_WIFI
} from '../../constants';
import { actions as widgetActions } from '../../flux/widget';

const normalizeToRange = (n, min, max) => {
    return Math.max(Math.min(n, max), min);
};

class MarlinWidget extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,
        setDisplay: PropTypes.func.isRequired,

        port: PropTypes.string.isRequired,
        isConnected: PropTypes.bool.isRequired,
        connectionType: PropTypes.string.isRequired,
        headType: PropTypes.string.isRequired,
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
        changeNozzleTargetTemperature: (nozzleTargetTemperature) => {
            nozzleTargetTemperature = normalizeToRange(nozzleTargetTemperature, TEMPERATURE_MIN, TEMPERATURE_MAX);
            this.setState({ nozzleTargetTemperature });
        },
        changeBedTargetTemperature: (bedTargetTemperature) => {
            bedTargetTemperature = normalizeToRange(bedTargetTemperature, TEMPERATURE_MIN, TEMPERATURE_MAX);
            this.setState({ bedTargetTemperature });
        },
        changeSpeedFactor: (speedFactor) => {
            speedFactor = normalizeToRange(speedFactor, SPEED_FACTOR_MIN, SPEED_FACTOR_MAX);
            this.setState({ speedFactor });
        },
        changeExtruderFactor: (extruderFactor) => {
            extruderFactor = normalizeToRange(extruderFactor, SPEED_FACTOR_MIN, SPEED_FACTOR_MAX);
            this.setState({ extruderFactor });
        },
        is3DPrinting: () => {
            return this.props.headType === MACHINE_HEAD_TYPE['3DP'].value;
        },
        isLaser: () => {
            return this.props.headType === MACHINE_HEAD_TYPE.LASER.value;
        },
        isCNC: () => {
            return this.props.headType === MACHINE_HEAD_TYPE.CNC.value;
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
        'serialport:ready': (options) => {
            const { dataSource, err } = options;
            if (dataSource !== PROTOCOL_TEXT) {
                return;
            }
            if (err) {
                return;
            }
            this.setState({
                ...this.getInitialState()
            });
            this.props.setDisplay(true);
        },
        'serialport:close': (options) => {
            const { dataSource } = options;
            if (dataSource !== PROTOCOL_TEXT) {
                return;
            }
            this.setState({ ...this.getInitialState() });
            this.props.setDisplay(false);
        },
        // 'Marlin:state': (state, dataSource) => {
        'Marlin:state': (options) => {
            const { state, dataSource } = options;
            if (dataSource !== PROTOCOL_TEXT) {
                return;
            }
            this.setState({
                controller: {
                    ...this.state.controller,
                    state
                }
            });
            const { speedFactor, extruderFactor } = state;
            if (speedFactor && speedFactor !== this.state.speedFactor) {
                this.setState({ speedFactor });
            }
            if (extruderFactor && extruderFactor !== this.state.extruderFactor) {
                this.setState({ extruderFactor });
            }
        },
        // 'Marlin:settings': (settings, dataSource) => {
        'Marlin:settings': (options) => {
            const { settings, dataSource } = options;
            if (dataSource !== PROTOCOL_TEXT) {
                return;
            }
            this.setState({
                controller: {
                    ...this.state.controller,
                    settings
                }
            });
        }
    };

    constructor(props) {
        super(props);
        this.props.setDisplay(false);
        this.actions.setTitle();
    }

    getInitialState() {
        return {
            canClick: true, // Defaults to true
            headType: null,

            // section state
            statusSectionExpanded: this.props.statusSectionExpanded,
            machineModalSectionExpanded: this.props.machineModalSectionExpanded,
            heaterControlSectionExpanded: this.props.heaterControlSectionExpanded,
            powerSectionExpanded: this.props.powerSectionExpanded,
            overridesSectionExpanded: this.props.overridesSectionExpanded,

            // data
            nozzleTargetTemperature: 200,
            bedTargetTemperature: 50,
            speedFactor: 100,
            extruderFactor: 100,
            controller: {
                state: controller.state,
                settings: controller.settings
            }
        };
    }

    componentDidMount() {
        this.addControllerEvents();
    }


    componentWillReceiveProps(nextProps) {
        const { connectionType, isConnected } = nextProps;
        if (connectionType === CONNECTION_TYPE_WIFI) {
            if (isConnected && !this.state.isConnected) {
                this.props.setDisplay(true);
            }
            if (!isConnected) {
                this.props.setDisplay(false);
            }
        }
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevProps.headType !== this.props.headType) {
            this.actions.setTitle();
        }
        if (this.state.controller === prevState.controller) {
            this.props.updateWidgetState({
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
        const { isConnected } = this.props;
        if (!isConnected) {
            return null;
        }
        const state = {
            ...this.state,
            canClick: !!this.props.port
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
    const { headType, port, isConnected, connectionType } = state.machine;
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
        port,
        isConnected,
        connectionType,
        headType: headType,
        statusSectionExpanded,
        machineModalSectionExpanded,
        heaterControlSectionExpanded,
        powerSectionExpanded,
        overridesSectionExpanded
    };
};
const mapDispatchToProps = (dispatch, ownProps) => {
    return {
        updateWidgetState: (value) => dispatch(widgetActions.updateWidgetState(ownProps.widgetId, '', value))
    };
};
export default connect(mapStateToProps, mapDispatchToProps)(MarlinWidget);
