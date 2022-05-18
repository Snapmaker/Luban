import map from 'lodash/map';
import includes from 'lodash/includes';
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { isNil } from 'lodash';
// import Switch from '../../components/Switch';
import Select from '../../components/Select';
import { Button } from '../../components/Buttons';
import i18n from '../../../lib/i18n';
import { controller } from '../../../lib/controller';
// import { preventDefault } from '../../../lib/dom-events';
import { in2mm, mm2in } from '../../../lib/units';
import usePrevious from '../../../lib/hooks/previous';
import DisplayPanel from './DisplayPanel';
import ControlPanel from './ControlPanel';
// import KeypadOverlay from './KeypadOverlay';
import { actions as machineActions } from '../../../flux/machine';
import { actions as widgetActions } from '../../../flux/widget';
import {
    HEAD_CNC,
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
import ModalSmall from '../../components/Modal/ModalSmall';

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

function Control({ widgetId, widgetActions: _widgetActions }) {
    const machine = useSelector(state => state.machine);
    const { widgets } = useSelector(state => state.widget);
    const { boundingBox } = useSelector(state => state.workspace);
    const workPosition = useSelector(state => state.machine.workPosition);
    const originOffset = useSelector(state => state.machine.originOffset) || {};
    const { jog, axes, dataSource } = widgets[widgetId];
    const { speed = 1500, keypad, selectedDistance, customDistance, selectedAngle, customAngle } = jog;
    const { headType, isConnected, workflowState, workflowStatus, homingModal } = machine;
    const dispatch = useDispatch();
    function getInitialState() {
        const jogSpeed = speed;
        let _workPosition = {
            x: '0.000',
            y: '0.000',
            z: '0.000'
        };
        let _originOffset = {
            x: 0,
            y: 0,
            z: 0
        };
        // init jog speed options, add saved speed when it doesn't exists in default options
        const jogSpeedOptions = DEFAULT_SPEED_OPTIONS;
        const optionFound = jogSpeedOptions.find(option => option.value === jogSpeed);
        if (!optionFound) {
            jogSpeedOptions.push({ label: jogSpeed, value: jogSpeed });
        }
        if (workPosition) {
            _workPosition = workPosition;
        }
        if (originOffset) {
            _originOffset = originOffset;
        }
        return {
            // config
            axes: axes || DEFAULT_AXES,
            keypadJogging: keypad,
            jogSpeed,
            jogSpeedOptions,
            selectedAxis: '', // Defaults to empty
            selectedDistance: selectedDistance,
            customDistance: toUnits(METRIC_UNITS, customDistance),
            selectedAngle: selectedAngle,
            customAngle: customAngle,


            // display
            canClick: true, // Defaults to true

            units: METRIC_UNITS,

            workPosition: _workPosition,

            originOffset: _originOffset,

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

    const [state, setState] = useState(() => getInitialState());
    const [homingModalShow, setHomingModalShow] = useState(homingModal);
    const prevState = usePrevious({
        customDistance: state.customDistance,
        units: state.units,
        bbox: state.bbox
    });

    const actions = {
        onChangeJogSpeed: (option) => {
            const jogSpeed = Math.min(6000, Number(option.value) || 0);
            setState({ ...state, jogSpeed });
        },
        onCreateJogSpeedOption: (option) => {
            const jogSpeed = Math.min(6000, Number(option.value) || 0);
            const newOption = { label: jogSpeed, value: jogSpeed };
            setState({
                ...state,
                jogSpeed,
                jogSpeedOptions: [...state.jogSpeedOptions, newOption]
            });
        },
        getJogDistance: () => {
            const { units } = state;
            if (selectedDistance) {
                return Number(selectedDistance) || 0;
            }
            return toUnits(units, customDistance);
        },
        getJogAngle: () => {
            if (selectedAngle) {
                return Number(selectedAngle) || 0;
            }
            return Number(customAngle);
        },

        // actions
        jog: (params = {}) => {
            const sArr = [];
            const s = map(params, (value, axis) => {
                const axisMoved = axis.toUpperCase();
                let signNumber = 1;
                if (axisMoved === 'Y' && state.workPosition.isFourAxis) {
                    signNumber = -1;
                } else {
                    signNumber = 1;
                }
                sArr.push({
                    axis: axisMoved,
                    distance: parseFloat(state.workPosition[axisMoved.toLowerCase()]) + (signNumber * value)
                });
                return (`${axisMoved}${signNumber * value}`);
            }).join(' ');
            if (s || !!sArr.length) {
                const gcode = ['G91', `G0 ${s} F${state.jogSpeed}`, 'G90'];
                actions.coordinateMove(gcode.join('\n'), sArr, state.jogSpeed);
            }
        },
        selectAngle: (angle = '') => {
            setState({ ...state, selectedAngle: angle });
        },
        changeCustomAngle: (_customAngle) => {
            setState({ ...state, customAngle: _customAngle });
        },

        move: (params = {}) => {
            const sArr = [];
            const s = map(params, (value, axis) => {
                console.log('moveOffset', axis, state.originOffset, state.originOffset[axis.toLowerCase()], state.workPosition[axis.toLowerCase()]);
                sArr.push({
                    axis: axis.toUpperCase(),
                    distance: value
                });
                return `${axis.toUpperCase()}${value}`;
            }).join(' ');
            if (s) {
                const gcode = `G0 ${s} F${state.jogSpeed}`;
                // actions.executeGcode(`G0 ${s} F${state.jogSpeed}`);
                actions.coordinateMove(gcode, sArr, state.jogSpeed);
            }
        },
        executeGcode: (gcode) => {
            dispatch(machineActions.executeGcode(gcode));
        },
        coordinateMove: (gcode, moveOrders, jogSpeed) => {
            dispatch(machineActions.coordinateMove(gcode, moveOrders, jogSpeed));
        },
        setWorkOrigin: () => {
            console.log(workPosition, state.workPosition);
            const xPosition = parseFloat(workPosition.x);
            const yPosition = parseFloat(workPosition.y);
            const zPosition = parseFloat(workPosition.z);
            const bPosition = workPosition.isFourAxis ? parseFloat(workPosition.b) : null;
            dispatch(machineActions.setWorkOrigin(xPosition, yPosition, zPosition, bPosition));
        },
        toggleKeypadJogging: () => {
            setState(stateBefore => ({
                ...state,
                keypadJogging: !stateBefore.keypadJogging
            }));
        },
        selectDistance: (distance = '') => {
            setState({ ...state, selectedDistance: distance });
        },
        changeCustomDistance: (_customDistance) => {
            _customDistance = normalizeToRange(_customDistance, DISTANCE_MIN, DISTANCE_MAX);
            setState({ ...state, customDistance: _customDistance });
        },
        increaseCustomDistance: () => {
            const { units } = state;
            let distance = Math.min(Number(state.customDistance) + DISTANCE_STEP, DISTANCE_MAX);
            if (units === IMPERIAL_UNITS) {
                distance = distance.toFixed(4) * 1;
            }
            if (units === METRIC_UNITS) {
                distance = distance.toFixed(3) * 1;
            }
            setState({ ...state, customDistance: distance });
        },
        increaseCustomAngle: () => {
            const angle = state.customAngle + 1;
            setState({ ...state, customAngle: angle });
        },
        decreaseCustomAngle: () => {
            const angle = state.customAngle - 1;
            setState({ ...state, customAngle: angle });
        },

        decreaseCustomDistance: () => {
            const { units } = state;
            let distance = Math.max(Number(state.customDistance) - DISTANCE_STEP, DISTANCE_MIN);
            if (units === IMPERIAL_UNITS) {
                distance = distance.toFixed(4) * 1;
            }
            if (units === METRIC_UNITS) {
                distance = distance.toFixed(3) * 1;
            }
            setState({ ...state, customDistance: distance });
        },
        runBoundary: () => {
            const { bbox } = state;
            const gcode = [];
            if (headType === HEAD_CNC) {
                gcode.push('G91', 'G0 Z5 F400', 'G90');
            }
            if (workPosition.isFourAxis) {
                const angleDiff = Math.abs(bbox.max.b - bbox.min.b);
                const minB = 0;
                const maxB = angleDiff > 360 ? 360 : angleDiff;
                gcode.push(
                    'G90', // absolute position
                    `G0 B${minB} Y${bbox.min.y} F${state.jogSpeed}`, // run boundary
                    `G0 B${minB} Y${bbox.max.y}`,
                    `G0 B${maxB} Y${bbox.max.y}`,
                    `G0 B${maxB} Y${bbox.min.y}`,
                    `G0 B${minB} Y${bbox.min.y}`,
                    `G0 B${workPosition.b} Y${workPosition.y}` // go back to origin
                );
            } else {
                gcode.push(
                    'G90', // absolute position
                    `G0 X${bbox.min.x} Y${bbox.min.y} F${state.jogSpeed}`, // run boundary
                    `G0 X${bbox.min.x} Y${bbox.max.y}`,
                    `G0 X${bbox.max.x} Y${bbox.max.y}`,
                    `G0 X${bbox.max.x} Y${bbox.min.y}`,
                    `G0 X${bbox.min.x} Y${bbox.min.y}`,
                    `G0 X${workPosition.x} Y${workPosition.y}` // go back to origin
                );
            }

            if (headType === HEAD_CNC) {
                gcode.push('G91', 'G0 Z-5 F400', 'G90');
            }

            actions.executeGcode(gcode.join('\n'));
        }
    };

    const controllerEvents = {
        'connection:close': (options) => {
            const { dataSource: _dataSource } = options;
            if (_dataSource !== dataSource) {
                return;
            }
            const initialState = getInitialState();
            const newState = {
                ...state,
                ...initialState,
                bbox: prevState.bbox
            };
            setState(newState);
        }
    };

    function addControllerEvents() {
        Object.keys(controllerEvents).forEach(eventName => {
            const callback = controllerEvents[eventName];
            controller.on(eventName, callback);
        });
    }

    function removeControllerEvents() {
        Object.keys(controllerEvents).forEach(eventName => {
            const callback = controllerEvents[eventName];
            controller.off(eventName, callback);
        });
    }

    useEffect(() => {
        _widgetActions.setTitle(i18n._('key-Workspace/Console-Control'));
        addControllerEvents();
        return () => {
            removeControllerEvents();
        };
    }, [prevState]);

    useEffect(() => {
        const { keypadJogging, selectedAxis } = state;

        // Disable keypad jogging and shuttle wheel when the workflow is not in the idle state.
        // This prevents accidental movement while sending G-code commands.
        setState({
            ...state,
            keypadJogging: (workflowState === WORKFLOW_STATE_IDLE) ? keypadJogging : false,
            selectedAxis: (workflowState === WORKFLOW_STATE_IDLE) ? selectedAxis : ''
        });
    }, [workflowState]);

    useEffect(() => {
        setState({
            ...state,
            workPosition: {
                ...state.workPosition,
                ...workPosition
            }
        });
    }, [workPosition]);

    useEffect(() => {
        setState({
            ...state,
            originOffset: {
                ...state.originOffset,
                ...originOffset
            }
        });
    }, [originOffset]);

    useEffect(() => {
        if (isNil(boundingBox)) {
            setState({
                ...state,
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
            setState({
                ...state,
                bbox: boundingBox
            });
        }
    }, [boundingBox]);

    useEffect(() => {
        const {
            units,
            jogSpeed,
            keypadJogging
        } = state;

        dispatch(widgetActions.updateWidgetState(widgetId, '', {
            axes: state.axes,
            jog: {
                speed: jogSpeed,
                keypad: keypadJogging,
                selectedDistance: state.selectedDistance, // '1', '0.1', '0.01', '0.001', or ''
                selectedAngle: state.selectedAngle ? String(state.selectedAngle) : String(state.customAngle)
            }
        }));

        // The custom distance will not persist while toggling between in and mm
        if (prevState && (prevState.customDistance !== state.customDistance) && (prevState.units === units)) {
            const distance = (units === IMPERIAL_UNITS) ? in2mm(state.customDistance) : state.customDistance;
            // Save customDistance in mm
            // this.props.config.set('jog.customDistance', Number(distance));
            dispatch(widgetActions.updateWidgetState(widgetId, '', {
                jog: {
                    customDistance: Number(distance)
                }
            }));
        }
    }, [state]);

    useEffect(() => {
        if (!isConnected) {
            setHomingModalShow(false);
        } else {
            setHomingModalShow(homingModal);
        }
    }, [homingModal, isConnected]);

    function canClick() {
        return (isConnected
            && includes([WORKFLOW_STATE_IDLE], workflowState)
            && includes([WORKFLOW_STATUS_IDLE, WORKFLOW_STATUS_UNKNOWN], workflowStatus));
    }

    const _canClick = canClick();

    return (
        <div>
            <DisplayPanel
                workPosition={workPosition}
                originOffset={state.originOffset}
                headType={headType}
                executeGcode={actions.executeGcode}
                state={state}
            />

            {/* Comment this since Luban v4.0 and will be used in the future */}
            {/* <div>
                <KeypadOverlay
                    show={_canClick && state.keypadJogging}
                >
                    <div className="sm-flex justify-space-between margin-vertical-8">
                        <span>{i18n._('key-Workspace/Console-Keyboard Shortcuts')}</span>
                        <Switch
                            onClick={actions.toggleKeypadJogging}
                            disabled={!_canClick}
                            checked={state.keypadJogging}
                        />
                    </div>
                </KeypadOverlay>
            </div> */}

            <div className="margin-vertical-8">
                <Button
                    type="primary"
                    level="level-three"
                    width="96px"
                    disabled={!_canClick}
                    onClick={() => dispatch(machineActions.executeGcodeAutoHome(true))}
                >
                    {i18n._('key-Workspace/Console-Home')}
                </Button>
                <div className="sm-flex justify-space-between align-center">
                    <span className="max-width-208 text-overflow-ellipsis">{i18n._('key-Workspace/Console-Jog Speed')}</span>
                    <Select
                        backspaceRemoves={false}
                        className="margin-left-8"
                        clearable={false}
                        size="middle"
                        menuContainerStyle={{ zIndex: 5 }}
                        options={state.jogSpeedOptions}
                        onNewOptionClick={actions.onCreateJogSpeedOption}
                        searchable
                        value={state.jogSpeed}
                        onChange={actions.onChangeJogSpeed}
                    />
                </div>
            </div>

            <ControlPanel
                state={state}
                workPosition={workPosition}
                actions={actions}
                executeGcode={actions.executeGcode}
            />
            {homingModalShow && (
                <ModalSmall
                    closable={false}
                    isImage={false}
                    img="WarningTipsWarning"
                    centered
                    title="key-Workspace/Connection-Go Home"
                    iconColor="#FFA940"
                />
            )}
        </div>
    );
}
Control.propTypes = {
    widgetId: PropTypes.string.isRequired,
    widgetActions: PropTypes.object.isRequired
};

export default Control;
