// import React, { PureComponent } from 'react';
import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import styles from '../styles.styl';
import { actions as editorActions } from '../../../../flux/editor';
import modal from '../../../../lib/modal';
import i18n from '../../../../lib/i18n';
import ModelItem from '../../../views/model-item';


function ObjectListBox(props) {
    // https://github.com/tc39/proposal-optional-chaining
    const selectedModelArray = useSelector(state => state[props.headType]?.modelGroup?.selectedModelArray, shallowEqual);
    const models = useSelector(state => state[props.headType]?.modelGroup?.models, shallowEqual);
    const previewFailed = useSelector(state => state[props.headType]?.previewFailed, shallowEqual);
    const dispatch = useDispatch();
    const actions = {
        onClickModelNameBox(model, event) {
            let isMultiSelect = event.shiftKey;
            if (selectedModelArray.length === 1 && selectedModelArray[0].visible === false) {
                isMultiSelect = false;
            }
            if (selectedModelArray && selectedModelArray.length > 0 && model.visible === false) {
                isMultiSelect = false;
            }
            dispatch(editorActions.selectTargetModel(model, props.headType, isMultiSelect));
        },
        onClickModelHideBox(model) {
            const visible = model.visible;
            dispatch(editorActions.selectTargetModel(model, props.headType));
            if (visible) {
                dispatch(editorActions.hideSelectedModel(props.headType));
            } else {
                dispatch(editorActions.showSelectedModel(props.headType));
            }
        }
    };

    useEffect(() => {
        props.widgetActions.setTitle(i18n._('Object List'));
    }, [props.widgetActions.setTitle]);
    useEffect(() => {
        if (previewFailed) {
            modal({
                title: i18n._('Failed to preview'),
                body: i18n._('Failed to preview, please modify parameters and try again.')
            });
        }
    }, [previewFailed]);

    return (
        <div>
            <div className={styles['object-list-box']}>
                {models && models.map((model) => {
                    return (
                        <ModelItem
                            model={model}
                            key={model.modelID}
                            styles={styles}
                            isSelected={selectedModelArray && selectedModelArray.includes(model)}
                            onSelect={actions.onClickModelNameBox}
                            onToggleVisible={actions.onClickModelHideBox}
                        />
                    );
                })}
            </div>
        </div>
    );
}
ObjectListBox.propTypes = {
    widgetActions: PropTypes.object.isRequired,
    headType: PropTypes.string
};

export default ObjectListBox;
