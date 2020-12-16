import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import { includes } from 'lodash';
import Select from 'react-select';
import Notifications from '../../components/Notifications';
import i18n from '../../lib/i18n';
import Modal from '../../components/Modal';
import Anchor from '../../components/Anchor';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import { actions as printingActions } from '../../flux/printing';
import { actions as projectActions } from '../../flux/project';
import widgetStyles from '../../widgets/styles.styl';
import styles from './styles.styl';
import confirm from '../../lib/confirm';
import { HEAD_3DP, PRINTING_MANAGER_TYPE_QUALITY, PRINTING_MANAGER_TYPE_MATERIAL, PRINTING_MATERIAL_CONFIG_KEYS, PRINTING_QUALITY_CONFIG_KEYS, PRINTING_QUALITY_CONFIG_GROUP } from '../../constants';

// checkbox and select
const MATERIAL_CHECKBOX_AND_SELECT_KEY_ARRAY = [
    'machine_heated_bed'
];
const QUALITY_CHECKBOX_AND_SELECT_KEY_ARRAY = [
    'outer_inset_first',
    'retraction_enable',
    'retract_at_layer_change',
    'retraction_hop',
    'magic_spiralize',
    'support_enable',
    'magic_mesh_surface_mode',
    'adhesion_type',
    'support_type',
    'support_pattern'
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
        exportPrintingManagerFile: PropTypes.func.isRequired,

        updateShowPrintingManager: PropTypes.func.isRequired,
        updateManagerDisplayType: PropTypes.func.isRequired,
        // updateDefaultQualityId: PropTypes.func.isRequired,
        updateDefaultMaterialId: PropTypes.func.isRequired
    };

   materialFileInput = React.createRef();

   qualityFileInput = React.createRef();

    state = {
        materialDefinitionForManager: null,
        qualityDefinitionForManager: null,
        materialDefinitionOptions: [],
        qualityDefinitionOptions: [],
        showPrintingManager: false,
        notificationMessage: '',
        nameForMaterial: 'PLA',
        nameForQuality: 'Fast Print',
        qualityConfigExpanded: (function () {
            PRINTING_QUALITY_CONFIG_GROUP.forEach((config) => {
                this[config.name] = false;
            });
            return this;
        }).call({}),
        qualityConfigGroup: PRINTING_QUALITY_CONFIG_GROUP
    };

    actions = {
        hidePrintingManager: () => {
            this.props.updateShowPrintingManager(false);
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

            const { nameForQuality } = this.state;

            if (nameForQuality !== qualityDefinitionForManager.name) { // changed
                try {
                    await this.props.updateQualityDefinitionName(qualityDefinitionForManager, nameForQuality);
                } catch (err) {
                    this.actions.showNotification(err);
                }
            }

            this.props.updateDefinitionsForManager(qualityDefinitionForManager.definitionId, managerDisplayType);
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
            await this.props.updateDefinitionSettings(materialDefinitionForManager, newDefinitionSettings);

            const { nameForMaterial } = this.state;

            if (nameForMaterial !== materialDefinitionForManager.name) { // changed
                try {
                    await this.props.updateMaterialDefinitionName(materialDefinitionForManager, nameForMaterial);
                } catch (err) {
                    this.actions.showNotification(err);
                }
            }
            this.props.updateDefinitionsForManager(materialDefinitionForManager.definitionId, managerDisplayType);
        },

        isMaterialSelectedForManager: (option) => {
            return this.state.materialDefinitionForManager && this.state.materialDefinitionForManager.name === option.label;
        },
        isQualitySelectedForManager: (option) => {
            return this.state.qualityDefinitionForManager && this.state.qualityDefinitionForManager.name === option.label;
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

        onDuplicateManagerDefinition: async (managerDisplayType) => {
            if (managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL) {
                const definition = this.state.materialDefinitionForManager;
                const newDefinition = await this.props.duplicateMaterialDefinition(definition);

                // Select new definition after creation
                this.actions.onSelectMaterialTypeNotUpdate(newDefinition.definitionId);
            } else if (managerDisplayType === PRINTING_MANAGER_TYPE_QUALITY) {
                const definition = this.state.qualityDefinitionForManager;
                const newDefinition = await this.props.duplicateQualityDefinition(definition);

                // Select new definition after creation
                this.actions.onSelectQualityTypeById(newDefinition.definitionId);
            }
        },
        onRemoveManagerDefinition: async (managerDisplayType) => {
            if (managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL) {
                const definition = this.state.materialDefinitionForManager;
                await confirm({
                    body: `Are you sure to remove profile "${definition.name}"?`
                });

                await this.props.removeMaterialDefinition(definition);

                // After removal, select the first definition
                if (this.props.materialDefinitions.length) {
                    this.actions.onSelectMaterialTypeAndUpdate(this.props.materialDefinitions[0].definitionId);
                }
            } else if (managerDisplayType === PRINTING_MANAGER_TYPE_QUALITY) {
                const definition = this.state.qualityDefinitionForManager;

                await confirm({
                    body: `Are you sure to remove profile "${definition.name}"?`
                });

                await this.props.removeQualityDefinition(definition);

                // After removal, select the first definition
                if (this.props.qualityDefinitions.length) {
                    this.actions.onSelectQualityType(this.props.qualityDefinitions[0]);
                }
            }
        }
    };

    componentWillReceiveProps(nextProps) {
        if (nextProps.showPrintingManager !== this.props.showPrintingManager) {
            this.setState({ showPrintingManager: nextProps.showPrintingManager });
        }

        if (nextProps.materialDefinitions !== this.props.materialDefinitions) {
            const newState = {};
            if (this.props.materialDefinitions.length === 0) {
                const materialDefinitionForManager = nextProps.materialDefinitions.find(d => d.definitionId === 'material.pla');
                Object.assign(newState, {
                    materialDefinitionForManager: materialDefinitionForManager
                });
            } else {
                const materialDefinitionForManager = nextProps.materialDefinitions.find(d => d.definitionId === this.state.materialDefinitionForManager.definitionId)
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
                const qualityDefinitionForManager = nextProps.qualityDefinitions.find(d => d.definitionId === this.state.qualityDefinitionForManager.definitionId)
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
        const currentMaterialOption = materialDefinitionOptions.find((item) => {
            return item.label === materialDefinitionForManager.name;
        });
        const currentQualityOption = qualityDefinitionOptions.find((item) => {
            return item.label === qualityDefinitionForManager.name;
        });
        return (
            <React.Fragment>
                {showPrintingManager && (
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
                                <Anchor
                                    onClick={() => actions.updateManagerDisplayType(PRINTING_MANAGER_TYPE_MATERIAL)}
                                    className={classNames(styles['manager-type'], { [styles.selected]: managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL })}
                                >
                                    {i18n._('Material')}
                                </Anchor>
                                <Anchor
                                    onClick={() => actions.updateManagerDisplayType(PRINTING_MANAGER_TYPE_QUALITY)}
                                    className={classNames(styles['manager-type'], { [styles.selected]: managerDisplayType === PRINTING_MANAGER_TYPE_QUALITY })}
                                    style={{ marginLeft: '20px' }}
                                >
                                    {i18n._('Printing Settings')}
                                </Anchor>
                            </div>
                            <div className={classNames(styles['manager-content'])}>
                                <div className={classNames(styles['manager-name'])}>
                                    <ul className={classNames(styles['manager-name-wrapper'])}>
                                        { managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL && (materialDefinitionOptions.map((option) => {
                                            return (
                                                <li key={`${option.value}`}>
                                                    <Anchor
                                                        className={classNames(styles['manager-btn'], { [styles.selected]: this.actions.isMaterialSelectedForManager(option) })}
                                                        onClick={() => this.actions.onSelectMaterialTypeNotUpdate(option.value)}
                                                    >
                                                        {i18n._(option.label)}
                                                    </Anchor>
                                                </li>
                                            );
                                        }))}
                                        { managerDisplayType === PRINTING_MANAGER_TYPE_QUALITY && (qualityDefinitionOptions.map((option) => {
                                            return (
                                                <li key={`${option.value}`}>
                                                    <Anchor
                                                        className={classNames(styles['manager-btn'], { [styles.selected]: this.actions.isQualitySelectedForManager(option) })}
                                                        onClick={() => this.actions.onSelectQualityTypeById(option.value)}
                                                    >
                                                        {i18n._(option.label)}
                                                    </Anchor>
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
                                    {managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL && (
                                        <div className="sm-parameter-container">
                                            <div className="sm-parameter-row">
                                                <span className="sm-parameter-row__label-lg">{i18n._('Name')}</span>
                                                <input
                                                    className="sm-parameter-row__input"
                                                    style={{ paddingLeft: '12px', height: '30px', width: '180px' }}
                                                    value={state.nameForMaterial}
                                                    onChange={actions.onChangeNameForMaterial}
                                                    disabled={!isDefinitionEditable(materialDefinitionForManager)}
                                                />
                                            </div>
                                            {state.notificationMessage && (
                                                <Notifications bsStyle="danger" onDismiss={actions.clearNotification} className="Notifications">
                                                    {state.notificationMessage}
                                                </Notifications>
                                            )}
                                            <div className={classNames(widgetStyles.separator, widgetStyles['separator-underline'])} />
                                            {PRINTING_MATERIAL_CONFIG_KEYS.map((key) => {
                                                const setting = materialDefinitionForManager.settings[key];

                                                const { label, description, type, unit = '', enabled = '' } = setting;

                                                const defaultValue = setting.default_value;
                                                if (enabled) {
                                                    // for example: retraction_hop.enable = retraction_enable and retraction_hop_enabled
                                                    const conditions = enabled.split('and').map(c => c.trim());

                                                    for (const condition of conditions) {
                                                        // Simple implementation of condition
                                                        if (materialDefinitionForManager.settings[condition]) {
                                                            const value = materialDefinitionForManager.settings[condition].default_value;
                                                            if (!value) {
                                                                return null;
                                                            }
                                                        }
                                                    }
                                                }

                                                return (
                                                    <div key={key} className="sm-parameter-row">
                                                        <TipTrigger title={i18n._(label)} content={i18n._(description)}>
                                                            <span className="sm-parameter-row__label-lg">{i18n._(label)}</span>
                                                            {type === 'float' && (
                                                                <Input
                                                                    className="sm-parameter-row__input"
                                                                    value={defaultValue}
                                                                    onChange={value => {
                                                                        this.actions.onChangeMaterialDefinitionForManager(key, value);
                                                                    }}
                                                                    disabled={!isDefinitionEditable(materialDefinitionForManager, key)}
                                                                />
                                                            )}
                                                            {type === 'bool' && (
                                                                <input
                                                                    className="sm-parameter-row__checkbox"
                                                                    type="checkbox"
                                                                    checked={currentMaterialOption[key]}
                                                                    disabled={!isDefinitionEditable(materialDefinitionForManager, key)}
                                                                    onChange={(event) => this.actions.onChangeMaterialDefinitionForManager(key, event.target.checked, key)}
                                                                />
                                                            )}
                                                            <span className="sm-parameter-row__input-unit">{unit}</span>
                                                        </TipTrigger>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {managerDisplayType === PRINTING_MANAGER_TYPE_QUALITY && (
                                        <div style={{ marginBottom: '6px' }}>
                                            <div className="sm-parameter-row">
                                                <span className="sm-parameter-row__label-lg">{i18n._('Name')}</span>
                                                <input
                                                    className="sm-parameter-row__input"
                                                    value={state.nameForQuality}
                                                    style={{ paddingLeft: '12px', height: '30px', width: '180px' }}
                                                    onChange={actions.onChangeNameForQuality}
                                                    disabled={!isDefinitionEditable(qualityDefinitionForManager)}
                                                />
                                            </div>
                                            <div className={classNames(widgetStyles.separator, widgetStyles['separator-underline'])} />
                                            {state.notificationMessage && (
                                                <Notifications bsStyle="danger" onDismiss={actions.clearNotification} className="Notifications">
                                                    {state.notificationMessage}
                                                </Notifications>
                                            )}
                                            <div className="sm-parameter-container">
                                                {state.qualityConfigGroup.map((group) => {
                                                    return (
                                                        <div key={i18n._(group.name)}>
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
                                                                <span className={classNames(
                                                                    'fa',
                                                                    qualityConfigExpanded[group.name] ? 'fa-angle-double-up' : 'fa-angle-double-down',
                                                                    'sm-parameter-header__indicator',
                                                                    'pull-right',
                                                                )}
                                                                />
                                                            </Anchor>
                                                            {qualityConfigExpanded[group.name] && group.fields.map((key) => {
                                                                const setting = qualityDefinitionForManager.settings[key];

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
                                                                                if (qualityDefinitionForManager.settings[enabledKey]) {
                                                                                    const value = qualityDefinitionForManager.settings[enabledKey].default_value;
                                                                                    if (value !== enabledValue) {
                                                                                        return null;
                                                                                    }
                                                                                }
                                                                            } else {
                                                                                if (qualityDefinitionForManager.settings[condition]) {
                                                                                    const value = qualityDefinitionForManager.settings[condition].default_value;
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
                                                                            if (qualityDefinitionForManager.settings[condition]) {
                                                                                const value = qualityDefinitionForManager.settings[condition].default_value;
                                                                                if (value) {
                                                                                    result = true;
                                                                                }
                                                                            }
                                                                            if (condition.match('(.*) > ([0-9]+)')) {
                                                                                const m = condition.match('(.*) > ([0-9]+)');
                                                                                const enabledKey = m[1];
                                                                                const enabledValue = parseInt(m[2], 10);
                                                                                if (qualityDefinitionForManager.settings[enabledKey]) {
                                                                                    const value = qualityDefinitionForManager.settings[enabledKey].default_value;
                                                                                    if (value > enabledValue) {
                                                                                        result = true;
                                                                                    }
                                                                                }
                                                                            }
                                                                            if (condition.match('(.*) < ([0-9]+)')) {
                                                                                const m = condition.match('(.*) > ([0-9]+)');
                                                                                const enabledKey = m[1];
                                                                                const enabledValue = parseInt(m[2], 10);
                                                                                if (qualityDefinitionForManager.settings[enabledKey]) {
                                                                                    const value = qualityDefinitionForManager.settings[enabledKey].default_value;
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
                                                                                if (qualityDefinitionForManager.settings[enabledKey]) {
                                                                                    const value = qualityDefinitionForManager.settings[enabledKey].default_value;
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
                                                                                    value={defaultValue}
                                                                                    disabled={!isDefinitionEditable(qualityDefinitionForManager)}
                                                                                    onChange={(value) => {
                                                                                        actions.onChangeQualityDefinitionForManager(key, value);
                                                                                    }}
                                                                                />
                                                                            )}
                                                                            {type === 'float' && (
                                                                                <span className="sm-parameter-row__input-unit">{unit}</span>
                                                                            )}
                                                                            {type === 'int' && (
                                                                                <Input
                                                                                    className="sm-parameter-row__input"
                                                                                    value={defaultValue}
                                                                                    disabled={!isDefinitionEditable(qualityDefinitionForManager)}
                                                                                    onChange={(value) => {
                                                                                        actions.onChangeQualityDefinitionForManager(key, value);
                                                                                    }}
                                                                                />
                                                                            )}
                                                                            {type === 'int' && (
                                                                                <span className="sm-parameter-row__input-unit">{unit}</span>
                                                                            )}
                                                                            {type === 'bool' && (
                                                                                <input
                                                                                    className="sm-parameter-row__checkbox"
                                                                                    type="checkbox"
                                                                                    checked={currentQualityOption[key]}
                                                                                    disabled={!isDefinitionEditable(qualityDefinitionForManager)}
                                                                                    onChange={(event) => actions.onChangeQualityDefinitionForManager(key, event.target.checked, QUALITY_CHECKBOX_AND_SELECT_KEY_ARRAY)}
                                                                                />
                                                                            )}
                                                                            {type === 'enum' && (
                                                                                <Select
                                                                                    className="sm-parameter-row__select"
                                                                                    backspaceRemoves={false}
                                                                                    clearable={false}
                                                                                    menuContainerStyle={{ zIndex: 5 }}
                                                                                    name={key}
                                                                                    disabled={!isDefinitionEditable(qualityDefinitionForManager)}
                                                                                    options={opts}
                                                                                    searchable={false}
                                                                                    value={currentQualityOption[key]}
                                                                                    onChange={(option) => {
                                                                                        actions.onChangeQualityDefinitionForManager(key, option.value, QUALITY_CHECKBOX_AND_SELECT_KEY_ARRAY);
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
                                    )}
                                </div>
                            </div>
                            <div className={classNames(styles['manager-settings'], 'clearfix')}>
                                <div className={classNames(styles['manager-settings-operate'], styles['manager-settings-btn'])}>
                                    <Anchor
                                        onClick={() => { actions.onDuplicateManagerDefinition(managerDisplayType); }}
                                        className="sm-btn-large sm-btn-default"
                                        style={{ marginRight: '11px' }}
                                    >
                                        {i18n._('Copy')}
                                    </Anchor>
                                    {managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL && (
                                        <Anchor
                                            className="sm-btn-large sm-btn-default"
                                            onClick={() => { actions.onRemoveManagerDefinition(managerDisplayType); }}
                                            disabled={isOfficialDefinition(materialDefinitionForManager)}
                                        >
                                            {i18n._('Delete')}
                                        </Anchor>
                                    )}
                                    {managerDisplayType === PRINTING_MANAGER_TYPE_QUALITY && (
                                        <Anchor
                                            className="sm-btn-large sm-btn-default"
                                            onClick={() => { actions.onRemoveManagerDefinition(managerDisplayType); }}
                                            disabled={isOfficialDefinition(qualityDefinitionForManager)}
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
        exportPrintingManagerFile: (targetFile) => dispatch(projectActions.exportPrintingManagerFile(targetFile)),
        duplicateMaterialDefinition: (definition) => dispatch(printingActions.duplicateMaterialDefinition(definition)),
        duplicateQualityDefinition: (definition) => dispatch(printingActions.duplicateQualityDefinition(definition)),
        removeMaterialDefinition: (definition) => dispatch(printingActions.removeMaterialDefinition(definition)),
        removeQualityDefinition: (definition) => dispatch(printingActions.removeQualityDefinition(definition)),
        updateMaterialDefinitionName: (definition, name) => dispatch(printingActions.updateMaterialDefinitionName(definition, name)),
        updateQualityDefinitionName: (definition, name) => dispatch(printingActions.updateQualityDefinitionName(definition, name)),
        updateDefinitionSettings: (definition, settings) => dispatch(printingActions.updateDefinitionSettings(definition, settings))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(PrintingManager);
