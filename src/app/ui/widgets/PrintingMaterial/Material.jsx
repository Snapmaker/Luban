import React, { useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import classNames from 'classnames';
import Select from '../../components/Select';
import SvgIcon from '../../components/SvgIcon';
import i18n from '../../../lib/i18n';
// import Anchor from '../../components/Anchor';
import { actions as printingActions } from '../../../flux/printing';
import { actions as projectActions } from '../../../flux/project';
// import styles from './styles.styl';
import { HEAD_PRINTING, PRINTING_MANAGER_TYPE_MATERIAL } from '../../../constants';
import { getSelectOptions } from '../../utils/profileManager';


// const MATERIAL_CONFIG_KEYS = [
//     'material_diameter',
//     'material_flow',
//     'material_print_temperature',
//     'material_print_temperature_layer_0',
//     'cool_fan_speed',
//     'machine_heated_bed',
//     'material_bed_temperature',
//     'material_bed_temperature_layer_0',
//     'material_flow_layer_0'
// ];
const plaMaterialId = 'material.pla';

function Material({ widgetActions }) {
    const materialDefinitions = useSelector(state => state?.printing?.materialDefinitions,);
    const defaultMaterialId = useSelector(state => state?.printing?.defaultMaterialId, shallowEqual);
    const inProgress = useSelector(state => state?.printing?.inProgress);
    const dispatch = useDispatch();

    function onShowPrintingManager() {
        dispatch(printingActions.updateManagerDisplayType(PRINTING_MANAGER_TYPE_MATERIAL));
        dispatch(printingActions.updateShowPrintingManager(true));
    }

    const updateActiveDefinition = useCallback((definition, shouldSave = false) => {
        if (definition) {
            dispatch(printingActions.updateActiveDefinition(definition, shouldSave));
            dispatch(projectActions.autoSaveEnvironment(HEAD_PRINTING));
        }
    }, [dispatch]);

    function onChangeMaterialValue(option) {
        const definitionId = option.value;
        const definition = materialDefinitions.find(d => d.definitionId === definitionId);
        if (definition) {
            // update selectedId
            dispatch(printingActions.updateDefaultConfigId(PRINTING_MANAGER_TYPE_MATERIAL, definition.definitionId));
            dispatch(printingActions.updateDefaultMaterialId(definition.definitionId));
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
                'sm-flex',
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
