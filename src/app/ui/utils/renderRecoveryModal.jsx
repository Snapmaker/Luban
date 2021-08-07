import React from 'react';
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import renderModal from './renderModal';

import i18n from '../../lib/i18n';
import { HEAD_3DP, HEAD_CNC, HEAD_LASER } from '../../constants';

import { actions as projectActions } from '../../flux/project';

function routeToHeadType(history, headType, forceRefresh = false) {
    const routerMap = {
        [HEAD_3DP]: '/3dp',
        [HEAD_CNC]: '/cnc',
        [HEAD_LASER]: '/laser'
    };

    const isCurrent = history.location.pathname.indexOf(routerMap[headType]) !== -1;
    if (isCurrent && forceRefresh) {
        history.replace();
    } else {
        history.replace(routerMap[headType]);
    }
}

export default function (headType, onClose) {
    const dispatch = useDispatch();
    const history = useHistory();
    function onRecovery() {
        dispatch(projectActions.onRecovery(headType));
    }

    return renderModal({
        title: i18n._('Resume Job'),
        renderBody() {
            return (<p>{i18n._('Do you want to resume previous job?')}</p>);
        },
        actions: [
            {
                name: i18n._('Cancel'),
                onClick: () => {
                    dispatch(projectActions.clearSavedEnvironment(headType));
                    onClose();
                }
            },
            {
                name: i18n._('Yes'),
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
