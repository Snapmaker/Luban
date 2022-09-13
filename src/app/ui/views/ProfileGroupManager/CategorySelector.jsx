import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { find, includes, remove } from 'lodash';
import i18n from '../../../lib/i18n';
import Anchor from '../../components/Anchor';
import { DUAL_EXTRUDER_TOOLHEAD_FOR_SM2, LEFT_EXTRUDER, RIGHT_EXTRUDER, WHITE_COLOR } from '../../../constants';
import SvgIcon from '../../components/SvgIcon';
import PrimeTowerModel from '../../../models/PrimeTowerModel';
/* eslint-disable import/no-cycle */
import { getPresetOptions } from '../../utils/profileManager';

export const EXTRUDER_TAB = 'Extruder';
export const MODEL_TAB = 'Madel';

const CategorySelector = ({
    handleUpdateCallback,
    handleTabSelectedCallback,
    mode,
    handleUpdateDefinitionId
}) => {
    const [selectTab, setSelectTab] = useState(EXTRUDER_TAB);
    const [selectedExtruder, setSelectedExtruder] = useState(LEFT_EXTRUDER);
    const [selectedModelId, setSelectedModelId] = useState('');
    const [selectedDefinitionId, setSelectedDefinitionId] = useState('');
    const { toolHead: { printingToolhead } } = useSelector(state => state?.machine);
    const {
        defaultMaterialId, defaultMaterialIdRight,
        materialDefinitions, modelGroup,
        qualityDefinitions
    } = useSelector(state => state?.printing);
    const [presetOptionsObj, setPresetOptionsObj] = useState(null);
    const [categoryShow, setCategoryShow] = useState(['Default']);
    const leftExtruderMaterial = find(materialDefinitions, { definitionId: defaultMaterialId });
    const rightExtruderMaterial = find(materialDefinitions, { definitionId: defaultMaterialIdRight });
    useEffect(() => {
        if (modelGroup.models?.length) {
            for (const model of modelGroup.models) {
                if (!(model instanceof PrimeTowerModel)) {
                    setSelectedModelId(model.modelID);
                    handleUpdateCallback(MODEL_TAB, model.modelID);
                    break;
                }
            }
        }
    }, [modelGroup.models]);

    useEffect(() => {
        if (mode === 'update') {
            const temp = getPresetOptions(qualityDefinitions);
            setPresetOptionsObj(temp);
            const initCategory = 'Default';
            setCategoryShow([initCategory]);
            setSelectedDefinitionId(temp[initCategory].options[0].definitionId);
            handleUpdateDefinitionId(temp[initCategory].options[0].definitionId);
        }
    }, [mode]);

    const handleUpdateExtruderSelect = (value) => {
        setSelectedExtruder(value);
        handleUpdateCallback(EXTRUDER_TAB, value);
    };

    const handleTabSelected = (type) => {
        setSelectTab(type);
        handleTabSelectedCallback(type);
    };

    const updateCategoryShow = (category) => {
        const newArr = [...categoryShow];
        if (includes(categoryShow, category)) {
            remove(newArr, (item) => {
                return category === item;
            });
        } else {
            newArr.push(category);
        }
        setCategoryShow(newArr);
    };

    const updateSelectedDefinitionId = (definitionId) => {
        setSelectedDefinitionId(definitionId);
        handleUpdateDefinitionId(definitionId);
    };

    return (
        <>
            {mode === 'show' && (
                <div className="width-264 min-width-264 background-color-white height-percent-100">
                    <div className="height-60 border-bottom-normal">
                        <div className={classNames('unit-text padding-horizontal-40 sm-flex justify-space-between height-percent-100')}>
                            <Anchor onClick={() => handleTabSelected(EXTRUDER_TAB)} className={classNames('padding-horizontal-3', `${selectTab === EXTRUDER_TAB ? 'border-bottom-black-3' : ''}`)}>
                                <span className={classNames('font-size-big line-height-68 display-inline', `${selectTab === EXTRUDER_TAB ? 'font-weight-bold color-black-2' : 'font-weight-normal color-black-4'}`)}>{i18n._('key-Printing/Preview_Options-Extruder')}</span>
                            </Anchor>
                            <Anchor onClick={() => handleTabSelected(MODEL_TAB)} className={classNames('padding-horizontal-3', `${selectTab === MODEL_TAB ? 'border-bottom-black-3' : ''}`)}>
                                <span className={classNames('font-size-big line-height-68 display-inline', `${selectTab === MODEL_TAB ? 'font-weight-bold color-black-2' : 'font-weight-normal color-black-4'}`)}>{i18n._('key-Printing/LeftBar-Selected Models')}</span>
                            </Anchor>
                        </div>
                    </div>
                    <div>
                        {selectTab === EXTRUDER_TAB && (
                            <div className="padding-horizontal-16 padding-top-24">
                                {printingToolhead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2 ? (
                                    <div>
                                        <Anchor
                                            onClick={() => handleUpdateExtruderSelect(LEFT_EXTRUDER)}
                                            className={classNames('sm-flex align-center margin-bottom-8 height-only-32 border-radius-4', `${selectedExtruder === LEFT_EXTRUDER ? 'background-color-blue' : ''}`)}
                                        >
                                            {leftExtruderMaterial?.settings?.color.default_value === WHITE_COLOR ? (
                                                <img src="/resources/images/24x24/icon_extruder_white_24x24.svg" alt="" />
                                            ) : (
                                                <SvgIcon
                                                    name="Extruder"
                                                    color={leftExtruderMaterial?.settings?.color.default_value || '#545659'}
                                                    type={['static']}
                                                    size={24}
                                                />
                                            )}
                                            <div className="margin-left-4 line-height-24 width-all-minus-36 text-overflow-ellipsis">L: {i18n._(leftExtruderMaterial.i18nName || leftExtruderMaterial.name)}</div>
                                        </Anchor>
                                        <Anchor
                                            className={classNames('sm-flex align-center height-only-32 border-radius-4', `${selectedExtruder === RIGHT_EXTRUDER ? 'background-color-blue' : ''}`)}
                                            onClick={() => handleUpdateExtruderSelect(RIGHT_EXTRUDER)}
                                        >
                                            {rightExtruderMaterial?.settings?.color.default_value === WHITE_COLOR ? (
                                                <img src="/resources/images/24x24/icon_extruder_white_24x24.svg" alt="" />
                                            ) : (
                                                <SvgIcon
                                                    name="Extruder"
                                                    color={rightExtruderMaterial?.settings?.color.default_value || '#545659'}
                                                    type={['static']}
                                                    size={24}
                                                />
                                            )}
                                            <div className="margin-left-4 line-height-24 width-all-minus-36 text-overflow-ellipsis">R: {i18n._(rightExtruderMaterial.i18nName || rightExtruderMaterial.name)}</div>
                                        </Anchor>
                                    </div>
                                ) : (
                                    <div className="background-color-blue height-only-32 sm-flex align-center">
                                        {leftExtruderMaterial?.settings?.color.default_value === WHITE_COLOR ? (
                                            <img src="/resources/images/24x24/icon_extruder_white_24x24.svg" alt="" />
                                        ) : (
                                            <SvgIcon
                                                name="Extruder"
                                                color={leftExtruderMaterial?.settings?.color.default_value || '#545659'}
                                                type={['static']}
                                                size={24}
                                            />
                                        )}
                                        <div className="margin-left-4 line-height-24 width-all-minus-36 text-overflow-ellipsis">
                                            {i18n._(leftExtruderMaterial.i18nName || leftExtruderMaterial.name)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {selectTab === MODEL_TAB && (
                            <div className="padding-horizontal-16 padding-top-24">
                                {modelGroup.models.map((model) => {
                                    if (!(model instanceof PrimeTowerModel)) {
                                        return (
                                            <Anchor
                                                className={classNames(
                                                    'height-only-32 sm-flex align-center border-radius-4 padding-horizontal-4 margin-bottom-8',
                                                    `${selectedModelId === model.modelID ? 'background-color-blue' : ''}`
                                                )}
                                                onClick={() => {
                                                    setSelectedModelId(model.modelID);
                                                    handleUpdateCallback(MODEL_TAB, model.modelID);
                                                }}
                                            >
                                                <SvgIcon
                                                    name="ObjectList3d"
                                                    size={24}
                                                    type={['static']}
                                                />
                                                <span className="display-inline line-height-24 margin-left-8 width-all-minus-36 text-overflow-ellipsis">{model.modelName}</span>
                                            </Anchor>
                                        );
                                    } else {
                                        return null;
                                    }
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
            {mode === 'update' && (
                <div className="width-264 min-width-264 background-color-white height-percent-100 padding-top-24 padding-horizontal-16">
                    {presetOptionsObj && Object.keys(presetOptionsObj).map((key) => {
                        return (
                            <li key={key}>
                                <Anchor onClick={() => updateCategoryShow(key)}>
                                    <div className={classNames('width-percent-100')}>
                                        <SvgIcon
                                            name="DropdownOpen"
                                            type={['static']}
                                            className={`${includes(categoryShow, key) ? '' : 'rotate270'}`}
                                        />
                                        <span>{i18n._(presetOptionsObj[key].i18nCategory)}</span>
                                    </div>
                                </Anchor>
                                {presetOptionsObj[key].options && presetOptionsObj[key].options.map(option => {
                                    return (
                                        <Anchor
                                            key={option.definitionId}
                                            className={`${includes(categoryShow, key) ? 'display-block' : 'display-none'}`}
                                            onClick={() => updateSelectedDefinitionId(option.definitionId)}
                                        >
                                            <div className={`border-radius-4 height-32 padding-horizontal-24 ${selectedDefinitionId === option.definitionId ? 'background-color-blue' : ''}`}>{option.label}</div>
                                        </Anchor>
                                    );
                                })}
                            </li>
                        );
                    })}
                </div>
            )}
        </>

    );
};

CategorySelector.propTypes = {
    handleUpdateCallback: PropTypes.func.isRequired,
    handleTabSelectedCallback: PropTypes.func.isRequired,
    mode: PropTypes.string.isRequired,
    handleUpdateDefinitionId: PropTypes.func.isRequired
};

export default CategorySelector;
