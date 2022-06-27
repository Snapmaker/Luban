import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import classNames from 'classnames';
import { cloneDeep, includes, isNil } from 'lodash';
// import { Segmented as OriginSegmented } from 'antd';
import Select from '../../components/Select';
import SvgIcon from '../../components/SvgIcon';
import Modal from '../../components/Modal';
import Anchor from '../../components/Anchor';
import { Button } from '../../components/Buttons';
import Segmented from '../../components/Segmented/index';
import i18n from '../../../lib/i18n';
import { actions as printingActions } from '../../../flux/printing';
import { actions as projectActions } from '../../../flux/project';
import { actions as machineActions } from '../../../flux/machine';

import {
    HEAD_PRINTING,
    PRINTING_MANAGER_TYPE_QUALITY,
    PRINTING_QUALITY_CONFIG_INDEX,
    PRINTING_QUALITY_CUSTOMIZE_FIELDS,
    PRINTING_QUALITY_CONFIG_GROUP_DUAL,
    PRINTING_QUALITY_CONFIG_GROUP_SINGLE,
    SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2
} from '../../../constants';
import SettingItem from '../../views/ProfileManager/SettingItem';
import ConfigValueBox from '../../views/ProfileManager/ConfigValueBox';
import styles from './styles.styl';
import { getSelectOptions, getPresetOptions } from '../../utils/profileManager';

const newKeys = cloneDeep(PRINTING_QUALITY_CONFIG_INDEX);
const PRESET_DISPLAY_TYPES = ['Recommended', 'Customized'];
const PRESET_DISPLAY_TYPES_OPTIONS = PRESET_DISPLAY_TYPES.map((item) => {
    return { value: item, label: item };
});
const CONFIG_DISPLAY_TYPES = ['Recommended', 'Customized'];
const CONFIG_DISPLAY_TYPES_OPTIONS = CONFIG_DISPLAY_TYPES.map((item) => {
    return { value: item, label: item };
});
function isOfficialDefinitionKey(key) {
    return includes(cloneDeep(PRINTING_QUALITY_CUSTOMIZE_FIELDS), key);
}
function calculateTextIndex(key) {
    return `${newKeys[key] * 20}px`;
}

function ParamItem({ selectedDefinitionModel, allParams }) {
    const selectedDefinitionSettings = selectedDefinitionModel.settings;
    const dispatch = useDispatch();

    async function onChangeParam(newValue, paramSetting) {
        const actualOptions = paramSetting.affectByType ? paramSetting[selectedDefinitionModel.typeOfPrinting] : paramSetting.options;
        const findedAffect = actualOptions[newValue]?.affect;
        Object.entries(findedAffect).forEach(([affectKey, affectValue]) => {
            selectedDefinitionModel.settings[
                affectKey
            ].default_value = affectValue;
        });
        await dispatch(
            printingActions.updateCurrentDefinition(
                selectedDefinitionModel,
                PRINTING_MANAGER_TYPE_QUALITY
            )
        );
        dispatch(printingActions.destroyGcodeLine());
        dispatch(printingActions.displayModel());
    }
    return (
        <div>
            {Object.entries(allParams).map(([paramName, paramSetting]) => {
                const actualOptions = paramSetting.affectByType ? paramSetting[selectedDefinitionModel.typeOfPrinting] : paramSetting.options;
                const allParamsName = [];
                let SegmentedValue = null;
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
                    SegmentedValue = paramSetting.current_value;
                }
                const eachParamObject = selectedDefinitionSettings[paramName];
                return (
                    <div key={paramName} className="margin-vertical-16">
                        <div className="height-24 margin-bottom-4">
                            <SvgIcon
                                className="border-default-black-5 margin-right-8"
                                name="PrintingSettingNormal"
                                type={['static']}
                                size={24}
                                disabled
                            />
                            <span className="color-black-3">
                                {i18n._(eachParamObject?.label)}
                            </span>
                            <span className="float-r color-black-3">
                                {eachParamObject?.default_value}
                            </span>
                        </div>
                        <Segmented
                            options={options}
                            value={SegmentedValue}
                            onChange={(value) => { onChangeParam(value, paramSetting); }}
                        />
                    </div>
                );
            })}
        </div>
    );
}
ParamItem.propTypes = {
    selectedDefinitionModel: PropTypes.object,
    allParams: PropTypes.object
};

