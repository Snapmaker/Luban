import PropTypes from 'prop-types';
import React from 'react';

import { useDispatch } from 'react-redux';
// import { includes } from 'lodash';
import i18n from '../../../lib/i18n';
import { Button } from '../../components/Buttons';
import TipTrigger from '../../components/TipTrigger';
import { actions as laserActions } from '../../../flux/laser';
import { actions as editorActions } from '../../../flux/editor';
import { HEAD_LASER } from '../../../constants';

const ABPositionButtonGroup = (props) => {
    const { state, workPosition, originOffset } = props;
    const { canClick } = state;
    const { x, y, z, b } = originOffset;
    const dispatch = useDispatch();

    const [offsetX, offsetY, offsetZ, offsetB] = [0, 0, 0, 0];
    const storeAPosition = () => {
        const machinePositionX = (Math.round((parseFloat(workPosition.x) - x) * 1000) / 1000 + offsetX);
        const machinePositionY = (Math.round((parseFloat(workPosition.y) - y) * 1000) / 1000 + offsetY);
        const machinePositionZ = (Math.round((parseFloat(workPosition.z) - z) * 1000) / 1000 + offsetZ);
        const machinePositionB = (Math.round((parseFloat(workPosition.b) - b) * 1000) / 1000 + offsetB);
        dispatch(laserActions.updateTmpAPosition({ x: machinePositionX, y: machinePositionY, z: machinePositionZ, b: machinePositionB }));
        console.log('$$$ setAPosition', workPosition, { x: machinePositionX, y: machinePositionY, z: machinePositionZ, b: machinePositionB });
    };
    const storeBPosition = () => {
        const machinePositionX = (Math.round((parseFloat(workPosition.x) - x) * 1000) / 1000 + offsetX);
        const machinePositionY = (Math.round((parseFloat(workPosition.y) - y) * 1000) / 1000 + offsetY);
        const machinePositionZ = (Math.round((parseFloat(workPosition.z) - z) * 1000) / 1000 + offsetZ);
        const machinePositionB = (Math.round((parseFloat(workPosition.b) - b) * 1000) / 1000 + offsetB);
        dispatch(laserActions.updateTmpBPosition({ x: machinePositionX, y: machinePositionY, z: machinePositionZ, b: machinePositionB }));
        console.log('$$$ setBPosition', workPosition, originOffset, { x: machinePositionX, y: machinePositionY, z: machinePositionZ, b: machinePositionB });
    };


    return (
        <div className="sm-flex-overflow-visible" style={{ flexDirection: 'column' }}>
            <TipTrigger content={i18n._('key-Laser/Control/ABPositionButton-Set A position')}>
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
            <TipTrigger content={i18n._('key-Laser/Control/ABPositionButton-Set B position')}>
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
            <TipTrigger content={i18n._('key-Laser/Control/ABPositionButton-Clear AB')}>
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
                        dispatch(laserActions.updateTmpAPosition({}));
                        dispatch(laserActions.updateTmpBPosition({}));
                        dispatch(editorActions.updateState(HEAD_LASER, {
                            useABPosition: false
                        }));
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
