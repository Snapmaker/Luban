import PropTypes from 'prop-types';
import React from 'react';
import { Trans } from 'react-i18next';

import { includes } from 'lodash';
import { useSelector } from 'react-redux';
import i18n from '../../../lib/i18n';
import { Button } from '../../components/Buttons';
import TipTrigger from '../../components/TipTrigger';
import { SnapmakerArtisanMachine } from '../../../machines';

const MotionButtonGroup = (props) => {
    const { actions, workPosition, runBoundary, executeGcode, disabled } = props;
    const { activeMachine } = useSelector((state) => state.workspace);


    const setOriginWork = () => {
        let gcode = 'G92 X0 Y0 Z0 B0';
        // Fixme: hard code for artisan asking to store current work origin which is about Power Loss Recovery
        if (includes([SnapmakerArtisanMachine], activeMachine)) {
            gcode += '\nM500';
        }
        executeGcode(gcode);
    };
    // const { canClick } = state;

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
                    onClick={runBoundary}
                    disabled={disabled}
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
                    disabled={disabled}
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
                    onClick={setOriginWork}
                    disabled={disabled}
                >
                    {i18n._('key-Workspace/Control/MotionButton-Set Work Origin')}
                </Button>
            </TipTrigger>
        </div>
    );
};

MotionButtonGroup.propTypes = {
    disabled: PropTypes.bool,
    workPosition: PropTypes.object,
    actions: PropTypes.object,
    runBoundary: PropTypes.func,
    executeGcode: PropTypes.func
};

export default MotionButtonGroup;
