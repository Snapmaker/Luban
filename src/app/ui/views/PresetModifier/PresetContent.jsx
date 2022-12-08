import classNames from 'classnames';
import i18next from 'i18next';
import { cloneDeep } from 'lodash';
import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useDispatch, useSelector } from 'react-redux';

import api from '../../../api';
import { LEFT_EXTRUDER, PRINTING_MANAGER_TYPE_QUALITY } from '../../../constants';
import { getQualityPresetLevelForRightExtruder } from '../../../constants/preset';
import i18n from '../../../lib/i18n';
import SvgIcon from '../../components/SvgIcon';

import { actions as printingActions } from '../../../flux/printing';
import SettingItem from './SettingItem';
import styles from './styles.styl';


/**
 * Preset parameter modifier content.
 *
 * @param selectedStackId stack id
 * @param selectedPresetId preset id
 * @param selectedPresetDefaultValues default values for preset, TODO: refactor this
 */
const PresetContent = (
    {
        selectedStackId,
        selectedPresetId,
        selectedPresetDefaultValues,
    }
) => {
    const dispatch = useDispatch();
    const printingProfileLevel = useSelector((state) => state?.printing?.printingProfileLevel);

    const {
        qualityDefinitions,
        qualityDefinitionsRight,
    } = useSelector(state => state?.printing);

    const [presetModel, setPresetModel] = useState(null);

    const [optionConfigGroup, setOptionConfigGroup] = useState({});

    const [mdContent, setMdContent] = useState(null);
    const [imgPath, setImgPath] = useState('');

    // Update preset model
    useEffect(() => {
        const presetModels = selectedStackId === LEFT_EXTRUDER ? qualityDefinitions : qualityDefinitionsRight;
        const targetPresetModel = presetModels.find(p => p.definitionId === selectedPresetId);
        setPresetModel(targetPresetModel);

        if (selectedStackId === LEFT_EXTRUDER) {
            setOptionConfigGroup(printingProfileLevel);
        } else {
            const level = getQualityPresetLevelForRightExtruder();
            setOptionConfigGroup(level);
        }
    }, [selectedStackId, selectedPresetId]);

    function onChangePresetValue(key, value) {
        const newPresetModel = cloneDeep(presetModel);
        newPresetModel.settings[key].default_value = value;
        setPresetModel(newPresetModel);

        dispatch(
            printingActions.updateCurrentDefinition({
                direction: selectedStackId,
                definitionModel: newPresetModel,
                changedSettingArray: [[key, value]],
                managerDisplayType: PRINTING_MANAGER_TYPE_QUALITY,
            })
        );
    }

    /**
     * Get parameter docs.
     *
     * @param key
     * @param category
     */
    const getParameterDocs = async (key, category) => {
        try {
            const res = await api.getProfileDocs({
                lang: i18next.language,
                selectCategory: category,
                selectProfile: key
            });
            setMdContent(res.body?.content);
            setImgPath(res.body?.imagePath);
        } catch (e) {
            console.info(e);
            setMdContent('');
        }
    };

    /**
     * Render SettingItemList
     *
     * Check ConfigValueBox.jsx
     */
    function renderSettingItemList(
        {
            settings = {},
            renderList = [],
            isDefaultDefinition = true,
            onChangePresetSettings = () => {
            },
            managerType,
            officialDefinition,
            categoryKey,
            definitionCategory = '',
        }
    ) {
        return renderList && renderList.map((key) => {
            const hasDefaultValue = !!selectedPresetDefaultValues[key];
            if (!hasDefaultValue) {
                return null;
            }

            return (
                <div key={key} className={`margin-left-${(settings[key].zIndex - 1) * 16}`}>
                    <SettingItem
                        settings={settings}
                        definitionKey={key}
                        key={key}
                        isDefaultDefinition={isDefaultDefinition}
                        onChangePresetSettings={onChangePresetSettings}
                        defaultValue={{
                            value: selectedPresetDefaultValues[key].default_value
                        }}
                        styleSize="large"
                        managerType={managerType}
                        officialDefinition={officialDefinition}
                        onClick={() => getParameterDocs(key, categoryKey)}
                        categoryKey={categoryKey}
                        definitionCategory={definitionCategory}
                    />
                    {/* render child */
                        settings[key].childKey && renderSettingItemList({
                            settings,
                            renderList: settings[key].childKey,
                            isDefaultDefinition,
                            onChangePresetSettings,
                            managerType,
                            definitionCategory,
                            categoryKey,
                            officialDefinition,
                        })
                    }
                </div>
            );
        });
    }

    return (
        <div className="margin-horizontal-16 margin-vertical-16 height-all-minus-164 border-radius-16 flex-grow-1 width-all-minus-296">
            <div className="sm-flex sm-flex-direction-c height-percent-100">
                <div className="border-radius-top-16 border-bottom-normal sm-flex justify-space-between align-center padding-vertical-12 padding-horizontal-16 background-color-white">
                    <div>
                        {i18n._('Modifier parameters')}
                    </div>
                </div>
                <div className="position-relative background-color-white border-radius-bottom-16 height-percent-100 height-100-percent-minus-56">
                    {/* Display preset */
                        presetModel && (
                            <div className={classNames('sm-flex height-percent-100 overflow-x-auto margin-right-16', styles['manager-params-docs'])}>
                                <div
                                    className={classNames('width-percent-60 padding-16 overflow-y-auto')}
                                    style={{
                                        minWidth: '528px'
                                    }}
                                >
                                    {
                                        Object.keys(optionConfigGroup).map((category) => {
                                            return (
                                                <div key={category}>
                                                    <div className="border-bottom-normal padding-bottom-8 margin-vertical-16">
                                                        <SvgIcon
                                                            name="TitleSetting"
                                                            type={['static']}
                                                        />
                                                        <span className="margin-left-2">
                                                            {i18n._(`key-Definition/Catagory-${category}`)}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        {
                                                            renderSettingItemList({
                                                                settings: presetModel.settings,
                                                                renderList: optionConfigGroup[category],
                                                                isDefaultDefinition: presetModel.isRecommended,
                                                                onChangePresetSettings: onChangePresetValue,
                                                                managerType: PRINTING_MANAGER_TYPE_QUALITY,
                                                                officialDefinition: !!presetModel?.isDefault,
                                                                categoryKey: category,
                                                                definitionCategory: presetModel.category,
                                                            })
                                                        }
                                                    </div>
                                                </div>
                                            );
                                        })
                                    }
                                </div>
                                <div
                                    className={classNames(
                                        'width-percent-40 background-grey-3 height-perccent-100 overflow-y-auto',
                                        'margin-top-16 margin-left-16 margin-bottom-48 border-radius-16',
                                    )}
                                    style={{
                                        minWidth: '356px'
                                    }}
                                >
                                    <div className={classNames(styles['manager-params-docs-content'], 'padding-16 overflow-y-auto')}>
                                        <ReactMarkdown transformImageUri={(input) => (`atom:///${imgPath}/${input.slice(3)}`)}>
                                            {mdContent}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        )
                    }
                </div>
            </div>
        </div>
    );
};

PresetContent.propTypes = {
    selectedStackId: PropTypes.string.isRequired,
    selectedPresetId: PropTypes.string.isRequired,
    selectedPresetDefaultValues: PropTypes.object.isRequired,
};

export default PresetContent;
