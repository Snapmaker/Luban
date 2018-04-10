import _, { includes } from 'lodash';
import classNames from 'classnames';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import shallowCompare from 'react-addons-shallow-compare';
import pubsub from 'pubsub-js';
import Widget from '../../components/Widget';
import combokeys from '../../lib/combokeys';
import controller from '../../lib/controller';
import { preventDefault } from '../../lib/dom-events';
import i18n from '../../lib/i18n';
import { in2mm, mm2in } from '../../lib/units';
import WidgetConfig from '../WidgetConfig';
import Axes from './Axes';
import ShuttleControl from './ShuttleControl';
import log from '../../lib/log';

import {
    // Units
    IMPERIAL_UNITS,
    METRIC_UNITS,
    // Grbl
    GRBL,
    GRBL_ACTIVE_STATE_IDLE,
    GRBL_ACTIVE_STATE_RUN,
    // Marlin
    MARLIN,
    // Smoothie
    SMOOTHIE,
    SMOOTHIE_ACTIVE_STATE_IDLE,
    SMOOTHIE_ACTIVE_STATE_RUN,
    // TinyG
    TINYG,
    TINYG_MACHINE_STATE_READY,
    TINYG_MACHINE_STATE_STOP,
    TINYG_MACHINE_STATE_END,
    TINYG_MACHINE_STATE_RUN,
    // Workflow
    WORKFLOW_STATE_IDLE
} from '../../constants';
import {
    MODAL_NONE,
    DISTANCE_MIN,
    DISTANCE_MAX,
    DISTANCE_STEP,
    DEFAULT_AXES
} from './constants';
import styles from './index.styl';

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

