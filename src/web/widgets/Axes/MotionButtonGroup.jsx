import React, { Component, PropTypes } from 'react';
import shallowCompare from 'react-addons-shallow-compare';
import i18n from '../../lib/i18n';
import controller from '../../lib/controller';
import styles from './index.styl';

class MotionButtonGroup extends Component {
    static propTypes = {
        state: PropTypes.object,
        actions: PropTypes.object
    };

    shouldComponentUpdate(nextProps, nextState) {
        return shallowCompare(this, nextProps, nextState);
    }
    render() {
        const { state, actions } = this.props;
        const { canClick } = state;

        return (
            <div className={styles['motion-controls']}>
                <div className="row no-gutters">
                    <div className="col-xs-12">
                        <button
                            type="button"
                            className="btn btn-sm btn-default"
                            onClick={actions.runBoundary}
                            disabled={!canClick}
                        >
                            Run Boundary
                        </button>
                    </div>
                </div>
                <div className={styles['row-space']} />
                <div className="row no-gutters">
                    <div className="col-xs-12">
                        <button
                            type="button"
                            className="btn btn-sm btn-default"
                            onClick={() => {
                                actions.move({ x: 0, y: 0, z: 0 });
                            }}
                            disabled={!canClick}
                        >
                            {i18n._('Go To Work Zero')}
                        </button>
                    </div>
                </div>
                <div className={styles['row-space']} />
                <div className="row no-gutters">
                    <div className="col-xs-12">
                        <button
                            type="button"
                            className="btn btn-sm btn-default"
                            onClick={() => {
                                controller.command('gcode', 'G92 X0 Y0 Z0');
                            }}
                            disabled={!canClick}
                        >
                            Set Origin
                        </button>
                    </div>
                </div>
                <div className={styles['row-space']} />
            </div>
        );
    }
}

export default MotionButtonGroup;
