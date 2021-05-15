import React, { useEffect, useState, useRef } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { cloneDeep } from 'lodash';
import { PRINTING_QUALITY_CONFIG_GROUP } from '../constants';
import modal from '../lib/modal';
import i18n from '../lib/i18n';
import SvgIcon from '../components/SvgIcon';
import Select from '../components/Select';
import Notifications from '../components/Notifications';
import Modal from '../components/Modal';
import Anchor from '../components/Anchor';
import { NumberInput as Input } from '../components/Input';
import TipTrigger from '../components/TipTrigger';
import useSetState from './set-state';
import { limitStringLength } from '../lib/normalize-range';


function ProfileManager({ optionConfigGroup, managerTitle, defaultKeysAndId, styles, allDefinitions, outsideActions, isDefinitionEditable, isOfficialDefinition }) {
    const [definitionState, setDefinitionState] = useSetState({
        definitionForManager: null,
        definitionOptions: [],
        selectedName: '',
        renamingStatus: false
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
        fileInput: useRef(null),
        renameInput: useRef(null),
        scrollDom: useRef(null)
    };

    const actions = {
        onSelectDefinitionById: (definitionId, name) => {
            const definitionForManager = definitionState?.definitionForManager;
            let selected;
            if (!name) {
                if (definitionId === definitionForManager?.definitionId) {
                    return;
                }
                selected = allDefinitions.find(d => d.definitionId === definitionId);
            } else {
                if (definitionId === definitionForManager?.definitionId && name === definitionForManager?.name) {
                    return;
                }
                selected = allDefinitions.find(d => d.definitionId === definitionId && d.name === name);
            }

            if (definitionState?.renamingStatus) {
                actions.setRenamingStatus(false);
            }
            console.log('onSelectDefinitionById', definitionId, name);
            if (selected) {
                setDefinitionState({
                    definitionForManager: selected,
                    selectedName: selected.name
                });
            }
        },
        foldCategory: (category) => {
            configExpanded[category] = !configExpanded[category];
            setConfigExpanded(JSON.parse(JSON.stringify(configExpanded)));
        },
        onSelectDefinition: (definitionForManager) => {
            setDefinitionState({
                definitionForManager: definitionForManager,
                selectedName: definitionForManager.name
            });
        },
        onRemoveManagerDefinition: async (definition) => {
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
                            await outsideActions.removeDefinitionByType(definition);
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
                title: i18n._('Create Profile'),
                label: i18n._('Enter Profile Name:'),
                defaultInputValue: 'New Profile',
                onComplete: outsideActions.onCreateManagerDefinition
            });
        },
        showDuplicateModal: () => {
            actions.showInputModal({
                title: i18n._('Copy Profile'),
                label: i18n._('Enter Profile Name:'),
                defaultInputValue: definitionState?.definitionForManager?.name,
                onComplete: outsideActions.onCreateManagerDefinition
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
                            const newDefinition = await onComplete(definitionState.definitionForManager, popupActions.getInputValue());
                            console.log('ddd newDefinition', newDefinition);
                            actions.onSelectDefinitionById(newDefinition.definitionId, newDefinition.name);
                            popupActions.close();
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
        updaterDefinitionName: async () => {
            const definition = definitionState?.definitionForManager;
            const options = definitionState?.definitionOptions;
            const selectedName = definitionState.selectedName;
            if (selectedName !== definition.name) { // changed
                try {
                    outsideActions.updaterDefinitionName(definition, selectedName);
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
        setRenamingStatus: (status, currentDefinition) => {
            if (isOfficialDefinition(definitionState.definitionForManager)) {
                return;
            } else if (!status) {
                setDefinitionState({
                    renamingStatus: status
                });
                return;
            }
            setDefinitionState({
                selectedName: currentDefinition.name,
                renamingStatus: status
            });

            status && setTimeout(() => {
                refs.renameInput.current.focus();
            }, 0);
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
    useEffect(() => {
        const newState = {};
        const definitionForManager = allDefinitions.find(d => d.definitionId === definitionState?.definitionForManager?.definitionId)
        || allDefinitions.find(d => d.definitionId === defaultKeysAndId.id);
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
            return checkboxAndSelectGroup;
        });
        console.log('definitionForManager', definitionForManager);
        Object.assign(newState, {
            definitionOptions: definitionOptions
        });

        setDefinitionState(newState);
    }, [allDefinitions]);
    console.log('definitionState.definitionState', definitionState.definitionForManager);
    const optionList = definitionState.definitionOptions;
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
    return (
        <React.Fragment>
            {definitionState?.definitionForManager && (
                <Modal
                    className={classNames(styles['manager-body'])}
                    style={{ minWidth: '700px' }}
                    onClose={outsideActions.hideManager}
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

                                        return !!cate.items.length && (
                                            <li key={`${cate.category}`}>
                                                <Anchor
                                                    className={classNames(styles['manager-btn'])}

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
                                                    <span>{displayCategory}</span>
                                                </Anchor>
                                                {!configExpanded[cate.category] && (
                                                    <ul style={{ listStyle: 'none', paddingLeft: '0' }}>
                                                        {(cate.items.map((currentOption) => {
                                                            const displayName = limitStringLength(i18n._(currentOption.label), 24);
                                                            const definitionForManager = definitionState?.definitionForManager;
                                                            const isSelected = currentOption.value === definitionForManager.definitionId && currentOption.label === definitionForManager.name;
                                                            return (
                                                                <li key={`${currentOption.value}${currentOption.label}`}>
                                                                    <Anchor
                                                                        className={classNames(styles['manager-btn'], { [styles.selected]: isSelected })}
                                                                        style={{ paddingLeft: '42px' }}
                                                                        title={currentOption.label}
                                                                        onClick={() => actions.onSelectDefinitionById(currentOption.value, currentOption.label)}
                                                                        onDoubleClick={() => actions.setRenamingStatus(true, definitionState.definitionForManager)}
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
                                                                                        actions.setRenamingStatus(false, definitionState.definitionForManager);
                                                                                        actions.updaterDefinitionName();
                                                                                    }
                                                                                }}
                                                                                onBlur={() => {
                                                                                    actions.setRenamingStatus(false, definitionState.definitionForManager);
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
                                        disabled={isOfficialDefinition(definitionState.definitionForManager)}
                                        size={18}
                                        title={i18n._('Edit')}
                                        onClick={() => actions.setRenamingStatus(true, definitionState.definitionForManager)}
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
                                        title={i18n._('Export')}
                                        onClick={() => outsideActions.exportConfigFile(definitionState.definitionForManager)}
                                    />
                                    <SvgIcon
                                        name="Delete"
                                        size={18}
                                        title={i18n._('Delete')}
                                        onClick={() => actions.onRemoveManagerDefinition(definitionState.definitionForManager)}
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
                                                    const setting = definitionState.definitionForManager.settings[key];
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
                                                                    if (definitionState.definitionForManager.settings[enabledKey]) {
                                                                        const value = definitionState.definitionForManager.settings[enabledKey].default_value;
                                                                        if (value !== enabledValue) {
                                                                            return null;
                                                                        }
                                                                    }
                                                                } else {
                                                                    if (definitionState.definitionForManager.settings[condition]) {
                                                                        const value = definitionState.definitionForManager.settings[condition].default_value;
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
                                                                if (definitionState.definitionForManager.settings[condition]) {
                                                                    const value = definitionState.definitionForManager.settings[condition].default_value;
                                                                    if (value) {
                                                                        result = true;
                                                                    }
                                                                }
                                                                if (condition.match('(.*) > ([0-9]+)')) {
                                                                    const m = condition.match('(.*) > ([0-9]+)');
                                                                    const enabledKey = m[1];
                                                                    const enabledValue = parseInt(m[2], 10);
                                                                    if (definitionState.definitionForManager.settings[enabledKey]) {
                                                                        const value = definitionState.definitionForManager.settings[enabledKey].default_value;
                                                                        if (value > enabledValue) {
                                                                            result = true;
                                                                        }
                                                                    }
                                                                }
                                                                if (condition.match('(.*) < ([0-9]+)')) {
                                                                    const m = condition.match('(.*) > ([0-9]+)');
                                                                    const enabledKey = m[1];
                                                                    const enabledValue = parseInt(m[2], 10);
                                                                    if (definitionState.definitionForManager.settings[enabledKey]) {
                                                                        const value = definitionState.definitionForManager.settings[enabledKey].default_value;
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
                                                                    if (definitionState.definitionForManager.settings[enabledKey]) {
                                                                        const value = definitionState.definitionForManager.settings[enabledKey].default_value;
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
                                                                        disabled={!isDefinitionEditable(definitionState.definitionForManager)}
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
                                                                        disabled={!isDefinitionEditable(definitionState.definitionForManager)}
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
                                                                        style={{ cursor: !isDefinitionEditable(definitionState.definitionForManager) ? 'not-allowed' : 'default' }}
                                                                        type="checkbox"
                                                                        checked={defaultValue}
                                                                        disabled={!isDefinitionEditable(definitionState.definitionForManager)}
                                                                        onChange={(event) => actions.onChangeDefinition(key, event.target.checked, defaultKeysAndId.keysArray)}
                                                                    />
                                                                )}
                                                                {type === 'enum' && (
                                                                    <Select
                                                                        className="sm-parameter-row__select-md"
                                                                        backspaceRemoves={false}
                                                                        clearable={false}
                                                                        menuContainerStyle={{ zIndex: 5 }}
                                                                        name={key}
                                                                        disabled={!isDefinitionEditable(definitionState.definitionForManager)}
                                                                        options={opts}
                                                                        value={defaultValue}
                                                                        onChange={(option) => {
                                                                            actions.onChangeDefinition(key, option.value, defaultKeysAndId.keysArray);
                                                                        }}
                                                                    />
                                                                )}
                                                                {type === undefined && (
                                                                    <Input
                                                                        className="sm-parameter-row__input"
                                                                        style={{ width: '160px' }}
                                                                        value={defaultValue}
                                                                        disabled={!isDefinitionEditable(definitionState.definitionForManager)}
                                                                        onChange={(value) => {
                                                                            actions.onChangeDefinition(key, value);
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
                                    onClick={() => { outsideActions.hideManager(); }}
                                    className="sm-btn-large sm-btn-default"
                                    style={{ marginRight: '11px' }}
                                >
                                    {i18n._('Close')}
                                </Anchor>

                                <Anchor
                                    onClick={() => {
                                        outsideActions.onUpdateDefaultDefinition(definitionState.definitionForManager);
                                        outsideActions.hideManager();
                                    }}
                                    className="sm-btn-large sm-btn-primary"
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
ProfileManager.propTypes = {
    outsideActions: PropTypes.object.isRequired,
    defaultKeysAndId: PropTypes.object.isRequired,
    managerTitle: PropTypes.string.isRequired,
    styles: PropTypes.object.isRequired,
    optionConfigGroup: PropTypes.array.isRequired,
    allDefinitions: PropTypes.array.isRequired,
    isDefinitionEditable: PropTypes.func.isRequired,
    isOfficialDefinition: PropTypes.func.isRequired
};

export default ProfileManager;
