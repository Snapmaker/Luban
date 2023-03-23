import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { Machine } from '@snapmaker/luban-platform';

import { MACHINE_TOOL_HEADS } from '../../../constants/machines';
import { RootState } from '../../../flux/index.def';
import log from '../../../lib/log';
import sceneLogic from '../../../scene/scene.logic';


/**
 * Component to initialize the scene.
 *
 * When component mounted on page, it starts the initialization of the scene.
 */
const SceneInitialization: React.FC = () => {
    const activeMachine: Machine | null = useSelector((state: RootState) => state.machine.activeMachine);
    const toolHeadName = useSelector((state: RootState) => state.machine.toolHead.printingToolhead);

    useEffect(() => {
        if (!activeMachine || !toolHeadName) {
            return;
        }

        const toolHead = MACHINE_TOOL_HEADS[toolHeadName];
        if (!toolHead) {
            return;
        }

        log.info(`Active Machine = ${activeMachine.identifier} (${activeMachine.fullName})`);
        log.info('Tool Head =', toolHead.identifier);

        // TODO: init buildVolume
        sceneLogic.onVisualizeInitialized(activeMachine, toolHead);
    }, [activeMachine, toolHeadName]);

    return (<div className="display-none" />);
};

export default SceneInitialization;
