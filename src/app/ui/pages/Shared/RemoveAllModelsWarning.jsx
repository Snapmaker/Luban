import React from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import { actions as editorActions } from '../../../flux/editor';
import { renderModal } from '../../utils';
import i18n from '../../../lib/i18n';

function useRenderRemoveModelsWarning(headType) {
    const removingModelsWarning = useSelector(state => state[headType]?.removingModelsWarning);
    const removingModelsWarningCallback = useSelector(state => state[headType]?.removingModelsWarningCallback, shallowEqual);
    const emptyToolPaths = useSelector(state => state[headType]?.emptyToolPaths);
    const dispatch = useDispatch();
    const onClose = () => dispatch(editorActions.updateState(headType, {
        removingModelsWarning: false
    }));
    return removingModelsWarning && renderModal({
        onClose,
        renderBody: () => (
            <div>
                <div>{i18n._('Delete the object? The toolpath created will be deleted together.')}</div>
                {emptyToolPaths.map((item) => {
                    return (<div key={item.name}>{item.name}</div>);
                })}
            </div>
        ),
        actions: [
            {
                name: i18n._('Cancel'),
                onClick: () => { onClose(); }
            },
            {
                name: i18n._('Delete'),
                isPrimary: true,
                onClick: () => {
                    removingModelsWarningCallback();
                    dispatch(editorActions.removeEmptyToolPaths(headType));
                    onClose();
                }
            }
        ]
    });
}

useRenderRemoveModelsWarning.propTypes = {
    headType: PropTypes.string.isRequired
};

export default useRenderRemoveModelsWarning;
