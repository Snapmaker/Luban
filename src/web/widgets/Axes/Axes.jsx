import map from 'lodash/map';
import mapValues from 'lodash/mapValues';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import pubsub from 'pubsub-js';
import i18n from '../../lib/i18n';
import combokeys from '../../lib/combokeys';
import controller from '../../lib/controller';
import { preventDefault } from '../../lib/dom-events';
import { in2mm, mm2in } from '../../lib/units';
import DisplayPanel from './DisplayPanel';
import ControlPanel from './ControlPanel';
import ShuttleControl from './ShuttleControl';
import KeypadOverlay from './KeypadOverlay';
import log from '../../lib/log';

import {
    // Units
    IMPERIAL_UNITS,
    METRIC_UNITS,
    MARLIN,
    // Workflow
    WORKFLOW_STATE_IDLE
} from '../../constants';
import {
    DISTANCE_MIN,
    DISTANCE_MAX,
    DISTANCE_STEP,
    DEFAULT_AXES
} from './constants';
import Space from '../../components/Space';

const toFixedUnits = (units, val) => {
    val = Number(val) || 0;
    if (units === IMPERIAL_UNITS) {
        val = mm2in(val).toFixed(4);
    }
    if (units === METRIC_UNITS) {
        val = val.toFixed(3);
    }

    return val;
};

const toUnits = (units, val) => {
    val = Number(val) || 0;
    if (units === IMPERIAL_UNITS) {
        val = mm2in(val).toFixed(4) * 1;
    }
    if (units === METRIC_UNITS) {
        val = val.toFixed(3) * 1;
    }

    return val;
};

const normalizeToRange = (n, min, max) => {
    if (n < min) {
        return min;
    }
    if (n > max) {
        return max;
    }
    return n;
};

class Axes extends PureComponent {
    static propTypes = {
        config: PropTypes.object.isRequired
    };

    state = this.getInitialState();

    getInitialState() {
        return {
            // config


            // machine status
            port: controller.port,

            // display
            canClick: true, // Defaults to true

            units: METRIC_UNITS,
            controller: {
                type: controller.type,
                state: controller.state
            },
            workflowState: controller.workflowState,
            axes: this.props.config.get('axes', DEFAULT_AXES),
            machinePosition: { // machine position
                x: '0.000',
                y: '0.000',
                z: '0.000',
                a: '0.000'
            },
            workPosition: { // work position
                x: '0.000',
                y: '0.000',
                z: '0.000',
                a: '0.000'
            },
            keypadJogging: this.props.config.get('jog.keypad'),
            jogSpeed: 3000,
            enabledJogSpeed: true,
            selectedAxis: '', // Defaults to empty
            selectedDistance: this.props.config.get('jog.selectedDistance'),
            customDistance: toUnits(METRIC_UNITS, this.props.config.get('jog.customDistance')),

            // Bounding box
            bbox: {
                min: {
                    x: 0,
                    y: 0,
                    z: 0
                },
                max: {
                    x: 0,
                    y: 0,
                    z: 0
                }
            }
        };
    }

