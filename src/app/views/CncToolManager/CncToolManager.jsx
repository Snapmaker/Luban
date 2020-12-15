import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import { includes } from 'lodash';
// import Select from 'react-select';
import Notifications from '../../components/Notifications';
import i18n from '../../lib/i18n';
import Modal from '../../components/Modal';
import Anchor from '../../components/Anchor';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import { actions as printingActions } from '../../flux/printing';
import { actions as cncActions } from '../../flux/cnc';
import { actions as projectActions } from '../../flux/project';
import widgetStyles from '../../widgets/styles.styl';
import styles from './styles.styl';
import confirm from '../../lib/confirm';
import { HEAD_3DP, PRINTING_MANAGER_TYPE_QUALITY, PRINTING_MANAGER_TYPE_MATERIAL, PRINTING_MATERIAL_CONFIG_KEYS, PRINTING_QUALITY_CONFIG_KEYS } from '../../constants';


// Only custom material is editable, changes on diameter is not allowed as well
function isDefinitionEditable(definition) {
    return !definition.metadata.readonly;
}

function isOfficialDefinition(definition) {
    if (definition) {
        return includes(['mdf'],
            definition.category);
    } else {
        return true;
    }
}
function isOfficialCategoryDefinition(activeToolCategory) {
    return includes(['mdf'],
        activeToolCategory.category);
}
class PrintingManager extends PureComponent {
    static propTypes = {
        showCncToolManager: PropTypes.bool,
        managerDisplayType: PropTypes.string.isRequired,
        materialDefinitions: PropTypes.array.isRequired,
        qualityDefinitions: PropTypes.array.isRequired,
        toolDefinitions: PropTypes.array.isRequired,
        // activeToolListDefinition: PropTypes.object,
        series: PropTypes.string.isRequired,
        duplicateToolCategoryDefinition: PropTypes.func.isRequired,
        duplicateToolListDefinition: PropTypes.func.isRequired,

        updateQualityDefinitionName: PropTypes.func.isRequired,
        updateMaterialDefinitionName: PropTypes.func.isRequired,
        updateDefinitionsForManager: PropTypes.func.isRequired,
        removeToolCategoryDefinition: PropTypes.func.isRequired,
        removeToolListDefinition: PropTypes.func.isRequired,

        updateDefinitionSettings: PropTypes.func.isRequired,
        onUploadManagerDefinition: PropTypes.func.isRequired,
        exportPrintingManagerFile: PropTypes.func.isRequired,

        updateShowCncToolManager: PropTypes.func.isRequired,
        updateManagerDisplayType: PropTypes.func.isRequired,
        updateDefaultMaterialId: PropTypes.func.isRequired
    };

   materialFileInput = React.createRef();

   qualityFileInput = React.createRef();

    state = {
        materialDefinitionForManager: null,
        qualityDefinitionForManager: null,
        materialDefinitionOptions: [],
        qualityDefinitionOptions: [],
        showCncToolManager: false,

        activeToolListDefinition: null,
        activeToolCategory: null,

        isCategorySelected: false,
        notificationMessage: '',
        nameForMaterial: 'PLA',
        nameForQuality: 'Fast Print'
    };

