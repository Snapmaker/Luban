import React, { useEffect, useState, useRef } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { isUndefined, cloneDeep, uniqWith } from 'lodash';
// import { PRINTING_QUALITY_CONFIG_GROUP } from '../../../constants';
import modal from '../../../lib/modal';
import DefinitionCreator from '../DefinitionCreator';
import Anchor from '../../components/Anchor';
import i18n from '../../../lib/i18n';
import SvgIcon from '../../components/SvgIcon';
import Notifications from '../../components/Notifications';
import Modal from '../../components/Modal';
import ConfigItem from './ConfigItem';
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

function useGetDefinitions(allDefinitions, definitionState, setDefinitionState, defaultKeysAndId) {
    const definitionsRef = useRef([]);
    useEffect(() => {
        const newState = {};
        const lastDefinitionForManager = definitionState?.definitionForManager;
        let definitionForManager = allDefinitions.find(d => d.definitionId === lastDefinitionForManager?.definitionId && d.name === lastDefinitionForManager?.name);
        if (!definitionForManager && defaultKeysAndId?.name) {
            definitionForManager = allDefinitions.find(d => d.definitionId === defaultKeysAndId?.id && d.name === defaultKeysAndId?.name);
        } else if (!definitionForManager && !defaultKeysAndId?.name) {
            definitionForManager = allDefinitions.find(d => d.definitionId === defaultKeysAndId?.id);
        }
        Object.assign(newState, {
            definitionForManager: definitionForManager
        });

        const definitionOptions = allDefinitions.map(d => {
            const checkboxAndSelectGroup = {};
            defaultKeysAndId.keysArray.forEach((key) => {
                checkboxAndSelectGroup[key] = d.settings[key].default_value;
            });
            checkboxAndSelectGroup.label = d.name;
            checkboxAndSelectGroup.value = d.definitionId;
            if (d?.category) {
                checkboxAndSelectGroup.category = d.category;
            }
            if (Object.keys(d.settings).length === 0 || isUndefined(d.settings)) {
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
    }, [allDefinitions, definitionState.definitionForManager, setDefinitionState, defaultKeysAndId]);
    return definitionsRef;
}

function ProfileManager({ optionConfigGroup, disableCategory = true, managerTitle, defaultKeysAndId, allDefinitions, outsideActions, isDefinitionEditable, isOfficialDefinition }) {
    const [definitionState, setDefinitionState] = useSetState({
        definitionForManager: null,
        definitionOptions: [],
        selectedName: '',
        isCategorySelected: false,
        renamingStatus: false
    });
    const [configExpanded, setConfigExpanded] = useState({});
    const [notificationMessage, setNotificationMessage] = useState('');
    const [activeCateId, setActiveCateId] = useState(2);
    // const [qualityConfigExpanded, setQualityConfigExpanded] = useState((() => {
    //     const obj = {};
    //     PRINTING_QUALITY_CONFIG_GROUP.forEach((config) => {
    //         obj[config.name] = false;
    //     });
    //     return obj;
    // }));
    const refs = {
        fileInput: useRef(null),
        renameInput: useRef(null),
        refCreateModal: useRef(null),
        scrollDom: useRef(null)
    };
    const currentDefinitions = useGetDefinitions(allDefinitions, definitionState, setDefinitionState, defaultKeysAndId);
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
        onSelectDefinitionById: (definitionId, name) => {
            const definitionForManager = definitionState?.definitionForManager;
            let selected;
            if (!name) {
                if (definitionId === definitionForManager?.definitionId) {
                    return;
                }
                selected = currentDefinitions.current.find(d => d.definitionId === definitionId);
            } else {
                selected = currentDefinitions.current.find(d => d.definitionId === definitionId && d.name === name);
            }

            if (definitionState?.renamingStatus) {
                actions.setRenamingStatus(false);
            }
            if (selected) {
                setDefinitionState({
                    definitionForManager: selected,
                    isCategorySelected: false,
                    selectedName: selected.name
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

            setDefinitionState({
                definitionForManager: activeToolCategory,
                selectedName: activeToolCategory.category,
                isCategorySelected: true
            });
        },
        foldCategory: (category) => {
            configExpanded[category] = !configExpanded[category];
            setConfigExpanded(JSON.parse(JSON.stringify(configExpanded)));
        },
        onSelectDefinition: (definitionForManager) => {
            setDefinitionState({
                definitionForManager: definitionForManager,
                isCategorySelected: false,
                selectedName: definitionForManager.name
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
                            if (!isCategorySelected) {
                                await outsideActions.removeManagerDefinition(definition);
                            } else if (isCategorySelected && outsideActions.removeToolCategoryDefinition) {
                                await outsideActions.removeToolCategoryDefinition(definition);
                            }
                            // After removal, select the first definition
                            if (shouldSelectDefinition) {
                                actions.onSelectDefinition(newDefinition);
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
            let title = i18n._('Create');
            let copyType = '', copyCategoryName = '', copyToolName = '';

            if (!isCreate) {
                title = i18n._('Copy');
                copyType = isCategorySelected ? 'Material' : 'Tool';
                copyCategoryName = definitionForManager.category;
                if (!isCategorySelected) {
                    copyToolName = definitionForManager.name;
                }
            } else {
                copyCategoryName = definitionForManager.category;
            }
            if (isCreate && disableCategory) {
                title = i18n._('Create');
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
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-primary"
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
                        {i18n._('OK')}
                    </button>
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
        importFile: (ref) => {
            ref.current.value = null;
            ref.current.click();
        },
        onChangeDefinition: (key, value, checkboxKeyArray) => {
            // now setDefinitionState is synchronize, so remove setTimeout
            const { definitionOptions, definitionForManager } = definitionState;
            const newDefinitionForManager = cloneDeep(definitionForManager);
            newDefinitionForManager.settings[key].default_value = value;
            setDefinitionState({
                definitionForManager: newDefinitionForManager
            });

            if (checkboxKeyArray) {
                let newDefinitionOptions;
                checkboxKeyArray.forEach((checkboxKey) => {
                    newDefinitionOptions = definitionOptions.map((item) => {
                        if (item.label === definitionForManager.name && key === checkboxKey) {
                            item[checkboxKey] = value;
                        }
                        return item;
                    });
                });
                setDefinitionState({
                    definitionOptions: newDefinitionOptions
                });
            }
            outsideActions.onSaveDefinitionForManager(newDefinitionForManager);
        }
    };
    const cates = creatCateArray(definitionState?.definitionOptions);

    return (
        <React.Fragment>
            {definitionState?.definitionForManager && (
                <Modal
                    className={classNames(styles['manager-body'])}
                    style={{ minWidth: '700px' }}
                    onClose={outsideActions.closeManager}
                >
                    <Modal.Body
                        style={{ margin: '0', padding: '20px 0 0', height: '100%', minHeight: '525px', textAlign: 'center' }}
                    >
                        <div className={classNames(styles['manager-type-wrapper'])}>
                            <Anchor
                                className={classNames(styles['manager-type'])}
                            >
                                {i18n._(managerTitle)}
                            </Anchor>
                        </div>

                        <div
                            className={classNames(styles['manager-content'])}
                        >
                            <div className={classNames(styles['manager-name'])}>
                                <ul className={classNames(styles['manager-name-wrapper'])}>
                                    {(cates.map((cate) => {
                                        const displayCategory = limitStringLength(cate.category, 28);
                                        const isCategorySelected = cate.category === definitionState?.definitionForManager.category;
                                        return !!cate.items.length && (
                                            <li key={`${cate.category}`}>
                                                <Anchor
                                                    className={classNames(styles['manager-btn'], { [styles.selected]: actions.isCategorySelectedNow(cate.category) })}
                                                    onClick={() => actions.onSelectToolCategory(cate.category)}
                                                    onDoubleClick={() => actions.setRenamingStatus(true)}
                                                >
                                                    <div className={classNames(styles['manager-btn-unfold'])}>
                                                        <span
                                                            className={classNames(styles['manager-btn-unfold-bg'], { [styles.unfold]: !configExpanded[cate.category] })}
                                                            onKeyDown={() => {}}
                                                            role="button"
                                                            tabIndex={0}
                                                            onClick={() => { actions.foldCategory(cate.category); }}
                                                        />
                                                    </div>
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
                                                            const displayName = limitStringLength(i18n._(currentOption.label), 24);
                                                            const definitionForManager = definitionState?.definitionForManager;
                                                            const isSelected = !definitionState.isCategorySelected && currentOption.value === definitionForManager.definitionId;
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

                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-around'
                                }}
                                >
                                    <SvgIcon
                                        name="Edit"
                                        disabled={isOfficialDefinition(definitionState.definitionForManager)}
                                        size={18}
                                        title={i18n._('Edit')}
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
                                        size={18}
                                        title={i18n._('Import')}
                                        onClick={() => actions.importFile(refs.fileInput)}
                                    />
                                    <SvgIcon
                                        name="Export"
                                        size={18}
                                        disabled={definitionState.isCategorySelected}
                                        title={i18n._('Export')}
                                        onClick={() => outsideActions.exportConfigFile(definitionState.definitionForManager)}
                                    />
                                    <SvgIcon
                                        name="Delete"
                                        size={18}
                                        title={i18n._('Delete')}
                                        onClick={() => actions.onRemoveManagerDefinition(definitionState.definitionForManager, definitionState.isCategorySelected)}
                                        disabled={isOfficialDefinition(definitionState.definitionForManager)}
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

                            {(optionConfigGroup.length > 2) && (
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
                                    {!definitionState?.isCategorySelected && optionConfigGroup.map((group) => {
                                        return (
                                            <ConfigItem
                                                definitionForManager={definitionState?.definitionForManager}
                                                group={group}
                                                defaultKeysAndId={defaultKeysAndId}
                                                key={group.name || group.fields[0]}
                                                isDefinitionEditable={isDefinitionEditable}
                                                onChangeDefinition={actions.onChangeDefinition}
                                            />
                                        );
                                    })}
                                </div>
                            </div>

                        </div>


                        <div className={classNames(styles['manager-settings'], 'clearfix')}>
                            <div className={classNames(styles['manager-settings-save'], styles['manager-settings-btn'])}>
                                <Anchor
                                    onClick={() => { outsideActions.closeManager(); }}
                                    className="sm-btn-large sm-btn-default"
                                    style={{ marginRight: '11px' }}
                                >
                                    {i18n._('Close')}
                                </Anchor>

                                {!definitionState?.isCategorySelected && (
                                    <Anchor
                                        onClick={() => {
                                            outsideActions.onUpdateDefaultDefinition(definitionState.definitionForManager);
                                            outsideActions.closeManager();
                                        }}
                                        className="sm-btn-large sm-btn-primary"
                                    >
                                        {i18n._('Select')}
                                    </Anchor>
                                )}

                            </div>
                        </div>
                    </Modal.Body>
                </Modal>
            )}
        </React.Fragment>
    );
}
ProfileManager.propTypes = {
    outsideActions: PropTypes.object.isRequired,
    defaultKeysAndId: PropTypes.object.isRequired,
    managerTitle: PropTypes.string.isRequired,
    disableCategory: PropTypes.bool,
    optionConfigGroup: PropTypes.array.isRequired,
    allDefinitions: PropTypes.array.isRequired,
    isDefinitionEditable: PropTypes.func.isRequired,
    isOfficialDefinition: PropTypes.func.isRequired
};

export default ProfileManager;
