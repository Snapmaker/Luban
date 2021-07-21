import React from 'react';
// import PropTypes from 'prop-types';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import classNames from 'classnames';
import styles from './styles.styl';
import ModelItem from '../../views/model-item';
import { actions as printingActions } from '../../../flux/printing';

function PrintingObjectListBox() {
    const selectedModelArray = useSelector(state => state?.printing?.modelGroup?.selectedModelArray);
    const models = useSelector(state => state?.printing?.modelGroup?.models);
    const inProgress = useSelector(state => state?.printing?.inProgress, shallowEqual);
    // const [showList, setShowList] = useState(true);
    const dispatch = useDispatch();
    const actions = {
        onClickModelNameBox(targetModel, event) {
            dispatch(printingActions.selectTargetModel(targetModel, event.shiftKey));
        },
        onClickModelHideBox(targetModel) {
            const visible = targetModel.visible;
            actions.onClickModelNameBox(targetModel, { shiftKey: false });
            if (visible === true) {
                dispatch(printingActions.hideSelectedModel(targetModel));
            } else {
                dispatch(printingActions.showSelectedModel(targetModel));
            }
        }
    };
    const allModels = (models) && models.filter(model => !model.supportTag);

    return (
        <div className={classNames(
            'width-264',
            allModels.length > 0 ? 'border-radius-8 border-default-grey-1 padding-vertical-4' : '',
        )}
        >
            {allModels && allModels.map((model) => {
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
