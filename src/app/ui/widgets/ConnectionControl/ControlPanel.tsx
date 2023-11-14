import React, { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { includes } from 'lodash';

import { RootState } from '../../../flux/index.def';
import JogDistance from './JogDistance';
import JogPad from './JogPad';
import MotionButtonGroup from './MotionButtonGroup';
import styles from './styles.styl';
import { MachineAgent } from '../../../flux/workspace/MachineAgent';

interface MoveOptions {
    X?: number;
    Y?: number;
    Z?: number;
    B?: number;
}

interface ControlPanelProps {
    workPosition: {
        isFourAxis: boolean;
    };
    disabled?: boolean;
    state: {
        keypadJogging: boolean;
        selectedAxis: '' | 'x' | 'y' | 'z';
    };
    actions: {
        getJogSpeed: () => number;
        getJogDistance: () => number;
        getJogAngle: () => number;
        move: (jogOptions: MoveOptions) => void;
        jog: (jogOptions: MoveOptions) => void;
    }
    executeGcode: () => void;
}

/**
 * Control Panel.
 */
const ControlPanel: React.FC<ControlPanelProps> = (props) => {
    const { workPosition, disabled = true, actions } = props;
    const enableBAxis = workPosition.isFourAxis;

    const { headType } = useSelector((state: RootState) => state.workspace);
    const server: MachineAgent = useSelector((state: RootState) => state.workspace.server);

    const jogSpeed = actions.getJogSpeed();
    const step = actions.getJogDistance();
    const stepAngle = actions.getJogAngle();

    const relativeMove = useCallback((moveOptions: MoveOptions) => {
        const moveOrders = [];
        let gcodeAxis = '';
        for (const axis of Object.keys(moveOptions)) {
            const axisMove = moveOptions[axis];

            const currentPosition = parseFloat(workPosition[axis.toLowerCase()]);
            const moveDistance = axisMove * (includes(['X', 'Y', 'Z'], axis) ? step : stepAngle);

            moveOrders.push({
                axis: axis.toUpperCase(),
                distance: currentPosition + moveDistance,
            });

            gcodeAxis += `${axis.toUpperCase()}${step} `;
        }

        // Relative move G-code
        const gcode = [
            'G91',
            `G0 ${gcodeAxis} F${jogSpeed}`,
            'G90',
        ].join('\n');

        server.coordinateMove(moveOrders, gcode, jogSpeed, headType);
    }, [server, headType, workPosition, jogSpeed, step, stepAngle]);


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

        const gcode = `G0 ${gcodeAxis} F${jogSpeed}`;
        server.coordinateMove(moveOrders, gcode, jogSpeed, headType);
    }, [server, headType, jogSpeed]);

    return (
        <div className={styles['control-panel']}>
            <div className="sm-flex justify-space-between">
                <JogPad
                    enableBAxis={enableBAxis}
                    disabled={disabled}
                    relativeMove={relativeMove}
                    absoluteMove={absoluteMove}
                />
                <div>
                    <MotionButtonGroup {...props} />
                </div>
            </div>

            <JogDistance {...props} />
        </div>
    );
};

export default ControlPanel;
