import React from 'react';
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import renderModal from './renderModal';

import i18n from '../../lib/i18n';
import { HEAD_PRINTING, HEAD_CNC, HEAD_LASER } from '../../constants';

import { actions as projectActions } from '../../flux/project';

function routeToHeadType(history, headType, forceRefresh = false) {
    const routerMap = {
        [HEAD_PRINTING]: '/printing',
        [HEAD_CNC]: '/cnc',
        [HEAD_LASER]: '/laser'
    };

    const isCurrent = history.location.pathname.indexOf(routerMap[headType]) !== -1;
    if (isCurrent && forceRefresh) {
        history.replace();
    } else {
        history.replace(
            {
                pathname: routerMap[headType],
                state: { initialized: true }
            }
        );
    }
}

export default function (headType, onClose) {
    const dispatch = useDispatch();
    const history = useHistory();
    function onRecovery() {
        dispatch(projectActions.onRecovery(headType));
    }

    return renderModal({
        title: i18n._('key-Project/Resume-Resume Job'),
        renderBody() {
            return (<p>{i18n._('key-Project/Resume-Snapmaker Luban quit unexpectedly. Resume the previous job?')}</p>);
        },
        actions: [
            {
                name: i18n._('key-Project/Resume-Cancel'),
                onClick: () => {
                    dispatch(projectActions.clearSavedEnvironment(headType));
                    onClose();
                }
            },
            {
                name: i18n._('key-Project/Resume-Resume'),
                isPrimary: true,
                onClick: () => {
                    routeToHeadType(history, headType);
                    onRecovery();
                    onClose();
                }
            }
        ],
        onClose
    });
}
