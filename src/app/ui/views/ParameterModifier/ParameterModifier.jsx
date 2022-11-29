import { includes } from 'lodash';
import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { LEFT_EXTRUDER, RIGHT_EXTRUDER } from '../../../constants';
import { actions as printingActions } from '../../../flux/printing';

import i18n from '../../../lib/i18n';

import Modal from '../../components/Modal';
import PresetContent from './PresetContent';
import StackPresetSelector from './StackPresetSelector';

/**
 * Print parameter modifier dialog.
 *
 * @param outsideActions
 * @constructor
 */
function ParameterModifier({ outsideActions }) {
    const dispatch = useDispatch();

    const {
        defaultDefinitions,
        qualityDefinitions,
        qualityDefinitionsRight,
        activePresetIds,
    } = useSelector(state => state?.printing);
    // const { toolHead: { printingToolhead } } = useSelector(state => state?.machine);

    // selected stack
    // Either LEFT_EXTRUDER or RIGHT_EXTRUDER, these are the only values supported,
    // add a global machine stack later.
    const [selectedStackId, setSelectedStackId] = useState(LEFT_EXTRUDER);

    // selected preset for selected stack
    const [selectedPresetId, setSelectedPresetId] = useState('');

    const [selectedPresetDefaultValues, setSelectedPresetDefaultValues] = useState({});

    /**
     * Select stack by stack id.
     *
     * @param stackId
     */
    function selectStack(stackId) {
        if (includes([LEFT_EXTRUDER, RIGHT_EXTRUDER], stackId)) {
            setSelectedStackId(stackId);
        }
    }

    /**
     * Select preset by preset id.
     *
     * @param presetId
     */
    function selectPreset(presetId) {
        setSelectedPresetId(presetId);

        const presetModels = selectedStackId === LEFT_EXTRUDER ? qualityDefinitions : qualityDefinitionsRight;
        const presetModel = presetModels.find(p => p.definitionId === presetId);
        if (presetModel) {
            dispatch(printingActions.updateActiveQualityPresetId(selectedStackId, presetId));
        }
    }

    /**
     * Get default values of a preset.
     *
     * @param presetId
     * @return {{}}
     */
    function getPresetDefaultValues(presetId) {
        const defaultPreset = defaultDefinitions.find(p => p.definitionId === presetId);

        return defaultPreset?.settings || {};
    }

    useEffect(() => {
        const presetId = activePresetIds[selectedStackId];

        if (presetId !== selectedPresetId) {
            setSelectedPresetId(presetId);
        }

        const defaultValues = getPresetDefaultValues(presetId);
        setSelectedPresetDefaultValues(defaultValues);
    }, [activePresetIds, selectedStackId]);

    return (
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
                    <StackPresetSelector
                        selectedStackId={selectedStackId}
                        selectedPresetId={selectedPresetId}
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

ParameterModifier.propTypes = {
    outsideActions: PropTypes.shape({
        closePrintParameterModifier: PropTypes.func.isRequired
    }).isRequired
};

export default ParameterModifier;
