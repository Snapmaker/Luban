import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { includes, remove } from 'lodash';

import { LEFT_EXTRUDER, RIGHT_EXTRUDER } from '../../../constants';
import { isDualExtruder } from '../../../constants/machines';
import { PRESET_CATEGORY_DEFAULT } from '../../../constants/preset';
import i18n from '../../../lib/i18n';
import Anchor from '../../components/Anchor';
import SvgIcon from '../../components/SvgIcon';
import { getPresetOptions } from '../../utils/profileManager';

/**
 * Stack and preset selector.
 *
 * Select a stack, and then select a preset for it.
 *
 * @param selectedStackId
 * @param selectedPresetId
 * @param onSelectStack
 * @param onSelectPreset
 * @returns {*}
 * @constructor
 */
const StackPresetSelector = ({ selectedStackId, selectedPresetId, onSelectStack, onSelectPreset }) => {
    const { toolHead: { printingToolhead } } = useSelector(state => state?.machine);
    // quality
    const {
        qualityDefinitions,
        qualityDefinitionsRight,
        materialDefinitions,
        defaultMaterialId,
        defaultMaterialIdRight,
    } = useSelector(state => state?.printing);

    const [presetOptionsObj, setPresetOptionsObj] = useState(null);

    // expanded categories, only for displaying
    const [expandedPresetCategories, setExpandedPresetCategories] = useState([PRESET_CATEGORY_DEFAULT]);

    useEffect(() => {
        const presets = selectedStackId === LEFT_EXTRUDER ? qualityDefinitions : qualityDefinitionsRight;

        const materialPresetId = selectedStackId === LEFT_EXTRUDER ? defaultMaterialId : defaultMaterialIdRight;
        const materialPreset = materialDefinitions.find(p => p.definitionId === materialPresetId);

        const presetOptions = getPresetOptions(presets, materialPreset);
        setPresetOptionsObj(presetOptions);

        // set all preset categories expanded
        setExpandedPresetCategories(Object.keys(presetOptions));
    }, [selectedStackId, defaultMaterialId, defaultMaterialIdRight]);

    // stackId: LEFT_EXTRUDER or RIGHT_EXTRUDER
    // Maybe support a global stack later
    function selectStack(stackId) {
        onSelectStack(stackId);
    }

    /**
     * Toggle expansion of a preset category.
     *
     * @param presetCategory
     */
    const togglePresetCategoryExpansion = (presetCategory) => {
        const newCategories = [...expandedPresetCategories];
        if (includes(expandedPresetCategories, presetCategory)) {
            remove(newCategories, (item) => {
                return item === presetCategory;
            });
        } else {
            newCategories.push(presetCategory);
        }
        setExpandedPresetCategories(newCategories);
    };

    /**
     * Select preset for selected stack.
     *
     * @param presetId
     */
    function selectPresetByPresetId(presetId) {
        onSelectPreset(presetId);
    }

    return (
        <div
            className="width-264 min-width-264 background-color-white height-percent-100"
            style={{
                minWidth: '264px'
            }}
        >
            <div className="height-60 border-bottom-normal">
                <div className="sm-flex justify-space-between height-percent-100 unit-text padding-horizontal-16">
                    <Anchor
                        className={classNames('padding-horizontal-3', `${selectedStackId === LEFT_EXTRUDER ? 'border-bottom-black-3' : ''}`)}
                        onClick={() => selectStack(LEFT_EXTRUDER)}
                    >
                        <span className={classNames('font-size-middle line-height-32 display-inline', `${selectedStackId === LEFT_EXTRUDER ? 'font-weight-bold color-black-2' : 'font-weight-normal color-black-4'}`)}>
                            {i18n._('Left Extruder')}
                        </span>
                    </Anchor>
                    <Anchor
                        className={classNames('padding-horizontal-3', `${selectedStackId === RIGHT_EXTRUDER ? 'border-bottom-black-3' : ''}`)}
                        onClick={() => selectStack(RIGHT_EXTRUDER)}
                        disabled={!isDualExtruder(printingToolhead)}
                    >
                        <span className={classNames('font-size-middle line-height-32 display-inline', `${selectedStackId === RIGHT_EXTRUDER ? 'font-weight-bold color-black-2' : 'font-weight-normal color-black-4'}`)}>
                            {i18n._('Right Extruder')}
                        </span>
                    </Anchor>
                </div>
            </div>
            <div className="padding-top-16 padding-horizontal-16">
                {
                    presetOptionsObj && Object.keys(presetOptionsObj).map((presetCategory) => {
                        const expanded = includes(expandedPresetCategories, presetCategory);
                        return (
                            <li key={presetCategory}>
                                <Anchor onClick={() => togglePresetCategoryExpansion(presetCategory)}>
                                    <div className={classNames('width-percent-100')}>
                                        <SvgIcon
                                            name="DropdownOpen"
                                            type={['static']}
                                            className={classNames({ 'rotate270': !expanded })}
                                        />
                                        <span>{i18n._(presetOptionsObj[presetCategory].i18nCategory)}</span>
                                    </div>
                                </Anchor>
                                {
                                    presetOptionsObj[presetCategory].options && presetOptionsObj[presetCategory].options.map(option => {
                                        return (
                                            <Anchor
                                                key={option.definitionId}
                                                className={classNames({
                                                    'display-block': expanded,
                                                    'display-none': !expanded,
                                                })}
                                                onClick={() => selectPresetByPresetId(option.definitionId)}
                                            >
                                                <div className={`border-radius-4 height-32 padding-horizontal-24 ${selectedPresetId === option.definitionId ? 'background-color-blue' : ''}`}>{option.label}</div>
                                            </Anchor>
                                        );
                                    })
                                }
                            </li>
                        );
                    })
                }
            </div>
        </div>
    );
};

StackPresetSelector.propTypes = {
    selectedStackId: PropTypes.string.isRequired,
    selectedPresetId: PropTypes.string.isRequired,
    onSelectStack: PropTypes.func.isRequired,
    onSelectPreset: PropTypes.func.isRequired
};

export default StackPresetSelector;
