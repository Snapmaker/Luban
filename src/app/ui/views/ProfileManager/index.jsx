import React, { useEffect, useState, useRef } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
// import { useSelector, shallowEqual } from 'react-redux';
import { isUndefined, cloneDeep, uniqWith } from 'lodash';
// import { PRINTING_QUALITY_CONFIG_GROUP } from '../../../constants';
import modal from '../../../lib/modal';
import DefinitionCreator from '../DefinitionCreator';
import Anchor from '../../components/Anchor';
import i18n from '../../../lib/i18n';
import SvgIcon from '../../components/SvgIcon';
import Notifications from '../../components/Notifications';
import Modal from '../../components/Modal';
import { Button } from '../../components/Buttons';
import ConfigValueBox from './ConfigValueBox';
import useSetState from '../../../lib/hooks/set-state';
import { limitStringLength } from '../../../lib/normalize-range';
import styles from './styles.styl';

function creatCateArray(optionList) {
    const cates = [];
    const regex = /^[a-z]+.[0-9]+$/;
    optionList.forEach(option => {
        if (option.category) {
            const cateItem = cates.find((cate) => cate.category === option.category);
            if (cateItem) {
                cateItem.items.push(option);
            } else {
                const eachCate = { items: [] };
                eachCate.category = option.category;
                eachCate.items.push(option);
                cates.push(eachCate);
            }
        } else {
            const idx = regex.test(option.value) ? 'Custom' : 'Default';
            const cateItem = cates.find((cate) => cate.category === idx);
            if (cateItem) {
                cateItem.items.push(option);
            } else {
                const eachCate = { items: [] };
                eachCate.category = idx;
                eachCate.items.push(option);
                cates.push(eachCate);
            }
        }
    });
    return cates;
}

function useGetDefinitions(allDefinitions, definitionState, setDefinitionState, selectedId, getDefaultDefinition) {
    const definitionsRef = useRef([]);
    useEffect(() => {
        const newState = {};
        const lastDefinitionForManager = definitionState?.definitionForManager;
        let definitionForManager = allDefinitions.find(d => d.definitionId === lastDefinitionForManager?.definitionId);
        if (!definitionForManager) {
            definitionForManager = allDefinitions.find(d => d.definitionId === selectedId);
        }
        const selectedSettingDefaultValue = getDefaultDefinition && getDefaultDefinition(definitionForManager?.definitionId);
        Object.assign(newState, {
            definitionForManager: definitionForManager,
            selectedSettingDefaultValue: selectedSettingDefaultValue
        });

        const definitionOptions = allDefinitions.map(d => {
            const checkboxAndSelectGroup = {};
            checkboxAndSelectGroup.label = d.name;
            checkboxAndSelectGroup.value = d.definitionId;
            checkboxAndSelectGroup.isDefault = !!d.isDefault;
            if (d?.category) {
                checkboxAndSelectGroup.category = d.category;
            }
            if (d.settings && (Object.keys(d.settings).length === 0 || isUndefined(d.settings))) {
                checkboxAndSelectGroup.isHidden = true;
            }
            return checkboxAndSelectGroup;
        });
        Object.assign(newState, {
            definitionOptions: definitionOptions
        });
        allDefinitions.forEach((item) => {
            definitionsRef.current.push(item);
        });
        setDefinitionState(newState);

        return () => {
            definitionsRef.current = [];
        };
    }, [allDefinitions, definitionState.definitionForManager, setDefinitionState, selectedId]);
    return definitionsRef;
}

