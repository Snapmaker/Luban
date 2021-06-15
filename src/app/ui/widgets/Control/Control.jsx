import map from 'lodash/map';
import includes from 'lodash/includes';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import ChangedReactSelect from '../../components/Select';

import i18n from '../../../lib/i18n';
import { controller } from '../../../lib/controller';
import { preventDefault } from '../../../lib/dom-events';
import { in2mm, mm2in } from '../../../lib/units';
import DisplayPanel from './DisplayPanel';
import ControlPanel from './ControlPanel';
import KeypadOverlay from './KeypadOverlay';
import { actions as machineActions } from '../../../flux/machine';
import { actions as widgetActions } from '../../../flux/widget';
import {
    HEAD_TYPE_CNC,
    // Units
    IMPERIAL_UNITS,
    METRIC_UNITS, WORKFLOW_STATUS_IDLE,
    WORKFLOW_STATE_IDLE, WORKFLOW_STATUS_UNKNOWN
} from '../../../constants';
import {
    DISTANCE_MIN,
    DISTANCE_MAX,
    DISTANCE_STEP,
    DEFAULT_AXES
} from './constants';

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

class Control extends PureComponent {
    static propTypes = {
        widgetId: PropTypes.string.isRequired,
        widgetActions: PropTypes.object.isRequired,

        headType: PropTypes.string,
        dataSource: PropTypes.string.isRequired,
        workflowState: PropTypes.string.isRequired,
        workflowStatus: PropTypes.string.isRequired,
        workPosition: PropTypes.object.isRequired,
        originOffset: PropTypes.object.isRequired,
        executeGcode: PropTypes.func,
        executeGcodeAutoHome: PropTypes.func,
        isConnected: PropTypes.bool.isRequired,
        boundingBox: PropTypes.object,

        axes: PropTypes.array.isRequired,
        speed: PropTypes.number.isRequired,
        keypad: PropTypes.bool.isRequired,
        selectedDistance: PropTypes.string.isRequired,
        customDistance: PropTypes.number.isRequired,
        selectedAngle: PropTypes.string.isRequired,
        customAngle: PropTypes.number.isRequired,

        updateWidgetState: PropTypes.func.isRequired
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
            const selectedDistance = this.props.selectedDistance;
            if (selectedDistance) {
                return Number(selectedDistance) || 0;
            }

            const customDistance = this.props.customDistance;
            return toUnits(units, customDistance);
        },
        getJogAngle: () => {
            const selectedAngle = this.state.selectedAngle;
            if (selectedAngle) {
                return Number(selectedAngle) || 0;
            }

            const customAngle = this.state.customAngle;
            return Number(customAngle);
        },

        // actions
        jog: (params = {}) => {
            const { workPosition } = this.props;
            const s = map(params, (value, axis) => {
                const axisMoved = axis.toUpperCase();
                let signNumber = 1;
                if (axisMoved === 'Y' && workPosition.isFourAxis) {
                    signNumber = -1;
                } else {
                    signNumber = 1;
                }
                return (`${axisMoved}${signNumber * value}`);
            }).join(' ');
            if (s) {
                const gcode = ['G91', `G0 ${s} F${this.state.jogSpeed}`, 'G90'];
                this.actions.executeGcode(gcode.join('\n'));
            }
        },
        selectAngle: (angle = '') => {
            this.setState({ selectedAngle: angle });
        },
        changeCustomAngle: (customAngle) => {
            this.setState({ customAngle: customAngle });
        },

