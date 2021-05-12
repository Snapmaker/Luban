import React, { useEffect, useState, useRef } from 'react';
// import PropTypes from 'prop-types';
import { shallowEqual, useSelector, useDispatch } from 'react-redux';
import classNames from 'classnames';
import { includes } from 'lodash';
import SvgIcon from '../../components/SvgIcon';
import modal from '../../lib/modal';
import Select from '../../components/Select';
import Notifications from '../../components/Notifications';
import i18n from '../../lib/i18n';
import Modal from '../../components/Modal';
import Anchor from '../../components/Anchor';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import { actions as printingActions } from '../../flux/printing';
import { actions as projectActions } from '../../flux/project';
import styles from './styles.styl';
import { PRINTING_MANAGER_TYPE_QUALITY, PRINTING_MANAGER_TYPE_MATERIAL,
    PRINTING_MATERIAL_CONFIG_KEYS, PRINTING_QUALITY_CONFIG_KEYS,
    PRINTING_MATERIAL_CONFIG_GROUP, PRINTING_QUALITY_CONFIG_GROUP } from '../../constants';
import { limitStringLength } from '../../lib/normalize-range';
import useSetState from '../../rehooks/set-state';

// checkbox and select
const MATERIAL_CHECKBOX_AND_SELECT_KEY_ARRAY = [
    'machine_heated_bed'
];
const QUALITY_CHECKBOX_AND_SELECT_KEY_ARRAY = [
    'adhesion_type',
    'infill_pattern',
    'magic_mesh_surface_mode',
    'magic_spiralize',
    'outer_inset_first',
    'retract_at_layer_change',
    'retraction_enable',
    'retraction_hop',
    'retraction_hop_enabled',
    'support_enable',
    'support_pattern',
    'support_type'
];
// Only custom material is editable, changes on diameter is not allowed as well
function isDefinitionEditable(definition, key) {
    return !definition.metadata.readonly
        && key !== 'material_diameter';
}

function isOfficialDefinition(definition) {
    return definition && includes(['material.pla', 'material.abs', 'quality.fast_print', 'quality.normal_quality', 'quality.high_quality'],
        definition.definitionId);
}


