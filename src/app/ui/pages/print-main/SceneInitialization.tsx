import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';

import log from '../../../lib/log';
import { RootState } from '../../../flux/index.def';


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

        log.info('Active Machine =', activeMachine.fullName);
        log.info('Tool Head =', toolHeadName);

        const size = activeMachine.size;
        log.info('machine size =', size);

        // TODO: init buildVolume
    }, [activeMachine, toolHeadName]);

    return (<div className="display-none" />);
};

export default SceneInitialization;
