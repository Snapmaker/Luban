import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { cloneDeep, find, includes, remove } from 'lodash';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import i18next from 'i18next';
import ReactMarkdown from 'react-markdown';

import { actions as printingActions } from '../../../flux/printing';
import i18n from '../../../lib/i18n';
import { Button } from '../../components/Buttons';
import Anchor from '../../components/Anchor';
import EmptyBox from './EmptyBox';
import CheckboxItem from '../ProfileManager/CheckboxItem';
import styles from '../ProfileManager/styles.styl';
import api from '../../../api';
import SettingItem from '../ProfileManager/SettingItem';
import { LEFT_EXTRUDER } from '../../../constants';
import { resolveDefinition } from '../../../../shared/lib/definitionResolver';


/**
 *
 * @param selectedExtruder
 * @param mode "show" or "update"
 * @param setMode
 * @param printingDefinitionId
 * @param selectedSettingsDefaultValue
 * @returns {*}
 */
const Content = ({
    selectedExtruder,
    mode,
    setMode,
    printingDefinitionId,
    selectedSettingsDefaultValue
}) => {
    const {
        definitionEditorForExtruder,
        qualityDefinitions,
        qualityDefinitionsRight,
        editorDefinition
    } = useSelector(state => state?.printing);

    const [extruderEditor, setExtruderEditor] = useState(definitionEditorForExtruder.get(selectedExtruder));
    const [definitionManager, setDefinitionManager] = useState(null);
    const [categoryGroup, setCategoryGroup] = useState(null);
    const [checkedParams, setCheckedParams] = useState({});
    const [mdContent, setMdContent] = useState(null);
    const [imgPath, setImgPath] = useState('');
    const dispatch = useDispatch();
    const lang = i18next.language;

    const canUpdateEditor = mode === 'show' && extruderEditor;

    useEffect(() => {
        const editor = definitionEditorForExtruder.get(selectedExtruder);
        setExtruderEditor(editor);
        setCheckedParams(editor ? { ...editor } : {});

        editorDefinition.get(selectedExtruder) && setDefinitionManager(editorDefinition.get(selectedExtruder));
    }, [selectedExtruder, definitionEditorForExtruder.size, editorDefinition]);

    useEffect(() => {
        if (mode === 'show') {
            setExtruderEditor(definitionEditorForExtruder.get(selectedExtruder));
        }
        setMdContent(null);
    }, [mode]);

    useEffect(() => {
        const temp = editorDefinition.get(selectedExtruder) || find(
            selectedExtruder === LEFT_EXTRUDER ? qualityDefinitions : qualityDefinitionsRight, { definitionId: printingDefinitionId }
        );
        setDefinitionManager(temp);
        setCategoryGroup(temp?.printingProfileLevelForExtruder);
    }, [printingDefinitionId, qualityDefinitions, qualityDefinitionsRight, selectedExtruder, editorDefinition]);

    const handleUpdateSelectedParams = (key, value, category) => {
        const temp = { ...checkedParams };
        if (temp[category]) {
            if (value) {
                !includes(temp[category], key) && temp[category].push(key);
            } else {
                remove(temp[category], (item) => {
                    return item === key;
                });
            }
        } else {
            temp[category] = [];
            value && temp[category].push(key);
        }
        setCheckedParams(temp);
    };

    const getMarkdown = async (key, category) => {
        try {
            const res = await api.getProfileDocs({ lang, selectCategory: category, selectProfile: key });
            setMdContent(res.body?.content);
            setImgPath(res.body?.imagePath);
        } catch (e) {
            console.info(e);
            setMdContent('');
        }
    };

    const handleConfirm = () => {
        definitionEditorForExtruder.set(selectedExtruder, checkedParams);
        editorDefinition.set(selectedExtruder, { ...definitionManager });
        setMode('show');
    };

    const handleClearEditor = () => {
        definitionEditorForExtruder.delete(selectedExtruder);
        setExtruderEditor(null);
        setCheckedParams({});
    };

    const handleUpdateDefinition = (key, value) => {
        const selected = selectedExtruder;
        const newDefinition = cloneDeep(editorDefinition.get(selected));
        resolveDefinition(newDefinition, [[key, value]]);
        const newMap = new Map([...editorDefinition.entries()]);
        newMap.set(selected, newDefinition);
        dispatch(printingActions.updateState({
            editorDefinition: newMap
        }));
    };

    const renderCheckboxList = ({
        renderList,
        settings,
        mainCategory
    }) => {
        return renderList && renderList.map((profileKey) => {
            if (settings[profileKey].childKey?.length > 0) {
                return (
                    <div key={profileKey} className={`margin-left-${(settings[profileKey].zIndex - 1) * 16}`}>
                        <Anchor onClick={() => getMarkdown(profileKey, mainCategory)}>
                            <CheckboxItem
                                settings={settings}
                                defaultValue={includes(checkedParams[mainCategory], profileKey)}
                                definitionKey={profileKey}
                                key={profileKey}
                                configCategory={mainCategory}
                                onChangePresetSettings={handleUpdateSelectedParams}
                            />
                        </Anchor>
                        {renderCheckboxList({
                            renderList: settings[profileKey].childKey,
                            settings,
                            mainCategory
                        })}
                    </div>
                );
            } else {
                return (
                    <div key={profileKey} className={`margin-left-${(settings[profileKey].zIndex < 3 ? settings[profileKey].zIndex - 1 : 1) * 16}`}>
                        <Anchor onClick={() => getMarkdown(profileKey, mainCategory)}>
                            <CheckboxItem
                                settings={settings}
                                defaultValue={includes(checkedParams[mainCategory], profileKey)}
                                definitionKey={profileKey}
                                key={profileKey}
                                configCategory={mainCategory}
                                onChangePresetSettings={handleUpdateSelectedParams}
                            />
                        </Anchor>
                    </div>
                );
            }
        });
    };

    const currentEditor = extruderEditor;

    return (
        <div className="margin-horizontal-16 margin-vertical-16 height-all-minus-164 border-radius-16 flex-grow-1 width-all-minus-296">
            <div className="sm-flex sm-flex-direction-c height-percent-100">
                <div className="border-radius-top-16 border-bottom-normal sm-flex justify-space-between align-center padding-vertical-12 padding-horizontal-16 background-color-white">
                    <div>
                        {i18n._('Modifier parameters')}
                    </div>
                    <div>
                        <Button
                            width="120px"
                            priority="level-three"
                            disabled={!canUpdateEditor}
                            className={mode !== 'update' ? 'visibility-visible' : 'visibility-hidden'}
                            onClick={() => setMode('update')}
                        >
                            {i18n._('Edit')}
                        </Button>
                        {
                            canUpdateEditor && (
                                <Button
                                    width="120px"
                                    priority="level-three"
                                    className="margin-left-12"
                                    onClick={handleClearEditor}
                                >
                                    {i18n._('Delete')}
                                </Button>
                            )
                        }
                    </div>
                </div>
                {
                    mode === 'show' && (
                        <div className="position-relative background-color-white border-radius-bottom-16 height-percent-100 height-100-percent-minus-56">
                            {
                                (!extruderEditor) && (
                                    <EmptyBox
                                        tipContent={i18n._('No modifier(s).')}
                                        addButton
                                        setMode={setMode}
                                    />
                                )
                            }
                            {/* Display editor */
                                currentEditor && definitionManager && (
                                    <div className={classNames('sm-flex height-percent-100 overflow-x-auto margin-right-16', styles['manager-params-docs'])}>
                                        <div
                                            className={classNames('width-percent-60 padding-16 overflow-y-auto')}
                                            style={{
                                                minWidth: '528px'
                                            }}
                                        >
                                            {
                                                Object.keys(currentEditor).map(objectKey => {
                                                    return (
                                                        <div key={objectKey} className="margin-bottom-16">
                                                            <div className="font-size-middle font-weight-bold height-32">
                                                                {i18n._(`key-Definition/Catagory-${objectKey}`)}
                                                            </div>
                                                            {currentEditor[objectKey].map(profileKey => {
                                                                return (
                                                                    <SettingItem
                                                                        settings={definitionManager?.settings}
                                                                        definitionKey={profileKey}
                                                                        key={profileKey}
                                                                        isDefaultDefinition={definitionManager?.isRecommended}
                                                                        defaultValue={{
                                                                            value: selectedSettingsDefaultValue[profileKey]?.default_value
                                                                        }}
                                                                        onChangePresetSettings={handleUpdateDefinition}
                                                                        onClick={() => getMarkdown(profileKey, objectKey)}
                                                                    />
                                                                );
                                                            })}
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
                    )
                }
                {
                    mode === 'update' && (
                        <div className="sm-flex sm-flex-direction-c height-percent-100">
                            <div className={classNames('background-color-white border-radius-bottom-16 sm-flex  height-100-percent-minus-40', styles['manager-params-docs'])}>
                                <div className="category-menu max-width-208 padding-horizontal-16 padding-top-16 border-right-normal height-percent-100">
                                    {categoryGroup && Object.keys(categoryGroup).map((key) => {
                                        if (categoryGroup[key].length > 0) {
                                            return (
                                                <Anchor key={key}>
                                                    <div className="width-percent-100 text-overflow-ellipsis height-32">
                                                        {i18n._(`key-Definition/Catagory-${key}`)}
                                                    </div>
                                                </Anchor>
                                            );
                                        } else {
                                            return null;
                                        }
                                    })}
                                </div>
                                <div className={classNames('params-detail-wrapper', 'width-percent-100 sm-flex margin-right-16 overflow-x-auto')}>
                                    <div
                                        className="width-percent-60 padding-16 height-percent-100 overflow-y-auto"
                                        style={{
                                            minWidth: '408px'
                                        }}
                                    >
                                        {categoryGroup && Object.keys(categoryGroup).map(key => {
                                            if (categoryGroup[key].length > 0) {
                                                return (
                                                    <div key={key} className="margin-bottom-16">
                                                        <div className="font-size-middle font-weight-bold">
                                                            {i18n._(`key-Definition/Catagory-${key}`)}
                                                        </div>
                                                        {
                                                            renderCheckboxList({
                                                                renderList: categoryGroup[key],
                                                                settings: definitionManager.settings,
                                                                mainCategory: key
                                                            })
                                                        }
                                                    </div>
                                                );
                                            } else {
                                                return null;
                                            }
                                        })}
                                    </div>
                                    <div
                                        className={classNames(
                                            'width-percent-40 background-grey-3 height-perccent-100 overflow-y-auto',
                                            'margin-top-16 margin-left-16 margin-bottom-48 border-radius-16',
                                        )}
                                        style={{
                                            minWidth: '264px'
                                        }}
                                    >
                                        <div className={classNames(styles['manager-params-docs-content'], 'padding-16 overflow-y-auto')}>
                                            <ReactMarkdown transformImageUri={(input) => (`atom:///${imgPath}/${input.slice(3)}`)}>
                                                {mdContent}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="background-transparent padding-top-8 sm-flex justify-flex-end height-40-only">
                                <Button
                                    width="96px"
                                    type="default"
                                    priority="level-two"
                                    onClick={() => setMode('show')}
                                >
                                    {i18n._('key-Modal/Common-Cancel')}
                                </Button>
                                <Button
                                    width="96px"
                                    type="primary"
                                    priority="level-two"
                                    className="margin-left-8"
                                    onClick={handleConfirm}
                                >
                                    {i18n._('key-Modal/Common-Yes')}
                                </Button>
                            </div>
                        </div>
                    )
                }
            </div>
        </div>
    );
};

Content.propTypes = {
    selectedExtruder: PropTypes.string.isRequired,
    mode: PropTypes.string.isRequired,
    setMode: PropTypes.func.isRequired,
    printingDefinitionId: PropTypes.string.isRequired,
    selectedSettingsDefaultValue: PropTypes.object.isRequired
};

export default Content;
