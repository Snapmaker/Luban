import React from 'react';
import { useDispatch } from 'react-redux';
import renderModal from './renderModal';

import i18n from '../../lib/i18n';

import { actions as projectActions } from '../../flux/project';

export default function (headType, onClose) {
    const dispatch = useDispatch();
    const actions = {
        onRecovery: () => dispatch(projectActions.onRecovery(headType))
    };

    return renderModal({
        title: i18n._('Resume Job'),
        renderBody() {
            return (<p>{i18n._('Do you want to resume previous job?')}</p>);
        },
        actions: [
            {
                name: i18n._('Yes'),
                isPrimary: true,
                onClick: () => {
                    actions.onRecovery();
                    onClose();
                }
            },
            {
                name: i18n._('Cancel'),

                onClick: () => { onClose(); }
            }
        ]
    });
}
