import React from 'react';

function ProfileManager({ optionConfigGroup, allDefinitions, outsideActions }) {
    // const showPrintingManager = useSelector(state => state?.printing?.showPrintingManager, shallowEqual);
    // const managerDisplayType = useSelector(state => state?.printing?.managerDisplayType, shallowEqual);
    // const materialDefinitions = useSelector(state => state?.printing?.materialDefinitions, shallowEqual);
    // const qualityDefinitions = useSelector(state => state?.printing?.qualityDefinitions, shallowEqual);

    const dispatch = useDispatch();
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
        // qualityFileInput: useRef(null),
        renameInput: useRef(null),
        scrollDom: useRef(null)
    };
    const state = {
        materialDefinitions,
        qualityDefinitions
    };

    const selectedOption = managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL ? definitionState?.materialDefinitionForManager : definitionState?.qualityDefinitionForManager;

    const actions= {
        onSelectDefinitionByType: (definitionForManager) => {
            setDefinitionState({
                definitionForManager: definitionForManager,
                selectedName: definition.name
            });
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
                            await outsideActions.removeDefinitionByType(definition));
                            // After removal, select the first definition
                            if (shouldSelectDefinition) {
                                actions.onSelectDefinitionByType(newDefinition);
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
                            await onComplete(popupActions.getInputValue());
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
                selectedName: event.target.valu
            });
        },
        updaterDefinitionName: async () => {
            const keySelectedDefinition = `${managerDisplayType}DefinitionForManager`;
            const keyDefinitionOptions = `${managerDisplayType}DefinitionOptions`;
            const definition = definitionState[keySelectedDefinition];
            const options = definitionState[keyDefinitionOptions];
            const selectedName = definitionState.selectedName;
            if (selectedName !== definition.name) { // changed
                try {
                    outsideActions.updaterDefinitionName();
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
            if (isOfficialDefinition(selectedOption)) {
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
            const newDefinitionForManager = JSON.parse(JSON.stringify(definitionForManager));
            newDefinitionForManager.settings[key].default_value = value;
            setDefinitionState({
                definitionForManager: newDefinitionForManager
            });

            if (checkboxKey) {
                const newDefinitionOptions = definitionOptions.map((item) => {
                    if (item.label === definitionForManager.name) {
                        item[checkboxKey] = value;
                    }
                    return item;
                });
                setDefinitionState({
                    definitionOptions: newDefinitionOptions
                });
            }
            outsideActions.onSaveDefinitionForManager(newDefinitionForManager)
        },
    }
    useEffect(() => {
        const newState = {};
        const definitionForManager = allDefinitions.find(d => d.definitionId === definitionState?.definitionForManager?.definitionId)
        || allDefinitions.find(d => d.definitionId === 'material.pla');
        Object.assign(newState, {
            definitionForManager: definitionForManager
        });

        const materialDefinitionOptions = allDefinitions.map(d => {
            const checkboxAndSelectGroup = {};
            MATERIAL_CHECKBOX_AND_SELECT_KEY_ARRAY.forEach((key) => {
                checkboxAndSelectGroup[key] = d.settings[key].default_value;
            });
            checkboxAndSelectGroup.label = d.name;
            checkboxAndSelectGroup.value = d.definitionId;
            return checkboxAndSelectGroup;
        });
        Object.assign(newState, {
            definitionOptions: definitionOptions
        });

        setDefinitionState(newState);
    }, [allDefinitions]);

    const optionList = definitionState.definitionOptions;
    const cates = [{ cateName: 'Default', items: [] }, { cateName: 'Custom', items: [] }];
    const regex = /^[a-z]+.[0-9]+$/;
    optionList.forEach(option => {
        const idx = regex.test(option.value) ? 1 : 0;
        cates[idx].items.push(option);
    });
    // : i18n._('Printing Settings')}
    return (
        <React.Fragment>
            <Modal
                className={classNames(styles['manager-body'])}
                style={{ minWidth: '700px' }}
                onClose={outsideActions.hidePrintingManager}
            >
                <Modal.Body
                    style={{ margin: '0', padding: '20px 0 0', height: '100%', minHeight: '525px', textAlign: 'center' }}
                >
                    <div className={classNames(styles['manager-type-wrapper'])}>
                        <Anchor
                            className={classNames(styles['manager-type'])}
                        >
                            i18n._('Material')
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
                                                        onClick={() => { outsideActions.foldCategory(cate.cateName); }}
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
                                                                    onClick={() => outsideActions.onSelectDefinition(currentOption.value)}
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
                                    disabled={isOfficialDefinition(selectedOption)}
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
                                    onClick={() => outsideActions.onRemoveManagerDefinition(managerDisplayType)}
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
                            onWheel={() => { outsideActions.setActiveCate(); }}
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
                                                                        outsideActions.onChangeDefinition(key, value);
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
                                                                    onChange={(event) => outsideActions.onChangeDefinition(key, event.target.checked, QUALITY_CHECKBOX_AND_SELECT_KEY_ARRAY)}
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
                                                                        outsideActions.onChangeDefinition(key, option.value, QUALITY_CHECKBOX_AND_SELECT_KEY_ARRAY);
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
                                onClick={() => { outsideActions.hidePrintingManager(); }}
                                className="sm-btn-large sm-btn-default"
                                style={{ marginRight: '11px' }}
                            >
                                {i18n._('Close')}
                            </Anchor>

                            <Anchor
                                onClick={() => {
                                    outsideActions.onUpdateDefaultDefinition(definitionState.definitionForManager);
                                    outsideActions.hidePrintingManager();
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
        </React.Fragment>
    );
}
ProfileManager.propTypes = {
    outsideActions: PropTypes.object.isRequired,
    optionConfigGroup: PropTypes.object.isRequired,
    allDefinitions: PropTypes.array.isRequired
};

export default ProfileManager;
