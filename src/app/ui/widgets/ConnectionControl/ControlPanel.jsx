import PropTypes from 'prop-types';
import React from 'react';
import styles from './styles.styl';
import JogDistance from './JogDistance';
import JogPad from './JogPad';
import MotionButtonGroup from './MotionButtonGroup';


const ControlPanel = (props) => {
    const isFourAxis = props.workPosition.isFourAxis;
    return (
        <div className={styles['control-panel']}>
            {isFourAxis && (
                <div className="sm-flex justify-space-between">
                    <div>
                        <JogPad {...props} />
                    </div>
                    <div>
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
