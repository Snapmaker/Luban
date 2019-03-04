import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Select from 'react-select';
import classNames from 'classnames';
import {
    ABSENT_OBJECT
} from '../../constants';
import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import { actions } from '../../reducers/printing';
import widgetStyles from '../styles.styl';
import styles from './styles.styl';


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

class Material extends PureComponent {
    static propTypes = {
        materialDefinitions: PropTypes.array.isRequired,
        activeDefinition: PropTypes.object.isRequired,
        updateActiveDefinition: PropTypes.func.isRequired
    };

    state = {
        materialDefinition: null
    };

    actions = {
        onChangeMaterial: (definitionId) => {
            const definition = this.props.materialDefinitions.find(d => d.definitionId === definitionId);

            if (definition) {
                this.setState({
                    materialDefinition: definition
                });
                this.props.updateActiveDefinition(definition);
            }
        },
        onChangeMaterialDefinition: (key, value) => {
            const definition = this.state.materialDefinition;
            definition.settings[key].default_value = value;

            this.props.updateActiveDefinition(definition);
        },
        onChangeAdhesion: (option) => {
            const definition = this.props.activeDefinition;

            definition.settings.adhesion_type.default_value = option.value;
            this.props.updateActiveDefinition(definition, true);
        },
        onChangeSupport: (option) => {
            const definition = this.props.activeDefinition;

            if (option.value === 'none') {
                definition.settings.support_enable.default_value = false;
            } else {
                definition.settings.support_enable.default_value = true;
                definition.settings.support_type.default_value = option.value;
            }

            this.props.updateActiveDefinition(definition, true);
        }
    };

    componentWillReceiveProps(nextProps) {
        if (nextProps.materialDefinitions !== this.props.materialDefinitions) {
            const definition = nextProps.materialDefinitions.find(d => d.definitionId === 'material.pla');
            this.setState({
                materialDefinition: definition
            });
            this.props.updateActiveDefinition(definition);
        }
    }

