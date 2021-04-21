import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import { includes, noop } from 'lodash';
import SvgIcon from '../../components/SvgIcon';
import modal from '../../lib/modal';
import Notifications from '../../components/Notifications';
import i18n from '../../lib/i18n';
import Modal from '../../components/Modal';
import Anchor from '../../components/Anchor';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import CreateModal from './CreateModal';
import { actions as cncActions } from '../../flux/cnc';
import { actions as projectActions } from '../../flux/project';
import styles from './styles.styl';
import { limitStringLength } from '../../lib/normalize-range';

import { CNC_TOOL_CONFIG_GROUP } from '../../constants';

const SUBCATEGORY = 'CncConfig';
const defaultToolListNames = [
    'Carving V bit',
    'Flat End Mill',
    'Ball End Mill',
    'Straight Groove V-bit'
];

function isOfficialListDefinition(activeToolList) {
    return includes(['Default'],
        activeToolList.definitionId)
            && includes(defaultToolListNames,
                activeToolList.name);
}

// function isOfficialCategoryDefinition(activeToolCategory) {
//     return includes(['Default'],
//         activeToolCategory.definitionId);
// }
class CncToolManager extends PureComponent {
    static propTypes = {
        showCncToolManager: PropTypes.bool,
        toolDefinitions: PropTypes.array.isRequired,
        activeToolListDefinition: PropTypes.object,
        duplicateToolCategoryDefinition: PropTypes.func.isRequired,
        duplicateToolListDefinition: PropTypes.func.isRequired,

        updateToolListDefinition: PropTypes.func.isRequired,
        updateToolDefinitionName: PropTypes.func.isRequired,
        removeToolCategoryDefinition: PropTypes.func.isRequired,
        removeToolListDefinition: PropTypes.func.isRequired,
        onUploadToolDefinition: PropTypes.func.isRequired,

        exportConfigFile: PropTypes.func.isRequired,
        changeActiveToolListDefinition: PropTypes.func.isRequired,
        updateShowCncToolManager: PropTypes.func.isRequired
    };

    toolFileInput = React.createRef();

    refCreateModal = React.createRef();

    renameInput = React.createRef();

    state = {
        showCncToolManager: false,
        nameForToolList: defaultToolListNames[0],
        configExpanded: {},
        activeToolListDefinition: null,
        activeToolCategory: null,

        isCategorySelected: false,
        notificationMessage: ''
    };

