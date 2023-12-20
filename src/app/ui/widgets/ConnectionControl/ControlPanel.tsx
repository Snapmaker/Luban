import { includes } from 'lodash';
import React, { useCallback, useState } from 'react';
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

interface MoveOptions {
    X?: number;
    Y?: number;
    Z?: number;
    B?: number;
}

interface ControlPanelProps {
    isInWorkspace: boolean
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
}

/**
 * Control Panel.
 */
const ControlPanel: React.FC<ControlPanelProps> = (props) => {
    const { workPosition, disabled = true, actions, isInWorkspace, enableShortcut } = props;
    const enableBAxis = workPosition.isFourAxis;

    const { headType } = useSelector((state: RootState) => state.workspace);
    const server: MachineAgent = useSelector((state: RootState) => state.workspace.server);

    const step = actions.getJogDistance();
    const stepAngle = actions.getJogAngle();

    const jogSpeed = props.state.jogSpeed;
    const jogSpeedOptions = props.state.jogSpeedOptions;

    const bbox = props.state.bbox;

    const [keepLaserOn, setKeepLaserOn] = useState(false);

    const onToggleKeepLaser = useCallback(() => {
        setKeepLaserOn(!keepLaserOn);
    }, [keepLaserOn]);

    const dispatch = useDispatch();

    const goHome = useCallback(() => {
        dispatch(workspaceActions.executeGcodeAutoHome(true));
    }, [dispatch, workspaceActions]);

    const relativeMove = useCallback((moveOptions: MoveOptions) => {
        // const moveOrders = [];
        let gcodeAxis = '';
        for (const axis of Object.keys(moveOptions)) {
            const axisMove = moveOptions[axis];

            // const currentPosition = parseFloat(workPosition[axis.toLowerCase()]);
            const moveDistance = axisMove * (includes(['X', 'Y', 'Z'], axis) ? step : stepAngle);

            /*
            moveOrders.push({
                axis: axis.toUpperCase(),
                distance: currentPosition + moveDistance,
            });
            */

            gcodeAxis += `${axis.toUpperCase()}${moveDistance} `;
        }

        const gCommand = keepLaserOn ? 'G1' : 'G0';

        // Relative move G-code
        const gcode = [
            'G91',
            `${gCommand} ${gcodeAxis} F${jogSpeed}`,
            'G90',
        ].join('\n');

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
        const gcode = [];
        if (headType === HEAD_CNC) {
            gcode.push('G91', 'G0 Z5 F400', 'G90');
        }

        const gCommand = keepLaserOn ? 'G1' : 'G0';

        if (workPosition.isFourAxis) {
            const angleDiff = Math.abs(bbox.max.b - bbox.min.b);
            const minB = 0;
            const maxB = angleDiff > 360 ? 360 : angleDiff;
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
                `${gCommand} X${bbox.min.x} Y${bbox.min.y} F${jogSpeed}`, // run boundary
                `${gCommand} X${bbox.min.x} Y${bbox.max.y}`,
                `${gCommand} X${bbox.max.x} Y${bbox.max.y}`,
                `${gCommand} X${bbox.max.x} Y${bbox.min.y}`,
                `${gCommand} X${bbox.min.x} Y${bbox.min.y}`,
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
        if (isInWorkspace) {
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
                    />
                </div>
            );
        }
    };

    return (
        <div className={styles['control-panel']}>
            {
                headType === HEAD_LASER && (
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
                <Button
                    type="primary"
                    priority="level-three"
                    width="96px"
                    disabled={disabled}
                    onClick={goHome}
                >
                    {i18n._('key-Workspace/Console-Home')}
                </Button>
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
                    disabled={disabled}
                    relativeMove={relativeMove}
                    absoluteMove={absoluteMove}
                />
                {renderMotionButtonGroup()}
            </div>

            <JogDistance {...props} />
        </div>
    );
};

export default ControlPanel;