    actions = {
        getJogDistance: () => {
            const { units } = this.state;
            const selectedDistance = this.config.get('jog.selectedDistance');
            if (selectedDistance) {
                return Number(selectedDistance) || 0;
            }

            const customDistance = this.config.get('jog.customDistance');
            return toUnits(units, customDistance);
        },
        jog: (params = {}) => {
            const s = map(params, (value, letter) => ('' + letter.toUpperCase() + value)).join(' ');
            controller.command('gcode', 'G91'); // relative
            this.actions.ensureFeedrateCommand('G0 ' + s);
            controller.command('gcode', 'G90'); // absolute
        },
        move: (params = {}) => {
            const s = map(params, (value, letter) => ('' + letter.toUpperCase() + value)).join(' ');
            this.actions.ensureFeedrateCommand('G0 ' + s);
        },
        toggleKeypadJogging: () => {
            this.setState({ keypadJogging: !this.state.keypadJogging });
        },
        selectAxis: (axis = '') => {
            this.setState({ selectedAxis: axis });
        },
        selectDistance: (distance = '') => {
            this.setState({ selectedDistance: distance });
        },
        changeCustomDistance: (customDistance) => {
            customDistance = normalizeToRange(customDistance, DISTANCE_MIN, DISTANCE_MAX);
            this.setState({ customDistance: customDistance });
        },
        increaseCustomDistance: () => {
            const { units, customDistance } = this.state;
            let distance = Math.min(Number(customDistance) + DISTANCE_STEP, DISTANCE_MAX);
            if (units === IMPERIAL_UNITS) {
                distance = distance.toFixed(4) * 1;
            }
            if (units === METRIC_UNITS) {
                distance = distance.toFixed(3) * 1;
            }
            this.setState({ customDistance: distance });
        },
        decreaseCustomDistance: () => {
            const { units, customDistance } = this.state;
            let distance = Math.max(Number(customDistance) - DISTANCE_STEP, DISTANCE_MIN);
            if (units === IMPERIAL_UNITS) {
                distance = distance.toFixed(4) * 1;
            }
            if (units === METRIC_UNITS) {
                distance = distance.toFixed(3) * 1;
            }
            this.setState({ customDistance: distance });
        },
        onChangeJogSpeed: (option) => {
            this.setState({ jogSpeed: option.value });
        },
        toggleEnableJogSpeed: (event) => {
            const checked = event.target.checked;
            this.setState(state => ({
                enabledJogSpeed: checked
            }));
        },
        ensureFeedrateCommand: (gcode) => {
            if (this.state.enabledJogSpeed) {
                gcode = `${gcode} F${this.state.jogSpeed}`;
                log.debug(gcode);
            }
            controller.command('gcode', gcode);
        },
        runBoundary: () => {
            const { bbox, workPosition } = this.state;

            // absolute position
            controller.command('gcode', 'G90');
            // run boundary
            this.actions.ensureFeedrateCommand(`G0 X${bbox.min.x} Y${bbox.min.y}`);
            this.actions.ensureFeedrateCommand(`G0 X${bbox.min.x} Y${bbox.max.y}`);
            this.actions.ensureFeedrateCommand(`G0 X${bbox.max.x} Y${bbox.max.y}`);
            this.actions.ensureFeedrateCommand(`G0 X${bbox.max.x} Y${bbox.min.y}`);
            this.actions.ensureFeedrateCommand(`G0 X${bbox.min.x} Y${bbox.min.y}`);
            // go back to origin
            this.actions.ensureFeedrateCommand(`G0 X${workPosition.x} Y${workPosition.y} Z${workPosition.z}`);
        }
    };

    shuttleControlEvents = {
        JOG: (event, { axis = null, direction = 1, factor = 1 }) => {
            const { canClick, keypadJogging, selectedAxis } = this.state;

            if (!canClick) {
                return;
            }

            if (axis !== null && !keypadJogging) {
                // keypad jogging is disabled
                return;
            }

            // The keyboard events of arrow keys for X-axis/Y-axis and pageup/pagedown for Z-axis
            // are not prevented by default. If a jog command will be executed, it needs to
            // stop the default behavior of a keyboard combination in a browser.
            preventDefault(event);

            axis = axis || selectedAxis;
            const distance = this.actions.getJogDistance();
            const jog = {
                x: () => this.actions.jog({ X: direction * distance * factor }),
                y: () => this.actions.jog({ Y: direction * distance * factor }),
                z: () => this.actions.jog({ Z: direction * distance * factor }),
                a: () => this.actions.jog({ A: direction * distance * factor })
            }[axis];

            jog && jog();
        },
        JOG_LEVER_SWITCH: (event) => {
            const { selectedDistance } = this.state;
            const distances = ['1', '0.1', '0.01', '0.001', ''];
            const currentIndex = distances.indexOf(selectedDistance);
            const distance = distances[(currentIndex + 1) % distances.length];
            this.actions.selectDistance(distance);
        },
        SHUTTLE: (event, { zone = 0 }) => {
            const { canClick, selectedAxis } = this.state;

            if (!canClick) {
                return;
            }

            if (zone === 0) {
                // Clear accumulated result
                this.shuttleControl.clear();

                if (selectedAxis) {
                    controller.command('gcode', 'G90');
                }
                return;
            }

            if (!selectedAxis) {
                return;
            }

            const distance = Math.min(this.actions.getJogDistance(), 1);
            const feedrateMin = this.props.config.get('shuttle.feedrateMin');
            const feedrateMax = this.props.config.get('shuttle.feedrateMax');
            const hertz = this.props.config.get('shuttle.hertz');
            const overshoot = this.props.config.get('shuttle.overshoot');

            this.shuttleControl.accumulate(zone, {
                axis: selectedAxis,
                distance: distance,
                feedrateMin: feedrateMin,
                feedrateMax: feedrateMax,
                hertz: hertz,
                overshoot: overshoot
            });
        }
    };

    controllerEvents = {
        'serialport:open': (options) => {
            const { port } = options;
            this.setState({ port: port });
        },
        'serialport:close': (options) => {
            const initialState = this.getInitialState();
            this.setState({ ...initialState });
        },
        'workflow:state': (workflowState) => {
            if (this.state.workflowState !== workflowState) {
                const { keypadJogging, selectedAxis } = this.state;

                // Disable keypad jogging and shuttle wheel when the workflow is not in the idle state.
                // This prevents accidental movement while sending G-code commands.
                this.setState({
                    keypadJogging: (workflowState === WORKFLOW_STATE_IDLE) ? keypadJogging : false,
                    selectedAxis: (workflowState === WORKFLOW_STATE_IDLE) ? selectedAxis : '',
                    workflowState: workflowState
                });
            }
        },
        // FIXME
        'Marlin:state': (state) => {
            const { pos } = { ...state };

            this.setState({
                controller: {
                    type: MARLIN,
                    state: state
                },
                workPosition: {
                    ...this.state.workPosition,
                    ...pos
                }
            });
        }
    };

