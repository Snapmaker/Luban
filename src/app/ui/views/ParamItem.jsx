import React from 'react';
import PropTypes from 'prop-types';
import { useDispatch } from 'react-redux';

import i18n from '../../lib/i18n';
import { actions as printingActions } from '../../flux/printing';
import { PRINTING_MANAGER_TYPE_QUALITY } from '../../constants';

import Select from '../components/Select';
import Tooltip from '../components/Tooltip';
import SvgIcon from '../components/SvgIcon';
import Segmented from '../components/Segmented/index';


const ALL_ICON_NAMES = {
    'layer_height': ['LayerHeightFine', 'LayerHeightMedium', 'LayerHeightRough'],
    'speed_print': ['SpeedSlow', 'SpeedMedium', 'SpeedFast'],
    'infill_sparse_density': ['ModelStructureThin', 'ModelStructureMedium', 'ModelStructureHard', 'ModelStructureVase'],
    'support_generate_type': ['SupportLine', 'SupportNone'],
    'adhesion_type': ['AdhesionSkirt', 'AdhesionBrim', 'AdhesionRaft']
};


const ParamItem = function ({ selectedDefinitionModel, onChangePresetSettings, setSelectedDefinition }) {
    const allParams = selectedDefinitionModel.params;
    const selectedDefinitionSettings = selectedDefinitionModel.settings;
    const dispatch = useDispatch();

    async function onChangeParam(newValue, paramSetting) {
        const actualOptions = paramSetting.affectByType ? paramSetting[selectedDefinitionModel.typeOfPrinting] : paramSetting.options;
        const findedAffect = actualOptions[newValue]?.affect;
        const changedSettingArray = [];
        Object.entries(findedAffect).forEach(([affectKey, affectValue]) => {
            selectedDefinitionModel.settings[
                affectKey
            ].default_value = affectValue;
            changedSettingArray.push([affectKey, affectValue]);
        });
        await dispatch(
            printingActions.updateCurrentDefinition({
                definitionModel: selectedDefinitionModel,
                managerDisplayType: PRINTING_MANAGER_TYPE_QUALITY,
                changedSettingArray
            })
        );
        setSelectedDefinition && setSelectedDefinition(selectedDefinitionModel);
        dispatch(printingActions.destroyGcodeLine());
        dispatch(printingActions.displayModel());
    }

    return (
        <div>
            {allParams && Object.entries(allParams).map(([paramName, paramSetting]) => {
                const actualOptions = paramSetting.affectByType ? paramSetting[selectedDefinitionModel.typeOfPrinting] : paramSetting.options;
                const allParamsName = [];
                let SegmentedValue = null;
                let iconName = '';
                const options = Object.entries(actualOptions).map(([keyName, keyValue]) => {
                    allParamsName.push(keyName);
                    return {
                        label: (
                            <span>{i18n._(keyValue.label)}</span>
                        ),
                        value: keyName
                    };
                });
                if (allParamsName.includes(paramSetting.current_value)) {
                    const index = allParamsName.findIndex((d) => d === paramSetting.current_value);
                    iconName = ALL_ICON_NAMES[paramName][index] || 'PrintingSettingNormal';
                    SegmentedValue = paramSetting.current_value;
                } else {
                    iconName = ALL_ICON_NAMES[paramName][1] || 'PrintingSettingNormal';
                }

                const eachParamObject = selectedDefinitionSettings[paramName];
                let displayName = eachParamObject?.label;
                let displayValue = eachParamObject?.default_value;
                let segmentedDisplay = true;
                let showSelect = false;
                const selectOptions = [];

                if (paramName === 'infill_sparse_density') {
                    const modelStructure = selectedDefinitionSettings.model_structure_type;
                    showSelect = true;
                    displayName = modelStructure?.label;
                    displayValue = modelStructure?.default_value;
                    if (displayValue !== 'normal') {
                        segmentedDisplay = false;
                        iconName = ALL_ICON_NAMES[paramName][3];
                    }
                    if (modelStructure?.options) {
                        Object.entries(modelStructure.options).forEach(([value, label]) => {
                            selectOptions.push({ value, label });
                        });
                    }
                }

                let descriptionDom = null;
                const allKeys = Object.keys(ALL_ICON_NAMES);
                switch (paramName) {
                    case allKeys[0]:
                        descriptionDom = (
                            <div className="padding-vertical-16 padding-horizontal-16">
                                <div className="font-weight-bold padding-bottom-16 border-bottom-white">
                                    {i18n._(`key-Luban/Preset/${displayName}`)}
                                </div>
                                <div className="sm-flex justify-space-between">
                                    <img src="/resources/images/3dp/layer-height-rough.png" alt="arrow" className="display-inline width-72 height-72" />
                                    <img src="/resources/images/3dp/layer-height-medium.png" alt="arrow" className="display-inline width-72 height-72" />
                                    <img src="/resources/images/3dp/layer-height-fine.png" alt="arrow" className="display-inline width-72 height-72" />
                                </div>
                                <img src="/resources/images/3dp/arrow.png" alt="arrow" className="display-block margin-vertical-8 width-288 height-12" />
                                <div className="font-size-small padding-top-16">
                                    {i18n._('key-Luban/Preset/The height of each layer of the model. Higher values produce faster prints in lower resolution, while lower values produce slower prints in higher resolution.')}
                                </div>
                            </div>
                        );
                        break;
                    case allKeys[1]:
                        descriptionDom = (
                            <div className="padding-vertical-16 padding-horizontal-16">
                                <div className="font-weight-bold padding-bottom-16 border-bottom-white">
                                    {i18n._(`key-Luban/Preset/${displayName}`)}
                                </div>
                                <div className="font-size-small padding-top-16">
                                    <div className="sm-flex justify-space-between font-weight-bold">
                                        <div>
                                            <div className="height-24">
                                                {i18n._('key-Luban/Preset/Printing Time')}
                                                <SvgIcon
                                                    size={24}
                                                    hoversize={24}
                                                    type={['static']}
                                                    name="TooltipsUp"
                                                    color="#FF3939"
                                                />
                                            </div>
                                            <div className="height-24">
                                                {i18n._('key-Luban/Preset/Printing Quality')}
                                                <SvgIcon
                                                    size={24}
                                                    hoversize={24}
                                                    type={['static']}
                                                    name="TooltipsUp"
                                                    color="#4CB518"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <div className="height-24">
                                                {i18n._('key-Luban/Preset/Printing Time')}
                                                <SvgIcon
                                                    size={24}
                                                    hoversize={24}
                                                    type={['static']}
                                                    name="TooltipsDown"
                                                    color="#4CB518"
                                                />
                                            </div>
                                            <div className="height-24">
                                                {i18n._('key-Luban/Preset/Printing Quality')}
                                                <SvgIcon
                                                    size={24}
                                                    hoversize={24}
                                                    type={['static']}
                                                    name="TooltipsDown"
                                                    color="#FF3939"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <img src="/resources/images/3dp/arrow.png" alt="arrow" className="display-block margin-vertical-8 width-288 height-12" />
                                    <div>
                                        {i18n._('key-Luban/Preset/The speed at which printing happens. Higher values decrease your printing time, at the cost of printing quality, while lower values increase the printing quality but require more time.')}
                                    </div>
                                </div>
                            </div>
                        );
                        break;
                    case allKeys[2]:
                        descriptionDom = (
                            <div className="padding-vertical-16 padding-horizontal-16">
                                <div className="font-weight-bold padding-bottom-16 border-bottom-white">
                                    {i18n._(`key-Luban/Preset/${displayName}`)}
                                </div>
                                <div className="font-size-small padding-top-16">
                                    <p className="font-weight-bold">{i18n._('key-Luban/Preset/Model Structure Type-Normal')}</p>
                                    <p className="margin-vertical-8">
                                        {i18n._('key-Luban/Preset/Prints all parts of the model integrally. The stronger the model is, the longer printing time it takes and more material it consumes. On the contrary, the thinner the model is, the shorter printing time it takes and less material it consumes.')}
                                    </p>
                                    <p className="font-weight-bold">{i18n._('key-Luban/Preset/Model Structure Type-Vase')}</p>
                                    <p className="margin-vertical-8">
                                        {i18n._('key-Luban/Preset/Prints only the bottom layer and the outer wall of the model. The structure of the print is similar to that of a vase, with a bottom and a wall, but with no infill or top cover.')}
                                    </p>
                                </div>
                            </div>

                        );
                        break;
                    case allKeys[3]:
                        descriptionDom = (
                            <div className="padding-vertical-16 padding-horizontal-16">
                                <div className="font-weight-bold padding-bottom-16 border-bottom-white">
                                    {i18n._(`key-Luban/Preset/${displayName}`)}
                                </div>
                                <div className="font-size-small padding-top-16">
                                    <p className="font-weight-bold">{i18n._('key-Luban/Preset/Support Type-Normal')}</p>
                                    <p className="margin-vertical-8">
                                        {i18n._('key-Luban/Preset/A vertical column generated directly below the overhanging parts of the model. It applies to most models.')}
                                    </p>
                                    <p className="font-weight-bold">{i18n._('key-Luban/Preset/Support Type-None')}</p>
                                    <p className="margin-vertical-8">
                                        {i18n._('key-Luban/Preset/No support is generated for the model. With this option selected, the overhanging parts of the model may collapse during printing.')}
                                    </p>
                                </div>
                            </div>

                        );
                        break;
                    case allKeys[4]:
                        descriptionDom = (
                            <div className="padding-vertical-16 padding-horizontal-16">
                                <div className="font-weight-bold padding-bottom-16 border-bottom-white">
                                    {i18n._(`key-Luban/Preset/${displayName}`)}
                                </div>
                                <div className="font-size-small padding-top-16">
                                    <p className="font-weight-bold">{i18n._('Skirt')}</p>
                                    <p className="margin-vertical-8">
                                        {i18n._('key-Luban/Preset/A single layer ring printed around the base of the model, not connected to the model. It can help prime the nozzle before the printing begins.')}
                                    </p>
                                    <p className="font-weight-bold">{i18n._('Brim')}</p>
                                    <p className="margin-vertical-8">
                                        {i18n._('key-Luban/Preset/A single layer of flat area around the base of the model, connected to the model. It can prevent the base of the model from warping.')}
                                    </p>
                                    <p className="font-weight-bold">{i18n._('Raft')}</p>
                                    <p className="margin-vertical-8">
                                        {i18n._('key-Luban/Preset/A multilayer flat area between the bottom of the model and the bulid plate. It produces the strongest adhesion between the print and the build plate.')}
                                    </p>
                                    <p>
                                        {i18n._('key-Luban/Preset/With stronger adhesion, the model is less likely to break away from the heated bed and warp, so the printing is more likely to success. However, a stronger adhesion will cost more printing time.')}
                                    </p>
                                </div>
                            </div>

                        );
                        break;
                    default:
                }
                return (
                    <Tooltip
                        title={descriptionDom}
                        trigger="hover"
                        key={paramName}
                        overlayInnerStyle={{ width: '350px', marginLeft: '-50%' }}
                        placement="leftBottom"
                    >
                        <div className="margin-vertical-16">
                            <div className="height-24 margin-bottom-4 sm-flex justify-space-between">
                                <div className="display-inline">
                                    <SvgIcon
                                        className="margin-right-8"
                                        name={iconName}
                                        type={['static']}
                                        size={24}
                                    />
                                    <span className="color-black-3">
                                        {i18n._(`key-Luban/Preset/${displayName}`)}
                                    </span>
                                </div>
                                {!showSelect && !(['Support Type', 'Build Plate Adhesion Type'].includes(displayName)) && (
                                    <span className="float-r color-black-3">
                                        {displayValue} {eachParamObject?.unit}
                                    </span>
                                )}
                                {showSelect && (
                                    <Select
                                        size="100px"
                                        bordered={false}
                                        options={selectOptions}
                                        value={displayValue}
                                        onChange={(item) => {
                                            onChangePresetSettings('model_structure_type', item.value);
                                        }}
                                    />
                                )}
                            </div>
                            {segmentedDisplay && (
                                <Segmented
                                    options={options}
                                    value={SegmentedValue}
                                    onChange={(value) => {
                                        onChangeParam(value, paramSetting);
                                    }}
                                />
                            )}
                        </div>
                    </Tooltip>
                );
            })}
        </div>
    );
};

ParamItem.propTypes = {
    selectedDefinitionModel: PropTypes.object,
    onChangePresetSettings: PropTypes.func,
    setSelectedDefinition: PropTypes.func,

};

export default ParamItem;