    actions = {
        foldCategory: (definitionId) => {
            const { configExpanded } = this.state;
            configExpanded[definitionId] = !configExpanded[definitionId];
            this.setState({
                configExpanded: JSON.parse(JSON.stringify(configExpanded))
            });
        },
        hideCncToolManager: () => {
            this.props.updateShowCncToolManager(false);
        },
        showNotification: (msg) => {
            this.setState({
                notificationMessage: msg
            });
        },
        clearNotification: () => {
            this.setState({
                notificationMessage: ''
            });
        },
        onChangeToolCategoryName: () => {
            const { activeToolCategory } = this.state;
            setTimeout(() => {
                this.setState({
                    activeToolCategory: {
                        ...activeToolCategory,
                        category: this.state.selectedName
                    }
                });
                this.actions.onSaveToolCategory();
            }, 0);
        },
        onChangeToolListName: () => {
            setTimeout(() => {
                this.setState({
                    nameForToolList: this.state.selectedName
                });
                this.actions.onSaveToolList();
            }, 0);
        },
        onChangeToolFileForManager: (event) => {
            const toolFile = event.target.files[0];
            this.props.onUploadToolDefinition(toolFile);
        },
        importFile: () => {
            this.toolFileInput.current.value = null;
            this.toolFileInput.current.click();
        },
        exportConfigFile: () => {
            const { activeToolCategory } = this.state;
            const definitionId = activeToolCategory.definitionId;
            const targetFile = `${definitionId}.def.json`;
            this.props.exportConfigFile(targetFile, SUBCATEGORY);
        },
        onChangeToolDefinition: (key, value) => {
            setTimeout(() => {
                const { activeToolListDefinition } = this.state;
                const newActiveToolListDefinition = JSON.parse(JSON.stringify(activeToolListDefinition));
                newActiveToolListDefinition.config[key].default_value = value;

                this.setState({
                    activeToolListDefinition: newActiveToolListDefinition
                });
                this.actions.onSaveToolList();
            }, 0);
        },
        onSaveToolCategory: async () => {
            const { activeToolCategory, isCategorySelected } = this.state;
            const definitionId = activeToolCategory.definitionId;
            const oldCategory = this.props.toolDefinitions.find(d => d.definitionId === definitionId);
            if (oldCategory.category !== activeToolCategory.category) { // unchanged
                try {
                    await this.props.updateToolDefinitionName(isCategorySelected, definitionId, oldCategory.category, activeToolCategory.category);
                } catch (err) {
                    this.actions.showNotification(err);
                }
            }
        },

        onSaveToolList: async () => {
            const { activeToolListDefinition, isCategorySelected, nameForToolList } = this.state;
            const definitionId = activeToolListDefinition.definitionId;
            const oldCategory = this.props.toolDefinitions.find(d => d.definitionId === definitionId);
            const oldToolList = oldCategory.toolList.find(d => d.name === activeToolListDefinition.name);
            await this.props.updateToolListDefinition(activeToolListDefinition);
            if (oldToolList.name !== nameForToolList) { // unchanged
                try {
                    await this.props.updateToolDefinitionName(isCategorySelected, definitionId, oldToolList.name, nameForToolList);
                } catch (err) {
                    this.actions.showNotification(err);
                }
            }
        },
        isNameSelectedNow: (definitionId, name) => {
            return this.state.activeToolListDefinition && this.state.activeToolListDefinition.name === name && this.state.activeToolListDefinition.definitionId === definitionId;
        },
        isCategorySelectedNow: (definitionId) => {
            return this.state.activeToolCategory && this.state.activeToolCategory.definitionId === definitionId;
        },
        onSelectToolCategory: (definitionId) => {
            if (this.state.isCategorySelected && definitionId === this.state.activeToolCategory.definitionId) {
                return;
            }
            this.actions.setRenamingStatus(false);
            let activeToolCategory = this.props.toolDefinitions.find(d => d.definitionId === definitionId);
            if (!activeToolCategory) {
                activeToolCategory = this.props.toolDefinitions[0];
            }

            const name = this.state.activeToolListDefinition.name;
            const toolDefinitionForManager = activeToolCategory.toolList.find(k => k.name === name)
             || activeToolCategory.toolList[0];
            if (toolDefinitionForManager) {
                toolDefinitionForManager.definitionId = activeToolCategory.definitionId;
                this.setState({ activeToolListDefinition: toolDefinitionForManager });
            }
            this.setState({
                activeToolCategory: activeToolCategory,
                isCategorySelected: true
            });
        },
        onSelectToolName: (definitionId, name) => {
            if (
                !this.state.isCategorySelected
                && definitionId === this.state.activeToolCategory.definitionId
                && name === this.state.activeToolListDefinition.name
            ) {
                return;
            }
            this.actions.setRenamingStatus(false);
            const activeToolCategory = this.props.toolDefinitions.find(d => d.definitionId === definitionId);
            const toolDefinitionForManager = activeToolCategory && activeToolCategory.toolList.find(k => k.name === name);
            if (toolDefinitionForManager) {
                toolDefinitionForManager.definitionId = activeToolCategory.definitionId;
                this.setState({
                    activeToolListDefinition: toolDefinitionForManager,
                    activeToolCategory: activeToolCategory,
                    nameForToolList: toolDefinitionForManager.name,
                    isCategorySelected: false
                });
            }
        },
        onDuplicateToolCategoryDefinition: async () => {
            const newDefinition = await this.props.duplicateToolCategoryDefinition(this.state.activeToolCategory);
            this.actions.onSelectToolCategory(newDefinition.definitionId);
        },
        onDuplicateToolNameDefinition: async () => {
            const newToolName = await this.props.duplicateToolListDefinition(this.state.activeToolCategory, this.state.activeToolListDefinition);
            // need to change ,update activeToolListDefinition
            this.actions.onSelectToolName(this.state.activeToolCategory.definitionId, newToolName);
        },
        onDuplicateDefinition: async () => {
            if (this.state.isCategorySelected) {
                return this.actions.onDuplicateToolCategoryDefinition();
            } else {
                return this.actions.onDuplicateToolNameDefinition();
            }
        },
        onRemoveToolDefinition: async () => {
            const { isCategorySelected, activeToolCategory } = this.state;
            let ok;
            if (isCategorySelected) {
                const popupActions = modal({
                    title: i18n._('Delete Parameters'),
                    body: (
                        <React.Fragment>
                            <p>{`Are you sure to remove category profile "${activeToolCategory.category}"?`}</p>
                        </React.Fragment>

                    ),

                    footer: (
                        <button
                            type="button"
                            className="sm-btn-large sm-btn-primary"
                            onClick={async () => {
                                await this.props.removeToolCategoryDefinition(activeToolCategory.definitionId);
                                popupActions.close();
                            }}
                        >
                            {i18n._('OK')}
                        </button>
                    )
                });
            } else {
                const activeToolListDefinition = this.state.activeToolListDefinition;
                const popupActions = modal({
                    title: i18n._('Delete Parameters'),
                    body: (
                        <React.Fragment>
                            <p>{`Are you sure to remove profile "${activeToolListDefinition.name}"?`}</p>
                        </React.Fragment>

                    ),

                    footer: (
                        <button
                            type="button"
                            className="sm-btn-large sm-btn-primary"
                            onClick={async () => {
                                await this.props.removeToolListDefinition(activeToolCategory, activeToolListDefinition);
                                popupActions.close();
                            }}
                        >
                            {i18n._('OK')}
                        </button>
                    )
                });
            }

            // After removal, select the first definition
            if (ok && this.props.toolDefinitions.length) {
                if (activeToolCategory) {
                    this.actions.onSelectToolCategory(activeToolCategory.definitionId);
                } else {
                    this.actions.onSelectToolCategory(this.props.toolDefinitions[0].definitionId);
                }
            }
        },
        onSelectToolListDefinition: () => {
            const { definitionId, name } = this.state.activeToolListDefinition;
            this.props.changeActiveToolListDefinition(definitionId, name);
        },
        onChangeSelectedName: (event) => {
            this.setState({
                selectedName: event.target.value
            });
        },
        setRenamingStatus: (status) => {
            if (
                (this.state.isCategorySelected && this.state.activeToolCategory.category === 'Default Material')
                || (!this.state.isCategorySelected && isOfficialListDefinition(this.state.activeToolListDefinition))
            ) {
                return;
            }
            this.setState({
                renamingStatus: status
            });
            if (status) {
                const title = this.state.isCategorySelected ? this.state.activeToolCategory.category : this.state.activeToolListDefinition.name;
                this.setState({
                    selectedName: title
                });
                setTimeout(() => {
                    this.renameInput.current.focus();
                }, 0);
            }
        },
        showNewModal: () => {
            this.actions.showCreateModal({
                isCreate: true
            });
        },
        showDuplicateModal: () => {
            this.actions.showCreateModal({
                isCreate: false
            });
        },
        showCreateModal: ({ isCreate }) => {
            let title = i18n._('Create');
            let copyType = '', copyTargetName = '';
            if (!isCreate) {
                title = i18n._('Copy');
                copyType = this.state.isCategorySelected ? 'Material' : 'Tool';
                copyTargetName = this.state.isCategorySelected ? this.state.activeToolCategory.category : this.state.activeToolListDefinition.name;
            }
            const materialOptions = this.state.toolDefinitionOptions.map(option => {
                return {
                    label: option.category,
                    value: option.definitionId
                };
            });
            const popupActions = modal({
                title: title,
                body: (
                    <React.Fragment>
                        <CreateModal
                            isCreate={isCreate}
                            ref={this.refCreateModal}
                            materialOptions={materialOptions}
                            copyType={copyType}
                            copyTargetName={copyTargetName}
                        />
                    </React.Fragment>

                ),

                footer: (
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-primary"
                        onClick={async () => {
                            const data = this.refCreateModal.current.getData();
                            // await onComplete(popupActions.getInputValue());
                            popupActions.close();
                            if (isCreate) {
                                if (data.createType === 'Material') {
                                    const toolCategory = {
                                        ...this.state.activeToolCategory,
                                        toolList: [],
                                        category: data.materialName
                                    };

                                    const newDefinition = await this.props.duplicateToolCategoryDefinition(toolCategory);
                                    this.actions.onSelectToolCategory(newDefinition.definitionId);
                                } else {
                                    const toolCategory = this.props.toolDefinitions.find(category => category.definitionId === data.materialDefinitionId);
                                    const tool = { ...this.state.activeToolListDefinition, name: data.toolName };
                                    const newToolName = await this.props.duplicateToolListDefinition(toolCategory, tool);
                                    this.actions.onSelectToolName(this.state.activeToolCategory.definitionId, newToolName);
                                }
                            } else {
                                if (this.state.isCategorySelected) {
                                    const toolCategory = { ...this.state.activeToolCategory };
                                    toolCategory.category = data.materialName;
                                    const newDefinition = await this.props.duplicateToolCategoryDefinition(toolCategory);
                                    this.actions.onSelectToolCategory(newDefinition.definitionId);
                                } else {
                                    const toolCategory = this.props.toolDefinitions.find(category => category.definitionId === data.materialDefinitionId);
                                    const tool = { ...this.state.activeToolListDefinition, name: data.toolName };
                                    const newToolName = await this.props.duplicateToolListDefinition(toolCategory, tool);
                                    this.actions.onSelectToolName(this.state.activeToolCategory.definitionId, newToolName);
                                }
                            }
                        }}
                    >
                        {i18n._('OK')}
                    </button>
                )
            });
        }
    };

