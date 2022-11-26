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
/* eslint-disable import/no-cycle */
import { getPresetOptions } from '../../utils/profileManager';

/**
 * Stack and preset selector.
 *
 * Select a stack, and then select a preset for it.
 *
 * @param onSelectStack
 * @param handleUpdateDefinitionId
 * @returns {*}
 * @constructor
 */
const StackPresetSelector = ({
    onSelectStack,
    handleUpdateDefinitionId
}) => {
    const { toolHead: { printingToolhead } } = useSelector(state => state?.machine);
    const {
        qualityDefinitions,
        qualityDefinitionsRight,
    } = useSelector(state => state?.printing);

    // selected stack ID (extruder)
    const [selectedStackId, setSelectedStackId] = useState(LEFT_EXTRUDER);
    const [presetOptionsObj, setPresetOptionsObj] = useState(null);
    const [selectedDefinitionId, setSelectedDefinitionId] = useState('');

    // expanded categories, only for displaying
    const [expandedPresetCategories, setExpandedPresetCategories] = useState([PRESET_CATEGORY_DEFAULT]);

    useEffect(() => {
        const presets = selectedStackId === LEFT_EXTRUDER ? qualityDefinitions : qualityDefinitionsRight;
        const presetOptions = getPresetOptions(presets);
        setPresetOptionsObj(presetOptions);

        // FIXME now
        const initCategory = PRESET_CATEGORY_DEFAULT;
        setExpandedPresetCategories([initCategory]);

        // FIXME now
        // select first option
        // setSelectedDefinitionId(presetOptions[initCategory].options[0].definitionId);
        // handleUpdateDefinitionId(presetOptions[initCategory].options[0].definitionId);
    }, [selectedStackId]);

    // stackId: LEFT_EXTRUDER or RIGHT_EXTRUDER
    // Maybe support a global stack later
    const handleStackSelected = (stackId) => {
        setSelectedStackId(stackId);
        onSelectStack(stackId);
    };

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

    const updateSelectedDefinitionId = (definitionId) => {
        setSelectedDefinitionId(definitionId);
        handleUpdateDefinitionId(definitionId);
    };

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
                        onClick={() => handleStackSelected(LEFT_EXTRUDER)}
                    >
                        <span className={classNames('font-size-middle line-height-32 display-inline', `${selectedStackId === LEFT_EXTRUDER ? 'font-weight-bold color-black-2' : 'font-weight-normal color-black-4'}`)}>
                            {i18n._('Left Extruder')}
                        </span>
                    </Anchor>
                    <Anchor
                        className={classNames('padding-horizontal-3', `${selectedStackId === RIGHT_EXTRUDER ? 'border-bottom-black-3' : ''}`)}
                        onClick={() => handleStackSelected(RIGHT_EXTRUDER)}
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
                                                onClick={() => updateSelectedDefinitionId(option.definitionId)}
                                            >
                                                <div className={`border-radius-4 height-32 padding-horizontal-24 ${selectedDefinitionId === option.definitionId ? 'background-color-blue' : ''}`}>{option.label}</div>
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
    onSelectStack: PropTypes.func.isRequired,
    handleUpdateDefinitionId: PropTypes.func.isRequired
};

export default StackPresetSelector;
