import { message } from 'antd';
import React, { useEffect } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';

import { actions as editorActions } from '../../../../flux/editor';
import { RootState } from '../../../../flux/index.def';
import i18n from '../../../../lib/i18n';

const ProjectOversizeMessage: React.FC = () => {
    const projectFileOversize = useSelector((state: RootState) => state.laser.projectFileOversize, shallowEqual);

    const dispatch = useDispatch();

    useEffect(() => {
        if (projectFileOversize) {
            message.info({
                content: <span>{i18n._('key-Laser/Page-Project file oversize')}</span>,
                duration: 5,
                onClose: () => (
                    dispatch(editorActions.updateState('laser', {
                        projectFileOversize: false,
                    }))
                ),
                key: 'laser',
            });
        }
    }, [dispatch, projectFileOversize]);

    return null;
};

export default ProjectOversizeMessage;
