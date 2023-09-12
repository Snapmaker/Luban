import React, { useEffect, useState, useRef } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
// import { useSelector, shallowEqual } from 'react-redux';
import { isUndefined, cloneDeep, uniqWith } from 'lodash';
import { HEAD_CNC, HEAD_LASER, KEY_DEFAULT_CATEGORY_CUSTOM, PRINTING_MANAGER_TYPE_MATERIAL, PRINTING_MANAGER_TYPE_QUALITY } from '../../../constants';
import modal from '../../../lib/modal';
import DefinitionCreator from '../DefinitionCreator';
import Anchor from '../../components/Anchor';
import i18n from '../../../lib/i18n';
import SvgIcon from '../../components/SvgIcon';
import Notifications from '../../components/Notifications';
import Modal from '../../components/Modal';
import { Button } from '../../components/Buttons';
import ConfigValueBox from './ConfigValueBox';
import styles from './styles.styl';
import { MaterialWithColor } from '../../widgets/PrintingMaterial/MaterialWithColor';
import useSetState from '../../../lib/hooks/set-state';
import { naturalSortKeys } from '../../../lib/numeric-utils';

/**
 * Do category fields in different types of profiles have values, and multilingual support
 * @fields                  category | i18nCategory
 *
 * @DefaultType                 √    |     √
 * @CopyType from default       √    |     √
 * @CustomType                  √    |     ×
 * @CopyType from custom        √    |     x
 * @ImportType                  ×    |     ×
 *
 * @ExportType                  ×    |     ×
 */

function creatCateArray(optionList) {
    const cates = [];
    optionList.forEach(option => {
        // Make sure that the copied description file is displayed in the correct position after switching the language
        const cateItem = cates.find((cate) => {
            return cate.category === option.category;
        });
        if (cateItem) {
            cateItem.items.push(option);
        } else {
            const eachCate = { items: [] };
            eachCate.category = option.category;
            eachCate.i18nCategory = option.i18nCategory;
            eachCate.items.push(option);
            cates.push(eachCate);
        }
    });

    // Sort items in category
    for (const cate of cates) {
        cate.items.sort((a, b) => {
            const aKeys = naturalSortKeys(a.label);
            const bKeys = naturalSortKeys(b.label);

            for (let i = 0; i < aKeys.length; i++) {
                if (aKeys[i] < bKeys[i]) return -1;
                if (aKeys[i] > bKeys[i]) return 1;
            }

            return 0;
        });
    }

    return cates;
}

function useGetDefinitions(allDefinitions, activeDefinitionID, getDefaultDefinition, managerType) {
    const [definitionState, setDefinitionState] = useSetState({
        activeDefinitionID,
        definitionForManager: allDefinitions.find(d => d.definitionId === activeDefinitionID),
        selectedSettingDefaultValue: getDefaultDefinition(activeDefinitionID),
        definitionOptions: [],
        selectedName: '',
        isCategorySelected: false,
        renamingStatus: false,
        cates: []
    });

    useEffect(() => {
        const definitionOptions = allDefinitions.map(d => {
            return {
                label: d.name,
                value: d.definitionId,
                category: d.category,
                i18nCategory: d.i18nCategory,
                isHidden: !d.settings || Object.keys(d.settings).length === 0,
                isDefault: !!d.isDefault,
                color: (
                    managerType === PRINTING_MANAGER_TYPE_MATERIAL && d.ownKeys.find(key => key === 'color') && d.settings.color
                ) ? d.settings.color.default_value : ''
            };
        });
        setDefinitionState((prev) => {
            let definitionForManager;
            let selectedSettingDefaultValue;
            if (prev.activeDefinitionID === activeDefinitionID && prev.definitionForManager) {
                definitionForManager = prev.definitionForManager;
                selectedSettingDefaultValue = prev.selectedSettingDefaultValue;
            } else {
                definitionForManager = allDefinitions.find(d => d.definitionId === activeDefinitionID) || allDefinitions[0];
                selectedSettingDefaultValue = getDefaultDefinition(definitionForManager.definitionId);
            }
            return {
                definitionOptions,
                cates: creatCateArray(definitionOptions),
                definitionForManager,
                selectedSettingDefaultValue
            };
        });
    }, [allDefinitions, activeDefinitionID]);

    return [definitionState, setDefinitionState];
}

