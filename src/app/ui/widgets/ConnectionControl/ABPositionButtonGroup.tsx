import PropTypes from 'prop-types';
import React, { useEffect } from 'react';
import { Trans } from 'react-i18next';

import { useDispatch } from 'react-redux';
// import { includes } from 'lodash';
import i18n from '../../../lib/i18n';
import { Button } from '../../components/Buttons';
import TipTrigger from '../../components/TipTrigger';
import { actions as laserActions } from '../../../flux/laser';
// import { RootState } from '../../../flux/index.def';
// import { L2WLaserToolModule } from '../../../machines/snapmaker-2-toolheads';
// import { ConnectionType } from '../../../flux/workspace/state';
// import { SnapmakerA150Machine, SnapmakerA250Machine, SnapmakerA350Machine, SnapmakerRayMachine } from '../../../machines';


const ABPositionButtonGroup = (props) => {
    const { state, workPosition, originOffset } = props;
    // const { APosition, BPosition } = useSelector((fluxState: RootState) => fluxState.laser);
    // const { workspaceToolHead, isConnected, activeMachine } = useSelector((fluxState: RootState) => fluxState.workspace);
    const { canClick } = state;
    const { x, y, z, b } = originOffset;
    const dispatch = useDispatch();



    const [offsetX, offsetY, offsetZ, offsetB] = [0, 0, 0, 0];
    // if (workspaceToolHead === L2WLaserToolModule.identifier
    //     && isConnected
    //     && includes([SnapmakerA150Machine.identifier, SnapmakerA250Machine.identifier, SnapmakerA350Machine.identifier], activeMachine.identifier)) {
    //         // offsetX = 21.7;
    //     // offsetY = 0;
    //     // offsetZ = 0;
    //     // offsetB = 0;
    // }
    // if (includes([SnapmakerRayMachine.identifier], activeMachine.identifier)) {
    //     offsetX = 0;
    //     offsetY = 400;
    //     offsetZ = 0;
    //     offsetB = 0;
    // }

    const storeAPosition = () => {
        const machinePositionX = (Math.round((parseFloat(workPosition.x) - x) * 1000) / 1000 + offsetX).toFixed(3);
        const machinePositionY = (Math.round((parseFloat(workPosition.y) - y) * 1000) / 1000 + offsetY).toFixed(3);
        const machinePositionZ = (Math.round((parseFloat(workPosition.z) - z) * 1000) / 1000 + offsetZ).toFixed(3);
        const machinePositionB = (Math.round((parseFloat(workPosition.b) - b) * 1000) / 1000 + offsetB).toFixed(3);
        dispatch(laserActions.updateAPosition({ x: machinePositionX, y: machinePositionY, z: machinePositionZ, b: machinePositionB }));
        console.log('$$$ setAPosition', workPosition, { x: machinePositionX, y: machinePositionY, z: machinePositionZ, b: machinePositionB });
    };
    const storeBPosition = () => {
        const machinePositionX = (Math.round((parseFloat(workPosition.x) - x) * 1000) / 1000 + offsetX).toFixed(3);
        const machinePositionY = (Math.round((parseFloat(workPosition.y) - y) * 1000) / 1000 + offsetY).toFixed(3);
        const machinePositionZ = (Math.round((parseFloat(workPosition.z) - z) * 1000) / 1000 + offsetZ).toFixed(3);
        const machinePositionB = (Math.round((parseFloat(workPosition.b) - b) * 1000) / 1000 + offsetB).toFixed(3);
        // setBPosition({ x: machinePositionX, y: machinePositionY, z: machinePositionZ, b: machinePositionB });
        dispatch(laserActions.updateBPosition({ x: machinePositionX, y: machinePositionY, z: machinePositionZ, b: machinePositionB }));
        console.log('$$$ setBPosition', workPosition, originOffset, { x: machinePositionX, y: machinePositionY, z: machinePositionZ, b: machinePositionB });
    };


    useEffect(() => {
        // dispatch(laserActions.updateAPosition({ x: 40.00, y: 240.00, z: 0, b: 0 }));
        // dispatch(laserActions.updateBPosition({ x: 80.00, y: 200.00, z: 0, b: 0 }));
    }, []);

    return (
        <div className="sm-flex-overflow-visible" style={{ flexDirection: 'column' }}>
            <TipTrigger
                title={i18n._('key-Laser/Control/ABPositionButton-Set A position')}
                content={(
                    <div>
                        <p>{i18n._('key-Laser/Control/ABPositionButton-Click to check the boundary of the image to be engraved.')}</p>
                        <br />
                        <p>
                            <Trans i18nKey="key-unused-Note: If you are using the CNC Carving Module, make sure the carving bit will not run into the fixtures before you use this feature.">
                                Note: If you are using the CNC Carving Module, make sure the carving
                                bit will not run into the fixtures before you use this feature.
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
                    onClick={storeAPosition}
                    disabled={!canClick}
                >
                    {i18n._('key-Laser/Control/ABPositionButton-Set A position')}
                </Button>
            </TipTrigger>
            <TipTrigger
                title={i18n._('key-Laser/Control/ABPositionButton-Set B position')}
                content={i18n._('key-Laser/Control/ABPositionButton-Move the head to the last saved work origin.')}
            >
                <Button
                    width="144px"
                    type="primary"
                    className="margin-bottom-8 display-block"
                    priority="level-three"
                    onClick={storeBPosition}
                    disabled={!canClick}
                >
                    {i18n._('key-Laser/Control/ABPositionButton-Set B position')}
                </Button>
            </TipTrigger>
            <TipTrigger
                title={i18n._('key-Laser/Control/ABPositionButton-Clear AB')}
                content={i18n._('key-Laser/Control/ABPositionButton-Set the current position of the toolhead as the work origin.')}
            >
                <Button
                    width="144px"
                    type="primary"
                    className="margin-bottom-8 display-block"
                    priority="level-three"
                    onClick={() => {
                        // props.executeGcode('G92 X0 Y0 Z0 B0');
                        // actions.setWorkOrigin();
                        dispatch(laserActions.updateAPosition({}));
                        dispatch(laserActions.updateBPosition({}));
                        dispatch(laserActions.removeBackgroundImage());
                    }}
                    disabled={!canClick}
                >
                    {i18n._('key-Laser/Control/ABPositionButton-Clear AB')}
                </Button>
            </TipTrigger>
        </div>
    );
};

ABPositionButtonGroup.propTypes = {
    state: PropTypes.object,
    workPosition: PropTypes.object,
    originOffset: PropTypes.object
    // executeGcode: PropTypes.func
};

export default ABPositionButtonGroup;
