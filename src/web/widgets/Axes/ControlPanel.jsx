import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import JogPad from './JogPad';
import JogDistance from './JogDistance';
import MotionButtonGroup from './MotionButtonGroup';
import styles from './index.styl';


class ControlPanel extends PureComponent {
    static propTypes = {
        state: PropTypes.object,
        actions: PropTypes.object
    };

    render() {
        return (
            <div className={styles.controlPanel}>
                <div className="row no-gutters">
                    <div className="col-xs-6">
                        <JogPad {...this.props} />
                    </div>
                    <div className="col-xs-6">
                        <MotionButtonGroup {...this.props} />
                    </div>
                </div>
                <div className="row no-gutters">
                    <div className="col-xs-12">
                        <JogDistance {...this.props} />
                    </div>
                </div>
            </div>
        );
    }
}

export default ControlPanel;