function Configurations() {
    const [selectedDefinition, setSelectedDefinition] = useState(null);
    const [minimized, setMinimized] = useState(false);
    const [showCustomConfigPannel, setShowCustomConfigPannel] = useState(false);
    const [presetDisplayType, setPresetDisplayType] = useState(PRESET_DISPLAY_TYPES[0]);
    const [configDisplayType, setConfigDisplayType] = useState(CONFIG_DISPLAY_TYPES[1]);
    const defaultQualityId = useSelector((state) => state?.printing?.defaultQualityId);
    const qualityDefinitionModels = useSelector((state) => state?.printing?.qualityDefinitions);

    let printingCustomConfigs = useSelector(
        (state) => state?.machine?.printingCustomConfigs
    );
    const toolHead = useSelector((state) => state?.machine?.toolHead);
    const [
        selectedSettingDefaultValue,
        setSelectedSettingDefaultValue
    ] = useState(null);
    const printingQualityConfigGroup = toolHead.printingToolhead === SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2
        ? PRINTING_QUALITY_CONFIG_GROUP_SINGLE
        : PRINTING_QUALITY_CONFIG_GROUP_DUAL;
    const dispatch = useDispatch();

    const actions = {
        onShowMaterialManager: () => {
            dispatch(
                printingActions.updateManagerDisplayType(
                    PRINTING_MANAGER_TYPE_QUALITY
                )
            );
            dispatch(printingActions.updateShowPrintingManager(true));
        },
        onChangeSelectedDefinition: (definition) => {
            if (definition) {
                setSelectedSettingDefaultValue(
                    dispatch(
                        printingActions.getDefaultDefinition(
                            definition.definitionId
                        )
                    )
                );
                setSelectedDefinition(definition);
            }
        },
        toggleShowCustomConfigPannel: () => {
            setShowCustomConfigPannel(!showCustomConfigPannel);
        },
        closePannel: () => {
            setShowCustomConfigPannel(false);
        },
        displayModel: () => {
            dispatch(printingActions.destroyGcodeLine());
            dispatch(printingActions.displayModel());
        },

        onChangeDefinition: async (definitionKey, value) => {
            if (isNil(value)) {
                // if 'value' does't exit, then reset this value
                value = dispatch(
                    printingActions.getDefaultDefinition(
                        selectedDefinition.definitionId
                    )
                )[definitionKey].default_value;
            }
            const newDefinitionForManager = selectedDefinition;
            newDefinitionForManager.settings[
                definitionKey
            ].default_value = value;
            const shouldUpdateIsOversteped = definitionKey === 'prime_tower_enable' && value === true;

            await dispatch(
                printingActions.updateCurrentDefinition(
                    newDefinitionForManager,
                    PRINTING_MANAGER_TYPE_QUALITY,
                    undefined,
                    shouldUpdateIsOversteped
                )
            );

            // actions.onChangeSelectedDefinition(newDefinitionForManager);
            actions.displayModel();
        },
        /**
         * Select `definition`.
         *
         * @param definition
         */
        onSelectOfficialDefinition: (definition, shouldSaveEnv = true) => {
            actions.onChangeSelectedDefinition(definition);
            dispatch(printingActions.updateDefaultQualityId(definition.definitionId));
            shouldSaveEnv && dispatch(projectActions.autoSaveEnvironment(HEAD_PRINTING));
        },
        onSelectCustomDefinitionById: (definitionId) => {
            const definition = qualityDefinitionModels.find(d => d.definitionId === definitionId);
            actions.onSelectOfficialDefinition(definition);
            actions.displayModel();
        }
    };

    const onChangeCustomConfig = useCallback((key, value) => {
        if (value && !includes(printingCustomConfigs, key)) {
            printingCustomConfigs.push(key);
            printingCustomConfigs = [...printingCustomConfigs];
        } else if (!value) {
            printingCustomConfigs = printingCustomConfigs.filter(
                (a) => a !== key
            );
        }
        dispatch(
            machineActions.updatePrintingCustomConfigs(printingCustomConfigs)
        );
    }, []);

    useEffect(() => {
        // re-select definition based on new properties

        if (qualityDefinitionModels.length > 0) {
            const definition = qualityDefinitionModels.find(
                (d) => d.definitionId === defaultQualityId
            );
            if (!definition) {
                // definition no found, select first official definition
                actions.onSelectOfficialDefinition(qualityDefinitionModels[0], false);
            } else {
                actions.onSelectOfficialDefinition(definition, false);
            }
        }
    }, [defaultQualityId, qualityDefinitionModels]);

    if (!selectedDefinition) {
        return null;
    }
    const toolDefinitionOptions = getSelectOptions(qualityDefinitionModels);
    const { recommendedOptions, customizedOptions } = getPresetOptions(qualityDefinitionModels);
    console.log('toolDefinitionOptions', toolDefinitionOptions, configDisplayType);
    return (
        <div>
            <div
                className={classNames(
                    'margin-top-16'
                )}
            >
                <Select
                    clearable={false}
                    size="328px"
                    options={PRESET_DISPLAY_TYPES_OPTIONS}
                    value={presetDisplayType}
                    onChange={(options) => {
                        setPresetDisplayType(options.value);
                    }}
                />
                {presetDisplayType === PRESET_DISPLAY_TYPES[0] && (
                    <div className={classNames(styles['preset-recommended'], 'sm-flex', 'margin-vertical-16', 'align-c', 'justify-space-between')}>
                        {recommendedOptions.map((optionItem) => {
                            return (
                                <div
                                    key={optionItem.typeOfPrinting}
                                    className={classNames(
                                        selectedDefinition.typeOfPrinting === optionItem.typeOfPrinting ? styles.selected : styles.unselected,
                                    )}
                                >
                                    <Anchor
                                        onClick={() => actions.onSelectCustomDefinitionById(optionItem.definitionId)}
                                    >
                                        <i className={styles[`preset-recommended__icon-${optionItem.typeOfPrinting}`]} />
                                    </Anchor>
                                    <span className="max-width-76 text-overflow-ellipsis-line-2 height-16 margin-top-4 margin-bottom-8">
                                        {i18n._(`key-Printing/PrintingConfigurations-${optionItem.typeOfPrinting}`)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
                {presetDisplayType === PRESET_DISPLAY_TYPES[1] && (
                    <div className={classNames(styles['preset-customized'], 'margin-top-8')}>
                        {customizedOptions.map((optionItem) => {
                            return (
                                <div
                                    key={optionItem.i18nName}
                                    className={classNames(
                                        optionItem.definitionId === selectedDefinition.definitionId ? styles.selected : null,
                                        'border-radius-4',
                                    )}
                                >
                                    <Anchor
                                        className={classNames(
                                            styles['preset-item'],
                                            'height-32',
                                            'display-block',
                                            'padding-left-8',
                                            'border-radius-4',
                                        )}
                                        onClick={() => actions.onSelectCustomDefinitionById(optionItem.definitionId)}
                                    >
                                        <span>
                                            {i18n._(optionItem.i18nName)}
                                        </span>
                                        <SvgIcon
                                            className={classNames(
                                                styles['preset-hover'],
                                                'float-right'
                                            )}
                                            size={24}
                                            name="PrintingSettingNormal"
                                        />
                                    </Anchor>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <div className={classNames(
                styles['divided-line'],
                'background-grey-1',
                minimized ? styles['opacity-1'] : styles['opacity-0']
            )}
            />
            <div className={classNames(styles['printing-settings-wrapper'], 'background-grey-1', 'margin-bottom-16')}>
                <div className={classNames(styles['printing-settings'], 'height-32', 'background-color-white', 'padding-horizontal-24')}>
                    <span className={classNames(styles['printing-settings-text'], 'align-c')}>
                        {i18n._('key-Printing/PrintingConfigurations-Printing Settings')}
                    </span>
                    <SvgIcon
                        title={minimized ? i18n._('key-Widget/CommonDropdownButton-Expand') : i18n._('key-Widget/CommonDropdownButton-Collapse')}
                        onClick={() => setMinimized(!minimized)}
                        name="DropdownLine"
                        size={24}
                        type={['static']}
                        className={classNames(
                            !minimized ? '' : 'rotate180'
                        )}
                    />
                </div>
            </div>
            {!minimized && (
                <div
                    className={classNames(
                        'sm-flex',
                        'margin-bottom-16',
                        'margin-top-negative-16'
                    )}
                >
                    <div
                        className={classNames(
                            'border-default-grey-1',
                            'border-radius-8',
                            'padding-bottom-16',
                            'padding-top-24',
                            'width-328',
                            'padding-horizontal-16',
                            // 'clearfix'
                        )}
                    >
                        <div className="margin-bottom-16 height-32 sm-flex justify-space-between">
                            <div className="display-inline-block">
                                <span className="color-black-5 margin-right-8">
                                    {i18n._(
                                        'key-Printing/PrintingConfigurations-Parameter Display'
                                    )}:
                                </span>
                                <Select
                                    clearable={false}
                                    style={{ border: 'none' }}
                                    size="100px"
                                    disableBorder
                                    options={CONFIG_DISPLAY_TYPES_OPTIONS}
                                    value={configDisplayType}
                                    onChange={(options) => {
                                        setConfigDisplayType(options.value);
                                    }}
                                />
                            </div>
                            {configDisplayType === CONFIG_DISPLAY_TYPES[1] && (
                                <SvgIcon
                                    name="Manage"
                                    size={24}
                                    onClick={actions.toggleShowCustomConfigPannel}
                                />
                            )}
                        </div>
                        {configDisplayType === CONFIG_DISPLAY_TYPES[0] && (
                            <div>
                                <ParamItem
                                    selectedDefinitionModel={selectedDefinition}
                                    allParams={selectedDefinition.params}
                                />
                            </div>
                        )}
                        {configDisplayType === CONFIG_DISPLAY_TYPES[1] && (
                            <div className="overflow-y-auto height-max-400">
                                {printingCustomConfigs.map((key) => {
                                    return (
                                        <SettingItem
                                            styleSize="middle"
                                            settings={selectedDefinition?.settings}
                                            definitionKey={key}
                                            key={key}
                                            onChangeDefinition={actions.onChangeDefinition}
                                            isDefaultDefinition={
                                                selectedDefinition.isRecommended
                                            }
                                            defaultValue={{
                                                value:
                                                selectedSettingDefaultValue
                                                && selectedSettingDefaultValue[key]
                                                    .default_value
                                            }}
                                        />
                                    );
                                })}
                                {showCustomConfigPannel && (
                                    <Modal
                                        className={classNames(styles['manager-body'])}
                                        style={{ minWidth: '700px' }}
                                        onClose={actions.closePannel}
                                    >
                                        <Modal.Header>
                                            {i18n._(
                                                'key-Printing/PrintingConfigurations-Custom Parameter Visibility'
                                            )}
                                        </Modal.Header>
                                        <Modal.Body>
                                            <div className={classNames(styles['manager-content'])}>
                                                <ConfigValueBox
                                                    calculateTextIndex={calculateTextIndex}
                                                    customConfigs={printingCustomConfigs}
                                                    definitionForManager={selectedDefinition}
                                                    optionConfigGroup={printingQualityConfigGroup}
                                                    isOfficialDefinitionKey={
                                                        isOfficialDefinitionKey
                                                    }
                                                    type="checkbox"
                                                    onChangeDefinition={onChangeCustomConfig}
                                                    onResetDefinition={actions.onChangeDefinition}
                                                    showMiddle
                                                />
                                            </div>
                                        </Modal.Body>
                                        <Modal.Footer>
                                            <Button
                                                onClick={actions.closePannel}
                                                type="default"
                                                width="96px"
                                                priority="level-two"
                                            >
                                                {i18n._(
                                                    'key-Printing/PrintingConfigurations-Close'
                                                )}
                                            </Button>
                                        </Modal.Footer>
                                    </Modal>
                                )}
                            </div>
                        )}
                        <Anchor
                            className={classNames(
                                'link-text',
                                'float-r'
                            )}
                            onClick={actions.onShowMaterialManager}
                        >
                            {i18n._('key-unused-More Parameters >')}
                        </Anchor>
                    </div>

                </div>
            )}
        </div>
    );
}
Configurations.propTypes = {
    // widgetActions: PropTypes.object
};
export default Configurations;
