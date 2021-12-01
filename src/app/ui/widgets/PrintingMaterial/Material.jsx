import React, { useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
// mock, antd TreeSelect
import { TreeSelect } from 'antd';
import classNames from 'classnames';
// import Select from '../../components/Select';
import SvgIcon from '../../components/SvgIcon';
import i18n from '../../../lib/i18n';
import { actions as printingActions } from '../../../flux/printing';
import { actions as projectActions } from '../../../flux/project';
import { DUAL_EXTRUDER_TOOLHEAD_FOR_SM2, HEAD_PRINTING, LEFT_EXTRUDER, PRINTING_MANAGER_TYPE_MATERIAL, RIGHT_EXTRUDER } from '../../../constants';
import { machineStore } from '../../../store/local-storage';
import { getSelectOptions } from '../../utils/profileManager';

const plaMaterialId = 'material.pla';
// const MaterialText = ({ name, color }) => {
//     return (
//         <div className="sm-flex align-center justify-space-between">
//             <span>{name}</span>
//             <div className={`width-16 height-16 material-background-${color?.toLowerCase()}`} />
//         </div>
//     );
// };
// MaterialText.propTypes = {
//     name: PropTypes.string,
//     color: PropTypes.string
// };
function Material({ widgetActions }) {
    const materialDefinitions = useSelector(state => state?.printing?.materialDefinitions,);
    const defaultMaterialId = useSelector(state => state?.printing?.defaultMaterialId, shallowEqual);
    const defaultMaterialIdRight = useSelector(state => state?.printing?.defaultMaterialIdRight, shallowEqual);
    const printingToolhead = machineStore.get('machine.toolHead.printingToolhead');
    const inProgress = useSelector(state => state?.printing?.inProgress);
    const dispatch = useDispatch();

    function onShowPrintingManager(direction = 'left') {
        dispatch(printingActions.updateManagerDisplayType(PRINTING_MANAGER_TYPE_MATERIAL));
        dispatch(printingActions.updateShowPrintingManager(true));
        dispatch(printingActions.updateState({ materialManagerDirection: direction }));
    }

    const updateActiveDefinition = useCallback((definition, shouldSave = false) => {
        if (definition) {
            dispatch(printingActions.updateActiveDefinition(definition, shouldSave));
            dispatch(projectActions.autoSaveEnvironment(HEAD_PRINTING));
        }
    }, [dispatch]);

    function onChangeMaterialValue(option, direction) {
        const definitionId = option;
        const definition = materialDefinitions.find(d => d.definitionId === definitionId);
        if (definition) {
            // update selectedId
            dispatch(printingActions.updateDefaultConfigId(PRINTING_MANAGER_TYPE_MATERIAL, definition.definitionId, direction));
            dispatch(printingActions.updateDefaultMaterialId(definition.definitionId, direction));
            // update active definition
            updateActiveDefinition(definition);

            // on after changes
            dispatch(printingActions.destroyGcodeLine());
            dispatch(printingActions.displayModel());
        }
    }
    useEffect(() => {
        widgetActions.setTitle(i18n._('key-Printing/PrintingConfigurations-Material Settings'));
    }, [widgetActions]);
    useEffect(() => {
        const definition = materialDefinitions.find(d => d.definitionId === defaultMaterialId);
        if (!definition) {
            dispatch(printingActions.updateDefaultMaterialId(plaMaterialId));
        }
        updateActiveDefinition(definition);
    }, [defaultMaterialId]);

    const toolDefinitionOptions = getSelectOptions(materialDefinitions);
    const valueObj = {
        firstKey: 'definitionId',
        firstValue: defaultMaterialId
    };

    return (
        <React.Fragment>
            <div className={classNames(
                'margin-top-8'
            )}
            >
                <Select
                    clearable={false}
                    size="292px"
                    isGroup
                    valueObj={valueObj}
                    options={toolDefinitionOptions}
                    value={defaultMaterialId}
                    onChange={onChangeMaterialValue}
                    disabled={inProgress}
                />
                <SvgIcon
                    className="border-default-black-5 margin-left-4"
                    name="PrintingSettingNormal"
                    size={24}
                    disabled={inProgress}
                    onClick={onShowPrintingManager}
                    borderRadius={8}
                />
            </div>
        </React.Fragment>
    );
}

Material.propTypes = {
    widgetActions: PropTypes.object
};

export default Material;
