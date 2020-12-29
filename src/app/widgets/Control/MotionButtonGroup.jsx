import React from 'react';
import PropTypes from 'prop-types';
import { Trans } from 'react-i18next';

import i18n from '../../lib/i18n';
// import controller from '../../lib/controller';
import TipTrigger from '../../components/TipTrigger';
import styles from './index.styl';


const MotionButtonGroup = (props) => {
    const { state, actions } = props;
    const { canClick, workPosition } = state;

    return (
        <div className={styles['motion-controls']}>
            <div className="row no-gutters">
                <div className="col-sm-12">
                    <TipTrigger
                        title={i18n._('Run Boundary')}
                        content={(
                            <div>
                                <p>{i18n._('Click to check the boundary of the image to be engraved.')}</p>
                                <br />
                                <p>
                                    <Trans>
                                        Note: If you are using the CNC Carving Module, make sure the carving bit will not run into the fixtures before you use this feature.
                                    </Trans>
                                </p>
                            </div>
                        )}
                    >
                        <button
                            type="button"
                            className="sm-btn btn-sm btn-outline-secondary"
                            onClick={actions.runBoundary}
                            disabled={!canClick}
                        >
                            {i18n._('Run Boundary')}
                        </button>
                    </TipTrigger>
                </div>
            </div>
            <div className="row no-gutters">
                <div className="col-sm-12">
                    <TipTrigger
                        title={i18n._('Go To Work Origin')}
                        content={i18n._('Move the head to the last saved work origin.')}
                    >
                        <button
                            type="button"
                            className="sm-btn btn-sm btn-outline-secondary"
                            onClick={() => {
                                if (workPosition.z > 0) {
                                    actions.move({ x: 0, y: 0, b: 0 });
                                    actions.move({ z: 0 });
                                } else {
                                    actions.move({ z: 0 });
                                    actions.move({ x: 0, y: 0, b: 0 });
                                }
                            }}
                            disabled={!canClick}
                        >
                            {i18n._('Go To Work Origin')}
                        </button>
                    </TipTrigger>
                </div>
            </div>
            <div className="row no-gutters">
                <div className="col-sm-12">
                    <TipTrigger
                        title={i18n._('Set Work Origin')}
                        content={i18n._('Set the current position of the head as the work origin.')}
                    >
                        <button
                            type="button"
                            className="sm-btn btn-sm btn-outline-secondary"
                            onClick={() => {
                                props.executeGcode('G92 X0 Y0 Z0 B0');
                            }}
                            disabled={!canClick}
                        >
                            {i18n._('Set Work Origin')}
                        </button>
                    </TipTrigger>
                </div>
            </div>
            <div style={{ marginBottom: '5px' }} />
        </div>
    );
};

MotionButtonGroup.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object,
    executeGcode: PropTypes.func
};

export default MotionButtonGroup;
