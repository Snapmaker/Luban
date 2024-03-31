import { WorkflowStatus } from '@snapmaker/luban-platform';
import { isNil } from 'lodash';
import includes from 'lodash/includes';
import map from 'lodash/map';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { controller } from '../../../communication/socket-communication';
import {
    HEAD_PRINTING,
    IMPERIAL_UNITS,
    METRIC_UNITS,
} from '../../../constants';
import { RootState } from '../../../flux/index.def';
import { actions as widgetsActions } from '../../../flux/widget';
import { actions as workspaceActions } from '../../../flux/workspace';
// import { actions as laserActions } from '../../../flux/laser';
import { MachineAgent } from '../../../flux/workspace/MachineAgent';
import usePrevious from '../../../lib/hooks/previous';
import { in2mm, mm2in } from '../../../lib/units';
import ControlPanel from './ControlPanel';
import DisplayPanel from './DisplayPanel';
import { DEFAULT_AXES, DISTANCE_MAX, DISTANCE_MIN, DISTANCE_STEP } from './constants';

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
        val = parseFloat(mm2in(val).toFixed(4)) * 1;
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

declare interface ConnectionControlProps {
    widgetId: string;
    isNotInWorkspace?: boolean
    runBoundary?: () => void
}

const Control: React.FC<ConnectionControlProps> = ({ widgetId, isNotInWorkspace, runBoundary }) => {
    const dispatch = useDispatch();

    const { widgets } = useSelector((state: RootState) => state.widget);

    const { isConnected } = useSelector((state: RootState) => state.workspace);
    const { headType } = useSelector((state: RootState) => state.workspace);

    const server: MachineAgent = useSelector((state: RootState) => state.workspace.server);
    const {
        isMoving,
        workflowStatus,
        workPosition,
        originOffset,
        boundingBox
    } = useSelector((state: RootState) => state.workspace);

    // const { enableABPositionShortcut } = useSelector((state: RootState) => state.laser);

    const { jog, axes } = widgets[widgetId];
    const { speed = 1500, keypad, selectedDistance, customDistance, selectedAngle, customAngle } = jog;

    const serverRef = useRef(server);
    useEffect(() => {
        serverRef.current = server;
    }, [server]);


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
            },

            // enableShortcut
            enableShortcut: true
        };
    }

    const [state, setState] = useState(() => getInitialState());
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
        getJogSpeed: () => {
            const { jogSpeed } = state;

            return jogSpeed;
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
                const signNumber = 1;
                // if (axisMoved === 'Y' && state.workPosition.isFourAxis) {
                //     signNumber = -1;
                // } else {
                //     signNumber = 1;
                // }
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
            dispatch(workspaceActions.executeGcode(gcode));
        },
        coordinateMove: (gcode, moveOrders, jogSpeed) => {
            serverRef.current.coordinateMove(moveOrders, gcode, jogSpeed, headType);
        },
        setWorkOrigin: () => {
            if (headType === HEAD_PRINTING) return;
            const xPosition = parseFloat(workPosition.x);
            const yPosition = parseFloat(workPosition.y);
            const zPosition = parseFloat(workPosition.z);
            const bPosition = workPosition.isFourAxis ? parseFloat(workPosition.b) : null;
            serverRef.current.setWorkOrigin(xPosition, yPosition, zPosition, bPosition);
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
    };

    const controllerEvents = {
        'connection:close': () => {
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
        addControllerEvents();
        return () => {
            removeControllerEvents();
        };
    }, [prevState]);


    const canClick = useMemo(() => {
        return isConnected && includes([WorkflowStatus.Unknown, WorkflowStatus.Idle, WorkflowStatus.Stopped], workflowStatus) && !isMoving;
    }, [isConnected, workflowStatus, isMoving]);


    useEffect(() => {
        const { keypadJogging, selectedAxis } = state;

        // Disable keypad jogging and shuttle wheel when the workflow is not in the idle state.
        // This prevents accidental movement while sending G-code commands.
        setState({
            ...state,
            keypadJogging: (workflowStatus === WorkflowStatus.Idle) ? keypadJogging : false,
            selectedAxis: (workflowStatus === WorkflowStatus.Idle) ? selectedAxis : '',
            canClick: canClick,
        });
    }, [isConnected, workflowStatus, isMoving, canClick]);

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

        dispatch(widgetsActions.updateWidgetState(widgetId, '', {
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
            dispatch(widgetsActions.updateWidgetState(widgetId, '', {
                jog: {
                    customDistance: Number(distance)
                }
            }));
        }
    }, [state]);

    return (
        <div>
            {!isNotInWorkspace && (
                <DisplayPanel
                    workPosition={workPosition}
                    originOffset={state.originOffset}
                    headType={headType}
                    executeGcode={actions.executeGcode}
                    state={state}
                />
            )}

            {/* {isNotInWorkspace && (
                <div className="sm-flex justify-space-between margin-vertical-8">
                    <span>{i18n._('key-Workspace/Console-Keyboard Shortcuts')}</span>
                    <Switch
                        onClick={() => setState(stateBefore => ({ ...state, enableShortcut: !stateBefore.enableShortcut }))}
                        disabled={!canClick}
                        checked={state.enableShortcut}
                    />
                </div>
            )} */}
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

            <ControlPanel
                enableShortcut={state.enableShortcut}
                disabled={!canClick}
                state={state}
                workPosition={workPosition}
                originOffset={state.originOffset}
                actions={actions}
                executeGcode={actions.executeGcode}
                isNotInWorkspace={isNotInWorkspace}
                runBoundary={runBoundary}
            />
        </div>
    );
};

export default Control;