    componentWillReceiveProps(nextProps) {
        if (nextProps.showCncToolManager !== this.props.showCncToolManager) {
            this.setState({ showCncToolManager: nextProps.showCncToolManager });
        }
        // Load 'toolDefinitions' and compose the content of the manager
        if (nextProps.toolDefinitions !== this.props.toolDefinitions) {
            const newState = {};
            let activeToolCategory;
            let activeToolListDefinition;
            if (this.props.toolDefinitions.length === 0) {
                activeToolCategory = nextProps.toolDefinitions.find(d => d.definitionId === 'Default');
                activeToolListDefinition = activeToolCategory.toolList.find(k => k.name === defaultToolListNames[0]);
                activeToolListDefinition.definitionId = activeToolCategory && activeToolCategory.definitionId;
                Object.assign(newState, {
                    activeToolCategory,
                    activeToolListDefinition
                });
            } else {
                activeToolCategory = nextProps.toolDefinitions.find(d => d.definitionId === this.state.activeToolListDefinition.definitionId) || nextProps.toolDefinitions.find(d => d.definitionId === 'Default');
                activeToolListDefinition = activeToolCategory.toolList.find(k => k.name === this.state.activeToolListDefinition.name)
                || activeToolCategory.toolList.find(k => k.name === defaultToolListNames[0]);
                if (activeToolListDefinition) {
                    activeToolListDefinition.definitionId = activeToolCategory && activeToolCategory.definitionId;
                    Object.assign(newState, {
                        activeToolCategory,
                        activeToolListDefinition
                    });
                }
            }
            const toolDefinitionOptions = nextProps.toolDefinitions.map(d => {
                const checkboxAndSelectGroup = {};
                const category = d.category;
                const definitionId = d.definitionId;
                const nameArray = [];
                const detailNameArray = [];
                d.toolList.forEach((item) => {
                    const detailName = item.name;
                    nameArray.push(detailName);
                    detailNameArray.push(detailName);
                });
                checkboxAndSelectGroup.category = category;
                checkboxAndSelectGroup.definitionId = definitionId;
                checkboxAndSelectGroup.expaned = false;
                checkboxAndSelectGroup.nameArray = nameArray;
                checkboxAndSelectGroup.detailNameArray = detailNameArray;
                return checkboxAndSelectGroup;
            });
            const configExpanded = {};
            nextProps.toolDefinitions.forEach(d => {
                configExpanded[d.definitionId] = false;
            });
            Object.assign(newState, {
                toolDefinitionOptions: toolDefinitionOptions,
                configExpanded
            });
            this.setState(newState);
        }
        if (nextProps.activeToolListDefinition !== this.props.activeToolListDefinition) {
            this.setState({
                activeToolListDefinition: nextProps.activeToolListDefinition
            });
        }
    }

