import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';

import log from '../../../lib/log';
import { MACHINE_TOOL_HEADS } from '../../../constants/machines';
import { RootState } from '../../../flux/index.def';
import sceneLogic from '../../../scene/scene.logic';


/**
 * Component to initialize the scene.
 *
 * When component mounted on page, it starts the initialization of the scene.
 */
const SceneInitialization: React.FC = () => {
    const activeMachine = useSelector((state: RootState) => state.machine.activeMachine);
    const toolHeadName = useSelector((state: RootState) => state.machine.toolHead.printingToolhead);

    useEffect(() => {
        if (!activeMachine || !toolHeadName) {
            return;
        }

        const toolHead = MACHINE_TOOL_HEADS[toolHeadName];
        if (!toolHead) {
            return;
        }

        log.info('Active Machine =', activeMachine.fullName);
        log.info('Tool Head =', toolHead);

        // TODO: init buildVolume
        sceneLogic.onVisualizeInitialized(activeMachine, toolHead);
    }, [activeMachine, toolHeadName]);

    return (<div className="display-none" />);
};

export default SceneInitialization;
