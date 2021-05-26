import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
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
// import widgetStyles from '../../widgets/styles.styl';
import styles from './styles.styl';
import { HEAD_3DP, PRINTING_MANAGER_TYPE_QUALITY, PRINTING_MANAGER_TYPE_MATERIAL,
    PRINTING_MATERIAL_CONFIG_KEYS, PRINTING_QUALITY_CONFIG_KEYS,
    PRINTING_MATERIAL_CONFIG_GROUP, PRINTING_QUALITY_CONFIG_GROUP } from '../../constants';
import { limitStringLength } from '../../lib/normalize-range';

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
    return includes(['material.pla', 'material.abs', 'quality.fast_print', 'quality.normal_quality', 'quality.high_quality'],
        definition.definitionId);
}
// TODO: map actions and props by managerDisplayType to simplify component invoke
class PrintingManager extends PureComponent {
    static propTypes = {
        showPrintingManager: PropTypes.bool,
        managerDisplayType: PropTypes.string.isRequired,
        materialDefinitions: PropTypes.array.isRequired,
        qualityDefinitions: PropTypes.array.isRequired,
        series: PropTypes.string.isRequired,

        updateQualityDefinitionName: PropTypes.func.isRequired,
        updateMaterialDefinitionName: PropTypes.func.isRequired,
        updateDefinitionsForManager: PropTypes.func.isRequired,
        duplicateMaterialDefinition: PropTypes.func.isRequired,
        duplicateQualityDefinition: PropTypes.func.isRequired,
        removeMaterialDefinition: PropTypes.func.isRequired,
        removeQualityDefinition: PropTypes.func.isRequired,
        updateDefinitionSettings: PropTypes.func.isRequired,
        onUploadManagerDefinition: PropTypes.func.isRequired,
        exportConfigFile: PropTypes.func.isRequired,

        updateShowPrintingManager: PropTypes.func.isRequired,
        updateManagerDisplayType: PropTypes.func.isRequired,
        updateDefaultQualityId: PropTypes.func.isRequired,
        updateDefaultMaterialId: PropTypes.func.isRequired
    };

    materialFileInput = React.createRef();

    qualityFileInput = React.createRef();

    renameInput = React.createRef();

    scrollDom = React.createRef();

    state = {
        materialDefinitionForManager: null,
        qualityDefinitionForManager: null,
        materialDefinitionOptions: [],
        qualityDefinitionOptions: [],
        configExpanded: {},
        showPrintingManager: false,
        notificationMessage: '',
        selectedName: '',
        activeCateId: 2,
        qualityConfigExpanded: (function () {
            PRINTING_QUALITY_CONFIG_GROUP.forEach((config) => {
                this[config.name] = false;
            });
            return this;
        }).call({})
    };

