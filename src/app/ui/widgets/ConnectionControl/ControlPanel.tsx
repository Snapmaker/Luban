import { includes } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { HEAD_CNC, HEAD_LASER } from '../../../constants';
import { RootState } from '../../../flux/index.def';
import { actions as workspaceActions } from '../../../flux/workspace';
import { MachineAgent } from '../../../flux/workspace/MachineAgent';
import i18n from '../../../lib/i18n';
import { Button } from '../../components/Buttons';
import Select from '../../components/Select';
import Switch from '../../components/Switch';
import JogDistance from './JogDistance';
import JogPad from './JogPad';
import MotionButtonGroup from './MotionButtonGroup';
import ABPositionButtonGroup from './ABPositionButtonGroup';
import styles from './styles.styl';
// import { L2WLaserToolModule } from '../../../machines/snapmaker-2-toolheads';
// import { ConnectionType } from '../../../flux/workspace/state';
import { SnapmakerRayMachine } from '../../../machines';
import { L2WLaserToolModule } from '../../../machines/snapmaker-2-toolheads';

interface MoveOptions {
    X?: number;
    Y?: number;
    Z?: number;
    B?: number;
}

interface ControlPanelProps {
    isNotInWorkspace: boolean
    workPosition: {
        isFourAxis: boolean;
        x: number;
        y: number;
        z: number;
        b: number;
    };
    enableShortcut?:boolean
    disabled?: boolean;
    state: {
        bbox: {
            min: {
                x: number,
                y: number,
                z: number,
                b: number,
            },
            max: {
                x: number,
                y: number,
                z: number,
                b: number,
            }
        },
        jogSpeed: number;
        jogSpeedOptions: [{ label: string, value: string }],
        keypadJogging: boolean;
        selectedAxis: '' | 'x' | 'y' | 'z';
    };
    actions: {
        getJogSpeed: () => number;
        getJogDistance: () => number;
        getJogAngle: () => number;
        move: (jogOptions: MoveOptions) => void;
        jog: (jogOptions: MoveOptions) => void;

        getJogSpeedOptions: () => [{ label: string, value: number }];
        onCreateJogSpeedOption: (option) => void;
        onChangeJogSpeed: (option) => void;
    }
    executeGcode: () => void;
    runBoundary?: () => void;
}

/**
 * Control Panel.
 */