    actions = {
        hidePrintingManager: () => {
            this.props.updateShowCncToolManager(false);
        },
        updateManagerDisplayType: (managerDisplayType) => {
            this.actions.clearNotification();
            this.props.updateManagerDisplayType(managerDisplayType);
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
        onChangeMaterialFileForManager: (event) => {
            const materialFile = event.target.files[0];
            this.props.onUploadManagerDefinition(materialFile, this.props.managerDisplayType);
        },
        onChangeQualityFileForManager: (event) => {
            const qualityFile = event.target.files[0];
            this.props.onUploadManagerDefinition(qualityFile, this.props.managerDisplayType);
        },
        importFile: (managerDisplayType) => {
            if (managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL) {
                this.materialFileInput.current.value = null;
                this.materialFileInput.current.click();
            } else if (managerDisplayType === PRINTING_MANAGER_TYPE_QUALITY) {
                this.qualityFileInput.current.value = null;
                this.qualityFileInput.current.click();
            }
        },
        exportPrintingManagerFile: (managerDisplayType) => {
            let definitionId, targetFile;
            if (managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL) {
                definitionId = this.state.materialDefinitionForManager.definitionId;
                targetFile = `${definitionId}.def.json`;
            } else if (managerDisplayType === PRINTING_MANAGER_TYPE_QUALITY) {
                const qualityDefinitionForManager = this.state.qualityDefinitionForManager;
                definitionId = qualityDefinitionForManager.definitionId;
                if (isOfficialDefinition(qualityDefinitionForManager)) {
                    targetFile = `${this.props.series}/${definitionId}.def.json`;
                } else {
                    targetFile = `${definitionId}.def.json`;
                }
            }
            this.props.exportPrintingManagerFile(targetFile);
        },

        onSelectQualityType: (definition) => {
            this.setState({
                qualityDefinitionForManager: definition,
                nameForQuality: definition.name
            });
        },
        onSelectQualityTypeById: (definitionId) => {
            const definition = this.props.qualityDefinitions.find(d => d.definitionId === definitionId);
            this.actions.onSelectQualityType(definition);
        },
        onChangeQualityDefinitionForManager: (key, value, checkboxKeyArray) => {
            const { qualityDefinitionForManager, qualityDefinitionOptions } = this.state;

            if (!isDefinitionEditable(qualityDefinitionForManager)) {
                return;
            }

            qualityDefinitionForManager.settings[key].default_value = value;
            this.setState({
                qualityDefinitionForManager,
                nameForQuality: qualityDefinitionForManager.name
            });
            if (checkboxKeyArray) {
                let newqQualityDefinitionOptions;
                checkboxKeyArray.forEach((checkboxKey) => {
                    newqQualityDefinitionOptions = qualityDefinitionOptions.map((item) => {
                        if (item.label === qualityDefinitionForManager.name && key === checkboxKey) {
                            item[checkboxKey] = value;
                        }
                        return item;
                    });
                });
                this.setState({
                    qualityDefinitionOptions: newqQualityDefinitionOptions
                });
            }
            // this.props.updateActiveDefinition({
            //     ownKeys: [key],
            //     settings: {
            //         [key]: { default_value: value }
            //     }
            // });
        },
        onSaveQualityForManager: async (managerDisplayType) => {
            const qualityDefinitionForManager = this.state.qualityDefinitionForManager;
            const newDefinitionSettings = {};
            for (const [key, value] of Object.entries(qualityDefinitionForManager.settings)) {
                if (PRINTING_QUALITY_CONFIG_KEYS.indexOf(key) > -1) {
                    newDefinitionSettings[key] = { 'default_value': value.default_value };
                }
            }

            this.props.updateDefinitionSettings(qualityDefinitionForManager, newDefinitionSettings);
            this.props.updateDefinitionsForManager(qualityDefinitionForManager.definitionId, managerDisplayType);

            const { nameForQuality } = this.state;

            if (nameForQuality === qualityDefinitionForManager.name) { // unchanged
                return;
            }

            try {
                await this.props.updateQualityDefinitionName(qualityDefinitionForManager, nameForQuality);
            } catch (err) {
                this.actions.showNotification(err);
            }
        },

        onSelectMaterialTypeNotUpdate: (definitionId) => {
            const materialDefinitionForManager = this.props.materialDefinitions.find(d => d.definitionId === definitionId);
            if (materialDefinitionForManager) {
                this.setState({
                    materialDefinitionForManager: materialDefinitionForManager,
                    nameForMaterial: materialDefinitionForManager.name
                });
            }
        },
        onSelectMaterialTypeAndUpdate: (definitionId) => {
            const materialDefinitionForManager = this.props.materialDefinitions.find(d => d.definitionId === definitionId);
            if (materialDefinitionForManager) {
                this.setState({
                    materialDefinitionForManager: materialDefinitionForManager,
                    nameForMaterial: materialDefinitionForManager.name
                });

                this.props.updateDefaultMaterialId(materialDefinitionForManager.definitionId);
            }
        },
        onChangeMaterialDefinitionForManager: (key, value, checkboxKey) => {
            const { materialDefinitionForManager, materialDefinitionOptions } = this.state;
            materialDefinitionForManager.settings[key].default_value = value;
            this.setState({
                materialDefinitionForManager: materialDefinitionForManager
            });
            if (checkboxKey) {
                const newMaterialDefinitionOptions = materialDefinitionOptions.map((item) => {
                    if (item.label === materialDefinitionForManager.name) {
                        item[checkboxKey] = value;
                    }
                    return item;
                });
                this.setState({
                    materialDefinitionOptions: newMaterialDefinitionOptions
                });
            }
        },
        onSaveMaterialForManager: async (managerDisplayType) => {
            const materialDefinitionForManager = this.state.materialDefinitionForManager;
            const newDefinitionSettings = {};
            for (const [key, value] of Object.entries(materialDefinitionForManager.settings)) {
                if (PRINTING_MATERIAL_CONFIG_KEYS.indexOf(key) > -1) {
                    newDefinitionSettings[key] = { 'default_value': value.default_value };
                }
            }
            this.props.updateDefinitionSettings(materialDefinitionForManager, newDefinitionSettings);
            this.props.updateDefinitionsForManager(materialDefinitionForManager.definitionId, managerDisplayType);

            const { nameForMaterial } = this.state;

            if (nameForMaterial === materialDefinitionForManager.name) { // unchanged
                return;
            }

            try {
                await this.props.updateMaterialDefinitionName(materialDefinitionForManager, nameForMaterial);
            } catch (err) {
                this.actions.showNotification(err);
            }
        },
        isNameSelectedNow: (category, name) => {
            return this.state.activeToolListDefinition && this.state.activeToolListDefinition.toolName === name && this.state.activeToolListDefinition.category === category;
        },
        isCategorySelectedNow: (category) => {
            return this.state.activeToolCategory && this.state.activeToolCategory.category === category;
        },
        onSelectToolCategory: (category) => {
            const toolListForManager = this.props.toolDefinitions.find(d => d.category === category);
            // const toolDefinitionForManager = toolListForManager.toolList[0];
            this.setState({
                activeToolCategory: toolListForManager,
                isCategorySelected: true
            });
        },
        onSelectToolName: (category, toolName) => {
            const activeToolCategory = this.props.toolDefinitions.find(d => d.category === category);
            const toolDefinitionForManager = activeToolCategory.toolList.find(k => k.toolName === toolName);
            toolDefinitionForManager.category = activeToolCategory.category;
            if (toolDefinitionForManager) {
                this.setState({
                    activeToolListDefinition: toolDefinitionForManager,
                    activeToolCategory: activeToolCategory,
                    isCategorySelected: false
                });
            }
        },
        onChangeNameForMaterial: (event) => {
            this.setState({
                nameForMaterial: event.target.value
            });
        },
        onChangeNameForQuality: (event) => {
            this.setState({
                nameForQuality: event.target.value
            });
        },
        onDuplicateToolCategoryDefinition: async () => {
            const newDefinition = await this.props.duplicateToolCategoryDefinition(this.state.activeToolCategory);
            this.actions.onSelectToolCategory(newDefinition.category);
            // this.setState({
            //     activeToolCategory: newDefinition
            // });
        },
        onDuplicateToolNameDefinition: async () => {
            const newToolName = await this.props.duplicateToolListDefinition(this.state.activeToolCategory, this.state.activeToolListDefinition);
            // need to change ,update activeToolListDefinition
            this.actions.onSelectToolName(this.state.activeToolCategory.category, newToolName);
        },
        onRemoveToolDefinition: async () => {
            const { isCategorySelected, activeToolCategory } = this.state;
            if (isCategorySelected) {
                await confirm({
                    body: `Are you sure to remove category profile "${activeToolCategory.category}"?`
                });

                await this.props.removeToolCategoryDefinition(activeToolCategory);

                // After removal, select the first definition
                if (this.props.toolDefinitions.length) {
                    this.actions.onSelectToolCategory(this.props.toolDefinitions[0].category);
                }
            } else {
                const activeToolListDefinition = this.state.activeToolListDefinition;

                await confirm({
                    body: `Are you sure to remove profile "${activeToolListDefinition.toolName}"?`
                });

                await this.props.removeToolListDefinition(activeToolCategory, activeToolListDefinition);

                // After removal, select the first definition
                if (activeToolCategory) {
                    const activeToolList = activeToolCategory.toolList;
                    if (activeToolList.length) {
                        console.log('ddd', activeToolCategory.category, activeToolList[0].toolName);
                        this.actions.onSelectToolName(activeToolCategory.category, activeToolList[0].toolName);
                    } else {
                        this.actions.onSelectToolCategory(activeToolCategory.category);
                    }
                }
            }
        }
    };

    componentWillReceiveProps(nextProps) {
        if (nextProps.showCncToolManager !== this.props.showCncToolManager) {
            this.setState({ showCncToolManager: nextProps.showCncToolManager });
        }
        if (nextProps.toolDefinitions !== this.props.toolDefinitions) {
            const newState = {};
            if (this.props.toolDefinitions.length === 0) {
                const activeToolCategory = nextProps.toolDefinitions.find(d => d.category === 'mdf');
                const activeToolListDefinition = activeToolCategory.toolList.find(k => k.toolName === 'snap.v-bit');
                activeToolListDefinition.category = activeToolCategory && activeToolCategory.category;
                Object.assign(newState, {
                    activeToolCategory,
                    activeToolListDefinition
                });
            } else {
                const activeToolCategory = nextProps.toolDefinitions.find(d => d.category === this.state.activeToolListDefinition.category) || nextProps.toolDefinitions.find(d => d.category === 'mdf').toolList;
                const activeToolListDefinition = activeToolCategory.toolList.find(k => k.toolName === this.state.activeToolListDefinition.toolName)
                || activeToolCategory.toolList.find(k => k.toolName === 'snap.v-bit');
                console.log('activeToolListDefinition', activeToolListDefinition);
                if (activeToolListDefinition) {
                    activeToolListDefinition.category = activeToolCategory && activeToolCategory.category;
                    Object.assign(newState, {
                        activeToolCategory,
                        activeToolListDefinition
                    });
                }
            }
            const toolDefinitionOptions = nextProps.toolDefinitions.map(d => {
                const checkboxAndSelectGroup = {};
                const category = d.category;
                const nameArray = [];
                d.toolList.forEach((item) => {
                    nameArray.push(item.toolName);
                });
                checkboxAndSelectGroup.category = category;
                checkboxAndSelectGroup.nameArray = nameArray;
                return checkboxAndSelectGroup;
            });
            Object.assign(newState, {
                toolDefinitionOptions: toolDefinitionOptions
            });
            this.setState(newState);
        }
    }

    render() {
        const state = this.state;
        const actions = this.actions;
        const { managerDisplayType } = this.props;
        const { materialDefinitionForManager, showCncToolManager,
            qualityDefinitionForManager, activeToolListDefinition, toolDefinitionOptions, isCategorySelected, activeToolCategory } = state;
        return (
            <React.Fragment>
                {showCncToolManager && (
                    <Modal
                        className={classNames(styles['manager-body'])}
                        style={{ width: '700px' }}
                        size="lg"
                        onClose={actions.hidePrintingManager}
                    >
                        <Modal.Body
                            style={{ margin: '0', padding: '20px 0 0', height: '100%', minHeight: '525px', textAlign: 'center' }}
                        >
                            <div className={classNames(styles['manager-type-wrapper'])}>
                                <div
                                    className={classNames(styles['manager-type'], { [styles.selected]: managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL })}
                                >
                                    {i18n._('Tool')}
                                </div>
                            </div>
                            <div className={classNames(styles['manager-content'])}>
                                <div className={classNames(styles['manager-name'])}>
                                    <ul className={classNames(styles['manager-name-wrapper'])}>
                                        {(toolDefinitionOptions.map((option) => {
                                            return (
                                                <li key={`${option.category}`}>
                                                    <Anchor
                                                        className={classNames(styles['manager-btn'], { [styles.selected]: isCategorySelected && this.actions.isCategorySelectedNow(option.category) })}
                                                        onClick={() => this.actions.onSelectToolCategory(option.category)}
                                                    >
                                                        {i18n._(option.category)}
                                                    </Anchor>
                                                    <ul>
                                                        { option.nameArray.map(singleName => {
                                                            return (
                                                                <li key={`${singleName}`}>
                                                                    <Anchor
                                                                        className={classNames(styles['manager-btn'], { [styles.selected]: !isCategorySelected && this.actions.isNameSelectedNow(option.category, singleName) })}
                                                                        onClick={() => this.actions.onSelectToolName(option.category, singleName)}
                                                                    >
                                                                        {i18n._(singleName)}
                                                                    </Anchor>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                </li>
                                            );
                                        }))}
                                    </ul>
                                    <input
                                        ref={this.materialFileInput}
                                        type="file"
                                        accept=".json"
                                        style={{ display: 'none' }}
                                        multiple={false}
                                        onChange={this.actions.onChangeMaterialFileForManager}
                                    />
                                    <input
                                        ref={this.qualityFileInput}
                                        type="file"
                                        accept=".json"
                                        style={{ display: 'none' }}
                                        multiple={false}
                                        onChange={this.actions.onChangeQualityFileForManager}
                                    />
                                    <div className="sm-tabs">
                                        <Anchor
                                            onClick={() => this.actions.importFile(managerDisplayType)}
                                            className={classNames(styles['manager-file'], 'sm-tab')}
                                        >
                                            {i18n._('Import')}
                                        </Anchor>
                                        <Anchor
                                            className={classNames(styles['manager-file'], 'sm-tab')}
                                            onClick={() => this.actions.exportPrintingManagerFile(managerDisplayType)}
                                        >
                                            {i18n._('Export')}
                                        </Anchor>
                                    </div>
                                </div>
                                <div className={classNames(styles['manager-details'])}>
                                    <div className="sm-parameter-container">
                                        <div className={classNames(widgetStyles.separator, widgetStyles['separator-underline'])} />
                                        <div className="sm-parameter-row">
                                            <span className="sm-parameter-row__label-lg">{i18n._('Name')}</span>
                                            {!isCategorySelected && (
                                                <input
                                                    className="sm-parameter-row__input"
                                                    style={{ paddingLeft: '12px', height: '30px', width: '180px' }}
                                                    value={activeToolListDefinition.toolName}
                                                />
                                            )}
                                            {isCategorySelected && (
                                                <input
                                                    className="sm-parameter-row__input"
                                                    style={{ paddingLeft: '12px', height: '30px', width: '180px' }}
                                                    value={activeToolCategory.category}
                                                />
                                            )}
                                        </div>
                                        {state.notificationMessage && (
                                            <Notifications bsStyle="danger" onDismiss={actions.clearNotification} className="Notifications">
                                                {state.notificationMessage}
                                            </Notifications>
                                        )}
                                        {!isCategorySelected && (Object.entries(activeToolListDefinition.cuttingData).map(([key, setting]) => {
                                            const defaultValue = setting.default_value;
                                            const unit = setting.unit;

                                            return (
                                                <div key={key} className="sm-parameter-row">

                                                    <TipTrigger>
                                                        <span className="sm-parameter-row__label-lg">{i18n._(key)}</span>
                                                        <Input
                                                            className="sm-parameter-row__input"
                                                            value={defaultValue}
                                                        />
                                                        <span className="sm-parameter-row__input-unit">{unit}</span>
                                                    </TipTrigger>
                                                </div>
                                            );
                                        }))}
                                    </div>
                                </div>
                            </div>
                            <div className={classNames(styles['manager-settings'], 'clearfix')}>
                                <div className={classNames(styles['manager-settings-operate'], styles['manager-settings-btn'])}>
                                    {isCategorySelected && (
                                        <Anchor
                                            className="sm-btn-large sm-btn-default"
                                            onClick={() => { actions.onDuplicateToolCategoryDefinition(); }}
                                            style={{ marginRight: '11px' }}
                                        >
                                            {i18n._('Copy')}
                                        </Anchor>
                                    )}
                                    {!isCategorySelected && (
                                        <Anchor
                                            className="sm-btn-large sm-btn-default"
                                            onClick={() => { actions.onDuplicateToolNameDefinition(); }}
                                            style={{ marginRight: '11px' }}
                                        >
                                            {i18n._('Copy')}
                                        </Anchor>
                                    )}
                                    {isCategorySelected && (
                                        <Anchor
                                            className="sm-btn-large sm-btn-default"
                                            onClick={() => { actions.onRemoveToolDefinition(); }}
                                            disabled={isOfficialCategoryDefinition(activeToolCategory)}
                                        >
                                            {i18n._('Delete')}
                                        </Anchor>
                                    )}
                                    {!isCategorySelected && (
                                        <Anchor
                                            className="sm-btn-large sm-btn-default"
                                            onClick={() => { actions.onRemoveToolDefinition(); }}
                                            disabled={isOfficialCategoryDefinition(activeToolCategory)}
                                        >
                                            {i18n._('Delete')}
                                        </Anchor>
                                    )}
                                </div>
                                <div className={classNames(styles['manager-settings-save'], styles['manager-settings-btn'])}>
                                    <Anchor
                                        onClick={() => { actions.hidePrintingManager(); }}
                                        className="sm-btn-large sm-btn-default"
                                        style={{ marginRight: '11px' }}
                                    >
                                        {i18n._('Close')}
                                    </Anchor>
                                    {managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL && (
                                        <Anchor
                                            onClick={() => { actions.onSaveMaterialForManager(managerDisplayType); }}
                                            className="sm-btn-large sm-btn-primary"
                                            disabled={isOfficialDefinition(materialDefinitionForManager)}
                                        >
                                            {i18n._('Save')}
                                        </Anchor>
                                    )}
                                    {managerDisplayType === PRINTING_MANAGER_TYPE_QUALITY && (
                                        <Anchor
                                            onClick={() => { actions.onSaveQualityForManager(managerDisplayType); }}
                                            className="sm-btn-large sm-btn-primary"
                                            disabled={isOfficialDefinition(qualityDefinitionForManager)}
                                        >
                                            {i18n._('Save')}
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
    const { qualityDefinitions, materialDefinitions,
        managerDisplayType } = state.printing;
    const { showCncToolManager, toolDefinitions, activeToolListDefinition } = state.cnc;
    const { series } = state.machine;
    return {
        series,
        materialDefinitions,
        showCncToolManager,
        toolDefinitions,
        activeToolListDefinition,
        managerDisplayType,
        qualityDefinitions
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateDefinitionsForManager: (definitionId, type) => dispatch(printingActions.updateDefinitionsForManager(definitionId, type)),
        updateDefaultQualityId: (qualityId) => dispatch(printingActions.updateDefaultQualityId(qualityId)),
        updateDefaultMaterialId: (defaultMaterialId) => dispatch(printingActions.updateDefaultMaterialId(defaultMaterialId)),
        updateActiveDefinition: (definition, shouldSave = false) => {
            dispatch(printingActions.updateActiveDefinition(definition, shouldSave));
            dispatch(projectActions.autoSaveEnvironment(HEAD_3DP, true));
        },
        updateManagerDisplayType: (managerDisplayType) => dispatch(printingActions.updateManagerDisplayType(managerDisplayType)),

        updateShowCncToolManager: (showCncToolManager) => dispatch(cncActions.updateShowCncToolManager(showCncToolManager)),
        duplicateToolCategoryDefinition: (activeToolCategory) => dispatch(cncActions.duplicateToolCategoryDefinition(activeToolCategory)),
        duplicateToolListDefinition: (activeToolCategory, activeToolListDefinition) => dispatch(cncActions.duplicateToolListDefinition(activeToolCategory, activeToolListDefinition)),
        removeToolCategoryDefinition: (activeToolCategory) => dispatch(cncActions.removeToolCategoryDefinition(activeToolCategory)),
        removeToolListDefinition: (activeToolCategory, activeToolList) => dispatch(cncActions.removeToolListDefinition(activeToolCategory, activeToolList)),

        onUploadManagerDefinition: (materialFile, type) => dispatch(printingActions.onUploadManagerDefinition(materialFile, type)),
        exportPrintingManagerFile: (targetFile) => dispatch(projectActions.exportPrintingManagerFile(targetFile)),
        duplicateMaterialDefinition: (definition) => dispatch(printingActions.duplicateMaterialDefinition(definition)),
        duplicateQualityDefinition: (definition) => dispatch(printingActions.duplicateQualityDefinition(definition)),
        removeQualityDefinition: (definition) => dispatch(printingActions.removeQualityDefinition(definition)),
        updateMaterialDefinitionName: (definition, name) => dispatch(printingActions.updateMaterialDefinitionName(definition, name)),
        updateQualityDefinitionName: (definition, name) => dispatch(printingActions.updateQualityDefinitionName(definition, name)),
        updateDefinitionSettings: (definition, settings) => dispatch(printingActions.updateDefinitionSettings(definition, settings))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(PrintingManager);
