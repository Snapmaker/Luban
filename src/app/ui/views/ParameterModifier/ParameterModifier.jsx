import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { every, find, includes } from 'lodash';
import { useDispatch, useSelector } from 'react-redux';

import { LEFT_EXTRUDER, RIGHT_EXTRUDER } from '../../../constants';
import { isDualExtruder, HEAD_PRINTING } from '../../../constants/machines';
import i18n from '../../../lib/i18n';

import Modal from '../../components/Modal';

import { getPresetOptions } from '../../utils/profileManager';
import { actions as projectActions } from '../../../flux/project';
/* eslint-disable import/no-cycle */
import CategorySelector, { EXTRUDER_TAB } from './CategorySelector';
/* eslint-disable import/no-cycle */
import Content from './Content';

function ParameterModifier({ outsideActions }) {
    const {
        defaultDefinitions,
        qualityDefinitions,
        qualityDefinitionsRight,
        defaultMaterialId,
        defaultMaterialIdRight,
        definitionEditorForExtruder,
    } = useSelector(state => state?.printing);

    const { toolHead: { printingToolhead } } = useSelector(state => state?.machine);
    const [selectedTab, setSelectedTab] = useState(EXTRUDER_TAB);
    const [selectedExtruder, setSelectedExtruder] = useState(LEFT_EXTRUDER);
    const [selectedModelId, setSelectedModelId] = useState('');
    const [selectedDefinitionId, setSelectedDefinitionId] = useState('');
    const [selectedSettingsDefaultValue, setSelectedSettingsDefaultValue] = useState({});
    const [mode, setMode] = useState('show'); // show => show the editor data, update => update the editor data
    const dispatch = useDispatch();

    const handleUpdateCallback = (type, value) => {
        if (type === EXTRUDER_TAB) {
            setSelectedExtruder(value);
        } else {
            setSelectedModelId(value);
        }
    };
    const handleTabSelectedCallback = (type) => {
        setSelectedTab(type);
    };

    const getKeys = (parentKeys, definition) => {
        let returnKeys = [];
        parentKeys.forEach(key => {
            const setting = definition.settings[key];
            if (setting.settable_per_extruder || setting.settable_per_mesh) {
                returnKeys = returnKeys.concat(key);
            }

            const childKey = setting.childKey;
            if (childKey.length) {
                const childKeyReturn = getKeys(childKey, definition);
                returnKeys = returnKeys.concat(childKeyReturn);
            }
        });
        return returnKeys;
    };

    useEffect(() => {
        const temp = getPresetOptions(qualityDefinitions);
        const initCategory = 'Default';

        if (!(every([defaultMaterialId, defaultMaterialIdRight], (item) => {
            const material = item.split('.')[1];
            return material === 'pva' || material === 'support';
        }) || every([defaultMaterialId, defaultMaterialIdRight], (item) => {
            const material = item.split('.')[1];
            return material !== 'pva' && material !== 'support';
        })) && isDualExtruder(printingToolhead)) {
            const secondaryExtruder = includes(['pva', 'support'], defaultMaterialId.split('.')[1]) ? LEFT_EXTRUDER : RIGHT_EXTRUDER;
            const autoParams = {};
            const definition = find(secondaryExtruder === LEFT_EXTRUDER ? qualityDefinitions : qualityDefinitionsRight, { definitionId: 'quality.normal_other_quality' });
            autoParams.printing_speed = getKeys(definition.printingProfileLevel.printing_speed, definition);
            autoParams.support = getKeys(definition.printingProfileLevel.support, definition);
            definitionEditorForExtruder.set(secondaryExtruder, autoParams);
        }
        setSelectedDefinitionId(temp[initCategory].options[0].definitionId);
        const defaultSettings = find(defaultDefinitions, { definitionId: temp[initCategory].options[0].definitionId })?.settings || {};
        setSelectedSettingsDefaultValue(defaultSettings);
        return () => {
            dispatch(projectActions.autoSaveEnvironment(HEAD_PRINTING, true));
        };
    }, []);

    useEffect(() => {
        const defaultSettings = find(defaultDefinitions, { definitionId: selectedDefinitionId })?.settings || {};

        setSelectedSettingsDefaultValue(defaultSettings);
    }, [selectedDefinitionId]);

    return (
        <React.Fragment>
            <Modal
                size="lg-profile-manager"
                style={{ minWidth: 700 }}
                onClose={outsideActions.closePrintParameterModifier}
            >
                <Modal.Header>
                    <div>
                        {i18n._('Print Parameter Modifiers')}
                    </div>
                </Modal.Header>
                <Modal.Body>
                    <div className="background-grey-3 height-all-minus-132 sm-flex">
                        <CategorySelector
                            handleUpdateCallback={handleUpdateCallback}
                            handleTabSelectedCallback={handleTabSelectedCallback}
                            mode={mode}
                            handleUpdateDefinitionId={setSelectedDefinitionId}
                        />
                        <Content
                            selectedExtruder={selectedExtruder}
                            selectedModelId={selectedModelId}
                            editorType={selectedTab}
                            mode={mode}
                            setMode={setMode}
                            printingDefinitionId={selectedDefinitionId}
                            selectedSettingsDefaultValue={selectedSettingsDefaultValue}
                        />
                    </div>
                </Modal.Body>
            </Modal>
        </React.Fragment>
    );
}

ParameterModifier.propTypes = {
    outsideActions: PropTypes.shape({
        closePrintParameterModifier: PropTypes.func.isRequired
    }).isRequired
};

export default ParameterModifier;