        move: (params = {}) => {
            const s = map(params, (value, axis) => (`${axis.toUpperCase()}${value}`)).join(' ');
            if (s) {
                this.actions.executeGcode(`G0 ${s} F${this.state.jogSpeed}`);
            }
        },
        executeGcode: (gcode) => {
            this.props.executeGcode(gcode);
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
        increaseCustomAngle: () => {
            const { customAngle } = this.state;
            const angle = customAngle + 1;
            this.setState({ customAngle: angle });
        },
        decreaseCustomAngle: () => {
            const { customAngle } = this.state;
            const angle = customAngle - 1;
            this.setState({ customAngle: angle });
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
            if (workPosition.isFourAxis) {
                const angleDiff = Math.abs(bbox.max.b - bbox.min.b);
                const minB = 0;
                const maxB = angleDiff > 360 ? 360 : angleDiff;
                gcode.push(
                    'G90', // absolute position
                    `G0 B${minB} Y${bbox.min.y} F${this.state.jogSpeed}`, // run boundary
                    `G0 B${minB} Y${bbox.max.y}`,
                    `G0 B${maxB} Y${bbox.max.y}`,
                    `G0 B${maxB} Y${bbox.min.y}`,
                    `G0 B${minB} Y${bbox.min.y}`,
                    `G0 B${workPosition.b} Y${workPosition.y}` // go back to origin
                );
            } else {
                gcode.push(
                    'G90', // absolute position
                    `G0 X${bbox.min.x} Y${bbox.min.y} F${this.state.jogSpeed}`, // run boundary
                    `G0 X${bbox.min.x} Y${bbox.max.y}`,
                    `G0 X${bbox.max.x} Y${bbox.max.y}`,
                    `G0 X${bbox.max.x} Y${bbox.min.y}`,
                    `G0 X${bbox.min.x} Y${bbox.min.y}`,
                    `G0 X${workPosition.x} Y${workPosition.y}` // go back to origin
                );
            }

            if (headType === HEAD_TYPE_CNC) {
                gcode.push('G91', 'G0 Z-5 F400', 'G90');
            }

            this.actions.executeGcode(gcode.join('\n'));
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
        'serialport:close': (options) => {
            const { dataSource } = options;
            if (dataSource !== this.props.dataSource) {
                return;
            }
            const initialState = this.getInitialState();
            this.setState({ ...initialState });
        }
    };

    constructor(props) {
        super(props);
        this.props.widgetActions.setTitle(i18n._('Control'));
    }

    getInitialState() {
        const jogSpeed = this.props.speed;

        // init jog speed options, add saved speed when it doesn't exists in default options
        const jogSpeedOptions = DEFAULT_SPEED_OPTIONS;
        const optionFound = jogSpeedOptions.find(option => option.value === jogSpeed);
        if (!optionFound) {
            jogSpeedOptions.push({ label: jogSpeed, value: jogSpeed });
        }

        return {
            // config
            axes: this.props.axes || DEFAULT_AXES,
            keypadJogging: this.props.keypad,
            jogSpeed,
            jogSpeedOptions,
            selectedAxis: '', // Defaults to empty
            selectedDistance: this.props.selectedDistance,
            customDistance: toUnits(METRIC_UNITS, this.props.customDistance),
            selectedAngle: this.props.selectedAngle,
            customAngle: this.props.customAngle,


            // display
            canClick: true, // Defaults to true

            units: METRIC_UNITS,

            workPosition: { // work position
                x: '0.000',
                y: '0.000',
                z: '0.000'
            },

            originOffset: {
                x: 0,
                y: 0,
                z: 0
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
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.workflowState !== this.props.workflowState) {
            const { keypadJogging, selectedAxis } = this.state;

            // Disable keypad jogging and shuttle wheel when the workflow is not in the idle state.
            // This prevents accidental movement while sending G-code commands.
            this.setState({
                keypadJogging: (nextProps.workflowState === WORKFLOW_STATE_IDLE) ? keypadJogging : false,
                selectedAxis: (nextProps.workflowState === WORKFLOW_STATE_IDLE) ? selectedAxis : ''
            });
        }
        if (nextProps.workPosition !== this.props.workPosition) {
            this.setState({
                workPosition: {
                    ...this.state.workPosition,
                    ...nextProps.workPosition
                }
            });
        }
        if (nextProps.originOffset !== this.props.originOffset) {
            this.setState({
                originOffset: {
                    ...this.state.originOffset,
                    ...nextProps.originOffset
                }
            });
        }
        if (nextProps.boundingBox !== this.props.boundingBox) {
            if (nextProps.boundingBox === null) {
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
            } else {
                this.setState({
                    bbox: nextProps.boundingBox
                });
            }
        }
    }

    componentDidUpdate(prevProps, prevState) {
        const {
            units,
            axes,
            jogSpeed,
            keypadJogging,
            selectedDistance, // '1', '0.1', '0.01', '0.001', or ''
            customDistance
        } = this.state;

        this.props.updateWidgetState(this.props.widgetId, {
            axes: axes,
            jog: {
                speed: jogSpeed,
                keypad: keypadJogging,
                selectedDistance: selectedDistance
            }
        });

        // The custom distance will not persist while toggling between in and mm
        if ((prevState.customDistance !== customDistance) && (prevState.units === units)) {
            const distance = (units === IMPERIAL_UNITS) ? in2mm(customDistance) : customDistance;
            // Save customDistance in mm
            // this.props.config.set('jog.customDistance', Number(distance));
            this.props.updateWidgetState(this.props.widgetId, {
                jog: {
                    customDistance: Number(distance)
                }
            });
        }
    }

    componentWillUnmount() {
        this.removeControllerEvents();
        this.removeShuttleControlEvents();
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
        // Object.keys(this.shuttleControlEvents).forEach(eventName => {
        //     const callback = this.shuttleControlEvents[eventName];
        //     combokeys.on(eventName, callback);
        // });
    }

    removeShuttleControlEvents() {
        // Object.keys(this.shuttleControlEvents).forEach(eventName => {
        //     const callback = this.shuttleControlEvents[eventName];
        //     combokeys.removeListener(eventName, callback);
        // });
    }


    canClick() {
        const { isConnected, workflowState, workflowStatus } = this.props;
        return (isConnected
            && includes([WORKFLOW_STATE_IDLE], workflowState)
            && includes([WORKFLOW_STATUS_IDLE, WORKFLOW_STATUS_UNKNOWN], workflowStatus));
    }

    render() {
        const canClick = this.canClick();
        const state = {
            ...this.state,
            canClick
        };
        const actions = {
            ...this.actions
        };

        const { workPosition, originOffset } = this.state;

        return (
            <div>
                <DisplayPanel
                    workPosition={workPosition}
                    originOffset={originOffset}
                    headType={this.props.headType}
                    executeGcode={this.actions.executeGcode}
                    state={state}
                />

                <div className="mb-3">
                    <KeypadOverlay
                        show={state.canClick && state.keypadJogging}
                    >
                        <button
                            type="button"
                            className="btn btn-outline-secondary"
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
                    <button
                        type="button"
                        className="btn btn-outline-secondary"
                        disabled={!canClick}
                        onClick={() => this.props.executeGcodeAutoHome()}
                    >
                        {i18n._('Home')}
                    </button>
                    <div className="sm-parameter-row__label2" style={{ textAlign: 'center', margin: '0 0 0 5px' }}>{i18n._('Jog Speed')}</div>
                    <ChangedReactSelect
                        backspaceRemoves={false}
                        className="sm-parameter-row__select2"
                        clearable={false}
                        menuContainerStyle={{ zIndex: 5 }}
                        options={this.state.jogSpeedOptions}
                        onNewOptionClick={this.actions.onCreateJogSpeedOption}
                        searchable
                        value={this.state.jogSpeed}
                        onChange={this.actions.onChangeJogSpeed}
                    />
                </div>

                <ControlPanel
                    state={state}
                    actions={actions}
                    executeGcode={this.actions.executeGcode}
                />
            </div>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const machine = state.machine;
    const { widgets } = state.widget;
    const { widgetId } = ownProps;
    const { jog, axes, dataSource } = widgets[widgetId];

    const { speed = 1500, keypad, selectedDistance, customDistance, selectedAngle, customAngle } = jog;
    const { port, headType, isConnected, workflowState, workPosition, originOffset = {}, workflowStatus } = machine;
    const { boundingBox } = state.workspace;

    return {
        port,
        headType,
        isConnected,
        dataSource,
        workflowState,
        workPosition,
        originOffset,
        workflowStatus,
        axes,
        speed,
        keypad,
        selectedDistance,
        customDistance,
        selectedAngle,
        customAngle,
        boundingBox
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        executeGcode: (gcode) => dispatch(machineActions.executeGcode(gcode)),
        executeGcodeAutoHome: () => dispatch(machineActions.executeGcodeAutoHome()),
        updateWidgetState: (widgetId, value) => dispatch(widgetActions.updateWidgetState(widgetId, '', value))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Control);
