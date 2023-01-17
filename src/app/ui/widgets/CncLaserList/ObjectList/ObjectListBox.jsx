// import React, { PureComponent } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useEffect } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { actions as editorActions } from '../../../../flux/editor';
import i18n from '../../../../lib/i18n';
import modal from '../../../../lib/modal';
import ModelItem from '../../../views/model-item';
import styles from '../styles.styl';


function ObjectListBox({ headType }) {
    // https://github.com/tc39/proposal-optional-chaining
    const selectedModelArray = useSelector(state => state[headType]?.modelGroup?.selectedModelArray);
    const models = useSelector(state => state[headType]?.modelGroup?.models);
    const inProgress = useSelector(state => state[headType]?.inProgress, shallowEqual);
    const previewFailed = useSelector(state => state[headType]?.previewFailed, shallowEqual);
    // const [showList, setShowList] = useState(true);
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
            dispatch(editorActions.selectTargetModel(model, headType, isMultiSelect));
        },
        onClickModelHideBox(model) {
            const visible = model.visible;
            dispatch(editorActions.selectTargetModel(model, headType));
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
                                onSelect={actions.onClickModelNameBox}
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
}

ObjectListBox.propTypes = {
    headType: PropTypes.string
};

export default ObjectListBox;