function ProfileManager({
    optionConfigGroup,
    managerTitle,
    activeDefinitionID,
    allDefinitions,
    outsideActions,
    isOfficialDefinition,
    managerType
}) {
    const [configExpanded, setConfigExpanded] = useState({});
    const [notificationMessage, setNotificationMessage] = useState('');
    const refs = {
        fileInput: useRef(null),
        renameInput: useRef(null),
        refCreateModal: useRef(null)
    };
    const [definitionState, setDefinitionState] = useGetDefinitions(allDefinitions, activeDefinitionID, outsideActions.getDefaultDefinition, managerType);

    const currentDefinitions = useRef(allDefinitions);
    currentDefinitions.current = allDefinitions;

    const actions = {
        isCategorySelectedNow: (category) => {
            const { definitionForManager, isCategorySelected } = definitionState;
            if (!isCategorySelected) {
                return false;
            }

            return definitionForManager.category === category;
        },
        setRenamingStatus: (status) => {
            const currentDefinition = definitionState?.definitionForManager;
            if (isOfficialDefinition(currentDefinition)) {
                return;
            } else if (!status) {
                setDefinitionState({
                    renamingStatus: status
                });
                return;
            }
            if (status) {
                const title = definitionState.isCategorySelected ? currentDefinition.category : currentDefinition.name;
                setDefinitionState({
                    selectedName: title,
                    renamingStatus: status
                });

                setTimeout(() => {
                    refs.renameInput.current.focus();
                }, 0);
            }
        },
        // onSelectedQualityDefinition
        onSelectDefinitionById: (definitionId, name) => {
            const { definitionForManager, isCategorySelected } = definitionState;
            if (!isCategorySelected && definitionId === definitionForManager.definitionId) {
                return;
            }
            let selected;
            if (!name) {
                selected = currentDefinitions.current.find(d => d.definitionId === definitionId);
            } else {
                selected = currentDefinitions.current.find(d => d.definitionId === definitionId && d.name === name);
            }

            if (definitionState?.renamingStatus) {
                actions.setRenamingStatus(false);
            }
            if (selected) {
                const selectedSettingDefaultValue = outsideActions.getDefaultDefinition(selected.definitionId);
                setDefinitionState({
                    definitionForManager: selected,
                    isCategorySelected: false,
                    selectedName: selected.name,
                    selectedSettingDefaultValue: selectedSettingDefaultValue
                });
            }
        },
        onSelectCategory: (category) => {
            const { definitionForManager, isCategorySelected, renamingStatus } = definitionState;
            if (isCategorySelected && category === definitionForManager.category) {
                return;
            }
            if (renamingStatus) {
                actions.setRenamingStatus(false);
            }
            const activeToolCategory = currentDefinitions.current.find(d => {
                return d.category === category;
            });
            const selectedSettingDefaultValue = outsideActions.getDefaultDefinition(activeToolCategory.definitionId);
            setDefinitionState({
                definitionForManager: activeToolCategory,
                selectedName: activeToolCategory.category,
                isCategorySelected: true,
                selectedSettingDefaultValue: selectedSettingDefaultValue
            });
        },
        foldCategory: (category) => {
            configExpanded[category] = !configExpanded[category];
            setConfigExpanded(JSON.parse(JSON.stringify(configExpanded)));
        },
        onRemoveManagerDefinition: async (definition, isCategorySelected) => {
            if (isOfficialDefinition(definitionState.definitionForManager)) {
                return;
            }
            const deleteName = isCategorySelected ? definition.category : definition.name;
            const popupActions = modal({
                title: i18n._('key-Printing/ProfileManager-Delete Profile'),
                body: (
                    <React.Fragment>
                        <p>{i18n._('key-ProfileManager-Are you sure to delete profile "{{name}}"?', { name: deleteName })}</p>
                    </React.Fragment>
                ),

                footer: (
                    <Button
                        priority="level-two"
                        className="margin-left-8"
                        width="96px"
                        onClick={async () => {
                            // After deletion, the first item is selected by default
                            setDefinitionState({
                                activeDefinitionID: '',
                                isCategorySelected: false
                            });

                            if (!isCategorySelected) {
                                await outsideActions.removeManagerDefinition(definition);
                            } else if (isCategorySelected && outsideActions.removeCategoryDefinition) {
                                await outsideActions.removeCategoryDefinition(definition);
                            }
                            popupActions.close();
                        }}
                    >
                        {i18n._('key-Printing/ProfileManager-Delete')}
                    </Button>
                )
            });
        },
        showNewModal: () => {
            actions.showInputModal({
                isCreate: true
            });
        },
        showDuplicateModal: () => {
            actions.showInputModal({
                isCreate: false
            });
        },
        createManagerDefinition: async (newDefinition, newName, isCategorySelected, isCreate) => {
            const isCustom = newDefinition.category === i18n._(KEY_DEFAULT_CATEGORY_CUSTOM);
            const res = await outsideActions.onCreateManagerDefinition({
                ...newDefinition,
                category: isCustom ? '' : newDefinition.category,
                i18nCategory: isCustom ? '' : newDefinition.i18nCategory
            }, newName, isCategorySelected, isCreate);
            if (isCustom) {
                res.category = i18n._(KEY_DEFAULT_CATEGORY_CUSTOM);
                res.i18nCategory = '';
            }
            return res;
        },
        showInputModal: ({ isCreate }) => {
            const definitionForManager = definitionState?.definitionForManager;
            const isCategorySelected = definitionState?.isCategorySelected;
            let title = i18n._('key-Printing/ProfileManager-Create Profile');
            let copyType = '', copyCategoryName = '', copyItemName = '';

            if (!isCreate) {
                title = i18n._('key-Printing/ProfileManager-Copy Profile');
                copyType = isCategorySelected ? 'Category' : 'Item';
                copyCategoryName = definitionForManager.category;
                if (!isCategorySelected) {
                    copyItemName = definitionForManager.name;
                }
            } else {
                title = i18n._('key-Printing/ProfileManager-Create Profile');
                copyType = 'Item';
                copyItemName = i18n._('key-default_category-New Profile');
                copyCategoryName = definitionForManager.category;
            }

            let materialOptions = definitionState?.definitionOptions.map(option => {
                return {
                    label: option.category,
                    value: option.category,
                    i18n: option.i18nCategory
                };
            });
            materialOptions = uniqWith(materialOptions, (a, b) => {
                return a.label === b.label;
            });

            const popupActions = modal({
                title: title,
                body: (
                    <React.Fragment>
                        <DefinitionCreator
                            managerType={managerType}
                            isCreate={isCreate}
                            ref={refs.refCreateModal}
                            materialOptions={materialOptions}
                            copyType={copyType}
                            copyCategoryName={copyCategoryName}
                            copyItemName={copyItemName}
                        />
                    </React.Fragment>
                ),
                footer: (
                    <Button
                        priority="level-two"
                        className="margin-left-8"
                        width="96px"
                        onClick={async () => {
                            const data = refs.refCreateModal.current.getData();
                            const newDefinitionForManager = cloneDeep(definitionState.definitionForManager);
                            let newName = '';
                            popupActions.close();
                            if (!isCreate) {
                                if (isCategorySelected) {
                                    newName = data.categoryName;
                                    const newDefinition = await actions.createManagerDefinition(newDefinitionForManager, newName, isCategorySelected);
                                    actions.onSelectCategory(newDefinition.category);
                                } else {
                                    newDefinitionForManager.category = data.categoryName;
                                    newDefinitionForManager.i18nCategory = data.categoryI18n;
                                    newName = data.itemName;
                                    const newDefinition = await actions.createManagerDefinition(newDefinitionForManager, newName, isCategorySelected);
                                    actions.onSelectDefinitionById(newDefinition.definitionId, newDefinition.name);
                                }
                            } else {
                                if (data.createType === 'Category') {
                                    newDefinitionForManager.category = data.categoryName;
                                    newDefinitionForManager.i18nCategory = data.categoryI18n;
                                    newName = data.categoryName;
                                    newDefinitionForManager.settings = {};
                                    const newDefinition = await actions.createManagerDefinition(newDefinitionForManager, newName, data.createType === 'Category', isCreate);
                                    actions.onSelectCategory(newDefinition.category);
                                } else {
                                    newDefinitionForManager.category = data.categoryName;
                                    newDefinitionForManager.i18nCategory = data.categoryI18n;
                                    newName = data.itemName;
                                    if (Object.keys(newDefinitionForManager.settings).length === 0) {
                                        newDefinitionForManager.settings = cloneDeep(allDefinitions[0].settings);
                                    }
                                    const newDefinition = await actions.createManagerDefinition(newDefinitionForManager, newName, data.createType === 'Category', isCreate);
                                    actions.onSelectDefinitionById(newDefinition.definitionId, newDefinition.name);
                                }
                            }
                        }}
                    >
                        {i18n._('key-Printing/ProfileManager-Save')}
                    </Button>
                )
            });
        },
        onChangeSelectedName: (event) => {
            setDefinitionState({
                selectedName: event.target.value
            });
        },
        updateDefinitionName: async () => {
            const definition = definitionState?.definitionForManager;
            const selectedName = definitionState.selectedName;
            if (selectedName !== definition.name) { // changed
                try {
                    await outsideActions.updateDefinitionName(definition, selectedName);
                } catch (err) {
                    actions.showNotification(err);
                }
            }
        },
        updateCategoryName: async () => {
            const definition = definitionState?.definitionForManager;
            const selectedName = definitionState.selectedName;
            if (selectedName !== definition.category) { // changed
                try {
                    await outsideActions.updateCategoryName(definition, selectedName);
                } catch (err) {
                    actions.showNotification(err);
                }
            }
        },
        showNotification: (msg) => {
            setNotificationMessage(msg);
        },
        clearNotification: () => {
            setNotificationMessage('');
        },
        importFile: (ref) => {
            ref.current.value = null;
            ref.current.click();
        },
        onChangePresetSettings: (key, value) => {
            // now setDefinitionState is synchronize, so remove setTimeout
            const { definitionForManager } = definitionState;
            const newDefinitionForManager = cloneDeep(definitionForManager);
            newDefinitionForManager.settings[key].default_value = value;

            if (managerType === HEAD_CNC || managerType === HEAD_LASER) {
                if (key === 'path_type' && value === 'path') {
                    newDefinitionForManager.settings.movement_mode.default_value = 'greyscale-line';
                }
                if (key === 'tool_type') {
                    switch (value) {
                        case 'vbit':
                            newDefinitionForManager.settings.diameter.default_value = 0.2;
                            break;
                        case 'flat':
                            newDefinitionForManager.settings.diameter.default_value = 1.5;
                            break;
                        case 'ball':
                            newDefinitionForManager.settings.diameter.default_value = 3.175;
                            break;
                        default:
                            break;
                    }
                }
            }
            setDefinitionState({
                definitionForManager: newDefinitionForManager
            });
            outsideActions.onSaveDefinitionForManager(newDefinitionForManager, definitionForManager.definitionId === activeDefinitionID);
        },
        resetDefinition: (definitionId) => {
            const newDefinitionForManager = outsideActions.resetDefinitionById(definitionId, definitionId === activeDefinitionID);
            setDefinitionState({
                definitionForManager: newDefinitionForManager
            });
        }
    };

    return (
        <React.Fragment>
            {definitionState?.definitionForManager && (
                <Modal
                    size="lg"
                    className={classNames(styles['manager-body'])}
                    style={{ minWidth: '700px' }}
                    onClose={outsideActions.closeManager}
                >
                    <Modal.Header>
                        <div className={classNames('heading-3')}>
                            {i18n._(managerTitle)}
                        </div>
                    </Modal.Header>
                    <Modal.Body>
                        <div
                            className={classNames(styles['manager-content'], 'sm-flex')}
                        >
                            <div className={classNames(styles['manager-name'], 'border-default-grey-1', 'border-radius-8', 'padding-top-4')}>
                                {notificationMessage && (
                                    <Notifications bsStyle="danger" onDismiss={actions.clearNotification} className="Notifications">
                                        {notificationMessage}
                                    </Notifications>
                                )}
                                <ul className={classNames(styles['manager-name-wrapper'])}>
                                    {(definitionState.cates.map((cate) => {
                                        const isCategorySelected = cate.category === definitionState?.definitionForManager.category;
                                        return !!cate.items.length && (
                                            <li key={`${cate.category}`}>
                                                <Anchor
                                                    className={classNames(styles['manager-btn'], { [styles.selected]: actions.isCategorySelectedNow(cate.category) })}
                                                    onClick={() => actions.onSelectCategory(cate.category)}
                                                    onDoubleClick={() => actions.setRenamingStatus(true)}
                                                >
                                                    <div className="sm-flex align-center" style={{ paddingRight: '10px' }}>
                                                        <SvgIcon
                                                            name="DropdownOpen"
                                                            className={classNames(
                                                                'margin-horizontal-4',
                                                                'padding-horizontal-4',
                                                                configExpanded[cate.category] ? 'rotate270' : ''
                                                            )}
                                                            onClick={() => { actions.foldCategory(cate.category); }}
                                                            type={['static']}
                                                        />
                                                        {(definitionState?.isCategorySelected && isCategorySelected && definitionState?.renamingStatus) ? (
                                                            <input
                                                                ref={refs.renameInput}
                                                                className="sm-parameter-row__input"
                                                                value={definitionState?.selectedName}
                                                                onChange={actions.onChangeSelectedName}
                                                                onKeyPress={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        actions.setRenamingStatus(false);
                                                                        actions.updateCategoryName();
                                                                    }
                                                                }}
                                                                onBlur={() => {
                                                                    actions.setRenamingStatus(false);
                                                                    actions.updateCategoryName();
                                                                }}
                                                            />
                                                        ) : <span className="text-overflow-ellipsis">{cate.category}</span>}
                                                    </div>
                                                </Anchor>
                                                {!configExpanded[cate.category] && (
                                                    <ul style={{ listStyle: 'none', paddingLeft: '0' }}>
                                                        {(cate.items.map((currentOption) => {
                                                            const definitionForManager = definitionState?.definitionForManager;
                                                            const displayName = (
                                                                <div className="display-inherit width-196 margin-left-4">
                                                                    <MaterialWithColor name={currentOption.label} color={currentOption.color} />
                                                                </div>
                                                            );
                                                            const isSelected = (
                                                                !definitionState.isCategorySelected
                                                                && currentOption.value === definitionForManager.definitionId
                                                            );
                                                            let isAllValueDefault = true;
                                                            if (isSelected && currentOption.isDefault && definitionState?.selectedSettingDefaultValue) {
                                                                const selectedSettingDefaultValue = definitionState?.selectedSettingDefaultValue;
                                                                isAllValueDefault = optionConfigGroup.every((item) => {
                                                                    return item.fields.every((key) => {
                                                                        return (
                                                                            definitionForManager.settings[key].default_value
                                                                            === selectedSettingDefaultValue[key].default_value
                                                                        );
                                                                    });
                                                                });
                                                            }
                                                            if (isUndefined(currentOption.label) || currentOption.isHidden) {
                                                                return null;
                                                            } else {
                                                                return (
                                                                    <li key={`${currentOption.value}${currentOption.label}`}>
                                                                        <div className="sm-flex align-center justify-space-between">
                                                                            <Anchor
                                                                                className={classNames(styles['manager-btn'], { [styles.selected]: isSelected })}
                                                                                style={{ paddingLeft: '42px' }}
                                                                                title={currentOption.label}
                                                                                onClick={() => actions.onSelectDefinitionById(
                                                                                    currentOption.value,
                                                                                    currentOption.label
                                                                                )}
                                                                                onDoubleClick={() => actions.setRenamingStatus(true)}
                                                                            >
                                                                                {!isAllValueDefault && (
                                                                                    <SvgIcon
                                                                                        name="Reset"
                                                                                        size={24}
                                                                                        className="margin-left-n-30"
                                                                                        onClick={() => {
                                                                                            actions.resetDefinition(currentOption.value);
                                                                                        }}
                                                                                    />
                                                                                )}
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
                                                                                                actions.updateDefinitionName();
                                                                                            }
                                                                                        }}
                                                                                        onBlur={() => {
                                                                                            actions.setRenamingStatus(false);
                                                                                            actions.updateDefinitionName();
                                                                                        }}
                                                                                    />
                                                                                )
                                                                                    : <span className="text-overflow-ellipsis">{displayName}</span>}
                                                                            </Anchor>
                                                                        </div>
                                                                    </li>
                                                                );
                                                            }
                                                        }))}
                                                    </ul>

                                                )}
                                            </li>
                                        );
                                    }))}
                                </ul>

                                <div className="module-default-shadow">
                                    <div className="sm-flex justify-space-between padding-vertical-8 padding-horizontal-16">
                                        <SvgIcon
                                            name="Edit"
                                            disabled={isOfficialDefinition(definitionState.definitionForManager)}
                                            size={24}
                                            className="padding-vertical-2 padding-horizontal-2"
                                            title={i18n._('key-Printing/ProfileManager-Edit')}
                                            onClick={() => actions.setRenamingStatus(true)}
                                        />
                                        <input
                                            ref={refs.fileInput}
                                            type="file"
                                            accept=".json"
                                            style={{ display: 'none' }}
                                            multiple={false}
                                            onChange={async (e) => {
                                                const definition = await outsideActions.onChangeFileForManager(e);
                                                actions.onSelectDefinitionById(
                                                    definition.definitionId,
                                                    definition.name
                                                );
                                            }}
                                        />
                                        <SvgIcon
                                            name="Import"
                                            size={24}
                                            className="padding-vertical-2 padding-horizontal-2"
                                            title={i18n._('key-Printing/ProfileManager-Import')}
                                            onClick={() => actions.importFile(refs.fileInput)}
                                        />
                                        <SvgIcon
                                            name="Export"
                                            size={24}
                                            className="padding-vertical-2 padding-horizontal-2"
                                            disabled={definitionState.isCategorySelected}
                                            title={i18n._('key-Printing/ProfileManager-Export')}
                                            onClick={() => outsideActions.exportConfigFile(definitionState.definitionForManager)}
                                        />
                                        <SvgIcon
                                            name="Delete"
                                            size={24}
                                            className="padding-vertical-2 padding-horizontal-2"
                                            title={i18n._('key-Printing/ProfileManager-Delete')}
                                            onClick={() => actions.onRemoveManagerDefinition(definitionState.definitionForManager, definitionState.isCategorySelected)}
                                            disabled={isOfficialDefinition(definitionState.definitionForManager)}
                                        />
                                    </div>


                                    <div className="sm-flex justify-space-between padding-bottom-16 padding-horizontal-16">
                                        <SvgIcon
                                            name="NewNormal"
                                            size={24}
                                            type={['static']}
                                            className={classNames(styles['manager-file'], 'sm-tab', 'align-c')}
                                            onClick={() => { actions.showNewModal(); }}
                                            spanText={i18n._('key-Printing/ProfileManager-Create')}
                                            spanClassName={classNames(styles['action-title'])}
                                        />
                                        <SvgIcon
                                            name="CopyNormal"
                                            size={24}
                                            type={['static']}
                                            className={classNames(styles['manager-file'], 'sm-tab', 'align-c')}
                                            onClick={() => { actions.showDuplicateModal(); }}
                                            spanText={i18n._('key-Printing/ProfileManager-Copy')}
                                            spanClassName={classNames(styles['action-title'])}
                                        />
                                    </div>
                                </div>
                            </div>
                            <ConfigValueBox
                                definitionForManager={definitionState.definitionForManager}
                                isCategorySelected={definitionState.isCategorySelected}
                                optionConfigGroup={optionConfigGroup}
                                isOfficialDefinition={isOfficialDefinition}
                                onChangePresetSettings={actions.onChangePresetSettings}
                                selectedSettingDefaultValue={definitionState?.selectedSettingDefaultValue}
                                showMiddle={managerType === PRINTING_MANAGER_TYPE_MATERIAL || managerType === PRINTING_MANAGER_TYPE_QUALITY}
                                hideMiniTitle={false}
                                managerType={managerType}
                            />

                        </div>

                    </Modal.Body>
                    <Modal.Footer>
                        <Button
                            onClick={outsideActions.closeManager}
                            type="default"
                            priority="level-two"
                            width="96px"
                        >
                            {i18n._('key-Printing/ProfileManager-Close')}
                        </Button>

                        {!definitionState?.isCategorySelected && (
                            <Button
                                onClick={() => {
                                    outsideActions.onUpdateDefaultDefinition(definitionState.definitionForManager);
                                    outsideActions.closeManager();
                                }}
                                priority="level-two"
                                width="96px"
                                className="margin-left-8"
                            >
                                {i18n._('key-Printing/ProfileManager-Select')}
                            </Button>
                        )}
                    </Modal.Footer>
                </Modal>
            )}
        </React.Fragment>
    );
}
ProfileManager.propTypes = {
    outsideActions: PropTypes.object.isRequired,
    activeDefinitionID: PropTypes.string.isRequired,
    managerTitle: PropTypes.string.isRequired,
    optionConfigGroup: PropTypes.array.isRequired,
    allDefinitions: PropTypes.array.isRequired,
    isOfficialDefinition: PropTypes.func.isRequired,
    managerType: PropTypes.string
};

export default ProfileManager;
