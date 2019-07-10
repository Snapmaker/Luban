import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import { actions } from '../../flux/printing';
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

        const isPLA = state.materialDefinition && state.materialDefinition.definitionId === 'material.pla';
        const isABS = state.materialDefinition && state.materialDefinition.definitionId === 'material.abs';
        const isCustom = state.materialDefinition && state.materialDefinition.definitionId === 'material.custom';

        return (
            <React.Fragment>
                <div style={{ marginBottom: '6px' }}>
                    <Anchor
                        className={classNames(styles['material-btn'], { [styles.selected]: isPLA })}
                        onClick={() => this.actions.onChangeMaterial('material.pla')}
                    >
                        PLA
                    </Anchor>
                    <Anchor
                        className={classNames(styles['material-btn'], { [styles.selected]: isABS })}
                        onClick={() => this.actions.onChangeMaterial('material.abs')}
                    >
                        ABS
                    </Anchor>
                    <Anchor
                        className={classNames(styles['material-btn'], { [styles.selected]: isCustom })}
                        onClick={() => this.actions.onChangeMaterial('material.custom')}
                    >
                        {i18n._('Custom Material')}
                    </Anchor>
                </div>
                <div className={widgetStyles.separator} />
                {state.materialDefinition && (
                    <div className="sm-parameter-container">
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
                                && state.materialDefinition.definitionId === 'material.custom'
                                && key !== 'material_diameter';

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
                                                disabled={!editable}
                                            />
                                        )}
                                        {type === 'bool' && (
                                            <input
                                                className="sm-parameter-row__checkbox"
                                                type="checkbox"
                                                checked={defaultValue}
                                                disabled={!editable}
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
        materialDefinitions: printing.materialDefinitions
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateActiveDefinition: (definition, shouldSave = false) => dispatch(actions.updateActiveDefinition(definition, shouldSave))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Material);
