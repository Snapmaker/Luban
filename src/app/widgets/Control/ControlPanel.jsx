import React from 'react';
import PropTypes from 'prop-types';
import JogPad from './JogPad';
import JogDistance from './JogDistance';
import MotionButtonGroup from './MotionButtonGroup';
import styles from './index.styl';


const ControlPanel = (props) => {
    const isFourAxis = props.state.workPosition.isFourAxis;
    return (
        <div className={styles['control-panel']}>
            {isFourAxis && (
                <div className="row no-gutters">
                    <div className="col-sm-7">
                        <JogPad {...props} />
                    </div>
                    <div className="col-sm-5">
                        <MotionButtonGroup {...props} />
                    </div>
                </div>
            )}
            {!isFourAxis && (
                <div className="row no-gutters">
                    <div className="col-sm-6">
                        <JogPad {...props} />
                    </div>
                    <div className="col-sm-6">
                        <MotionButtonGroup {...props} />
                    </div>
                </div>
            )}
            <div className="row no-gutters">
                <div className="col-sm-12">
                    <JogDistance {...props} />
                </div>
            </div>
        </div>
    );
};

ControlPanel.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object,
    executeGcode: PropTypes.func
};

export default ControlPanel;