    render() {
        const state = this.state;
        const actions = this.actions;
        const { showCncToolManager,
            activeToolListDefinition, toolDefinitionOptions, isCategorySelected, activeToolCategory, configExpanded,
            renamingStatus, selectedName
        } = state;
        const optionConfigGroup = CNC_TOOL_CONFIG_GROUP;
        const unEditable = (isCategorySelected && this.state.activeToolCategory.category === 'Default Material')
            || (!isCategorySelected && activeToolListDefinition && isOfficialListDefinition(activeToolListDefinition));

        return (
            <React.Fragment>
                {showCncToolManager && (
                    <Modal
                        className={classNames(styles['manager-body'])}
                        style={{ width: '700px' }}

                        onClose={actions.hideCncToolManager}
                    >
                        <Modal.Body
                            style={{ margin: '0', padding: '20px 0 0', height: '100%', minHeight: '525px', textAlign: 'center' }}
                        >
                            <div className={classNames(styles['manager-type-wrapper'])}>
                                <div
                                    className={classNames(styles['manager-type'])}
                                >
                                    {i18n._('Tool')}
                                </div>
                            </div>
                            <div
                                className={classNames(styles['manager-content'])}
                            >
                                <div className={classNames(styles['manager-name'])}>
                                    <ul className={classNames(styles['manager-name-wrapper'])}>
                                        {(toolDefinitionOptions.map((option) => {
                                            const displayCategory = limitStringLength(option.category, 28);
                                            const isSelected = option.definitionId === activeToolCategory.definitionId;
                                            return (
                                                <li key={`${option.definitionId}`}>
                                                    <Anchor
                                                        className={classNames(styles['manager-btn'], { [styles.selected]: isCategorySelected && this.actions.isCategorySelectedNow(option.definitionId) })}
                                                        onClick={() => this.actions.onSelectToolCategory(option.definitionId)}
                                                        onDoubleClick={() => { this.actions.setRenamingStatus(true); }}
                                                    >
                                                        <div className={classNames(styles['manager-btn-unfold'])}>
                                                            <span
                                                                className={classNames(styles['manager-btn-unfold-bg'], { [styles.unfold]: !configExpanded[option.definitionId] })}
                                                                onKeyDown={noop}
                                                                role="button"
                                                                tabIndex={0}
                                                                onClick={() => { this.actions.foldCategory(option.definitionId,); }}

                                                            />
                                                        </div>
                                                        {(isCategorySelected && isSelected && renamingStatus) ? (
                                                            <input
                                                                ref={this.renameInput}
                                                                className="sm-parameter-row__input"
                                                                value={selectedName}
                                                                onChange={actions.onChangeSelectedName}
                                                                onKeyPress={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        this.actions.setRenamingStatus(false);
                                                                        this.actions.onChangeToolCategoryName();
                                                                    }
                                                                }}
                                                                onBlur={() => {
                                                                    this.actions.setRenamingStatus(false);
                                                                    this.actions.onChangeToolCategoryName();
                                                                }}
                                                            />
                                                        ) : displayCategory}
                                                        {/* <span>{displayCategory}</span> */}
                                                    </Anchor>
                                                    {!configExpanded[option.definitionId] && (
                                                        <ul style={{ listStyle: 'none', paddingLeft: '0' }}>
                                                            { option.nameArray.map((singleName, index) => {
                                                                const displayName = limitStringLength(i18n._(option.detailNameArray[index]), 24);
                                                                // eslint-disable-next-line no-shadow
                                                                const isSelected = option.definitionId === activeToolListDefinition.definitionId
                                                                && singleName === activeToolListDefinition.name;
                                                                return (
                                                                    <li key={`${singleName}`}>
                                                                        <Anchor
                                                                            className={classNames(styles['manager-btn'], { [styles.selected]: !isCategorySelected && this.actions.isNameSelectedNow(option.definitionId, singleName) })}
                                                                            style={{ paddingLeft: '42px' }}
                                                                            onClick={() => this.actions.onSelectToolName(option.definitionId, singleName)}
                                                                            onDoubleClick={() => { this.actions.setRenamingStatus(true); }}
                                                                            title={option.detailNameArray[index]}
                                                                        >
                                                                            {(!isCategorySelected && isSelected && renamingStatus) ? (
                                                                                <input
                                                                                    ref={this.renameInput}
                                                                                    className="sm-parameter-row__input"
                                                                                    value={selectedName}
                                                                                    onChange={actions.onChangeSelectedName}
                                                                                    onKeyPress={(e) => {
                                                                                        if (e.key === 'Enter') {
                                                                                            e.preventDefault();
                                                                                            this.actions.setRenamingStatus(false);
                                                                                            this.actions.onChangeToolListName();
                                                                                        }
                                                                                    }}
                                                                                    onBlur={() => {
                                                                                        this.actions.setRenamingStatus(false);
                                                                                        this.actions.onChangeToolListName();
                                                                                    }}
                                                                                    // disabled={!isDefinitionEditable(qualityDefinitionForManager)}
                                                                                />
                                                                            ) : displayName}
                                                                        </Anchor>
                                                                    </li>
                                                                );
                                                            })}
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
                                            size={18}
                                            title={i18n._('Edit')}
                                            onClick={() => this.actions.setRenamingStatus(true)}
                                            disabled={unEditable}
                                        />

                                        <input
                                            ref={this.toolFileInput}
                                            type="file"
                                            accept=".json"
                                            style={{ display: 'none' }}
                                            multiple={false}
                                            onChange={this.actions.onChangeQualityFileForManager}
                                        />
                                        <SvgIcon
                                            name="Import"
                                            size={18}
                                            title={i18n._('Import')}
                                            onClick={() => this.actions.importFile()}
                                        />
                                        <SvgIcon
                                            name="Export"
                                            size={18}
                                            title={i18n._('Export')}
                                            onClick={() => this.actions.exportConfigFile()}
                                        />
                                        <SvgIcon
                                            name="Delete"
                                            size={18}
                                            title={i18n._('Delete')}
                                            onClick={() => (!unEditable) && this.actions.onRemoveToolDefinition()}
                                            disabled={unEditable}
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
                                <div className={classNames(styles['manager-details'])}>
                                    <div className="sm-parameter-container">

                                        {state.notificationMessage && (
                                            <Notifications bsStyle="danger" onDismiss={actions.clearNotification} className="Notifications">
                                                {state.notificationMessage}
                                            </Notifications>
                                        )}
                                        {!isCategorySelected && optionConfigGroup.map((group, idx) => {
                                            return (
                                                <div key={i18n._(idx)}>
                                                    {group.name && (
                                                        <Anchor
                                                            className="sm-parameter-header"
                                                            onClick={() => {
                                                                // qualityConfigExpanded[group.name] = !qualityConfigExpanded[group.name];
                                                                // this.setState({
                                                                //     qualityConfigExpanded: JSON.parse(JSON.stringify(qualityConfigExpanded))
                                                                // });
                                                            }}
                                                        >
                                                            <span className="fa fa-gear sm-parameter-header__indicator" />
                                                            <span className="sm-parameter-header__title">{i18n._(group.name)}</span>

                                                        </Anchor>
                                                    )}
                                                    { group.fields.map((key) => {
                                                        const setting = activeToolListDefinition.config[key];
                                                        const defaultValue = setting.default_value;
                                                        const label = setting.label;
                                                        const unit = setting.unit;
                                                        const min = setting.min || 0;
                                                        const max = setting.max || 6000;
                                                        return (
                                                            <div key={key} className="sm-parameter-row">

                                                                <TipTrigger>
                                                                    <span className="sm-parameter-row__label-lg">{i18n._(label)}</span>
                                                                    <Input
                                                                        className="sm-parameter-row__select-md"
                                                                        value={defaultValue}
                                                                        min={min}
                                                                        max={max}
                                                                        onChange={value => {
                                                                            this.actions.onChangeToolDefinition(key, value);
                                                                        }}
                                                                        disabled={isOfficialListDefinition(activeToolListDefinition)}
                                                                    />
                                                                    <span className="sm-parameter-row__input-unit">{unit}</span>
                                                                </TipTrigger>
                                                            </div>
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
                                        onClick={() => { actions.hideCncToolManager(); }}
                                        className="sm-btn-large sm-btn-default"
                                        style={{ marginRight: '11px' }}
                                    >
                                        {i18n._('Close')}
                                    </Anchor>
                                    {/* {isCategorySelected && (
                                        <Anchor
                                            onClick={() => { actions.onSaveToolCategory(); }}
                                            className="sm-btn-large sm-btn-primary"
                                            disabled={isOfficialCategoryDefinition(activeToolCategory)}
                                        >
                                            {i18n._('Save')}
                                        </Anchor>
                                    )} */}
                                    {!isCategorySelected && (
                                        <Anchor
                                            onClick={() => {
                                                actions.onSelectToolListDefinition();
                                                actions.hideCncToolManager();
                                            }}
                                            className="sm-btn-large sm-btn-primary"
                                            disabled={
                                                activeToolListDefinition.definitionId === this.props.activeToolListDefinition.definitionId
                                                && activeToolListDefinition.name === this.props.activeToolListDefinition.name
                                            }
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
}

const mapStateToProps = (state) => {
    const { showCncToolManager, toolDefinitions, activeToolListDefinition } = state.cnc;
    return {
        showCncToolManager,
        toolDefinitions,
        activeToolListDefinition
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateShowCncToolManager: (showCncToolManager) => dispatch(cncActions.updateShowCncToolManager(showCncToolManager)),
        duplicateToolCategoryDefinition: (activeToolCategory) => dispatch(cncActions.duplicateToolCategoryDefinition(activeToolCategory)),
        duplicateToolListDefinition: (activeToolCategory, activeToolListDefinition) => dispatch(cncActions.duplicateToolListDefinition(activeToolCategory, activeToolListDefinition)),
        removeToolCategoryDefinition: (definitionId) => dispatch(cncActions.removeToolCategoryDefinition(definitionId)),
        removeToolListDefinition: (activeToolCategory, activeToolList) => dispatch(cncActions.removeToolListDefinition(activeToolCategory, activeToolList)),
        exportConfigFile: (targetFile, subCategory) => dispatch(projectActions.exportConfigFile(targetFile, subCategory)),
        onUploadToolDefinition: (toolFile) => dispatch(cncActions.onUploadToolDefinition(toolFile)),
        onDownloadToolListDefinition: (activeToolCategory, activeToolList) => dispatch(cncActions.onDownloadToolListDefinition(activeToolCategory, activeToolList)),
        updateToolDefinitionName: (isCategorySelected, definitionId, oldName, newName) => dispatch(cncActions.updateToolDefinitionName(isCategorySelected, definitionId, oldName, newName)),
        updateToolListDefinition: (activeToolList) => dispatch(cncActions.updateToolListDefinition(activeToolList)),
        changeActiveToolListDefinition: (definitionId, name) => dispatch(cncActions.changeActiveToolListDefinition(definitionId, name))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(CncToolManager);
