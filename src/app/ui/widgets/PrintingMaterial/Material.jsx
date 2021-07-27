import React, { useEffect, useState, useCallback } from 'react';
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
import { HEAD_3DP, PRINTING_MANAGER_TYPE_MATERIAL } from '../../../constants';
// import OptionalDropdown from '../../components/OptionalDropdown';
// import Space from '../../components/Space';


// const MATERIAL_CONFIG_KEYS = [
//     'material_diameter',
//     'material_flow',
//     'material_print_temperature',
//     'material_print_temperature_layer_0',
//     'material_final_print_temperature',
//     'cool_fan_speed',
//     'machine_heated_bed',
//     'material_bed_temperature',
//     'material_bed_temperature_layer_0'
// ];
function Material({ widgetActions }) {
    const materialDefinitions = useSelector(state => state?.printing?.materialDefinitions, shallowEqual);
    const defaultMaterialId = useSelector(state => state?.printing?.defaultMaterialId, shallowEqual);
    const inProgress = useSelector(state => state?.printing?.inProgress);
    const dispatch = useDispatch();
    // const [showOfficialMaterialDetails, setShowOfficialMaterialDetails] = useState(true);
    const [currentDefinition, setCurrentDefinition] = useState(null);
    const [materialDefinitionOptions, setMaterialDefinitionOptions] = useState([]);

    function onShowPrintingManager() {
        dispatch(printingActions.updateManagerDisplayType(PRINTING_MANAGER_TYPE_MATERIAL));
        dispatch(printingActions.updateShowPrintingManager(true));
    }

    const updateActiveDefinition = useCallback((definition, shouldSave = false) => {
        if (definition) {
            dispatch(printingActions.updateActiveDefinition(definition, shouldSave));
            dispatch(projectActions.autoSaveEnvironment(HEAD_3DP, true));
        }
    }, [dispatch]);
    function onChangeMaterialValue(option) {
        const definitionId = option.value;
        const definition = materialDefinitions.find(d => d.definitionId === definitionId);
        if (definition) {
            setCurrentDefinition(definition);
            dispatch(printingActions.updateState({ defaultMaterialId: definition.definitionId }));
            updateActiveDefinition(definition);
        }
    }

    const onChangeMaterial = useCallback((definitionId) => {
        const definition = materialDefinitions.find(d => d.definitionId === definitionId);
        if (definition) {
            setCurrentDefinition(definition);
            dispatch(printingActions.updateState({ defaultMaterialId: definition.definitionId }));
            updateActiveDefinition(definition);
        }
    }, [dispatch, updateActiveDefinition, materialDefinitions]);
    useEffect(() => {
        if (materialDefinitions.length === 0) {
            const definition = materialDefinitions.find(d => d.definitionId === 'material.pla');
            setCurrentDefinition(definition);
            updateActiveDefinition(definition);
        } else {
            const definition = materialDefinitions.find(d => d.definitionId === (currentDefinition?.definitionId))
                || materialDefinitions.find(d => d.definitionId === 'material.pla');
            setCurrentDefinition(definition);
            updateActiveDefinition(definition);
        }
        const newMaterialDefinitionOptions = materialDefinitions.map(d => ({
            label: d.name,
            value: d.definitionId
        }));

        setMaterialDefinitionOptions(newMaterialDefinitionOptions);
    }, [materialDefinitions, updateActiveDefinition, currentDefinition?.definitionId]);

    useEffect(() => {
        onChangeMaterial(defaultMaterialId);
    }, [defaultMaterialId, onChangeMaterial]);

    useEffect(() => {
        widgetActions.setTitle(i18n._('Material'));
    }, [widgetActions]);

    if (!currentDefinition) {
        return null;
    }

    return (
        <React.Fragment>
            <div className={classNames(
                'sm-flex',
                'margin-top-8'
            )}
            >
                <Select
                    clearable={false}
                    size="294px"
                    searchable
                    options={materialDefinitionOptions}
                    value={currentDefinition.definitionId}
                    onChange={onChangeMaterialValue}
                    disabled={inProgress}
                />
                <SvgIcon
                    className="border-radius-8 border-default-grey-1 padding-vertical-2 padding-horizontal-2 margin-left-4"
                    name="PrintingSettingNormal"
                    size={24}
                    disabled={inProgress}
                    onClick={onShowPrintingManager}
                />
            </div>
        </React.Fragment>
    );
}

Material.propTypes = {
    widgetActions: PropTypes.object
};

export default Material;