const ControlPanel: React.FC<ControlPanelProps> = (props) => {
    const { workPosition, disabled = true, actions, isNotInWorkspace, enableShortcut } = props;
    const enableBAxis = workPosition.isFourAxis;

    const { headType, toolHead } = useSelector((state: RootState) => state.workspace);
    const server: MachineAgent = useSelector((state: RootState) => state.workspace.server);
    const { activeMachine } = useSelector((state: RootState) => state.workspace);
    const RayWorkArea = { X: 600, Y: 400 };
    const RayWorkAreaOffset = { X: 0, Y: 0 };

    const step = actions.getJogDistance();
    const stepAngle = actions.getJogAngle();

    const jogSpeed = props.state.jogSpeed;
    const jogSpeedOptions = props.state.jogSpeedOptions;

    let bbox = props.state.bbox;

    const [isConnectedRay, setIsConnectedRay] = useState(false);
    const [keepLaserOn, setKeepLaserOn] = useState(false);

    const onToggleKeepLaser = useCallback(() => {
        setKeepLaserOn(!keepLaserOn);
    }, [keepLaserOn]);

    const dispatch = useDispatch();

    const goHome = useCallback(() => {
        console.log('isConnectedRay', isConnectedRay);
        return isConnectedRay
            ? dispatch(workspaceActions.executeGcode('$H')) as unknown as Promise<void>
            : dispatch(workspaceActions.executeGcodeAutoHome(true));
    }, [dispatch, workspaceActions, isConnectedRay]);


    useEffect(() => {
        if (!activeMachine) return;
        console.log('machine', activeMachine.identifier, SnapmakerRayMachine.identifier, activeMachine.identifier === SnapmakerRayMachine.identifier, includes([SnapmakerRayMachine.identifier], activeMachine.identifier), isConnectedRay);
        setIsConnectedRay(includes([SnapmakerRayMachine.identifier], activeMachine.identifier));
    }, [activeMachine]);


    const relativeMove = useCallback((moveOptions: MoveOptions) => {
        const moveOrders = [];
        let gcodeAxis = '';
        for (const axis of Object.keys(moveOptions)) {
            const axisMove = moveOptions[axis];

            // const currentPosition = parseFloat(workPosition[axis.toLowerCase()]);
            let moveDistance = axisMove * (includes(['X', 'Y', 'Z'], axis) ? step : stepAngle);


            const currentPosition = parseFloat(workPosition[axis.toLowerCase()]) + RayWorkAreaOffset[axis];
            console.log('axis:', axis, currentPosition, moveDistance, RayWorkArea[axis], RayWorkArea[axis] - currentPosition, currentPosition + moveDistance);
            if (isConnectedRay && (currentPosition + moveDistance > RayWorkArea[axis])) {
                // console.log('overplace position !', currentPosition, moveDistance, RayWorkArea[axis]);
                moveDistance = RayWorkArea[axis] - currentPosition;
                return;
            } else if (isConnectedRay && (currentPosition + moveDistance < 0)) {
                moveDistance -= currentPosition;
            }
            console.log('moveDistance', moveDistance);
            moveOrders.push({
                axis: axis.toUpperCase(),
                distance: currentPosition + moveDistance,
            });

            gcodeAxis += `${axis.toUpperCase()}${moveDistance} `;
        }

        const gCommand = keepLaserOn ? 'G1' : 'G0';

        // Relative move G-code
        const gcode = [
            `\nG91\n${gCommand} ${gcodeAxis} F${jogSpeed}\nG90\n`
        ].join('\n');

        console.log(moveOrders, gcode);
        // server.coordinateMove(moveOrders, gcode, jogSpeed, headType);
        server.executeGcode(gcode);
    }, [
        server, headType,
        workPosition, jogSpeed, step, stepAngle,
        keepLaserOn,
    ]);

    const absoluteMove = useCallback((moveOptions: MoveOptions) => {
        const moveOrders = [];
        let gcodeAxis = '';
        for (const axis of Object.keys(moveOptions)) {
            const position = moveOptions[axis];

            console.log('axis:', axis, position, RayWorkArea[axis]);
            if (isConnectedRay && position > RayWorkArea[axis]) {
                console.log('overplace position !', position, RayWorkArea[axis]);
                return;
            }
            moveOrders.push({
                axis: axis.toUpperCase(),
                distance: position,
            });

            gcodeAxis += `${axis.toUpperCase()}${position} `;
        }

        const gCommand = keepLaserOn ? 'G1' : 'G0';

        const gcode = `${gCommand} ${gcodeAxis} F${jogSpeed}`;
        server.coordinateMove(moveOrders, gcode, jogSpeed, headType);
    }, [
        server, headType,
        // variable
        jogSpeed, keepLaserOn,
    ]);

    const runBoundary = useCallback(() => {
        console.log('$$$$$$$$$ bbox', bbox);
        // ray runBoundary need to create file boundary.nc
        if (isConnectedRay && typeof props.runBoundary !== 'undefined') {
            props.runBoundary();
            return;
        }

        if (!bbox) {
            bbox = {
                max: {
                    x: 0, y: 0, z: 0, b: 0
                },
                min: {
                    x: 0, y: 0, z: 0, b: 0
                }
            };
        }


        const gcode = [];
        if (headType === HEAD_CNC) {
            gcode.push('G91', 'G0 Z5 F400', 'G90');
        }

        const gCommand = keepLaserOn ? 'G1' : 'G0';

        const [minX, minY, maxX, maxY] = [bbox.min.x, bbox.min.y, bbox.max.x, bbox.max.y];

        if (workPosition.isFourAxis) {
            // const angleDiff = Math.abs(bbox.max.b - bbox.min.b);
            const minB = bbox.min.b || 0;
            const maxB = bbox.max.b || 0;
            gcode.push(
                'G90', // absolute position
                `${gCommand} B${minB} Y${bbox.min.y} F${jogSpeed}`, // run boundary
                `${gCommand} B${minB} Y${bbox.max.y}`,
                `${gCommand} B${maxB} Y${bbox.max.y}`,
                `${gCommand} B${maxB} Y${bbox.min.y}`,
                `${gCommand} B${minB} Y${bbox.min.y}`,
                `${gCommand} B${workPosition.b} Y${workPosition.y}` // go back to origin
            );
        } else {
            gcode.push(
                'G90', // absolute position
                `${gCommand} X${minX} Y${minY} F${jogSpeed}`, // run boundary
                `${gCommand} X${minX} Y${maxY}`,
                `${gCommand} X${maxX} Y${maxY}`,
                `${gCommand} X${maxX} Y${minY}`,
                `${gCommand} X${minX} Y${minY}`,
                `${gCommand} X${workPosition.x} Y${workPosition.y}` // go back to origin
            );
        }

        if (headType === HEAD_CNC) {
            gcode.push(
                'G91',
                `${gCommand} Z-5 F400`,
                'G90',
            );
        }

        server.executeGcode(gcode.join('\n'));
    }, [
        // machine
        server, headType, workPosition,
        // G-code
        bbox,
        // variable
        jogSpeed, keepLaserOn,
    ]);

    const renderMotionButtonGroup = () => {
        if (isNotInWorkspace) {
            return (
                <div>
                    <ABPositionButtonGroup
                        {...props}
                    />
                </div>
            );
        } else {
            return (
                <div>
                    <MotionButtonGroup
                        {...props}
                        runBoundary={runBoundary}
                        isConnectedRay={isConnectedRay}
                    />
                </div>
            );
        }
    };

    return (
        <div className={styles['control-panel']}>
            {
                (headType === HEAD_LASER && !includes([L2WLaserToolModule.identifier], toolHead)) && (
                    <div className="margin-bottom-8">
                        <div className="sm-flex justify-space-between">
                            <span>{i18n._('Keep Laser On When Moving')}</span>
                            <Switch
                                className="sm-flex-auto"
                                onClick={onToggleKeepLaser}
                                checked={keepLaserOn}
                            />
                        </div>
                    </div>
                )
            }

            <div className="margin-vertical-8">
                {
                    (!isNotInWorkspace || isConnectedRay) && (
                        <Button
                            type="primary"
                            priority="level-three"
                            width="96px"
                            disabled={disabled}
                            onClick={goHome}
                        >
                            {i18n._('key-Workspace/Console-Home')}
                        </Button>
                    )
                }
                <div className="sm-flex justify-space-between align-center">
                    <span className="max-width-208 text-overflow-ellipsis">{i18n._('key-Workspace/Console-Jog Speed')}</span>
                    <Select
                        className="margin-left-8"
                        clearable={false}
                        size="middle"
                        options={jogSpeedOptions}
                        onNewOptionClick={actions.onCreateJogSpeedOption}
                        searchable
                        disabled={disabled}
                        value={jogSpeed}
                        onChange={actions.onChangeJogSpeed}
                    />
                </div>
            </div>

            <div className="sm-flex justify-space-between">
                <JogPad
                    enableShortcut={enableShortcut}
                    enableBAxis={enableBAxis}
                    enableZAxis={!isConnectedRay}
                    disabled={disabled}
                    relativeMove={relativeMove}
                    absoluteMove={absoluteMove}
                />
                {renderMotionButtonGroup()}
            </div>

            <JogDistance {...props} isConnectedRay={isConnectedRay} />
        </div>
    );
};

export default ControlPanel;
