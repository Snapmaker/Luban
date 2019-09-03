import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import includes from 'lodash/includes';
import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import { actions as printingActions } from '../../flux/printing';
import widgetStyles from '../styles.styl';
import styles from './styles.styl';
import confirm from '../../lib/confirm';


const MATERIAL_CONFIG_KEYS = [
    'material_diameter',
    'material_flow',
    'material_print_temperature',
    'material_print_temperature_layer_0',
    'material_final_print_temperature',
    'machine_heated_bed',
    'material_bed_temperature',
    'material_bed_temperature_layer_0'
];

// Only custom material is editable, changes on diameter is not allowed as well
function isDefinitionEditable(definition, key) {
    return definition
        && definition.definitionId !== 'material.pla'
        && definition.definitionId !== 'material.abs'
        && key !== 'material_diameter';
}

function isOfficialDefinition(definition) {
    return includes(['material.pla', 'material.abs'], definition.definitionId);
}

class Material extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,

        materialDefinitions: PropTypes.array.isRequired,
        updateActiveDefinition: PropTypes.func.isRequired,
        duplicateMaterialDefinition: PropTypes.func.isRequired,
        updateMaterialDefinitionName: PropTypes.func.isRequired,
        removeMaterialDefinition: PropTypes.func.isRequired,
        updateDefinitionSettings: PropTypes.func.isRequired
    };

    state = {
        materialDefinition: null,
        materialDefinitionOptions: [],

        isRenaming: null,
        newName: null
    };

    actions = {
        onChangeMaterial: (definitionId) => {
            const definition = this.props.materialDefinitions.find(d => d.definitionId === definitionId);
            if (definition) {
                this.setState({
                    materialDefinition: definition,
                    isRenaming: false
                });
                this.props.updateActiveDefinition(definition);
            }
        },
        onChangeMaterialDefinition: (key, value) => {
            const definition = this.state.materialDefinition;
            if (!isDefinitionEditable(definition, key)) {
                return;
            }

            definition.settings[key].default_value = value;

            this.props.updateDefinitionSettings(definition, {
                [key]: { default_value: value }
            });

            this.props.updateActiveDefinition(definition);
        },
        onDuplicateMaterialDefinition: async () => {
            const definition = this.state.materialDefinition;
            const newDefinition = await this.props.duplicateMaterialDefinition(definition);

            // Select new definition after creation
            this.actions.onChangeMaterial(newDefinition.definitionId);
        },
        isMaterialSelected: (option) => {
            return this.state.materialDefinition && this.state.materialDefinition.name === option.label;
        },
        onChangeNewName: (event) => {
            this.setState({
                newName: event.target.value
            });
        },
        onRenameDefinitionStart: () => {
            if (!this.state.isRenaming) {
                const definition = this.state.materialDefinition;
                this.setState({
                    isRenaming: true,
                    newName: definition.name
                });
            } else {
                this.actions.onRenameDefinitionEnd();
            }
        },
        onRenameDefinitionEnd: async () => {
            const definition = this.state.materialDefinition;
            const { newName } = this.state;

            if (newName === definition.name) { // unchanged
                this.setState({
                    isRenaming: false
                });
                return;
            }

            try {
                await this.props.updateMaterialDefinitionName(definition, newName);
            } catch (err) {
                if (typeof err === 'string') {
                    this.actions.showNotification(err);
                }
            }

            // Update options
            const materialDefinitionOptions = this.props.materialDefinitions.map(d => ({
                label: d.name,
                value: d.definitionId
            }));

            this.setState({
                isRenaming: false,
                materialDefinitionOptions
            });
        },
        onRemoveDefinition: async () => {
            const definition = this.state.materialDefinition;
            await confirm({
                body: `Are you sure to remove profile "${definition.name}"?`
            });

            await this.props.removeMaterialDefinition(definition);

            // After removal, select the first definition
            if (this.props.materialDefinitions.length) {
                this.actions.onChangeMaterial(this.props.materialDefinitions[0].definitionId);
            }
        }
    };

    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('Material'));
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.materialDefinitions !== this.props.materialDefinitions) {
            const newState = {};
            if (this.props.materialDefinitions.length === 0) {
                const definition = nextProps.materialDefinitions.find(d => d.definitionId === 'material.pla');

                Object.assign(newState, {
                    materialDefinition: definition
                });

                this.props.updateActiveDefinition(definition);
            }

            const materialDefinitionOptions = nextProps.materialDefinitions.map(d => ({
                label: d.name,
                value: d.definitionId
            }));

            Object.assign(newState, {
                materialDefinitionOptions: materialDefinitionOptions
            });

            this.setState(newState);
        }
    }

    render() {
        const state = this.state;
        const actions = this.actions;
        const { materialDefinition, materialDefinitionOptions } = state;

        if (!materialDefinition) {
            return null;
        }

        return (
            <React.Fragment>
                <div>
                    {materialDefinitionOptions.map((option) => {
                        return (
                            <Anchor
                                key={option.value}
                                className={classNames(styles['material-btn'], { [styles.selected]: this.actions.isMaterialSelected(option) })}
                                onClick={() => this.actions.onChangeMaterial(option.value)}
                            >
                                {i18n._(option.label)}
                            </Anchor>
                        );
                    })}
                </div>
                <div style={{ marginTop: '8px', color: '#808080' }}>
                    {!state.isRenaming && (
                        <span>{materialDefinition.name}</span>
                    )}
                    {state.isRenaming && (
                        <React.Fragment>
                            <input
                                value={state.newName}
                                onChange={actions.onChangeNewName}
                            />
                            <Anchor
                                className={classNames('fa', 'fa-check', widgetStyles['fa-btn'])}
                                onClick={actions.onRenameDefinitionEnd}
                            />
                        </React.Fragment>
                    )}
                    <div
                        style={{
                            display: 'inline-block',
                            float: 'right'
                        }}
                    >
                        {!isOfficialDefinition(materialDefinition) && (
                            <Anchor
                                className={classNames('fa', 'fa-edit', widgetStyles['fa-btn'])}
                                onClick={actions.onRenameDefinitionStart}
                            />
                        )}
                        <Anchor
                            className={classNames('fa', 'fa-plus', widgetStyles['fa-btn'])}
                            onClick={actions.onDuplicateMaterialDefinition}
                        />
                        {!isOfficialDefinition(materialDefinition) && (
                            <Anchor
                                className={classNames('fa', 'fa-trash-o', widgetStyles['fa-btn'])}
                                onClick={actions.onRemoveDefinition}
                            />
                        )}
                    </div>
                </div>
                <div className={classNames(widgetStyles.separator, widgetStyles['separator-underline'])} />
                {materialDefinition && (
                    <div className="sm-parameter-container">
                        {MATERIAL_CONFIG_KEYS.map((key) => {
                            const setting = materialDefinition.settings[key];

                            const { label, description, type, unit = '', enabled = '' } = setting;
                            const defaultValue = setting.default_value;

                            if (enabled) {
                            // for example: retraction_hop.enable = retraction_enable and retraction_hop_enabled
                                const conditions = enabled.split('and').map(c => c.trim());

                                for (const condition of conditions) {
                                // Simple implementation of condition
                                    if (materialDefinition.settings[condition]) {
                                        const value = materialDefinition.settings[condition].default_value;
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
                                                    this.actions.onChangeMaterialDefinition(key, value);
                                                }}
                                                disabled={!isDefinitionEditable(materialDefinition, key)}
                                            />
                                        )}
                                        {type === 'bool' && (
                                            <input
                                                className="sm-parameter-row__checkbox"
                                                type="checkbox"
                                                checked={defaultValue}
                                                disabled={!isDefinitionEditable(materialDefinition, key)}
                                                onChange={(event) => this.actions.onChangeMaterialDefinition(key, event.target.checked)}
                                            />
                                        )}
                                        <span className="sm-parameter-row__input-unit">{unit}</span>
                                    </TipTrigger>
                                </div>
                            );
                        })}
                    </div>
                )}
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const printing = state.printing;
    return {
        materialDefinitions: printing.materialDefinitions,
        activeDefinition: printing.activeDefinition
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateActiveDefinition: (definition, shouldSave = false) => dispatch(printingActions.updateActiveDefinition(definition, shouldSave)),
        duplicateMaterialDefinition: (definition) => dispatch(printingActions.duplicateMaterialDefinition(definition)),
        removeMaterialDefinition: (definition) => dispatch(printingActions.removeMaterialDefinition(definition)),
        updateMaterialDefinitionName: (definition, name) => dispatch(printingActions.updateMaterialDefinitionName(definition, name)),
        updateDefinitionSettings: (definition, settings) => dispatch(printingActions.updateDefinitionSettings(definition, settings))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Material);
