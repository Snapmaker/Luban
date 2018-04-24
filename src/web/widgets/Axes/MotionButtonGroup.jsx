import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import i18n from '../../lib/i18n';
import controller from '../../lib/controller';
import TipTrigger from '../../components/TipTrigger';
import styles from './index.styl';

class MotionButtonGroup extends PureComponent {
    static propTypes = {
        state: PropTypes.object,
        actions: PropTypes.object
    };

    render() {
        const { state, actions } = this.props;
        const { canClick } = state;

        return (
            <div className={styles['motion-controls']}>
                <div className="row no-gutters">
                    <div className="col-xs-12">
                        <TipTrigger
                            title="Run Boundary"
                            content={(
                                <div>
                                    <p>Click to check the boundary of the image to be engraved.</p>
                                    <br />
                                    <p>Note: If you are using the CNC Carving Module, make sure the carving bit will not
                                        run into the fixtures before you use this feature.</p>
                                </div>
                            )}
                        >
                            <button
                                type="button"
                                className="btn btn-sm btn-default"
                                onClick={actions.runBoundary}
                                disabled={!canClick}
                            >
                                Run Boundary
                            </button>
                        </TipTrigger>
                    </div>
                </div>
                <div className={styles['row-space']} />
                <div className="row no-gutters">
                    <div className="col-xs-12">
                        <TipTrigger title="Go To Work Origin" content="Move the head to the last saved work origin.">
                            <button
                                type="button"
                                className="btn btn-sm btn-default"
                                onClick={() => {
                                    actions.move({ x: 0, y: 0, z: 0 });
                                }}
                                disabled={!canClick}
                            >
                                {i18n._('Go To Work Origin')}
                            </button>
                        </TipTrigger>
                    </div>
                </div>
                <div className={styles['row-space']} />
                <div className="row no-gutters">
                    <TipTrigger title="Set Origin" content="Set the current position of the head as the work origin.">
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
                    </TipTrigger>
                </div>
                <div className={styles['row-space']} />
            </div>
        );
    }
}

export default MotionButtonGroup;