    actions = {
        foldCategory: (cateName) => {
            const { configExpanded } = this.state;
            configExpanded[cateName] = !configExpanded[cateName];
            this.setState({
                configExpanded: JSON.parse(JSON.stringify(configExpanded))
            });
        },
        hidePrintingManager: () => {
            this.props.updateShowPrintingManager(false);
        },
        updateManagerDisplayType: (managerDisplayType) => {
            this.actions.clearNotification();
            this.props.updateManagerDisplayType(managerDisplayType);
            this.setState({ activeCateId: 0 });
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
        setActiveCate: (activeCateId) => {
            if (this.scrollDom.current) {
                const container = this.scrollDom.current.parentElement;
                const offsetTops = [...this.scrollDom.current.children].map(i => i.offsetTop);
                if (activeCateId !== undefined) {
                    container.scrollTop = offsetTops[activeCateId] - 80;
                } else {
                    activeCateId = offsetTops.findIndex((item, idx) => item < container.scrollTop && offsetTops[idx + 1] > container.scrollTop);
                    activeCateId = Math.max(activeCateId, 0);
                }
                this.setState({ activeCateId });
            }
            return true;
        },
        setRenamingStatus: (status) => {
            const selectedOption = this.props.managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL ? this.state.materialDefinitionForManager : this.state.qualityDefinitionForManager;
            if (isOfficialDefinition(selectedOption)) {
                return;
            }
            const keySelectedDefinition = `${this.props.managerDisplayType}DefinitionForManager`;
            this.setState({
                renamingStatus: status,
                selectedName: this.state[keySelectedDefinition].name
            });
            status && setTimeout(() => {
                this.renameInput.current.focus();
            }, 0);
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
        exportConfigFile: (managerDisplayType) => {
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
            this.props.exportConfigFile(targetFile);
        },
        onUpdateDefaultDefinition: () => {
            const { managerDisplayType } = this.props;
            const { qualityDefinitionForManager, materialDefinitionForManager } = this.state;
            if (managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL) {
                this.props.updateDefaultMaterialId(materialDefinitionForManager.definitionId);
            } else {
                this.props.updateDefaultQualityId(qualityDefinitionForManager.definitionId);
            }
        },
        onSelectQualityType: (definition) => {
            this.setState({
                qualityDefinitionForManager: definition,
                selectedName: definition.name
            });
        },
        onSelectQualityTypeById: (definitionId) => {
            const definition = this.props.qualityDefinitions.find(d => d.definitionId === definitionId);
            this.actions.onSelectQualityType(definition);
        },
        onChangeQualityDefinitionForManager: (key, value, checkboxKeyArray) => {
            const { qualityDefinitionForManager, qualityDefinitionOptions } = this.state;
            const newQualityDefinitionForManager = JSON.parse(JSON.stringify(qualityDefinitionForManager));
            if (!isDefinitionEditable(qualityDefinitionForManager)) {
                return;
            }

            newQualityDefinitionForManager.settings[key].default_value = value;
            this.setState({
                qualityDefinitionForManager: newQualityDefinitionForManager,
                selectedName: qualityDefinitionForManager.name
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
        },

        onChangeDefinition: (key, value, checkboxKeyArray) => {
            // setState in setTimeout is synchronize
            setTimeout(() => {
                const { managerDisplayType } = this.props;
                if (managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL) {
                    this.actions.onChangeMaterialDefinitionForManager(key, value, checkboxKeyArray);
                    this.actions.onSaveMaterialForManager(managerDisplayType);
                } else {
                    this.actions.onChangeQualityDefinitionForManager(key, value, checkboxKeyArray);
                    this.actions.onSaveQualityForManager(managerDisplayType);
                }
            }, 0);
        },
        onSaveQualityForManager: async (managerDisplayType) => {
            const qualityDefinitionForManager = this.state.qualityDefinitionForManager;
            const newDefinitionSettings = {};
            for (const [key, value] of Object.entries(qualityDefinitionForManager.settings)) {
                if (PRINTING_QUALITY_CONFIG_KEYS.indexOf(key) > -1) {
                    newDefinitionSettings[key] = { 'default_value': value.default_value };
                }
            }

            await this.props.updateDefinitionSettings(qualityDefinitionForManager, newDefinitionSettings);

            this.props.updateDefinitionsForManager(qualityDefinitionForManager.definitionId, managerDisplayType);
        },

        onSelectDefinition: (definitionId) => {
            const keySelectedDefinition = `${this.props.managerDisplayType}DefinitionForManager`;
            if (definitionId === this.state[keySelectedDefinition].definitionId) {
                return;
            }

            const keySelectedName = `${this.props.managerDisplayType}SelectedName`;
            const selected = this.props[`${this.props.managerDisplayType}Definitions`].find(d => d.definitionId === definitionId);
            this.actions.setRenamingStatus(false);

            if (selected) {
                this.setState({
                    [keySelectedDefinition]: selected,
                    [keySelectedName]: selected.name
                });
            }
        },
        onSelectMaterialTypeAndUpdate: (definitionId) => {
            const materialDefinitionForManager = this.props.materialDefinitions.find(d => d.definitionId === definitionId);
            if (materialDefinitionForManager) {
                this.setState({
                    materialDefinitionForManager: materialDefinitionForManager,
                    selectedName: materialDefinitionForManager.name
                });

                this.props.updateDefaultMaterialId(materialDefinitionForManager.definitionId);
            }
        },
        onChangeMaterialDefinitionForManager: (key, value, checkboxKey) => {
            const { materialDefinitionForManager, materialDefinitionOptions } = this.state;
            const newMaterialDefinitionForManager = JSON.parse(JSON.stringify(materialDefinitionForManager));

            newMaterialDefinitionForManager.settings[key].default_value = value;
            this.setState({
                materialDefinitionForManager: newMaterialDefinitionForManager
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
            await this.props.updateDefinitionSettings(materialDefinitionForManager, newDefinitionSettings);

            this.props.updateDefinitionsForManager(materialDefinitionForManager.definitionId, managerDisplayType);
        },
        updaterDefinitionName: async () => {
            const { selectedName } = this.state;
            const keySelectedDefinition = `${this.props.managerDisplayType}DefinitionForManager`;
            const keyDefinitionOptions = `${this.props.managerDisplayType}DefinitionOptions`;
            const definition = this.state[keySelectedDefinition];
            const options = this.state[keyDefinitionOptions];
            if (selectedName !== definition.name) { // changed
                try {
                    if (this.props.managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL) {
                        await this.props.updateMaterialDefinitionName(definition, selectedName);
                    } else {
                        await this.props.updateQualityDefinitionName(definition, selectedName);
                    }
                    const option = options.find(o => o.value === definition.definitionId);
                    option.label = selectedName;
                    this.setState({ [keyDefinitionOptions]: [...options] });
                } catch (err) {
                    this.actions.showNotification(err);
                }
            }
        },
        isNameSelectedNow: (definitionId, name) => {
            return this.state.activeToolListDefinition && this.state.activeToolListDefinition.name === name && this.state.activeToolListDefinition.definitionId === definitionId;
        },
        isMaterialSelectedForManager: (option) => {
            return this.state.materialDefinitionForManager && this.state.materialDefinitionForManager.name === option.label;
        },
        isQualitySelectedForManager: (option) => {
            return this.state.qualityDefinitionForManager && this.state.qualityDefinitionForManager.name === option.label;
        },

        onChangeSelectedName: (event) => {
            this.setState({
                selectedName: event.target.value
            });
        },

        onDuplicateManagerDefinition: async (name) => {
            const { managerDisplayType } = this.props;
            if (managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL) {
                const definition = this.state.materialDefinitionForManager;
                const newDefinition = await this.props.duplicateMaterialDefinition(definition, undefined, name);

                // Select new definition after creation
                this.actions.onSelectDefinition(newDefinition.definitionId);
            } else if (managerDisplayType === PRINTING_MANAGER_TYPE_QUALITY) {
                const definition = this.state.qualityDefinitionForManager;
                const newDefinition = await this.props.duplicateQualityDefinition(definition, undefined, name);

                // Select new definition after creation
                this.actions.onSelectDefinition(newDefinition.definitionId);
            }
        },
        onCreateManagerDefinition: async (name) => {
            const { managerDisplayType, materialDefinitions, qualityDefinitions } = this.props;
            if (managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL) {
                const definition = materialDefinitions.find(def => def.definitionId === 'material.pla');
                const newDefinition = await this.props.duplicateMaterialDefinition(definition, undefined, name);

                // Select new definition after creation
                this.actions.onSelectDefinition(newDefinition.definitionId);
            } else if (managerDisplayType === PRINTING_MANAGER_TYPE_QUALITY) {
                const definition = qualityDefinitions.find(def => def.definitionId === 'quality.normal_quality');
                const newDefinition = await this.props.duplicateQualityDefinition(definition, undefined, name);

                // Select new definition after creation
                this.actions.onSelectDefinition(newDefinition.definitionId);
            }
        },
        onRemoveManagerDefinition: async (managerDisplayType) => {
            const selectedOption = this.props.managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL ? this.state.materialDefinitionForManager : this.state.qualityDefinitionForManager;
            if (isOfficialDefinition(selectedOption)) {
                return;
            }
            if (managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL) {
                const definition = this.state.materialDefinitionForManager;
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
                                await this.props.removeMaterialDefinition(definition);

                                // After removal, select the first definition
                                if (this.props.materialDefinitions.length) {
                                    this.actions.onSelectMaterialTypeAndUpdate(this.props.materialDefinitions[0].definitionId);
                                }
                                popupActions.close();
                            }}
                        >
                            {i18n._('OK')}
                        </button>
                    )
                });
            } else if (managerDisplayType === PRINTING_MANAGER_TYPE_QUALITY) {
                const definition = this.state.qualityDefinitionForManager;
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
                                await this.props.removeQualityDefinition(definition);

                                // After removal, select the first definition
                                if (this.props.qualityDefinitions.length) {
                                    this.actions.onSelectQualityType(this.props.qualityDefinitions[0]);
                                }
                                popupActions.close();
                            }}
                        >
                            {i18n._('OK')}
                        </button>
                    )
                });
            }
        },
        showNewModal: () => {
            // const keySelectedDefinition = `${this.props.managerDisplayType}DefinitionForManager`;
            this.actions.showInputModal({
                title: i18n._('Create Profile'),
                label: i18n._('Enter Profile Name:'),
                defaultInputValue: 'New Profile',
                onComplete: this.actions.onCreateManagerDefinition
            });
        },
        showDuplicateModal: () => {
            const keySelectedDefinition = `${this.props.managerDisplayType}DefinitionForManager`;
            this.actions.showInputModal({
                title: i18n._('Copy Profile'),
                label: i18n._('Enter Profile Name:'),
                defaultInputValue: this.state[keySelectedDefinition].name,
                onComplete: this.actions.onDuplicateManagerDefinition
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

    componentWillReceiveProps(nextProps) {
        if (nextProps.showPrintingManager !== this.props.showPrintingManager) {
            this.setState({ showPrintingManager: nextProps.showPrintingManager });
        }
        // Load 'materialDefinitions' and compose the content of the manager
        if (nextProps.materialDefinitions !== this.props.materialDefinitions) {
            const newState = {};
            if (this.props.materialDefinitions.length === 0) {
                const materialDefinitionForManager = nextProps.materialDefinitions.find(d => d.definitionId === 'material.pla');
                Object.assign(newState, {
                    materialDefinitionForManager: materialDefinitionForManager
                });
            } else {
                const materialDefinitionForManager = nextProps.materialDefinitions.find(d => d.definitionId === this.state.materialDefinitionForManager?.definitionId)
                || nextProps.materialDefinitions.find(d => d.definitionId === 'material.pla');
                Object.assign(newState, {
                    materialDefinitionForManager: materialDefinitionForManager
                });
            }

            const materialDefinitionOptions = nextProps.materialDefinitions.map(d => {
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

            this.setState(newState);
        }
        const { qualityDefinitions } = this.props;
        // selected quality ID or definitions changed
        if (qualityDefinitions !== nextProps.qualityDefinitions) {
            // re-select definition based on new properties
            const newState = {};
            if (this.props.qualityDefinitions.length === 0) {
                const qualityDefinitionForManager = nextProps.qualityDefinitions.find(d => d.definitionId === 'quality.fast_print');
                Object.assign(newState, {
                    qualityDefinitionForManager: qualityDefinitionForManager
                });
            } else {
                const qualityDefinitionForManager = nextProps.qualityDefinitions.find(d => d.definitionId === this.state.qualityDefinitionForManager?.definitionId)
                || nextProps.qualityDefinitions.find(d => d.definitionId === 'quality.fast_print');
                Object.assign(newState, {
                    qualityDefinitionForManager: qualityDefinitionForManager
                });
            }
            const qualityDefinitionOptions = nextProps.qualityDefinitions.map(d => {
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
            this.setState(newState);
        }
    }

    render() {
        const state = this.state;
        const actions = this.actions;
        const { managerDisplayType } = this.props;
        const { materialDefinitionOptions, materialDefinitionForManager, showPrintingManager,
            qualityDefinitionOptions, qualityDefinitionForManager, qualityConfigExpanded } = state;
        const { configExpanded, renamingStatus, selectedName, activeCateId } = state;

        const cates = [{ cateName: 'Default', items: [] }, { cateName: 'Custom', items: [] }];
        const regex = /^[a-z]+.[0-9]+$/;
        const optionConfigGroup = managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL ? PRINTING_MATERIAL_CONFIG_GROUP : PRINTING_QUALITY_CONFIG_GROUP;
        const optionList = managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL ? materialDefinitionOptions : qualityDefinitionOptions;
        optionList.forEach(option => {
            const idx = regex.test(option.value) ? 1 : 0;
            cates[idx].items.push(option);
        });

        const selectedOption = managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL ? materialDefinitionForManager : qualityDefinitionForManager;
        // console.log(isOfficialDefinition(selectedOption))

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
                                                                onClick={() => { this.actions.foldCategory(cate.cateName); }}
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
                                                                            onClick={() => this.actions.onSelectDefinition(currentOption.value)}
                                                                            onDoubleClick={() => this.actions.setRenamingStatus(true)}
                                                                        >
                                                                            {(isSelected && renamingStatus) ? (
                                                                                <input
                                                                                    ref={this.renameInput}
                                                                                    className="sm-parameter-row__input"
                                                                                    value={selectedName}
                                                                                    onChange={actions.onChangeSelectedName}
                                                                                    onKeyPress={(e) => {
                                                                                        if (e.key === 'Enter') {
                                                                                            e.preventDefault();
                                                                                            this.actions.setRenamingStatus(false);
                                                                                            this.actions.updaterDefinitionName();
                                                                                        }
                                                                                    }}
                                                                                    onBlur={() => {
                                                                                        this.actions.setRenamingStatus(false);
                                                                                        this.actions.updaterDefinitionName();
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
                                            onClick={() => this.actions.setRenamingStatus(true)}
                                        />
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
                                        <SvgIcon
                                            name="Import"
                                            size={18}
                                            title={i18n._('Import')}
                                            onClick={() => this.actions.importFile(managerDisplayType)}
                                        />
                                        <SvgIcon
                                            name="Export"
                                            size={18}
                                            title={i18n._('Export')}
                                            onClick={() => this.actions.exportConfigFile(managerDisplayType)}
                                        />
                                        <SvgIcon
                                            name="Delete"
                                            size={18}
                                            title={i18n._('Delete')}
                                            onClick={() => this.actions.onRemoveManagerDefinition(managerDisplayType)}
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
                                                                    this.actions.setActiveCate(idx);
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
                                    onWheel={() => { this.actions.setActiveCate(); }}
                                >
                                    {state.notificationMessage && (
                                        <Notifications bsStyle="danger" onDismiss={actions.clearNotification} className="Notifications">
                                            {state.notificationMessage}
                                        </Notifications>
                                    )}

                                    <div className="sm-parameter-container" ref={this.scrollDom}>
                                        {optionConfigGroup.map((group, idx) => {
                                            return (
                                                <div key={i18n._(idx)}>
                                                    {group.name && (
                                                        <Anchor
                                                            className="sm-parameter-header"
                                                            onClick={() => {
                                                                qualityConfigExpanded[group.name] = !qualityConfigExpanded[group.name];
                                                                this.setState({
                                                                    qualityConfigExpanded: JSON.parse(JSON.stringify(qualityConfigExpanded))
                                                                });
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
}

const mapStateToProps = (state) => {
    const { qualityDefinitions, materialDefinitions, showPrintingManager,
        managerDisplayType } = state.printing;
    const { series } = state.machine;
    return {
        series,
        materialDefinitions,
        showPrintingManager,
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
        updateShowPrintingManager: (showPrintingManager) => dispatch(printingActions.updateShowPrintingManager(showPrintingManager)),
        onUploadManagerDefinition: (materialFile, type) => dispatch(printingActions.onUploadManagerDefinition(materialFile, type)),
        exportConfigFile: (targetFile) => dispatch(projectActions.exportConfigFile(targetFile)),
        duplicateMaterialDefinition: (definition, newDefinitionId, newDefinitionName) => dispatch(printingActions.duplicateMaterialDefinition(definition, newDefinitionId, newDefinitionName)),
        duplicateQualityDefinition: (definition, newDefinitionId, newDefinitionName) => dispatch(printingActions.duplicateQualityDefinition(definition, newDefinitionId, newDefinitionName)),
        removeMaterialDefinition: (definition) => dispatch(printingActions.removeMaterialDefinition(definition)),
        removeQualityDefinition: (definition) => dispatch(printingActions.removeQualityDefinition(definition)),
        updateMaterialDefinitionName: (definition, name) => dispatch(printingActions.updateMaterialDefinitionName(definition, name)),
        updateQualityDefinitionName: (definition, name) => dispatch(printingActions.updateQualityDefinitionName(definition, name)),
        updateDefinitionSettings: (definition, settings) => dispatch(printingActions.updateDefinitionSettings(definition, settings))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(PrintingManager);
