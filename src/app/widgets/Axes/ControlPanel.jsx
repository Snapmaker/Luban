import React from 'react';
import PropTypes from 'prop-types';
import JogPad from './JogPad';
import JogDistance from './JogDistance';
import MotionButtonGroup from './MotionButtonGroup';
import styles from './index.styl';


const ControlPanel = (props) => (
    <div className={styles.controlPanel}>
        <div className="row no-gutters">
            <div className="col-xs-6">
                <JogPad {...props} />
            </div>
            <div className="col-xs-6">
                <MotionButtonGroup {...props} />
            </div>
        </div>
        <div className="row no-gutters">
            <div className="col-xs-12">
                <JogDistance {...props} />
            </div>
        </div>
    </div>
);

ControlPanel.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};

export default ControlPanel;