    render() {
        const state = this.state;
        const actions = this.actions;

        const isPLA = state.materialDefinition && state.materialDefinition.definitionId === 'material.pla';
        const isABS = state.materialDefinition && state.materialDefinition.definitionId === 'material.abs';
        const isCustom = state.materialDefinition && state.materialDefinition.definitionId === 'material.custom';

        const { activeDefinition } = this.props;

        return (
            <React.Fragment>
                <div style={{ marginBottom: '6px' }}>
                    <Anchor
                        className={classNames(styles['material-btn'], { [styles.selected]: isPLA })}
                        onClick={() => actions.onChangeMaterial('material.pla')}
                    >
                        PLA
                    </Anchor>
                    <Anchor
                        className={classNames(styles['material-btn'], { [styles.selected]: isABS })}
                        onClick={() => actions.onChangeMaterial('material.abs')}
                    >
                        ABS
                    </Anchor>
                    <Anchor
                        className={classNames(styles['material-btn'], { [styles.selected]: isCustom })}
                        onClick={() => actions.onChangeMaterial('material.custom')}
                    >
                        {i18n._('Custom Material')}
                    </Anchor>
                </div>
                <div className={widgetStyles.separator} />
                {state.materialDefinition &&
                <div className={widgetStyles['parameter-container']}>
                    {MATERIAL_CONFIG_KEYS.map((key) => {
                        const setting = state.materialDefinition.settings[key];

                        const { label, description, type, unit = '', enabled = '' } = setting;
                        const defaultValue = setting.default_value;

                        if (enabled) {
                            // for example: retraction_hop.enable = retraction_enable and retraction_hop_enabled
                            const conditions = enabled.split('and').map(c => c.trim());

                            for (const condition of conditions) {
                                // Simple implementation of condition
                                if (state.materialDefinition.settings[condition]) {
                                    const value = state.materialDefinition.settings[condition].default_value;
                                    if (!value) {
                                        return null;
                                    }
                                }
                            }
                        }

                        // Only custom material is editable, changes on diameter is not allowed as well
                        const editable = state.materialDefinition
                            && state.materialDefinition.definitionId === 'custom.material'
                            && key !== 'material_diameter';

                        return (
                            <div key={key} className={widgetStyles['parameter-row']}>
                                <TipTrigger title={i18n._(label)} content={i18n._(description)}>
                                    <span className={widgetStyles['parameter-row__label-lg']}>{i18n._(label)}</span>
                                    {type === 'float' &&
                                    <Input
                                        className={widgetStyles['parameter-row__input']}
                                        value={defaultValue}
                                        onChange={value => {
                                            actions.onChangeMaterialDefinition(key, value);
                                        }}
                                        disabled={!editable}
                                    />
                                    }
                                    {type === 'bool' &&
                                    <input
                                        className={widgetStyles['parameter-row__checkbox']}
                                        type="checkbox"
                                        checked={defaultValue}
                                        disabled={!editable}
                                        onChange={(event) => actions.onChangeMaterialDefinition(key, event.target.checked)}
                                    />
                                    }
                                    <span className={widgetStyles['parameter-row__input-unit']}>{unit}</span>
                                </TipTrigger>
                            </div>
                        );
                    })}
                </div>
                }
                <div className={widgetStyles.separator} style={{ marginTop: '10px' }} />
                <div
                    className={widgetStyles['parameter-container']}
                    style={{ marginTop: '18px', marginBottom: '3px' }}
                >
                    {activeDefinition !== ABSENT_OBJECT && (() => {
                        const adhesionSetting = activeDefinition.settings.adhesion_type;

                        return (
                            <TipTrigger
                                title={i18n._('Adhesion')}
                                content={i18n._(adhesionSetting.description)}
                                className={widgetStyles['parameter-row']}
                            >
                                <span className={widgetStyles['parameter-row__label']}>{i18n._('Adhesion')}</span>
                                <Select
                                    className={widgetStyles['parameter-row__select-lg']}
                                    backspaceRemoves={false}
                                    clearable={false}
                                    style={{ height: '30px' }}
                                    menuContainerStyle={{ zIndex: 5 }}
                                    name="adhesion"
                                    options={[{
                                        value: 'none',
                                        label: i18n._('None')
                                    }, {
                                        value: 'skirt',
                                        label: 'Skirt'
                                    }, {
                                        value: 'brim',
                                        label: 'Brim'
                                    }, {
                                        value: 'raft',
                                        label: 'Raft'
                                    }]}
                                    placeholder="Choose Adhesion"
                                    searchable={false}
                                    value={i18n._(activeDefinition.settings.adhesion_type.default_value)}
                                    onChange={actions.onChangeAdhesion}
                                />
                            </TipTrigger>
                        );
                    })()}
                    {activeDefinition !== ABSENT_OBJECT && (() => {
                        const supportEnableSetting = activeDefinition.settings.support_enable;
                        const supportTypeSetting = activeDefinition.settings.support_type;

                        return (
                            <TipTrigger
                                title={i18n._('Support')}
                                content={i18n._(supportEnableSetting.description)}
                                className={widgetStyles['parameter-row']}
                            >
                                <span className={widgetStyles['parameter-row__label']}>{i18n._('Support')}</span>
                                <Select
                                    className={widgetStyles['parameter-row__select-lg']}
                                    backspaceRemoves={false}
                                    clearable={false}
                                    menuContainerStyle={{ zIndex: 5 }}
                                    name="adhesion"
                                    options={[{
                                        value: 'none',
                                        label: i18n._('None')
                                    }, {
                                        value: 'buildplate',
                                        label: i18n._('Touch Building Plate')
                                    }, {
                                        value: 'everywhere',
                                        label: i18n._('Everywhere')
                                    }]}
                                    placeholder="choose support"
                                    searchable={false}
                                    value={supportEnableSetting.default_value ? supportTypeSetting.default_value : 'none'}
                                    onChange={actions.onChangeSupport}
                                />
                            </TipTrigger>
                        );
                    })()}
                </div>
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
        updateActiveDefinition: (definition, shouldSave = false) => dispatch(actions.updateActiveDefinition(definition, shouldSave))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Material);
