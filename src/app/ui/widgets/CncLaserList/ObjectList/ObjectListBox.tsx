import classNames from 'classnames';
import React, { useEffect, useCallback } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';

import { actions as editorActions } from '../../../../flux/editor';
import i18n from '../../../../lib/i18n';
import modal from '../../../../lib/modal';
import styles from '../styles.styl';
import ModelItem from './model-item';


interface ObjectListBoxProps {
    headType: 'laser' | 'cnc';
}

const ObjectListBox: React.FC<ObjectListBoxProps> = ({ headType }) => {
    const selectedModelArray = useSelector(state => state[headType].modelGroup?.selectedModelArray);
    const models = useSelector(state => state[headType]?.modelGroup?.models);

    const inProgress = useSelector(state => state[headType]?.inProgress, shallowEqual);
    const previewFailed = useSelector(state => state[headType]?.previewFailed, shallowEqual);

    const dispatch = useDispatch();

    const onSelectItem = useCallback((model, event) => {
        let isMultiSelect = event.shiftKey;

        // TODO: Add comment here
        if (selectedModelArray.length === 1 && selectedModelArray[0].visible === false) {
            isMultiSelect = false;
        }
        // TODO: Add comment here
        if (selectedModelArray.length > 0 && model.visible === false) {
            isMultiSelect = false;
        }

        dispatch(editorActions.selectTargetModel(headType, model, isMultiSelect));
    }, [dispatch, headType, selectedModelArray]);

    const actions = {
        onClickModelHideBox(model) {
            const visible = model.visible;
            dispatch(editorActions.selectTargetModel(headType, model));
            if (visible) {
                dispatch(editorActions.hideSelectedModel(headType, model));
            } else {
                dispatch(editorActions.showSelectedModel(headType, model));
            }
        }
    };

    useEffect(() => {
        if (previewFailed) {
            modal({
                title: i18n._('key-unused-Failed to preview'),
                body: i18n._('key-unused-Failed to preview, please modify parameters and try again.')
            });
        }
    }, [previewFailed]);
    const allModels = (models) && models.filter(model => !model.supportTag);

    return (
        <div
            className={classNames(
                styles['object-list-box'],
                'width-264',
            )}
        >
            <div className={classNames('padding-vertical-4')}>
                {
                    allModels && allModels.map((model) => {
                        return (
                            <ModelItem
                                model={model}
                                key={model.modelID}
                                visible={model.visible}
                                styles={styles}
                                isSelected={selectedModelArray && selectedModelArray.includes(model)}
                                onSelect={onSelectItem}
                                onToggleVisible={actions.onClickModelHideBox}
                                inProgress={inProgress}
                                placement="right"
                            />
                        );
                    })
                }
                {
                    allModels && allModels.length === 0 && (
                        <div className="padding-vertical-4 padding-horizontal-8">
                            <div className="height-24">
                                <span>{i18n._('key-Printing/No model(s).')}</span>
                            </div>
                        </div>
                    )
                }
            </div>
        </div>
    );
};

export default ObjectListBox;