function ProfileManager({ optionConfigGroup, disableCategory = true, managerTitle, selectedId, allDefinitions, outsideActions, isOfficialDefinition, activeDefinition, headType }) {
    const [definitionState, setDefinitionState] = useSetState({
        definitionForManager: activeDefinition,
        definitionOptions: [],
        selectedName: '',
        isCategorySelected: false,
        renamingStatus: false
    });
    const [configExpanded, setConfigExpanded] = useState({});
    const [notificationMessage, setNotificationMessage] = useState('');
    const refs = {
        fileInput: useRef(null),
        renameInput: useRef(null),
        refCreateModal: useRef(null)
    };
    const currentDefinitions = useGetDefinitions(allDefinitions, definitionState, setDefinitionState, selectedId, outsideActions.getDefaultDefinition);
    const actions = {
        isCategorySelectedNow: (category) => {
            const { definitionForManager, isCategorySelected } = definitionState;
            return isCategorySelected && definitionForManager.category === category;
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
        onSelectToolCategory: (category) => {
            if (disableCategory) return;
            const { definitionForManager, isCategorySelected, renamingStatus } = definitionState;
            if (isCategorySelected && category === definitionForManager.category) {
                return;
            }
            if (renamingStatus) {
                actions.setRenamingStatus(false);
            }
            const activeToolCategory = currentDefinitions.current.find(d => d.category === category);
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
        onSelectDefinition: (definitionForManager) => {
            const selectedSettingDefaultValue = outsideActions.getDefaultDefinition(definitionForManager.definitionId);
            setDefinitionState({
                definitionForManager: definitionForManager,
                isCategorySelected: false,
                selectedName: definitionForManager.name,
                selectedSettingDefaultValue: selectedSettingDefaultValue
            });
        },
        onRemoveManagerDefinition: async (definition, isCategorySelected) => {
            if (isOfficialDefinition(definitionState.definitionForManager)) {
                return;
            }
            let newDefinition = {};
            let shouldSelectDefinition = false;
            if (allDefinitions.length) {
                shouldSelectDefinition = true;
                newDefinition = allDefinitions[0];
            }
            const deleteName = isCategorySelected ? definition.category : definition.name;
            const popupActions = modal({
                title: i18n._('key-Printing/ProfileManager-Delete Profile'),
                body: (
                    <React.Fragment>
                        <p>{`Are you sure to delete profile "${deleteName}"?`}</p>
                    </React.Fragment>
                ),

                footer: (
                    <Button
                        priority="level-two"
                        className="margin-left-8"
                        width="96px"
                        onClick={async () => {
                            if (!isCategorySelected) {
                                await outsideActions.removeManagerDefinition(definition);
                            } else if (isCategorySelected && outsideActions.removeToolCategoryDefinition) {
                                await outsideActions.removeToolCategoryDefinition(definition);
                            }
                            // After removal, select the first definition
                            if (shouldSelectDefinition) {
                                actions.onSelectDefinition(newDefinition);
                            }
                            if (definition?.definitionId === activeDefinition?.definitionId) {
                                outsideActions.onUpdateDefaultDefinition(newDefinition);
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
        showInputModal: ({ isCreate }) => {
            const definitionForManager = definitionState?.definitionForManager;
            const isCategorySelected = definitionState?.isCategorySelected;
            let title = i18n._('key-Printing/ProfileManager-Create Profile');
            let copyType = '', copyCategoryName = '', copyToolName = '';

            if (!isCreate) {
                title = i18n._('key-Printing/ProfileManager-Copy Profile');
                copyType = isCategorySelected ? 'Material' : 'Tool';
                copyCategoryName = definitionForManager.category;
                if (!isCategorySelected) {
                    copyToolName = definitionForManager.name;
                }
            } else {
                copyCategoryName = definitionForManager.category;
            }
            if (isCreate && disableCategory) {
                title = i18n._('key-Printing/ProfileManager-Create Profile');
                copyType = 'Tool';
                copyToolName = 'New Profile';
            }
            isCreate = isCreate && !disableCategory;

            let materialOptions = definitionState?.definitionOptions.map(option => {
                return {
                    label: option.category,
                    value: option.category
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
                            headType={headType}
                            isCreate={isCreate}
                            disableCategory={disableCategory}
                            ref={refs.refCreateModal}
                            materialOptions={materialOptions}
                            copyType={copyType}
                            copyCategoryName={copyCategoryName}
                            copyToolName={copyToolName}
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
                                    newName = data.materialName;
                                    const newDefinition = await outsideActions.onCreateManagerDefinition(newDefinitionForManager, newName, isCategorySelected);
                                    actions.onSelectToolCategory(newDefinition.category);
                                } else {
                                    newDefinitionForManager.category = data.materialName;
                                    newName = data.toolName;
                                    const newDefinition = await outsideActions.onCreateManagerDefinition(newDefinitionForManager, newName, isCategorySelected);
                                    actions.onSelectDefinitionById(newDefinition.definitionId, newDefinition.name);
                                }
                            } else {
                                if (data.createType === 'Material') {
                                    newDefinitionForManager.category = data.materialName;
                                    newName = data.materialName;
                                    newDefinitionForManager.settings = {};
                                    const newDefinition = await outsideActions.onCreateManagerDefinition(newDefinitionForManager, newName, data.createType === 'Material', isCreate);
                                    actions.onSelectToolCategory(newDefinition.category);
                                } else {
                                    newDefinitionForManager.category = data.materialName;
                                    newName = data.toolName;
                                    if (Object.keys(newDefinitionForManager.settings).length === 0) {
                                        newDefinitionForManager.settings = cloneDeep(allDefinitions[0].settings);
                                    }
                                    const newDefinition = await outsideActions.onCreateManagerDefinition(newDefinitionForManager, newName, data.createType === 'Material', isCreate);
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
            const options = definitionState?.definitionOptions;
            const selectedName = definitionState.selectedName;
            if (selectedName !== definition.name) { // changed
                try {
                    await outsideActions.updateDefinitionName(definition, selectedName);
                    const option = options.find(o => o.value === definition.definitionId);
                    option.label = selectedName;
                    setDefinitionState({
                        definitionOptions: [...options]
                    });
                } catch (err) {
                    actions.showNotification(err);
                }
            }
        },
        updateCategoryName: async () => {
            const definition = definitionState?.definitionForManager;
            let options = definitionState?.definitionOptions;
            const selectedName = definitionState.selectedName;
            if (selectedName !== definition.category) { // changed
                try {
                    await outsideActions.updateCategoryName(definition, selectedName);
                    options = options.map(o => {
                        if (o.category === definition.category) {
                            o.category = selectedName;
                        }
                        return o;
                    });
                    setDefinitionState({
                        definitionOptions: [...options]
                    });
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
        onChangeDefinition: (key, value) => {
            // now setDefinitionState is synchronize, so remove setTimeout
            const { definitionForManager } = definitionState;
            const newDefinitionForManager = cloneDeep(definitionForManager);
            newDefinitionForManager.settings[key].default_value = value;
            setDefinitionState({
                definitionForManager: newDefinitionForManager
            });

            outsideActions.onSaveDefinitionForManager(newDefinitionForManager);
        }
    };
    const cates = creatCateArray(definitionState?.definitionOptions);

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
                                    {(cates.map((cate) => {
                                        const displayCategory = limitStringLength(cate.category ?? '', 28);
                                        const isDefault = cate.items.some(item => item.isDefault);
                                        const isCategorySelected = cate.category === definitionState?.definitionForManager.category;
                                        return !!cate.items.length && (
                                            <li key={`${cate.category}`}>
                                                <Anchor
                                                    className={classNames(styles['manager-btn'], { [styles.selected]: actions.isCategorySelectedNow(cate.category) })}
                                                    onClick={() => actions.onSelectToolCategory(cate.category)}
                                                    onDoubleClick={() => actions.setRenamingStatus(true)}
                                                >
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
                                                    ) : displayCategory}
                                                </Anchor>
                                                {!configExpanded[cate.category] && (
                                                    <ul style={{ listStyle: 'none', paddingLeft: '0' }}>
                                                        {(cate.items.map((currentOption) => {
                                                            const displayName = limitStringLength(currentOption.label ?? '', 24);
                                                            const definitionForManager = definitionState?.definitionForManager;
                                                            const isSelected = !definitionState.isCategorySelected && currentOption.value === definitionForManager.definitionId;
                                                            let isAllValueDefault = isDefault && isSelected;
                                                            if (isDefault && isSelected && definitionState?.selectedSettingDefaultValue) {
                                                                const selectedSettingDefaultValue = definitionState?.selectedSettingDefaultValue;
                                                                optionConfigGroup.map((item) => {
                                                                    item.fields.map((key) => {
                                                                        if (definitionForManager.settings[key].default_value !== selectedSettingDefaultValue[key].default_value) {
                                                                            isAllValueDefault = false;
                                                                        }
                                                                        return null;
                                                                    });
                                                                    return null;
                                                                });
                                                            }
                                                            if (isUndefined(currentOption.label) || currentOption.isHidden) {
                                                                return null;
                                                            } else {
                                                                return (
                                                                    <li key={`${currentOption.value}${currentOption.label}`}>
                                                                        <Anchor
                                                                            className={classNames(styles['manager-btn'], { [styles.selected]: isSelected })}
                                                                            style={{ paddingLeft: '42px' }}
                                                                            title={currentOption.label}
                                                                            onClick={() => actions.onSelectDefinitionById(currentOption.value, currentOption.label)}
                                                                            onDoubleClick={() => actions.setRenamingStatus(true)}
                                                                        >
                                                                            {isDefault && isSelected && !isAllValueDefault && (
                                                                                <SvgIcon
                                                                                    name="Reset"
                                                                                    size={24}
                                                                                    className="margin-left-n-28 margin-right-4"
                                                                                    onClick={() => {
                                                                                        outsideActions.resetDefinitionById(currentOption.value);
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
                                                                                // disabled={!isDefinitionEditable(qualityDefinitionForManager)}
                                                                                />
                                                                            ) : displayName}

                                                                        </Anchor>
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
                                            onChange={outsideActions.onChangeFileForManager}
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
                                onChangeDefinition={actions.onChangeDefinition}
                                selectedSettingDefaultValue={definitionState?.selectedSettingDefaultValue}
                                showMiddle={managerTitle === 'key-Printing/PrintingConfigurations-Printing Settings'}
                                hideMiniTitle={managerTitle === 'key-Printing/PrintingConfigurations-Material Settings'}
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
    activeDefinition: PropTypes.object,
    selectedId: PropTypes.string.isRequired,
    managerTitle: PropTypes.string.isRequired,
    disableCategory: PropTypes.bool,
    optionConfigGroup: PropTypes.array.isRequired,
    allDefinitions: PropTypes.array.isRequired,
    // isDefinitionEditable: PropTypes.func.isRequired,
    isOfficialDefinition: PropTypes.func.isRequired,
    headType: PropTypes.string
};

export default ProfileManager;
