// import React, { PureComponent } from 'react';
import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import classNames from 'classnames';
import { limitStringLength } from '../../../lib/normalize-range';
import Anchor from '../../../components/Anchor';
import styles from '../styles.styl';
import { actions as editorActions } from '../../../flux/editor';
import modal from '../../../lib/modal';
import i18n from '../../../lib/i18n';
import TipTrigger from '../../../components/TipTrigger';

const ModelItem = (props) => {
    const { model, selectedModelArray = [], onClickModelNameBox, onClickModelHideBox } = props;
    if (!model) {
        return null;
    }
    const taskInfo = model.getTaskInfo();
    const modelName = taskInfo.modelName;
    const displayModelName = limitStringLength(modelName, 36);
    const modelIcon = () => {
        if (taskInfo.sourceType === 'text') {
            return styles.iconText;
        }
        if (taskInfo.mode !== 'vector') {
            return styles.iconPic;
        }
        return styles.iconShape;
    };
    return (
        <TipTrigger
            key={model.modelName}
            title={i18n._('Object')}
            content={model.modelName}
        >
            <div>
                <div
                    className={classNames(
                        styles['object-list-item'],
                        selectedModelArray && selectedModelArray.includes(model) ? styles.selected : null,
                    )}
                >
                    <Anchor
                        className={classNames(
                            styles.name,
                            styles.bt
                        )}
                        onClick={(event) => onClickModelNameBox(model, event)}
                    >
                        <span
                            className={classNames(
                                styles.icon,
                                modelIcon()
                            )}
                        />
                        {displayModelName}
                    </Anchor>
                    <button
                        type="button"
                        className={classNames(
                            styles.icon,
                            taskInfo.visible ? styles.iconHideOpen : styles.iconHideClose,
                            styles.bt
                        )}
                        onClick={() => onClickModelHideBox(model)}
                    />
                </div>
            </div>
        </TipTrigger>
    );
};
ModelItem.propTypes = {
    model: PropTypes.object.isRequired,
    selectedModelArray: PropTypes.array.isRequired,
    onClickModelNameBox: PropTypes.func.isRequired,
    onClickModelHideBox: PropTypes.func.isRequired
};

const ObjectListBox = (props) => {
    // https://github.com/tc39/proposal-optional-chaining
    const selectedModelArray = useSelector(state => state[props.headType]?.modelGroup?.selectedModelArray);
    const models = useSelector(state => state[props.headType]?.modelGroup?.models);
    const previewFailed = useSelector(state => state[props.headType]?.previewFailed);
    const dispatch = useDispatch();

    const actions = {
        onClickModelNameBox: (model, event) => {
            let isMultiSelect = event.shiftKey;
            if (selectedModelArray.length === 1 && selectedModelArray[0].visible === false) {
                isMultiSelect = false;
            }
            if (selectedModelArray && selectedModelArray.length > 0 && model.visible === false) {
                isMultiSelect = false;
            }
            dispatch(editorActions.selectTargetModel(model, props.headType, isMultiSelect));
        },
        onClickModelHideBox: (model) => {
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
        props.setTitle(i18n._('Object List'));
    }, []);
    useEffect(() => {
        if (previewFailed) {
            modal({
                title: i18n._('Failed to preview'),
                body: i18n._('Failed to preview, please modify parameters and try again.')
            });
        }
    }, previewFailed);

    return (
        <div>
            <div className={styles['object-list-box']}>
                {models && models.map((model) => {
                    return (
                        <ModelItem
                            model={model}
                            key={model.modelName}
                            selectedModelArray={selectedModelArray}
                            onClickModelNameBox={actions.onClickModelNameBox}
                            onClickModelHideBox={actions.onClickModelHideBox}
                        />
                    );
                })}
            </div>
        </div>
    );
};
ObjectListBox.propTypes = {
    setTitle: PropTypes.func,
    headType: PropTypes.string
};

export default ObjectListBox;
