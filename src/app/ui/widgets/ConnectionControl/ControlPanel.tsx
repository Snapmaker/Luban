import React from 'react';

import JogDistance from './JogDistance';
import JogPad from './JogPad';
import MotionButtonGroup from './MotionButtonGroup';
import styles from './styles.styl';

interface ControlPanelProps {
    state: object;
    workPosition: {
        isFourAxis: boolean;
    };
    actions: object;
    executeGcode: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = (props) => {
    const isFourAxis = props.workPosition.isFourAxis;
    return (
        <div className={styles['control-panel']}>
            {
                isFourAxis && (
                    <div className="sm-flex justify-space-between">
                        <div>
                            <JogPad {...props} />
                        </div>
                        <div>
                            <MotionButtonGroup {...props} />
                        </div>
                    </div>
                )
            }
            {
                !isFourAxis && (
                    <div className="sm-flex justify-space-between">
                        <div className="sm-flex-auto">
                            <JogPad {...props} />
                        </div>
                        <div className="sm-flex-auto">
                            <MotionButtonGroup {...props} />
                        </div>
                    </div>
                )
            }

            <JogDistance {...props} />
        </div>
    );
};

export default ControlPanel;
