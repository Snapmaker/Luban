import { includes } from 'lodash';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { LEFT_EXTRUDER, RIGHT_EXTRUDER } from '../../../constants';
import { actions as printingActions } from '../../../flux/printing';

import i18n from '../../../lib/i18n';

import Modal from '../../components/Modal';
import definitionManager from '../../../flux/manager/DefinitionManager';
import PresetContent from './PresetContent';
import StackPresetSelector from './StackPresetSelector';

/**
 * Preset modifier modal.
 *
 * @param defaultStackId
 * @param outsideActions
 * @constructor
 */
function PresetModifierModal(
    {
        defaultStackId = LEFT_EXTRUDER,
        outsideActions // TODO: Remove this
    }
) {
    const dispatch = useDispatch();

    const {
        defaultDefinitions,
        qualityDefinitions: qualityPresetModels,
        activePresetIds,
    } = useSelector(state => state?.printing);

    // selected stack
    // Either LEFT_EXTRUDER or RIGHT_EXTRUDER, these are the only values supported,
    // add a global machine stack later.
    const [selectedStackId, setSelectedStackId] = useState(defaultStackId);

    // selected preset for selected stack
    const [selectedPresetId, setSelectedPresetId] = useState('');

    const selectedPresetModel = useMemo(() => {
        return qualityPresetModels.find(p => p.definitionId === selectedPresetId);
    }, [qualityPresetModels, selectedPresetId]);

    const [selectedPresetDefaultValues, setSelectedPresetDefaultValues] = useState({});

    /**
     * Select stack by stack id.
     *
     * @param stackId
     */
    const selectStack = useCallback((stackId) => {
        if (includes([LEFT_EXTRUDER, RIGHT_EXTRUDER], stackId)) {
            setSelectedStackId(stackId);
        }
    }, []);

    /**
     * Select preset by preset id.
     *
     * @param presetId
     */
    const selectPreset = useCallback((presetId) => {
        const presetModel = qualityPresetModels.find(p => p.definitionId === presetId);
        if (presetModel) {
            setSelectedPresetId(presetId);
            dispatch(printingActions.updateActiveQualityPresetId(selectedStackId, presetId));
        } else {
            // TODO: Popup a notification indicating unacceptable preset id
            dispatch(printingActions.updateActiveQualityPresetId(selectedStackId, presetId));
        }
    }, [dispatch, selectedStackId, qualityPresetModels]);

    useEffect(() => {
        const presetId = activePresetIds[selectedStackId];

        if (presetId !== selectedPresetId) {
            setSelectedPresetId(presetId);
        }

        /**
         * Get default values of a preset.
         *
         * @param presetId
         * @return {{}}
         */
        const getPresetDefaultValues = (presetId_) => {
            const defaultPreset = defaultDefinitions.find(p => p.definitionId === presetId_);

            return defaultPreset?.settings || {};
        };

        const defaultValues = getPresetDefaultValues(presetId);
        setSelectedPresetDefaultValues(defaultValues);
    }, [activePresetIds, selectedStackId, selectedPresetId, defaultDefinitions]);

    // Calculate reset state of the preset
    // TODO: Compare operation on every render is expensive, calculate this on preset parameter change
    const isValuesAllDefaultValues = (() => {
        if (selectedPresetModel && selectedPresetModel.isDefault && Object.keys(selectedPresetDefaultValues).length > 0) {
            let same = true;

            for (const key of definitionManager.qualityProfileArr) {
                if (!selectedPresetDefaultValues[key]) {
                    console.warn(`preset ${selectedPresetId}, missing default value for key ${key}.`);
                    continue;
                }
                if (selectedPresetDefaultValues[key].default_value !== selectedPresetModel.settings[key].default_value) {
                    same = false;
                    break;
                }
            }

            return same;
        }
        return true;
    })();

    return (
        <Modal
            size="lg-profile-manager"
            style={{ minWidth: 700 }}
            onClose={outsideActions.closePrintParameterModifier}
        >
            <Modal.Header>
                <div>
                    {i18n._('Print Settings')}
                </div>
            </Modal.Header>
            <Modal.Body>
                <div className="background-grey-3 height-all-minus-132 sm-flex">
                    <StackPresetSelector
                        selectedStackId={selectedStackId}
                        selectedPresetId={selectedPresetId}
                        isValuesAllDefaultValues={isValuesAllDefaultValues}
                        onSelectStack={selectStack}
                        onSelectPreset={selectPreset}
                    />
                    <PresetContent
                        selectedStackId={selectedStackId}
                        selectedPresetId={selectedPresetId}
                        selectedPresetDefaultValues={selectedPresetDefaultValues}
                    />
                </div>
            </Modal.Body>
        </Modal>
    );
}

PresetModifierModal.propTypes = {
    defaultStackId: PropTypes.string,
    outsideActions: PropTypes.shape({
        closePrintParameterModifier: PropTypes.func.isRequired
    }).isRequired
};

export default PresetModifierModal;
