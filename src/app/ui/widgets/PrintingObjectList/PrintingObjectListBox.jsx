import React, { useState } from 'react';
// import PropTypes from 'prop-types';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import styles from './styles.styl';
import { actions as printingActions } from '../../../flux/printing';
// import i18n from '../../../lib/i18n';
import ModelItem from '../../views/model-item';
import Anchor from '../../components/Anchor';
import i18n from '../../../lib/i18n';

function PrintingObjectListBox() {
    const selectedModelIDArray = useSelector(state => state?.printing?.modelGroup?.selectedModelIDArray, shallowEqual);
    const models = useSelector(state => state?.printing?.modelGroup?.models);
    const inProgress = useSelector(state => state?.printing?.inProgress);
    const [showList, setShowList] = useState(true);
    const dispatch = useDispatch();
    const actions = {
        selectTargetModel(targetModel, shiftKey) {
            dispatch(printingActions.selectTargetModel(targetModel, shiftKey));
        },
        onClickHideShowSelectedModel(targetModel) {
            const visible = targetModel.visible;
            actions.selectTargetModel(targetModel);
            if (visible === true) {
                dispatch(printingActions.hideSelectedModel(targetModel));
            } else {
                dispatch(printingActions.showSelectedModel(targetModel));
            }
        }
    };
    return (
        <div>
            <div>
                <Anchor
                    onClick={() => setShowList(!showList)}
                    title={i18n._('hide')}
                >
                    X
                </Anchor>
            </div>
            {showList && (
                <div className={styles['object-list-box']}>
                    {(models) && models.filter(model => !model.supportTag).map((model) => {
                        return (
                            <ModelItem
                                key={model.modelID}
                                model={model}
                                visible={model.visible}
                                styles={styles}
                                isSelected={selectedModelIDArray.length > 0 && selectedModelIDArray.indexOf(model.modelID) >= 0}
                                onSelect={actions.selectTargetModel}
                                onToggleVisible={actions.onClickHideShowSelectedModel}
                                inProgress={inProgress}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default PrintingObjectListBox;
