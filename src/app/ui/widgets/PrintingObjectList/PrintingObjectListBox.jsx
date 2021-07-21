import React from 'react';
// import PropTypes from 'prop-types';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import styles from './styles.styl';
// import i18n from '../../../lib/i18n';
import ModelItem from '../../views/model-item';
import { actions as printingActions } from '../../../flux/printing';

function PrintingObjectListBox() {
    const selectedModelArray = useSelector(state => state?.printing?.modelGroup?.selectedModelArray, shallowEqual);
    const models = useSelector(state => state?.printing?.modelGroup?.models);
    const inProgress = useSelector(state => state?.printing?.inProgress, shallowEqual);
    // const [showList, setShowList] = useState(true);
    const dispatch = useDispatch();
    const actions = {
        onClickModelNameBox(targetModel, shiftKey) {
            dispatch(printingActions.selectTargetModel(targetModel, shiftKey));
        },
        onClickModelHideBox(targetModel) {
            const visible = targetModel.visible;
            actions.onClickModelNameBox(targetModel);
            if (visible === true) {
                dispatch(printingActions.hideSelectedModel(targetModel));
            } else {
                dispatch(printingActions.showSelectedModel(targetModel));
            }
        }
    };

    return (
        <div className="width-264 margin-vertical-4">
            {(models) && models.filter(model => !model.supportTag).map((model) => {
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
                    />
                );
            })}
        </div>
    );
}
// PrintingObjectListBox.propTypes = {
//     headType: PropTypes.string
// };

export default PrintingObjectListBox;
