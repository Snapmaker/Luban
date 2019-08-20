import map from 'lodash/map';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Creatable } from 'react-select';
import pubsub from 'pubsub-js';

import i18n from '../../lib/i18n';
import combokeys from '../../lib/combokeys';
import controller from '../../lib/controller';
import { preventDefault } from '../../lib/dom-events';
import { in2mm, mm2in } from '../../lib/units';
import DisplayPanel from './DisplayPanel';
import ControlPanel from './ControlPanel';
import KeypadOverlay from './KeypadOverlay';
import { actions as machineActions } from '../../flux/machine';

import {
    ABSENT_OBJECT,
    HEAD_TYPE_CNC,
    // Units
    IMPERIAL_UNITS,
    METRIC_UNITS,
    // Workflow
    WORKFLOW_STATE_IDLE
} from '../../constants';
import {
    DISTANCE_MIN,
    DISTANCE_MAX,
    DISTANCE_STEP,
    DEFAULT_AXES
} from './constants';

/*
const toFixedUnits = (units, val) => {
    val = Number(val) || 0;
    if (units === IMPERIAL_UNITS) {
        val = mm2in(val).toFixed(4);
    }
    if (units === METRIC_UNITS) {
        val = val.toFixed(3);
    }

    return val;
};*/

const DEFAULT_SPEED_OPTIONS = [
    {
        label: 3000,
        value: 3000
    },
    {
        label: 1500,
        value: 1500
    },
    {
        label: 500,
        value: 500
    },
    {
        label: 200,
        value: 200
    }
];

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
        config: PropTypes.object.isRequired,
        setTitle: PropTypes.func.isRequired,

        port: PropTypes.string.isRequired,
        headType: PropTypes.string.isRequired,
        workState: PropTypes.string.isRequired,
        workPosition: PropTypes.object.isRequired,
        server: PropTypes.object.isRequired,
        serverStatus: PropTypes.string.isRequired,
        executeGcode: PropTypes.func.isRequired
    };

    state = this.getInitialState();

    actions = {
        onChangeJogSpeed: (option) => {
            const jogSpeed = Math.min(6000, Number(option.value) || 0);
            this.setState({ jogSpeed });
        },
        onCreateJogSpeedOption: (option) => {
            const jogSpeed = Math.min(6000, Number(option.value) || 0);
            const newOption = { label: jogSpeed, value: jogSpeed };
            this.setState({
                jogSpeed,
                jogSpeedOptions: [...this.state.jogSpeedOptions, newOption]
            });
        },
        getJogDistance: () => {
            const { units } = this.state;
            const selectedDistance = this.props.config.get('jog.selectedDistance');
            if (selectedDistance) {
                return Number(selectedDistance) || 0;
            }

            const customDistance = this.props.config.get('jog.customDistance');
            return toUnits(units, customDistance);
        },
        // actions
        jog: (params = {}) => {
            const s = map(params, (value, axis) => (`${axis.toUpperCase()}${value}`)).join(' ');
            if (s) {
                const gcode = ['G91', `G0 ${s} F${this.state.jogSpeed}`, 'G90'];
                this.props.executeGcode(gcode.join('\n'));
            }
        },
        move: (params = {}) => {
            const s = map(params, (value, axis) => (`${axis.toUpperCase()}${value}`)).join(' ');
            if (s) {
                this.props.executeGcode(`G0 ${s} F${this.state.jogSpeed}`);
            }
        },
        toggleKeypadJogging: () => {
            this.setState(state => ({
                keypadJogging: !state.keypadJogging
            }));
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
        runBoundary: () => {
            const { headType, workPosition } = this.props;
            const { bbox } = this.state;

            const gcode = [];
            if (headType === HEAD_TYPE_CNC) {
                gcode.push('G91', 'G0 Z5 F400', 'G90');
            }
            gcode.push(
                'G90', // absolute position
                `G0 X${bbox.min.x} Y${bbox.min.y} F${this.state.jogSpeed}`, // run boundary
                `G0 X${bbox.min.x} Y${bbox.max.y}`,
                `G0 X${bbox.max.x} Y${bbox.max.y}`,
                `G0 X${bbox.max.x} Y${bbox.min.y}`,
                `G0 X${bbox.min.x} Y${bbox.min.y}`,
                `G0 X${workPosition.x} Y${workPosition.y}` // go back to origin
            );
            if (headType === HEAD_TYPE_CNC) {
                gcode.push('G91', 'G0 Z-5 F400', 'G90');
            }

            this.props.executeGcode(gcode.join('\n'));
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
        JOG_LEVER_SWITCH: () => {
            const { selectedDistance } = this.state;
            const distances = ['1', '0.1', '0.01', '0.001', ''];
            const currentIndex = distances.indexOf(selectedDistance);
            const distance = distances[(currentIndex + 1) % distances.length];
            this.actions.selectDistance(distance);
        }
    };

    controllerEvents = {
        'serialport:close': () => {
            const initialState = this.getInitialState();
            this.setState({ ...initialState });
        },
        // FIXME
        'Marlin:state': (state) => {
            this.setState({
                controller: {
                    state: state
                }
            });
        }
    };

    subscriptions = [];

    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('Axes'));
    }

    getInitialState() {
        const jogSpeed = this.props.config.get('jog.speed') || 1500;

        // init jog speed options, add saved speed when it doesn't exists in default options
        const jogSpeedOptions = DEFAULT_SPEED_OPTIONS;
        const optionFound = jogSpeedOptions.find(option => option.value === jogSpeed);
        if (!optionFound) {
            jogSpeedOptions.push({ label: jogSpeed, value: jogSpeed });
        }

        return {
            // config
            axes: this.props.config.get('axes', DEFAULT_AXES),
            keypadJogging: this.props.config.get('jog.keypad'),
            jogSpeed,
            jogSpeedOptions,
            selectedAxis: '', // Defaults to empty
            selectedDistance: this.props.config.get('jog.selectedDistance'),
            customDistance: toUnits(METRIC_UNITS, this.props.config.get('jog.customDistance')),

            // display
            canClick: true, // Defaults to true

            units: METRIC_UNITS,
            controller: {
                state: controller.state
            },


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

    componentDidMount() {
        this.addControllerEvents();
        this.addShuttleControlEvents();
        this.subscribe();
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.workState !== this.props.workState) {
            const { keypadJogging, selectedAxis } = this.state;

            // Disable keypad jogging and shuttle wheel when the workflow is not in the idle state.
            // This prevents accidental movement while sending G-code commands.
            this.setState({
                keypadJogging: (nextProps.workState === WORKFLOW_STATE_IDLE) ? keypadJogging : false,
                selectedAxis: (nextProps.workState === WORKFLOW_STATE_IDLE) ? selectedAxis : ''
            });
        }
    }

    componentDidUpdate(prevProps, prevState) {
        const {
            units,
            minimized,
            axes,
            jogSpeed,
            keypadJogging,
            selectedDistance, // '1', '0.1', '0.01', '0.001', or ''
            customDistance
        } = this.state;

        this.props.config.set('minimized', minimized);
        this.props.config.set('axes', axes);
        this.props.config.set('jog.speed', jogSpeed);
        this.props.config.set('jog.keypad', keypadJogging);
        this.props.config.set('jog.selectedDistance', selectedDistance);

        // The custom distance will not persist while toggling between in and mm
        if ((prevState.customDistance !== customDistance) && (prevState.units === units)) {
            const distance = (units === IMPERIAL_UNITS) ? in2mm(customDistance) : customDistance;
            // Save customDistance in mm
            this.props.config.set('jog.customDistance', Number(distance));
        }
    }

    componentWillUnmount() {
        this.removeControllerEvents();
        this.removeShuttleControlEvents();
        this.unsubscribe();
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
    }

    removeShuttleControlEvents() {
        Object.keys(this.shuttleControlEvents).forEach(eventName => {
            const callback = this.shuttleControlEvents[eventName];
            combokeys.removeListener(eventName, callback);
        });
    }

    subscribe() {
        this.subscriptions = [
            pubsub.subscribe('gcode:unload', () => {
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
        // TODO: move to redux state
        const { port, workState, server, serverStatus } = this.props;
        return (port && workState === WORKFLOW_STATE_IDLE
            || server !== ABSENT_OBJECT && serverStatus === 'IDLE');
    }

    render() {
        // const { units } = this.state;
        const canClick = this.canClick();
        const state = {
            ...this.state,
            canClick
        };
        const actions = {
            ...this.actions
        };

        const { workPosition } = this.props;

        return (
            <div>
                <DisplayPanel
                    workPosition={workPosition}
                    executeGcode={this.props.executeGcode}
                    state={state}
                />

                <div style={{ marginBottom: '10px' }}>
                    <KeypadOverlay
                        show={state.canClick && state.keypadJogging}
                    >
                        <button
                            type="button"
                            className="btn btn-default"
                            onClick={actions.toggleKeypadJogging}
                            disabled={!canClick}
                        >
                            {state.keypadJogging && <i className="fa fa-toggle-on fa-fw" />}
                            {!state.keypadJogging && <i className="fa fa-toggle-off fa-fw" />}
                            <span className="space space-sm" />
                            {i18n._('Keyboard Shortcuts')}
                        </button>
                    </KeypadOverlay>
                </div>
                <div className="sm-parameter-row">
                    <span className="sm-parameter-row__label">{i18n._('Jog Speed')}</span>
                    <Creatable
                        backspaceRemoves={false}
                        className="sm-parameter-row__select-lg"
                        clearable={false}
                        menuContainerStyle={{ zIndex: 5 }}
                        options={this.state.jogSpeedOptions}
                        onNewOptionClick={this.actions.onCreateJogSpeedOption}
                        searchable
                        value={this.state.jogSpeed}
                        onChange={this.actions.onChangeJogSpeed}
                    />
                </div>
                <ControlPanel state={state} actions={actions} executeGcode={this.props.executeGcode} />
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;

    const { port, headType, workState, workPosition, server, serverStatus } = machine;

    return {
        port,
        headType,
        workState,
        workPosition,
        server,
        serverStatus
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        executeGcode: (gcode) => dispatch(machineActions.executeGcode(gcode))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Axes);
