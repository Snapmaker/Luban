import React, { useEffect } from 'react';
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
        onClickModelNameBox(model, event) {
            let isMultiSelect = event.shiftKey;
            if (selectedModelArray.length === 1 && selectedModelArray[0].visible === false) {
                isMultiSelect = false;
            }
            if (selectedModelArray && selectedModelArray.length > 0 && model.visible === false) {
                isMultiSelect = false;
            }
            dispatch(printingActions.selectTargetModel(model, isMultiSelect));
        },
        onClickModelHideBox(model) {
            const visible = model.visible;
            dispatch(printingActions.selectTargetModel(model));
            if (visible) {
                dispatch(printingActions.hideSelectedModel(model));
            } else {
                dispatch(printingActions.showSelectedModel(model));
            }
        }
    };

    useEffect(() => {
    }, [models]);

    return (
        <div className="width-264 margin-vertical-4">
            {models && models.map((model) => {
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
