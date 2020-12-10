import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import Select from 'react-select';
import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import { actions as printingActions } from '../../flux/printing';
import { actions as projectActions } from '../../flux/project';
import widgetStyles from '../styles.styl';
import styles from './styles.styl';
import { HEAD_3DP, PRINTING_MANAGER_TYPE_MATERIAL } from '../../constants';


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
    return !definition.metadata.readonly
        && key !== 'material_diameter';
}


class Material extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,
        defaultMaterialId: PropTypes.string.isRequired,
        materialDefinitions: PropTypes.array.isRequired,
        updateActiveDefinition: PropTypes.func.isRequired,
        updateManagerDisplayType: PropTypes.func.isRequired,
        updateShowPrintingManager: PropTypes.func.isRequired,
        updateDefinitionSettings: PropTypes.func.isRequired,
        updateDefinitionsForManager: PropTypes.func.isRequired,
        updateDefaultMaterialId: PropTypes.func.isRequired
    };

   fileInput = React.createRef();

    state = {
        materialDefinition: null,
        materialDefinitionOptions: []

    };

    actions = {
        onShowPrintingManager: () => {
            this.props.updateManagerDisplayType(PRINTING_MANAGER_TYPE_MATERIAL);
            this.props.updateShowPrintingManager(true);
        },
        onChangeMaterialValue: (option) => {
            const definitionId = option.value;
            const definition = this.props.materialDefinitions.find(d => d.definitionId === definitionId);
            if (definition) {
                this.setState({
                    materialDefinition: definition
                });

                this.props.updateDefaultMaterialId(definition.definitionId);
                this.props.updateActiveDefinition(definition);
            }
        },
        onChangeMaterial: (definitionId) => {
            const definition = this.props.materialDefinitions.find(d => d.definitionId === definitionId);
            if (definition) {
                this.setState({
                    materialDefinition: definition
                });

                this.props.updateDefaultMaterialId(definition.definitionId);
                this.props.updateActiveDefinition(definition);
            }
        },
        onChangeMaterialDefinition: (key, value, shouldUpdateDefinitionsForManager = false) => {
            const definition = this.state.materialDefinition;
            if (!isDefinitionEditable(definition, key)) {
                return;
            }

            definition.settings[key].default_value = value;
            this.props.updateDefinitionSettings(definition, {
                [key]: { default_value: value }
            });
            this.props.updateActiveDefinition(definition);
            if (shouldUpdateDefinitionsForManager) {
                this.props.updateDefinitionsForManager(definition.definitionId, PRINTING_MANAGER_TYPE_MATERIAL);
            }
        },
        isMaterialSelected: (option) => {
            return this.state.materialDefinition && this.state.materialDefinition.name === option.label;
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
            } else {
                const definition = nextProps.materialDefinitions.find(d => d.definitionId === this.state.materialDefinition.definitionId)
                || nextProps.materialDefinitions.find(d => d.definitionId === 'material.pla');
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
        if (nextProps.defaultMaterialId !== this.props.defaultMaterialId) {
            this.actions.onChangeMaterial(nextProps.defaultMaterialId);
        }
    }

    render() {
        const state = this.state;
        // const actions = this.actions;
        const { materialDefinition, materialDefinitionOptions } = state;

        if (!materialDefinition) {
            return null;
        }

        return (
            <React.Fragment>
                <div className={classNames(
                    styles['material-select']
                )}
                >
                    <Select
                        clearable={false}
                        searchable
                        options={materialDefinitionOptions}
                        value={materialDefinition.definitionId}
                        onChange={this.actions.onChangeMaterialValue}
                    />
                </div>
                <Anchor
                    onClick={this.actions.onShowPrintingManager}
                >
                    <span
                        className={classNames(
                            styles['manager-icon'],
                        )}
                    />
                </Anchor>
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
                                                onChange={(event) => this.actions.onChangeMaterialDefinition(key, event.target.checked, type === 'bool')}
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
        defaultMaterialId: printing.defaultMaterialId,
        activeDefinition: printing.activeDefinition
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateDefaultMaterialId: (defaultMaterialId) => dispatch(printingActions.updateState({ defaultMaterialId })),
        updateActiveDefinition: (definition, shouldSave = false) => {
            dispatch(printingActions.updateActiveDefinition(definition, shouldSave));
            dispatch(projectActions.autoSaveEnvironment(HEAD_3DP, true));
        },
        updateManagerDisplayType: (managerDisplayType) => dispatch(printingActions.updateManagerDisplayType(managerDisplayType)),
        updateShowPrintingManager: (showPrintingManager) => dispatch(printingActions.updateShowPrintingManager(showPrintingManager)),
        updateDefinitionSettings: (definition, settings) => dispatch(printingActions.updateDefinitionSettings(definition, settings)),
        updateDefinitionsForManager: (definitionId, type) => dispatch(printingActions.updateDefinitionsForManager(definitionId, type))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Material);
