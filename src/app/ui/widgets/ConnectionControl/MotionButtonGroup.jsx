import PropTypes from 'prop-types';
import React from 'react';
import { Trans } from 'react-i18next';

import i18n from '../../../lib/i18n';
import { Button } from '../../components/Buttons';
import TipTrigger from '../../components/TipTrigger';


const MotionButtonGroup = (props) => {
    const { state, actions, workPosition } = props;
    const { canClick } = state;

    return (
        <div className="sm-flex-overflow-visible" style={{ flexDirection: 'column' }}>
            <TipTrigger
                title={i18n._('Run Boundary')}
                content={(
                    <div>
                        <p>{i18n._('key-Workspace/Control/MotionButton-Click to check the boundary of the image to be engraved.')}</p>
                        <br />
                        <p>
                            <Trans i18nKey="key-unused-Note: If you are using the CNC Carving Module, make sure the carving bit will not run into the fixtures before you use this feature.">
                                Note: If you are using the CNC Carving Module, make sure the carving bit will not run into the fixtures before you use this feature.
                            </Trans>
                        </p>
                    </div>
                )}
            >
                <Button
                    width="144px"
                    type="primary"
                    className="margin-bottom-8 display-block"
                    priority="level-three"
                    onClick={actions.runBoundary}
                    disabled={!canClick}
                >
                    {i18n._('Run Boundary')}
                </Button>
            </TipTrigger>
            <TipTrigger
                title={i18n._('key-Workspace/Control/MotionButton-Go To Work Origin')}
                content={i18n._('key-Workspace/Control/MotionButton-Move the head to the last saved work origin.')}
            >
                <Button
                    width="144px"
                    type="primary"
                    className="margin-bottom-8 display-block"
                    priority="level-three"
                    onClick={() => {
                        if (workPosition.z > 0) {
                            actions.move({ x: 0, y: 0, b: 0, z: 0 });
                        } else {
                            actions.move({ z: 0, x: 0, y: 0, b: 0 });
                        }
                    }}
                    disabled={!canClick}
                >
                    {i18n._('key-Workspace/Control/MotionButton-Go To Work Origin')}
                </Button>
            </TipTrigger>
            <TipTrigger
                title={i18n._('key-Workspace/Control/MotionButton-Set Work Origin')}
                content={i18n._('key-Workspace/Control/MotionButton-Set the current position of the toolhead as the work origin.')}
            >
                <Button
                    width="144px"
                    type="primary"
                    className="margin-bottom-8 display-block"
                    priority="level-three"
                    onClick={() => {
                        // props.executeGcode('G92 X0 Y0 Z0 B0');
                        actions.setWorkOrigin();
                    }}
                    disabled={!canClick}
                >
                    {i18n._('key-Workspace/Control/MotionButton-Set Work Origin')}
                </Button>
            </TipTrigger>
        </div>
    );
};

MotionButtonGroup.propTypes = {
    state: PropTypes.object,
    workPosition: PropTypes.object,
    actions: PropTypes.object,
    // executeGcode: PropTypes.func
};

export default MotionButtonGroup;
