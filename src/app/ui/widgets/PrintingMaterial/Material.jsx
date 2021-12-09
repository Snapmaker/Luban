import React, { useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import classNames from 'classnames';
import Select from '../../components/Select';
import SvgIcon from '../../components/SvgIcon';
import i18n from '../../../lib/i18n';
import { actions as printingActions } from '../../../flux/printing';
import { actions as projectActions } from '../../../flux/project';
import {
    LEFT_EXTRUDER, PRINTING_MANAGER_TYPE_MATERIAL, HEAD_PRINTING, DUAL_EXTRUDER_TOOLHEAD_FOR_SM2,
    RIGHT_EXTRUDER
} from '../../../constants';
import { machineStore } from '../../../store/local-storage';
import { getMaterialSelectOptions } from '../../utils/profileManager';

const plaMaterialId = 'material.pla';

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
        const definitionId = option.definitionId;
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

    const materialDefinitionOptions = getMaterialSelectOptions(materialDefinitions);
    const valueObj = {
        firstKey: 'definitionId',
        firstValue: defaultMaterialId
    };
    const valueObjForRight = {
        firstKey: 'definitionId',
        firstValue: defaultMaterialIdRight
    };

    return (
        <React.Fragment>
            <div className={classNames(
                'margin-top-8'
            )}
            >
                <div className="sm-flex justify-space-between">
                    <span className="display-inline width-88 text-overflow-ellipsis height-32">
                        {printingToolhead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2 ? i18n._('key-Printing/PrintingConfigurations-Extruder L') : i18n._('key-Printing/PrintingConfigurations-Extruder')}
                    </span>
                    <div>
                        <Select
                            clearable={false}
                            size="160px"
                            isGroup
                            valueObj={valueObj}
                            options={materialDefinitionOptions}
                            value={defaultMaterialId}
                            onChange={(option) => onChangeMaterialValue(option, LEFT_EXTRUDER)}
                            disabled={inProgress}
                        />
                        <SvgIcon
                            className="border-default-black-5 margin-left-4"
                            name="PrintingSettingNormal"
                            size={24}
                            disabled={inProgress}
                            onClick={() => onShowPrintingManager(LEFT_EXTRUDER)}
                            borderRadius={8}
                        />
                    </div>
                </div>
                {printingToolhead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2 && (
                    <div className="sm-flex justify-space-between margin-top-8">
                        <span className="display-inline width-88 text-overflow-ellipsis height-32">{i18n._('key-Printing/PrintingConfigurations-Extruder R')}</span>
                        <div>
                            <Select
                                clearable={false}
                                size="160px"
                                isGroup
                                valueObj={valueObjForRight}
                                options={materialDefinitionOptions}
                                value={defaultMaterialIdRight}
                                onChange={(option) => onChangeMaterialValue(option, RIGHT_EXTRUDER)}
                                disabled={inProgress}
                            />
                            <SvgIcon
                                className="border-default-black-5 margin-left-4"
                                name="PrintingSettingNormal"
                                size={24}
                                disabled={inProgress}
                                onClick={() => onShowPrintingManager(RIGHT_EXTRUDER)}
                                borderRadius={8}
                            />
                        </div>
                    </div>
                )}
            </div>
        </React.Fragment>
    );
}

Material.propTypes = {
    widgetActions: PropTypes.object
};

export default Material;