    shuttleControl = null;

    subscriptions = [];

    componentDidMount() {
        this.addControllerEvents();
        this.addShuttleControlEvents();
        this.subscribe();
    }

    componentWillUnmount() {
        this.removeControllerEvents();
        this.removeShuttleControlEvents();
        this.unsubscribe();
    }

    componentDidUpdate(prevProps, prevState) {
        const {
            units,
            minimized,
            axes,
            keypadJogging,
            selectedDistance, // '1', '0.1', '0.01', '0.001', or ''
            customDistance
        } = this.state;

        this.props.config.set('minimized', minimized);
        this.props.config.set('axes', axes);
        this.props.config.set('jog.keypad', keypadJogging);
        this.props.config.set('jog.selectedDistance', selectedDistance);

        // The custom distance will not persist while toggling between in and mm
        if ((prevState.customDistance !== customDistance) && (prevState.units === units)) {
            const distance = (units === IMPERIAL_UNITS) ? in2mm(customDistance) : customDistance;
            // Save customDistance in mm
            this.props.config.set('jog.customDistance', Number(distance));
        }
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

    addShuttleControlEvents() {
        Object.keys(this.shuttleControlEvents).forEach(eventName => {
            const callback = this.shuttleControlEvents[eventName];
            combokeys.on(eventName, callback);
        });

        // Shuttle Zone
        this.shuttleControl = new ShuttleControl();
        this.shuttleControl.on('flush', ({ axis, feedrate, relativeDistance }) => {
            feedrate = Number(feedrate.toFixed(3));
            relativeDistance = Number(relativeDistance.toFixed(4));

            controller.command('gcode', 'G91'); // relative
            controller.command('gcode', `G1 F${feedrate} ${axis}${relativeDistance}`);
            controller.command('gcode', 'G90'); // absolute
        });
    }

    removeShuttleControlEvents() {
        Object.keys(this.shuttleControlEvents).forEach(eventName => {
            const callback = this.shuttleControlEvents[eventName];
            combokeys.removeListener(eventName, callback);
        });

        this.shuttleControl.removeAllListeners('flush');
        this.shuttleControl = null;
    }

    subscribe() {
        this.subscriptions = [
            pubsub.subscribe('gcode:unload', (msg) => {
                this.setState({
                    bbox: {
                        min: {
                            x: 0,
                            y: 0,
                            z: 0
                        },
                        max: {
                            x: 0,
                            y: 0,
                            z: 0
                        }
                    }
                });
            }),
            pubsub.subscribe('gcode:bbox', (msg, bbox) => {
                this.setState({
                    bbox: {
                        min: {
                            x: bbox.min.x,
                            y: bbox.min.y,
                            z: bbox.min.z
                        },
                        max: {
                            x: bbox.max.x,
                            y: bbox.max.y,
                            z: bbox.max.z
                        }
                    }
                });
            })
        ];
    }

    unsubscribe() {
        this.subscriptions.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        this.subscriptions = [];
    }

    canClick() {
        const { port, workflowState } = this.state;

        if (!port) {
            return false;
        }
        if (workflowState !== WORKFLOW_STATE_IDLE) {
            return false;
        }
        return true;
    }

    render() {
        const { units, machinePosition, workPosition } = this.state;
        const state = {
            ...this.state,
            // Determine if the motion button is clickable
            canClick: this.canClick(),
            // Output machine position with the display units
            machinePosition: mapValues(machinePosition, (pos, axis) => {
                return String(toFixedUnits(units, pos));
            }),
            // Output work position with the display units
            workPosition: mapValues(workPosition, (pos, axis) => {
                return String(toFixedUnits(units, pos));
            })
        };
        const actions = {
            ...this.actions
        };

        return (
            <div>
                <div style={{ marginBottom: '10px' }}>
                    {i18n._('Keyboard Shortcuts')}
                    <Space width={4} />
                    <KeypadOverlay
                        show={state.canClick && state.keypadJogging}
                    >
                        <button
                            type="button"
                            // title={i18n._('Keypad jogging')}
                            onClick={actions.toggleKeypadJogging}
                            // inverted={state.keypadJogging}
                            disabled={!state.canClick}
                        >
                            <i className="fa fa-keyboard-o" />
                        </button>
                    </KeypadOverlay>
                </div>
                <DisplayPanel state={state} actions={actions} />
                <ControlPanel state={state} actions={actions} />
            </div>
        );
    }
}

export default Axes;
