import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import Select from '../../components/Select';
import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import { actions as printingActions } from '../../flux/printing';
import { actions as projectActions } from '../../flux/project';
import styles from './styles.styl';
import { HEAD_3DP, PRINTING_MANAGER_TYPE_MATERIAL } from '../../constants';
import OptionalDropdown from '../../components/OptionalDropdown';
import Space from '../../components/Space';


const MATERIAL_CONFIG_KEYS = [
    'material_diameter',
    'material_flow',
    'material_print_temperature',
    'material_print_temperature_layer_0',
    'material_final_print_temperature',
    'cool_fan_speed',
    'machine_heated_bed',
    'material_bed_temperature',
    'material_bed_temperature_layer_0'
];

class Material extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,
        defaultMaterialId: PropTypes.string.isRequired,
        materialDefinitions: PropTypes.array.isRequired,
        updateActiveDefinition: PropTypes.func.isRequired,
        updateManagerDisplayType: PropTypes.func.isRequired,
        updateShowPrintingManager: PropTypes.func.isRequired,
        updateDefaultMaterialId: PropTypes.func.isRequired
    };

    fileInput = React.createRef();

    state = {
        showOfficialMaterialDetails: true,
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
                const definition = nextProps.materialDefinitions.find(d => d.definitionId === (this.state.materialDefinition?.definitionId))
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
                <div>
                    <OptionalDropdown
                        draggable="false"
                        title={i18n._('Show Details')}
                        hidden={!state.showOfficialMaterialDetails}
                        onClick={() => {
                            this.setState({ showOfficialMaterialDetails: !state.showOfficialMaterialDetails });
                        }}
                    >
                        {state.showOfficialMaterialDetails && (
                            <table className={styles['config-details-table']}>
                                <tbody>
                                    {MATERIAL_CONFIG_KEYS.map((key) => {
                                        const setting = materialDefinition.settings[key];
                                        const { label, type, unit = '', enabled = '' } = setting;
                                        const defaultValue = setting.default_value;
                                        if (typeof enabled === 'string') {
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
                                            <tr key={key}>
                                                <td>{i18n._(label)}</td>
                                                { type === 'float' && (
                                                    <td>
                                                        <span>{i18n._(defaultValue)}</span>
                                                        <Space width="4" />
                                                        <span>{i18n._(unit)}</span>
                                                    </td>
                                                )}
                                                { type === 'enum' && (
                                                    <td>
                                                        <span>{i18n._(setting.options[defaultValue])}</span>
                                                        <Space width="4" />
                                                        <span>{i18n._(unit)}</span>
                                                    </td>
                                                )}
                                                { type === 'bool' && (
                                                    <td>
                                                        {defaultValue ? i18n._('Yes') : i18n._('No')}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </OptionalDropdown>
                </div>
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
