import React from 'react';
import PropTypes from 'prop-types';
import JogPad from './JogPad';
import JogDistance from './JogDistance';
import MotionButtonGroup from './MotionButtonGroup';
import styles from './index.styl';


const ControlPanel = (props) => {
    const isFourAxis = props.workPosition.isFourAxis;
    return (
        <div className={styles['control-panel']}>
            {isFourAxis && (
                <div className="sm-flex justify-space-between">
                    <div className="">
                        <JogPad {...props} />
                    </div>
                    <div className="">
                        <MotionButtonGroup {...props} />
                    </div>
                </div>
            )}
            {!isFourAxis && (
                <div className="sm-flex justify-space-between">
                    <div className="sm-flex-auto">
                        <JogPad {...props} />
                    </div>
                    <div className="sm-flex-auto">
                        <MotionButtonGroup {...props} />
                    </div>
                </div>
            )}

            <JogDistance {...props} />
        </div>
    );
};

ControlPanel.propTypes = {
    state: PropTypes.object,
    workPosition: PropTypes.object.isRequired,
    actions: PropTypes.object,
    executeGcode: PropTypes.func
};

export default ControlPanel;