class AxesWidget extends Component {
    static propTypes = {
        widgetId: PropTypes.string.isRequired,
        onFork: PropTypes.func.isRequired,
        onRemove: PropTypes.func.isRequired,
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
        openModal: (name = MODAL_NONE, params = {}) => {
            this.setState({
                modal: {
                    name: name,
                    params: params
                }
            });
        },
        closeModal: () => {
            this.setState({
                modal: {
                    name: MODAL_NONE,
                    params: {}
                }
            });
        },
        updateModalParams: (params = {}) => {
            this.setState({
                modal: {
                    ...this.state.modal,
                    params: {
                        ...this.state.modal.params,
                        ...params
                    }
                }
            });
        },
        loadConfig: () => {
            return {
                axes: this.config.get('axes'),
                feedrateMin: this.config.get('shuttle.feedrateMin'),
                feedrateMax: this.config.get('shuttle.feedrateMax'),
                hertz: this.config.get('shuttle.hertz'),
                overshoot: this.config.get('shuttle.overshoot')
            };
        },
        saveConfig: (data) => {
            const {
                axes,
                feedrateMin,
                feedrateMax,
                hertz,
                overshoot
            } = { ...data };

            this.config.replace('axes', axes); // array
            this.config.set('shuttle.feedrateMin', feedrateMin);
            this.config.set('shuttle.feedrateMax', feedrateMax);
            this.config.set('shuttle.hertz', hertz);
            this.config.set('shuttle.overshoot', overshoot);

            // Update axes
            this.setState({ axes: axes });
        },
        getJogDistance: () => {
            const { units } = this.state;
            const selectedDistance = this.config.get('jog.selectedDistance');
            const customDistance = this.config.get('jog.customDistance');
            if (selectedDistance) {
                return Number(selectedDistance) || 0;
            }
            return toUnits(units, customDistance);
        },
        getWorkCoordinateSystem: () => {
            const controllerType = this.state.controller.type;
            const controllerState = this.state.controller.state;
            const defaultWCS = 'G54';

            if (controllerType === GRBL) {
                return _.get(controllerState, 'parserstate.modal.coordinate') || defaultWCS;
            }

            // FIXME
            if (controllerType === MARLIN) {
                return _.get(controllerState, 'parserstate.modal.coordinate') || defaultWCS;
            }

            if (controllerType === SMOOTHIE) {
                return _.get(controllerState, 'parserstate.modal.coordinate') || defaultWCS;
            }

            if (controllerType === TINYG) {
                return _.get(controllerState, 'sr.modal.coordinate') || defaultWCS;
            }

            return defaultWCS;
        },
        jog: (params = {}) => {
            const s = _.map(params, (value, letter) => ('' + letter.toUpperCase() + value)).join(' ');
            controller.command('gcode', 'G91'); // relative distance
            this.actions.ensureFeedrateCommand('G0 ' + s);
            controller.command('gcode', 'G90'); // absolute distance
        },
        move: (params = {}) => {
            const s = _.map(params, (value, letter) => ('' + letter.toUpperCase() + value)).join(' ');
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
        SELECT_AXIS: (event, { axis }) => {
            const { canClick, selectedAxis } = this.state;

            if (!canClick) {
                return;
            }

            if (selectedAxis === axis) {
                this.actions.selectAxis(); // deselect axis
            } else {
                this.actions.selectAxis(axis);
            }
        },
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
            const feedrateMin = this.config.get('shuttle.feedrateMin');
            const feedrateMax = this.config.get('shuttle.feedrateMax');
            const hertz = this.config.get('shuttle.hertz');
            const overshoot = this.config.get('shuttle.overshoot');

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
        'Grbl:state': (state) => {
            const { status, parserstate } = { ...state };
            const { mpos, wpos } = status;
            const { modal = {} } = { ...parserstate };
            const units = {
                'G20': IMPERIAL_UNITS,
                'G21': METRIC_UNITS
            }[modal.units] || this.state.units;

            let customDistance = this.config.get('jog.customDistance');
            if (units === IMPERIAL_UNITS) {
                customDistance = mm2in(customDistance).toFixed(4) * 1;
            }
            if (units === METRIC_UNITS) {
                customDistance = Number(customDistance).toFixed(3) * 1;
            }

            this.setState({
                units: units,
                controller: {
                    type: GRBL,
                    state: state
                },
                machinePosition: {
                    ...this.state.machinePosition,
                    ...mpos
                },
                workPosition: {
                    ...this.state.workPosition,
                    ...wpos
                },
                customDistance: customDistance
            });
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
        },
        'Smoothie:state': (state) => {
            const { status, parserstate } = { ...state };
            const { mpos, wpos } = status;
            const { modal = {} } = { ...parserstate };
            const units = {
                'G20': IMPERIAL_UNITS,
                'G21': METRIC_UNITS
            }[modal.units] || this.state.units;

            let customDistance = this.config.get('jog.customDistance');
            if (units === IMPERIAL_UNITS) {
                customDistance = mm2in(customDistance).toFixed(4) * 1;
            }
            if (units === METRIC_UNITS) {
                customDistance = Number(customDistance).toFixed(3) * 1;
            }

            this.setState({
                units: units,
                controller: {
                    type: SMOOTHIE,
                    state: state
                },
                machinePosition: {
                    ...this.state.machinePosition,
                    ...mpos
                },
                workPosition: {
                    ...this.state.workPosition,
                    ...wpos
                },
                customDistance: customDistance
            });
        },
        'TinyG:state': (state) => {
            const { sr } = { ...state };
            const { mpos, wpos, modal = {} } = sr;
            const units = {
                'G20': IMPERIAL_UNITS,
                'G21': METRIC_UNITS
            }[modal.units] || this.state.units;

            let customDistance = this.config.get('jog.customDistance');
            if (units === IMPERIAL_UNITS) {
                customDistance = mm2in(customDistance).toFixed(4) * 1;
            }
            if (units === METRIC_UNITS) {
                customDistance = Number(customDistance).toFixed(3) * 1;
            }

            // https://github.com/synthetos/g2/wiki/Status-Reports
            // Canonical machine position are always reported in millimeters with no offsets.
            const machinePosition = {
                ...this.state.machinePosition,
                ...mpos
            };
            // Work position are reported in current units, and also apply any offsets.
            const workPosition = _.mapValues({
                ...this.state.workPosition,
                ...wpos
            }, (val) => {
                return (units === IMPERIAL_UNITS) ? in2mm(val) : val;
            });

            this.setState({
                units: units,
                controller: {
                    type: TINYG,
                    state: state
                },
                machinePosition: machinePosition,
                workPosition: workPosition,
                customDistance: customDistance
            });
        }
    };
    shuttleControl = null;

    pubsubTokens = [];

    subscribe() {
        const tokens = [
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
                        },
                        delta: {
                            x: 0,
                            y: 0,
                            z: 0
                        }
                    }
                });
            }),
            pubsub.subscribe('gcode:bbox', (msg, bbox) => {
                const dX = bbox.max.x - bbox.min.x;
                const dY = bbox.max.y - bbox.min.y;
                const dZ = bbox.max.z - bbox.min.z;

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
                        },
                        delta: {
                            x: dX,
                            y: dY,
                            z: dZ
                        }
                    }
                });
            })
        ];
        this.pubsubTokens = this.pubsubTokens.concat(tokens);
    }
    unsubscribe() {
        this.pubsubTokens.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        this.pubsubTokens = [];
    }

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
    shouldComponentUpdate(nextProps, nextState) {
        return shallowCompare(this, nextProps, nextState);
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

        this.config.set('minimized', minimized);
        this.config.set('axes', axes);
        this.config.set('jog.keypad', keypadJogging);
        this.config.set('jog.selectedDistance', selectedDistance);

        // The custom distance will not persist while toggling between in and mm
        if ((prevState.customDistance !== customDistance) && (prevState.units === units)) {
            const distance = (units === IMPERIAL_UNITS) ? in2mm(customDistance) : customDistance;
            // Save customDistance in mm
            this.config.set('jog.customDistance', Number(distance));
        }
    }
    getInitialState() {
        return {
            minimized: this.config.get('minimized', false),
            isFullscreen: false,
            canClick: true, // Defaults to true
            port: controller.port,
            units: METRIC_UNITS,
            controller: {
                type: controller.type,
                state: controller.state
            },
            modal: {
                name: MODAL_NONE,
                params: {}
            },
            workflowState: controller.workflowState,
            axes: this.config.get('axes', DEFAULT_AXES),
            machinePosition: { // Machine position
                x: '0.000',
                y: '0.000',
                z: '0.000',
                a: '0.000'
            },
            workPosition: { // Work position
                x: '0.000',
                y: '0.000',
                z: '0.000',
                a: '0.000'
            },
            keypadJogging: this.config.get('jog.keypad'),
            jogSpeed: 3000,
            enabledJogSpeed: true,
            selectedAxis: '', // Defaults to empty
            selectedDistance: this.config.get('jog.selectedDistance'),
            customDistance: toUnits(METRIC_UNITS, this.config.get('jog.customDistance')),

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
                },
                delta: {
                    x: 0,
                    y: 0,
                    z: 0
                }
            }
        };
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
            feedrate = feedrate.toFixed(3) * 1;
            relativeDistance = relativeDistance.toFixed(4) * 1;

            controller.command('gcode', 'G91 G1 F' + feedrate + ' ' + axis + relativeDistance);
            controller.command('gcode', 'G90');
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
    canClick() {
        const { port, workflowState } = this.state;
        const controllerType = this.state.controller.type;
        const controllerState = this.state.controller.state;

        if (!port) {
            return false;
        }
        if (workflowState !== WORKFLOW_STATE_IDLE) {
            return false;
        }
        if (!includes([GRBL, MARLIN, SMOOTHIE, TINYG], controllerType)) {
            return false;
        }
        if (controllerType === GRBL) {
            const activeState = _.get(controllerState, 'status.activeState');
            const states = [
                GRBL_ACTIVE_STATE_IDLE,
                GRBL_ACTIVE_STATE_RUN
            ];
            if (!includes(states, activeState)) {
                return false;
            }
        }
        // FIXME
        if (controllerType === MARLIN) {
            // Unsupported
        }
        if (controllerType === SMOOTHIE) {
            const activeState = _.get(controllerState, 'status.activeState');
            const states = [
                SMOOTHIE_ACTIVE_STATE_IDLE,
                SMOOTHIE_ACTIVE_STATE_RUN
            ];
            if (!includes(states, activeState)) {
                return false;
            }
        }
        if (controllerType === TINYG) {
            const machineState = _.get(controllerState, 'sr.machineState');
            const states = [
                TINYG_MACHINE_STATE_READY,
                TINYG_MACHINE_STATE_STOP,
                TINYG_MACHINE_STATE_END,
                TINYG_MACHINE_STATE_RUN
            ];
            if (!includes(states, machineState)) {
                return false;
            }
        }

        return true;
    }
    render() {
        const { widgetId } = this.props;
        const { minimized, isFullscreen } = this.state;
        const { units, machinePosition, workPosition } = this.state;
        const isForkedWidget = widgetId.match(/\w+:[\w\-]+/);
        const state = {
            ...this.state,
            // Determine if the motion button is clickable
            canClick: this.canClick(),
            // Output machine position with the display units
            machinePosition: _.mapValues(machinePosition, (pos, axis) => {
                return String(toFixedUnits(units, pos));
            }),
            // Output work position with the display units
            workPosition: _.mapValues(workPosition, (pos, axis) => {
                return String(toFixedUnits(units, pos));
            })
        };
        const actions = {
            ...this.actions
        };

        return (
            <Widget fullscreen={isFullscreen}>
                <Widget.Header>
                    <Widget.Title>
                        <Widget.Sortable className={this.props.sortable.handleClassName}>
                            <i className="fa fa-bars" />
                            <span className="space" />
                        </Widget.Sortable>
                        {i18n._('Axes')}
                        {isForkedWidget &&
                        <i className="fa fa-code-fork" style={{ marginLeft: 5 }} />
                        }
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
                                } else if (eventKey === 'fork') {
                                    this.props.onFork();
                                } else if (eventKey === 'remove') {
                                    this.props.onRemove();
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
                            <Widget.DropdownMenuItem eventKey="fork">
                                <i className="fa fa-fw fa-code-fork" />
                                <span className="space space-sm" />
                                {i18n._('Fork Widget')}
                            </Widget.DropdownMenuItem>
                            <Widget.DropdownMenuItem eventKey="remove">
                                <i className="fa fa-fw fa-times" />
                                <span className="space space-sm" />
                                {i18n._('Remove Widget')}
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
                    <Axes state={state} actions={actions} />
                </Widget.Content>
            </Widget>
        );
    }
}

export default AxesWidget;
