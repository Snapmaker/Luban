import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import styles from './styles.styl';
import { actions as printingActions } from '../../../flux/printing';
import i18n from '../../../lib/i18n';
import ModelItem from '../../views/model-item';

function PrintingObjectListBox(props) {
    const selectedModelIDArray = useSelector(state => state?.printing?.modelGroup?.selectedModelIDArray, shallowEqual);
    const models = useSelector(state => state?.printing?.modelGroup?.models);
    const dispatch = useDispatch();
    const actions = {
        selectTargetModel(targetModel, shiftKey) {
            dispatch(printingActions.selectTargetModel(targetModel, shiftKey));
        },
        onClickHideShowSelectedModel(targetModel) {
            const visible = targetModel.visible;
            actions.selectTargetModel(targetModel);
            if (visible === true) {
                dispatch(printingActions.hideSelectedModel());
            } else {
                dispatch(printingActions.showSelectedModel());
            }
        }
    };
    useEffect(() => {
        props.widgetActions.setTitle(i18n._('Object List'));
    }, [props.widgetActions.setTitle]);
    return (
        <div className={styles['object-list-box']}>
            {(models) && models.filter(model => !model.supportTag).map((model) => {
                return (
                    <ModelItem
                        key={model.modelID}
                        model={model}
                        styles={styles}
                        isSelected={selectedModelIDArray.length > 0 && selectedModelIDArray.indexOf(model.modelID) >= 0}
                        onSelect={actions.selectTargetModel}
                        onToggleVisible={actions.onClickHideShowSelectedModel}
                    />
                );
            })}
        </div>
    );
}
PrintingObjectListBox.propTypes = {
    widgetActions: PropTypes.object
};

export default PrintingObjectListBox;