function PrintingManager() {
    const showPrintingManager = useSelector(state => state?.printing?.showPrintingManager, shallowEqual);
    const series = useSelector(state => state?.machine?.series, shallowEqual);
    const managerDisplayType = useSelector(state => state?.printing?.managerDisplayType, shallowEqual);
    const materialDefinitions = useSelector(state => state?.printing?.materialDefinitions, shallowEqual);
    const qualityDefinitions = useSelector(state => state?.printing?.qualityDefinitions, shallowEqual);


    const dispatch = useDispatch();
    const [definitionState, setDefinitionState] = useSetState({
        materialDefinitionForManager: null,
        qualityDefinitionForManager: null,
        materialDefinitionOptions: [],
        selectedName: '',
        renamingStatus: false,
        qualityDefinitionOptions: []
    });
    const [configExpanded, setConfigExpanded] = useState({});
    const [notificationMessage, setNotificationMessage] = useState('');
    const [activeCateId, setActiveCateId] = useState(2);
    const [qualityConfigExpanded, setQualityConfigExpanded] = useState((function () {
        PRINTING_QUALITY_CONFIG_GROUP.forEach((config) => {
            this[config.name] = false;
        });
        return this;
    }).call({}));
    const refs = {
        materialFileInput: useRef(null),
        qualityFileInput: useRef(null),
        renameInput: useRef(null),
        scrollDom: useRef(null)
    };
    const state = {
        materialDefinitions,
        qualityDefinitions
    };

    const selectedOption = managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL ? definitionState?.materialDefinitionForManager : definitionState?.qualityDefinitionForManager;

    const actions = {
        foldCategory: (cateName) => {
            configExpanded[cateName] = !configExpanded[cateName];
            setConfigExpanded(JSON.parse(JSON.stringify(configExpanded)));
        },
        hidePrintingManager: () => {
            dispatch(printingActions.updateShowPrintingManager(false));
        },
        updateManagerDisplayType: (type) => {
            actions.clearNotification();
            dispatch(printingActions.updateManagerDisplayType(type));
            setActiveCateId(0);
        },
        showNotification: (msg) => {
            setNotificationMessage(msg);
        },
        clearNotification: () => {
            setNotificationMessage('');
        },
        setActiveCate: (cateId) => {
            if (refs.scrollDom.current) {
                const container = refs.scrollDom.current.parentElement;
                const offsetTops = [...refs.scrollDom.current.children].map(i => i.offsetTop);
                if (cateId !== undefined) {
                    container.scrollTop = offsetTops[cateId] - 80;
                } else {
                    cateId = offsetTops.findIndex((item, idx) => item < container.scrollTop && offsetTops[idx + 1] > container.scrollTop);
                    cateId = Math.max(cateId, 0);
                }
                setActiveCateId(cateId);
            }
            return true;
        },
        setRenamingStatus: (status) => {
            const { materialDefinitionForManager, qualityDefinitionForManager } = definitionState;
            if (isOfficialDefinition(selectedOption)) {
                return;
            }
            if (managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL) {
                setDefinitionState({
                    selectedName: materialDefinitionForManager.name,
                    renamingStatus: status
                });
            } else {
                setDefinitionState({
                    selectedName: qualityDefinitionForManager.name,
                    renamingStatus: status
                });
            }

            status && setTimeout(() => {
                refs.renameInput.current.focus();
            }, 0);
        },
        onChangeMaterialFileForManager: (event) => {
            const materialFile = event.target.files[0];
            dispatch(printingActions.onUploadManagerDefinition(materialFile, managerDisplayType));
        },
        onChangeQualityFileForManager: (event) => {
            const qualityFile = event.target.files[0];
            dispatch(printingActions.onUploadManagerDefinition(qualityFile, managerDisplayType));
        },
        importFile: (type) => {
            if (type === PRINTING_MANAGER_TYPE_MATERIAL) {
                refs.materialFileInput.current.value = null;
                refs.materialFileInput.current.click();
            } else if (type === PRINTING_MANAGER_TYPE_QUALITY) {
                refs.qualityFileInput.current.value = null;
                refs.qualityFileInput.current.click();
            }
        },
        exportConfigFile: (type) => {
            let definitionId, targetFile;
            const { materialDefinitionForManager, qualityDefinitionForManager } = definitionState;
            if (type === PRINTING_MANAGER_TYPE_MATERIAL) {
                definitionId = materialDefinitionForManager.definitionId;
                targetFile = `${definitionId}.def.json`;
            } else if (type === PRINTING_MANAGER_TYPE_QUALITY) {
                definitionId = qualityDefinitionForManager.definitionId;
                if (isOfficialDefinition(qualityDefinitionForManager)) {
                    targetFile = `${series}/${definitionId}.def.json`;
                } else {
                    targetFile = `${definitionId}.def.json`;
                }
            }
            dispatch(projectActions.exportConfigFile(targetFile));
        },
        onUpdateDefaultDefinition: () => {
            let definitionId;
            const { materialDefinitionForManager, qualityDefinitionForManager } = definitionState;
            if (managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL) {
                definitionId = materialDefinitionForManager.definitionId;
            } else {
                definitionId = qualityDefinitionForManager.definitionId;
            }
            dispatch(printingActions.updateDefaultIdByType(managerDisplayType, definitionId));
        },
        onSelectDefinitionByType: (type, definition) => {
            setDefinitionState({
                [`${type}DefinitionForManager`]: definition,
                selectedName: definition.name
            });
        },
        onChangeQualityDefinitionForManager: (key, value, checkboxKeyArray) => {
            const { qualityDefinitionForManager } = definitionState;
            const newQualityDefinitionForManager = JSON.parse(JSON.stringify(qualityDefinitionForManager));
            // if (!isDefinitionEditable(qualityDefinitionForManager)) {
            //     return;
            // }
            newQualityDefinitionForManager.settings[key].default_value = value;

            setDefinitionState({
                qualityDefinitionForManager: newQualityDefinitionForManager,
                selectedName: qualityDefinitionForManager.name
            });
            if (checkboxKeyArray) {
                const { qualityDefinitionOptions } = definitionState;
                let newQualityDefinitionOptions;
                checkboxKeyArray.forEach((checkboxKey) => {
                    newQualityDefinitionOptions = qualityDefinitionOptions.map((item) => {
                        if (item.label === qualityDefinitionForManager.name && key === checkboxKey) {
                            item[checkboxKey] = value;
                        }
                        return item;
                    });
                });
                setDefinitionState({
                    qualityDefinitionOptions: newQualityDefinitionOptions
                });
            }
            return newQualityDefinitionForManager;
        },

        onChangeDefinition: (key, value, checkboxKeyArray) => {
            // setState in setTimeout is synchronize
            // now setDefinitionState is synchronize, so remove setTimeout
            if (managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL) {
                const newDefinition = actions.onChangeMaterialDefinitionForManager(key, value, checkboxKeyArray);
                actions.onSaveMaterialForManager(managerDisplayType, newDefinition);
            } else {
                const newDefinition = actions.onChangeQualityDefinitionForManager(key, value, checkboxKeyArray);
                actions.onSaveQualityForManager(managerDisplayType, newDefinition);
            }
        },
        onSaveQualityForManager: async (type, newDefinition) => {
            const newDefinitionSettings = {};
            for (const [key, value] of Object.entries(newDefinition.settings)) {
                if (PRINTING_QUALITY_CONFIG_KEYS.indexOf(key) > -1) {
                    newDefinitionSettings[key] = { 'default_value': value.default_value };
                }
            }

            await dispatch(printingActions.updateDefinitionSettings(newDefinition, newDefinitionSettings));
            dispatch(printingActions.updateDefinitionsForManager(newDefinition.definitionId, type));
        },

        onSelectDefinition: (definitionId) => {
            const keySelectedDefinition = `${managerDisplayType}DefinitionForManager`;
            if (definitionId === definitionState[keySelectedDefinition].definitionId) {
                return;
            }
            const selected = state[`${managerDisplayType}Definitions`].find(d => d.definitionId === definitionId);
            actions.setRenamingStatus(false);
            if (selected) {
                setDefinitionState({
                    [keySelectedDefinition]: selected,
                    selectedName: selected.name
                });
            }
        },
        onChangeMaterialDefinitionForManager: (key, value, checkboxKey) => {
            const { materialDefinitionOptions, materialDefinitionForManager } = definitionState;
            const newMaterialDefinitionForManager = JSON.parse(JSON.stringify(materialDefinitionForManager));
            newMaterialDefinitionForManager.settings[key].default_value = value;
            setDefinitionState({
                materialDefinitionForManager: newMaterialDefinitionForManager
            });

            if (checkboxKey) {
                const newMaterialDefinitionOptions = materialDefinitionOptions.map((item) => {
                    if (item.label === materialDefinitionForManager.name) {
                        item[checkboxKey] = value;
                    }
                    return item;
                });
                setDefinitionState({
                    materialDefinitionOptions: newMaterialDefinitionOptions
                });
            }
            return newMaterialDefinitionForManager;
        },
        onSaveMaterialForManager: async (type, newDefinition) => {
            const newDefinitionSettings = {};
            for (const [key, value] of Object.entries(newDefinition?.settings)) {
                if (PRINTING_MATERIAL_CONFIG_KEYS.indexOf(key) > -1) {
                    newDefinitionSettings[key] = { 'default_value': value.default_value };
                }
            }
            await dispatch(printingActions.updateDefinitionSettings(newDefinition, newDefinitionSettings));
            dispatch(printingActions.updateDefinitionsForManager(newDefinition.definitionId, type));
        },

        updaterDefinitionName: async () => {
            const keySelectedDefinition = `${managerDisplayType}DefinitionForManager`;
            const keyDefinitionOptions = `${managerDisplayType}DefinitionOptions`;
            const definition = definitionState[keySelectedDefinition];
            const options = definitionState[keyDefinitionOptions];
            const selectedName = definitionState.selectedName;
            if (selectedName !== definition.name) { // changed
                try {
                    await dispatch(printingActions.updateDefinitionNameByType(managerDisplayType, definition, selectedName));
                    const option = options.find(o => o.value === definition.definitionId);
                    option.label = selectedName;
                    setDefinitionState({
                        [keyDefinitionOptions]: [...options]
                    });
                } catch (err) {
                    actions.showNotification(err);
                }
            }
        },

        onChangeSelectedName: (event) => {
            setDefinitionState({
                selectedName: event.target.valu
            });
        },

        onDuplicateManagerDefinition: async (name) => {
            const { materialDefinitionForManager, qualityDefinitionForManager } = definitionState;
            let definition = {};
            if (managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL) {
                definition = materialDefinitionForManager;
            } else if (managerDisplayType === PRINTING_MANAGER_TYPE_QUALITY) {
                definition = qualityDefinitionForManager;
            }
            const newDefinition = await dispatch(printingActions.duplicateDefinitionByType(managerDisplayType, definition, undefined, name));
            // Select new definition after creation
            actions.onSelectDefinition(newDefinition.definitionId);
        },
        // TODO
        onCreateManagerDefinition: async (name) => {
            let definition = {};
            if (managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL) {
                definition = materialDefinitions.find(def => def.definitionId === 'material.pla');
            } else if (managerDisplayType === PRINTING_MANAGER_TYPE_QUALITY) {
                definition = qualityDefinitions.find(def => def.definitionId === 'quality.normal_quality');
            }
            const newDefinition = await dispatch(printingActions.duplicateDefinitionByType(managerDisplayType, definition, undefined, name));

            actions.onSelectDefinition(newDefinition.definitionId);
        },
        onRemoveManagerDefinition: async (type) => {
            const { materialDefinitionForManager, qualityDefinitionForManager } = definitionState;
            if (isOfficialDefinition(selectedOption)) {
                return;
            }
            let definition = {};
            let newDefinition = {};
            let shouldSelectDefinition = false;
            if (type === PRINTING_MANAGER_TYPE_MATERIAL) {
                definition = materialDefinitionForManager;
                // After removal, select the first definition
                if (materialDefinitions.length) {
                    shouldSelectDefinition = true;
                    newDefinition = materialDefinitions[0];
                }
            } else if (type === PRINTING_MANAGER_TYPE_QUALITY) {
                definition = qualityDefinitionForManager;
                if (qualityDefinitions.length) {
                    shouldSelectDefinition = true;
                    newDefinition = qualityDefinitions[0];
                }
            }
            const popupActions = modal({
                title: i18n._('Delete Parameters'),
                body: (
                    <React.Fragment>
                        <p>{`Are you sure to remove profile "${definition.name}"?`}</p>
                    </React.Fragment>

                ),

                footer: (
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-primary"
                        onClick={async () => {
                            await dispatch(printingActions.removeDefinitionByType(managerDisplayType, definition));
                            // After removal, select the first definition
                            if (shouldSelectDefinition) {
                                actions.onSelectDefinitionByType(managerDisplayType, newDefinition);
                            }
                            popupActions.close();
                        }}
                    >
                        {i18n._('OK')}
                    </button>
                )
            });
        },
        showNewModal: () => {
            // const keySelectedDefinition = `${refs.props.managerDisplayType}DefinitionForManager`;
            actions.showInputModal({
                title: i18n._('Create Profile'),
                label: i18n._('Enter Profile Name:'),
                defaultInputValue: 'New Profile',
                onComplete: actions.onCreateManagerDefinition
            });
        },
        showDuplicateModal: () => {
            const keySelectedDefinition = `${managerDisplayType}DefinitionForManager`;
            actions.showInputModal({
                title: i18n._('Copy Profile'),
                label: i18n._('Enter Profile Name:'),
                defaultInputValue: definitionState[keySelectedDefinition].name,
                onComplete: actions.onDuplicateManagerDefinition
            });
        },
        showInputModal: ({ title, label, defaultInputValue, onComplete }) => {
            const popupActions = modal({
                title: title,
                body: (
                    <React.Fragment>
                        <p>{label}</p>
                    </React.Fragment>

                ),
                defaultInputValue,
                footer: (
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-primary"
                        onClick={async () => {
                            await onComplete(popupActions.getInputValue());
                            popupActions.close();
                        }}
                    >
                        {i18n._('OK')}
                    </button>
                )
            });
        }
    };

    useEffect(() => {
        const newState = {};
        const materialDefinitionForManager = materialDefinitions.find(d => d.definitionId === definitionState?.materialDefinitionForManager?.definitionId)
        || materialDefinitions.find(d => d.definitionId === 'material.pla');
        Object.assign(newState, {
            materialDefinitionForManager: materialDefinitionForManager
        });

        const materialDefinitionOptions = materialDefinitions.map(d => {
            const checkboxAndSelectGroup = {};
            MATERIAL_CHECKBOX_AND_SELECT_KEY_ARRAY.forEach((key) => {
                checkboxAndSelectGroup[key] = d.settings[key].default_value;
            });
            checkboxAndSelectGroup.label = d.name;
            checkboxAndSelectGroup.value = d.definitionId;
            return checkboxAndSelectGroup;
        });
        Object.assign(newState, {
            materialDefinitionOptions: materialDefinitionOptions
        });

        setDefinitionState(newState);
    }, [materialDefinitions]);

    useEffect(() => {
        const newState = {};
        const qualityDefinitionForManager = qualityDefinitions.find(d => d.definitionId === definitionState?.qualityDefinitionForManager?.definitionId)
        || qualityDefinitions.find(d => d.definitionId === 'quality.fast_print');
        Object.assign(newState, {
            qualityDefinitionForManager: qualityDefinitionForManager
        });
        const qualityDefinitionOptions = qualityDefinitions.map(d => {
            const checkboxAndSelectGroup = {};
            QUALITY_CHECKBOX_AND_SELECT_KEY_ARRAY.forEach((key) => {
                checkboxAndSelectGroup[key] = d.settings[key].default_value;
            });
            checkboxAndSelectGroup.label = d.name;
            checkboxAndSelectGroup.value = d.definitionId;
            return checkboxAndSelectGroup;
        });
        Object.assign(newState, {
            qualityDefinitionOptions: qualityDefinitionOptions
        });
        setDefinitionState(newState);
    }, [qualityDefinitions]);

    if (!showPrintingManager) {
        return null;
    }

    const optionConfigGroup = managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL ? PRINTING_MATERIAL_CONFIG_GROUP : PRINTING_QUALITY_CONFIG_GROUP;
    const optionList = managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL ? definitionState?.materialDefinitionOptions : definitionState?.qualityDefinitionOptions;
    const cates = [{ cateName: 'Default', items: [] }, { cateName: 'Custom', items: [] }];
    const regex = /^[a-z]+.[0-9]+$/;
    optionList.forEach(option => {
        const idx = regex.test(option.value) ? 1 : 0;
        cates[idx].items.push(option);
    });

    return (
        <React.Fragment>
            {showPrintingManager && (
                <Modal
                    className={classNames(styles['manager-body'])}
                    style={{ minWidth: '700px' }}
                    onClose={actions.hidePrintingManager}
                >
                    <Modal.Body
                        style={{ margin: '0', padding: '20px 0 0', height: '100%', minHeight: '525px', textAlign: 'center' }}
                    >
                        <div className={classNames(styles['manager-type-wrapper'])}>
                            <Anchor
                                // onClick={() => actions.updateManagerDisplayType(PRINTING_MANAGER_TYPE_MATERIAL)}
                                className={classNames(styles['manager-type'])}
                            >
                                {managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL ? i18n._('Material') : i18n._('Printing Settings')}
                            </Anchor>
                        </div>

                        <div
                            className={classNames(styles['manager-content'])}
                        >
                            <div className={classNames(styles['manager-name'])}>
                                <ul className={classNames(styles['manager-name-wrapper'])}>
                                    {(cates.map((cate) => {
                                        const displayCategory = limitStringLength(cate.cateName, 28);

                                        return !!cate.items.length && (
                                            <li key={`${cate.cateName}`}>
                                                <Anchor
                                                    className={classNames(styles['manager-btn'])}

                                                >
                                                    <div className={classNames(styles['manager-btn-unfold'])}>
                                                        <span
                                                            className={classNames(styles['manager-btn-unfold-bg'], { [styles.unfold]: !configExpanded[cate.cateName] })}
                                                            onKeyDown={() => {}}
                                                            role="button"
                                                            tabIndex={0}
                                                            onClick={() => { actions.foldCategory(cate.cateName); }}
                                                        />
                                                    </div>
                                                    <span>{displayCategory}</span>
                                                </Anchor>
                                                {!configExpanded[cate.cateName] && (
                                                    <ul style={{ listStyle: 'none', paddingLeft: '0' }}>
                                                        {(cate.items.map((currentOption) => {
                                                            const displayName = limitStringLength(i18n._(currentOption.label), 24);
                                                            const isSelected = currentOption.value === selectedOption.definitionId;
                                                            return (
                                                                <li key={`${currentOption.value}`}>
                                                                    <Anchor
                                                                        className={classNames(styles['manager-btn'], { [styles.selected]: isSelected })}
                                                                        style={{ paddingLeft: '42px' }}
                                                                        title={currentOption.label}
                                                                        onClick={() => actions.onSelectDefinition(currentOption.value)}
                                                                        onDoubleClick={() => actions.setRenamingStatus(true)}
                                                                    >
                                                                        {(isSelected && definitionState.renamingStatus) ? (
                                                                            <input
                                                                                ref={refs.renameInput}
                                                                                className="sm-parameter-row__input"
                                                                                value={definitionState.selectedName}
                                                                                onChange={actions.onChangeSelectedName}
                                                                                onKeyPress={(e) => {
                                                                                    if (e.key === 'Enter') {
                                                                                        e.preventDefault();
                                                                                        actions.setRenamingStatus(false);
                                                                                        actions.updaterDefinitionName();
                                                                                    }
                                                                                }}
                                                                                onBlur={() => {
                                                                                    actions.setRenamingStatus(false);
                                                                                    actions.updaterDefinitionName();
                                                                                }}
                                                                                // disabled={!isDefinitionEditable(qualityDefinitionForManager)}
                                                                            />
                                                                        ) : displayName}

                                                                    </Anchor>
                                                                </li>
                                                            );
                                                        }))}
                                                    </ul>

                                                )}
                                            </li>
                                        );
                                    }))}
                                </ul>

                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-around'
                                }}
                                >
                                    <SvgIcon
                                        name="Edit"
                                        disabled={isOfficialDefinition(selectedOption)}
                                        size={18}
                                        title={i18n._('Edit')}
                                        onClick={() => actions.setRenamingStatus(true)}
                                    />
                                    <input
                                        ref={refs.materialFileInput}
                                        type="file"
                                        accept=".json"
                                        style={{ display: 'none' }}
                                        multiple={false}
                                        onChange={actions.onChangeMaterialFileForManager}
                                    />
                                    <input
                                        ref={refs.qualityFileInput}
                                        type="file"
                                        accept=".json"
                                        style={{ display: 'none' }}
                                        multiple={false}
                                        onChange={actions.onChangeQualityFileForManager}
                                    />
                                    <SvgIcon
                                        name="Import"
                                        size={18}
                                        title={i18n._('Import')}
                                        onClick={() => actions.importFile(managerDisplayType)}
                                    />
                                    <SvgIcon
                                        name="Export"
                                        size={18}
                                        title={i18n._('Export')}
                                        onClick={() => actions.exportConfigFile(managerDisplayType)}
                                    />
                                    <SvgIcon
                                        name="Delete"
                                        size={18}
                                        title={i18n._('Delete')}
                                        onClick={() => actions.onRemoveManagerDefinition(managerDisplayType)}
                                        disabled={isOfficialDefinition(selectedOption)}
                                    />
                                </div>


                                <div className="sm-tabs" style={{ padding: '16px' }}>
                                    <SvgIcon
                                        name="New"
                                        size={18}
                                        className={classNames(styles['manager-file'], 'sm-tab')}
                                        onClick={() => { actions.showNewModal(); }}
                                        spanText={i18n._('New')}
                                        spanClassName={classNames(styles['action-title'])}
                                    />
                                    <SvgIcon
                                        name="Copy"
                                        size={18}
                                        className={classNames(styles['manager-file'], 'sm-tab')}
                                        onClick={() => { actions.showDuplicateModal(); }}
                                        spanText={i18n._('Copy')}
                                        spanClassName={classNames(styles['action-title'])}
                                    />
                                </div>
                            </div>

                            {(optionConfigGroup.length > 1) && (
                                <div className={classNames(styles['manager-grouplist'])}>
                                    <div className="sm-parameter-container">
                                        {optionConfigGroup.map((group, idx) => {
                                            return (
                                                <div
                                                    key={i18n._(idx)}

                                                >
                                                    {group.name && (
                                                        <Anchor
                                                            className={classNames(styles.item, { [styles.selected]: idx === activeCateId })}

                                                            onClick={() => {
                                                                actions.setActiveCate(idx);
                                                            }}
                                                        >
                                                            <span className="sm-parameter-header__title">{i18n._(group.name)}</span>

                                                        </Anchor>
                                                    )}

                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}


                            <div
                                className={classNames(styles['manager-details'])}
                                onWheel={() => { actions.setActiveCate(); }}
                            >
                                {notificationMessage && (
                                    <Notifications bsStyle="danger" onDismiss={actions.clearNotification} className="Notifications">
                                        {notificationMessage}
                                    </Notifications>
                                )}

                                <div className="sm-parameter-container" ref={refs.scrollDom}>
                                    {optionConfigGroup.map((group, idx) => {
                                        return (
                                            <div key={i18n._(idx)}>
                                                {group.name && (
                                                    <Anchor
                                                        className="sm-parameter-header"
                                                        onClick={() => {
                                                            qualityConfigExpanded[group.name] = !qualityConfigExpanded[group.name];
                                                            setQualityConfigExpanded(JSON.parse(JSON.stringify(qualityConfigExpanded)));
                                                        }}
                                                    >
                                                        <span className="fa fa-gear sm-parameter-header__indicator" />
                                                        <span className="sm-parameter-header__title">{i18n._(group.name)}</span>

                                                    </Anchor>
                                                )}
                                                { group.fields.map((key) => {
                                                    const setting = selectedOption.settings[key];
                                                    const { label, description, type, unit = '', enabled, options } = setting;
                                                    const defaultValue = setting.default_value;
                                                    if (typeof enabled === 'string') {
                                                        if (enabled.indexOf(' and ') !== -1) {
                                                            const andConditions = enabled.split(' and ').map(c => c.trim());
                                                            for (const condition of andConditions) {
                                                                // parse resolveOrValue('adhesion_type') == 'skirt'
                                                                const enabledKey = condition.match("resolveOrValue\\('(.[^)|']*)'") ? condition.match("resolveOrValue\\('(.[^)|']*)'")[1] : null;
                                                                const enabledValue = condition.match("== ?'(.[^)|']*)'") ? condition.match("== ?'(.[^)|']*)'")[1] : null;
                                                                if (enabledKey) {
                                                                    if (selectedOption.settings[enabledKey]) {
                                                                        const value = selectedOption.settings[enabledKey].default_value;
                                                                        if (value !== enabledValue) {
                                                                            return null;
                                                                        }
                                                                    }
                                                                } else {
                                                                    if (selectedOption.settings[condition]) {
                                                                        const value = selectedOption.settings[condition].default_value;
                                                                        if (!value) {
                                                                            return null;
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        } else {
                                                            const orConditions = enabled.split(' or ')
                                                                .map(c => c.trim());
                                                            let result = false;
                                                            for (const condition of orConditions) {
                                                                if (selectedOption.settings[condition]) {
                                                                    const value = selectedOption.settings[condition].default_value;
                                                                    if (value) {
                                                                        result = true;
                                                                    }
                                                                }
                                                                if (condition.match('(.*) > ([0-9]+)')) {
                                                                    const m = condition.match('(.*) > ([0-9]+)');
                                                                    const enabledKey = m[1];
                                                                    const enabledValue = parseInt(m[2], 10);
                                                                    if (selectedOption.settings[enabledKey]) {
                                                                        const value = selectedOption.settings[enabledKey].default_value;
                                                                        if (value > enabledValue) {
                                                                            result = true;
                                                                        }
                                                                    }
                                                                }
                                                                if (condition.match('(.*) < ([0-9]+)')) {
                                                                    const m = condition.match('(.*) > ([0-9]+)');
                                                                    const enabledKey = m[1];
                                                                    const enabledValue = parseInt(m[2], 10);
                                                                    if (selectedOption.settings[enabledKey]) {
                                                                        const value = selectedOption.settings[enabledKey].default_value;
                                                                        if (value < enabledValue) {
                                                                            result = true;
                                                                        }
                                                                    }
                                                                }
                                                                if (condition.match("resolveOrValue\\('(.[^)|']*)'")) {
                                                                    const m1 = condition.match("resolveOrValue\\('(.[^)|']*)'");
                                                                    const m2 = condition.match("== ?'(.[^)|']*)'");
                                                                    const enabledKey = m1[1];
                                                                    const enabledValue = m2[1];
                                                                    if (selectedOption.settings[enabledKey]) {
                                                                        const value = selectedOption.settings[enabledKey].default_value;
                                                                        if (value === enabledValue) {
                                                                            result = true;
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                            if (!result) {
                                                                return null;
                                                            }
                                                        }
                                                    } else if (typeof enabled === 'boolean' && enabled === false) {
                                                        return null;
                                                    }

                                                    const opts = [];
                                                    if (options) {
                                                        Object.keys(options).forEach((k) => {
                                                            opts.push({
                                                                value: k,
                                                                label: i18n._(options[k])
                                                            });
                                                        });
                                                    }
                                                    return (
                                                        <TipTrigger title={i18n._(label)} content={i18n._(description)} key={key}>
                                                            <div className="sm-parameter-row" key={key}>
                                                                <span className="sm-parameter-row__label-lg">{i18n._(label)}</span>
                                                                {type === 'float' && (
                                                                    <Input
                                                                        className="sm-parameter-row__input"
                                                                        style={{ width: '160px' }}
                                                                        value={defaultValue}
                                                                        disabled={!isDefinitionEditable(selectedOption)}
                                                                        onChange={(value) => {
                                                                            actions.onChangeDefinition(key, value);
                                                                        }}
                                                                    />
                                                                )}
                                                                {type === 'float' && (
                                                                    <span className="sm-parameter-row__input-unit">{unit}</span>
                                                                )}
                                                                {type === 'int' && (
                                                                    <Input
                                                                        className="sm-parameter-row__input"
                                                                        style={{ width: '160px' }}
                                                                        value={defaultValue}
                                                                        disabled={!isDefinitionEditable(selectedOption)}
                                                                        onChange={(value) => {
                                                                            actions.onChangeDefinition(key, value);
                                                                        }}
                                                                    />
                                                                )}
                                                                {type === 'int' && (
                                                                    <span className="sm-parameter-row__input-unit">{unit}</span>
                                                                )}
                                                                {type === 'bool' && (
                                                                    <input
                                                                        className="sm-parameter-row__checkbox"
                                                                        style={{ cursor: !isDefinitionEditable(selectedOption) ? 'not-allowed' : 'default' }}
                                                                        type="checkbox"
                                                                        checked={defaultValue}
                                                                        disabled={!isDefinitionEditable(selectedOption)}
                                                                        onChange={(event) => actions.onChangeDefinition(key, event.target.checked, QUALITY_CHECKBOX_AND_SELECT_KEY_ARRAY)}
                                                                    />
                                                                )}
                                                                {type === 'enum' && (
                                                                    <Select
                                                                        className="sm-parameter-row__select-md"
                                                                        backspaceRemoves={false}
                                                                        clearable={false}
                                                                        menuContainerStyle={{ zIndex: 5 }}
                                                                        name={key}
                                                                        disabled={!isDefinitionEditable(selectedOption)}
                                                                        options={opts}
                                                                        value={defaultValue}
                                                                        onChange={(option) => {
                                                                            actions.onChangeDefinition(key, option.value, QUALITY_CHECKBOX_AND_SELECT_KEY_ARRAY);
                                                                        }}
                                                                    />
                                                                )}
                                                            </div>
                                                        </TipTrigger>
                                                    );
                                                })
                                                }
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                        </div>

                        <div className={classNames(styles['manager-settings'], 'clearfix')}>
                            <div className={classNames(styles['manager-settings-save'], styles['manager-settings-btn'])}>
                                <Anchor
                                    onClick={() => { actions.hidePrintingManager(); }}
                                    className="sm-btn-large sm-btn-default"
                                    style={{ marginRight: '11px' }}
                                >
                                    {i18n._('Close')}
                                </Anchor>

                                <Anchor
                                    onClick={() => {
                                        actions.onUpdateDefaultDefinition();
                                        actions.hidePrintingManager();
                                    }}
                                    className="sm-btn-large sm-btn-primary"
                                    // disabled={isOfficialDefinition(selectedOption)}
                                >
                                    {i18n._('Select')}
                                </Anchor>

                            </div>
                        </div>
                    </Modal.Body>
                </Modal>
            )}
        </React.Fragment>
    );
}

export default PrintingManager;
