import React, { useEffect, useState } from 'react';
// import PropTypes from 'prop-types';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import { find, filter, includes } from 'lodash';
import classNames from 'classnames';
import styles from './styles.styl';
import ModelItem from '../../views/model-item';
import { actions as printingActions } from '../../../flux/printing';
import { machineStore } from '../../../store/local-storage';
import { DUAL_EXTRUDER_TOOLHEAD_FOR_SM2, LEFT_EXTRUDER, RIGHT_EXTRUDER } from '../../../constants';
import { whiteHex } from '../PrintingVisualizer/VisualizerLeftBar';

function PrintingObjectListBox() {
    const selectedModelArray = useSelector(state => state?.printing?.modelGroup?.selectedModelArray);
    const models = useSelector(state => state?.printing?.modelGroup?.models);
    const inProgress = useSelector(state => state?.printing?.inProgress, shallowEqual);
    const leftBarOverlayVisible = useSelector(state => state?.printing?.leftBarOverlayVisible, shallowEqual);
    const disabled = leftBarOverlayVisible;
    const isDualExtruder = (machineStore.get('machine.toolHead.printingToolhead') === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2);
    const defaultMaterialId = useSelector(state => state?.printing?.defaultMaterialId, shallowEqual);
    const defaultMaterialIdRight = useSelector(state => state?.printing?.defaultMaterialIdRight, shallowEqual);
    const materialDefinitions = useSelector(state => state?.printing?.materialDefinitions);
    const [leftMaterialColor, setLeftMaterialColor] = useState(whiteHex);
    const [rightMaterialColor, setRightMaterialColor] = useState(whiteHex);
    const [expendArr, setExpendArr] = useState([]);
    // const [showList, setShowList] = useState(true);
    const dispatch = useDispatch();
    const actions = {
        onClickModelNameBox(targetModel, event) {
            if (disabled) {
                return;
            }
            dispatch(printingActions.selectTargetModel(targetModel, event.shiftKey));
        },
        onClickModelHideBox(targetModel) {
            if (disabled) {
                return;
            }
            const visible = targetModel.visible;
            actions.onClickModelNameBox(targetModel, { shiftKey: false });
            if (visible === true) {
                dispatch(printingActions.hideSelectedModel(targetModel));
            } else {
                dispatch(printingActions.showSelectedModel(targetModel));
            }
        },
        updateMaterialColor(definition, direction) {
            const color = definition?.settings?.color?.default_value;
            switch (direction) {
                case LEFT_EXTRUDER:
                    setLeftMaterialColor(color);
                    break;
                case RIGHT_EXTRUDER:
                    setRightMaterialColor(color);
                    break;
                default:
                    break;
            }
        },
        onClickChangeExpendArr(modelId) {
            if (expendArr.includes(modelId)) {
                const tempArr = filter(expendArr, (item) => {
                    return item !== modelId;
                });
                setExpendArr(tempArr);
            } else {
                const tempArr = expendArr;
                tempArr.push(modelId);
                setExpendArr(tempArr);
            }
        }
    };
    const allModels = (models) && models.filter(model => !model.supportTag);
    // const prevProps = usePrevious({
    //     allModels
    // });
    useEffect(() => {
        const leftDefinition = find(materialDefinitions, { definitionId: defaultMaterialId });
        const rightDefinition = find(materialDefinitions, { definitionId: defaultMaterialIdRight });
        actions.updateMaterialColor(leftDefinition, LEFT_EXTRUDER);
        actions.updateMaterialColor(rightDefinition, RIGHT_EXTRUDER);
    }, [materialDefinitions]);

    useEffect(() => {
        const leftDefinition = find(materialDefinitions, { definitionId: defaultMaterialId });
        actions.updateMaterialColor(leftDefinition, LEFT_EXTRUDER);
    }, [defaultMaterialId]);

    useEffect(() => {
        const rightDefinition = find(materialDefinitions, { definitionId: defaultMaterialIdRight });
        actions.updateMaterialColor(rightDefinition, RIGHT_EXTRUDER);
    }, [defaultMaterialIdRight]);

    return (
        <div className={classNames(
            'width-264',
            'background-color-white',
            styles['object-list-box'],
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
                        placment="right"
                        disabled={disabled}
                        isDualExtruder={isDualExtruder}
                        leftMaterialColor={leftMaterialColor}
                        rightMaterialColor={rightMaterialColor}
                        isExpend={expendArr && includes(expendArr, model.modelID)}
                        onExpend={actions.onClickChangeExpendArr}
                    />
                );
            })}
        </div>
    );
}

export default PrintingObjectListBox;
