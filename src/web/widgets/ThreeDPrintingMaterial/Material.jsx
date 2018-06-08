import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import {
    ACTION_3DP_CONFIG_LOADED
} from '../../constants';
import Anchor from '../../components/Anchor';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import styles from './styles.styl';
import configManager from '../Print3dConfigManager';


const MATERIAL_CONFIG_KEYS = [
    'material_diameter',
    'material_bed_temperature',
    'material_bed_temperature_layer_0',
    'material_print_temperature',
    'material_print_temperature_layer_0',
    'material_final_print_temperature'
];

class Material extends PureComponent {
    static propTypes = {
        widgetState: PropTypes.object
    };

    state = {
        selectedMaterialBean: undefined,
        adhesionSupportBean: undefined
    };

    actions = {
        onChangeMaterial: (name) => {
            this.setState({
                selectedMaterialBean: configManager.findBean('material', name)
            }, () => {
                // update for_update material
                const forPrintBean = configManager.findBean('material', 'for_print');
                forPrintBean.jsonObj.overrides = this.state.selectedMaterialBean.jsonObj.overrides;
                configManager.saveModificationToFile('material', 'for_print');
            });
        },
        onChangeCustomConfig: (key, value) => {
            this.state.selectedMaterialBean.jsonObj.overrides[key].default_value = value;
            this.setState({
                selectedMaterialBean: this.state.selectedMaterialBean.deepCopy()
            }, () => {
                // update selectedMaterialBean to file
                configManager.saveModificationToFile('material', this.state.selectedMaterialBean.jsonObj.name);
                // update for_update material
                const forPrintBean = configManager.findBean('material', 'for_print');
                forPrintBean.jsonObj.overrides = this.state.selectedMaterialBean.jsonObj.overrides;
                configManager.saveModificationToFile('material', 'for_print');
            });
        },
        onChangeAdhesion: (option) => {
            this.state.adhesionSupportBean.jsonObj.overrides.adhesion_type.default_value = option.value;
            configManager.saveModificationToFile('adhesion_support');
            this.setState({
                adhesionSupportBean: this.state.adhesionSupportBean.deepCopy()
            });
        },
        onChangeSupport: (option) => {
            if (option.value.toLowerCase() === 'none') {
                this.state.adhesionSupportBean.jsonObj.overrides.support_enable.default_value = false;
            } else {
                this.state.adhesionSupportBean.jsonObj.overrides.support_enable.default_value = true;
                this.state.adhesionSupportBean.jsonObj.overrides.support_type.default_value = option.value;
            }
            configManager.saveModificationToFile('adhesion_support');
            this.setState({
                adhesionSupportBean: this.state.adhesionSupportBean.deepCopy()
            });
        }
    };

    componentDidMount() {
        this.subscribe();
        configManager.loadAllConfigs();
    }

    componentWillUnmount() {
        this.unsubscribe();
    }

    subscribe() {
        this.subscriptions = [
            pubsub.subscribe(ACTION_3DP_CONFIG_LOADED, (msg, data) => {
                if (data === 'material') {
                    this.actions.onChangeMaterial('PLA');
                } else if (data === 'adhesion_support') {
                    this.setState({
                        adhesionSupportBean: configManager.findBean('adhesion_support')
                    });
                }
            })
        ];
    }
    unsubscribe() {
        this.subscriptions.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        this.subscriptions = [];
    }
    render() {
        const state = this.state;
        const actions = this.actions;

        const adhesionBeanOverrides = state.adhesionSupportBean && state.adhesionSupportBean.jsonObj.overrides;

        return (
            <React.Fragment>
                <div style={{ marginTop: '3px', marginBottom: '18px' }}>
                    <Anchor
                        className={classNames(styles['material-btn'], { [styles.selected]: (state.selectedMaterialBean && state.selectedMaterialBean.jsonObj.name === 'PLA') })}
                        onClick={() => actions.onChangeMaterial('PLA')}
                    >
                        PLA
                    </Anchor>
                    <Anchor
                        className={classNames(styles['material-btn'], { [styles.selected]: (state.selectedMaterialBean && state.selectedMaterialBean.jsonObj.name === 'ABS') })}
                        onClick={() => actions.onChangeMaterial('ABS')}
                    >
                        ABS
                    </Anchor>
                    <Anchor
                        className={classNames(styles['material-btn'], { [styles.selected]: (state.selectedMaterialBean && state.selectedMaterialBean.jsonObj.name === 'CUSTOM') })}
                        onClick={() => actions.onChangeMaterial('CUSTOM')}
                    >
                        Other Materials
                    </Anchor>
                </div>
                <div className={styles.separator} />
                { state.selectedMaterialBean && state.selectedMaterialBean.jsonObj.name === 'CUSTOM' &&
                <div>
                    <table className={styles['parameter-table']}>
                        <tbody>
                            { MATERIAL_CONFIG_KEYS.map((key) => {
                                const field = state.selectedMaterialBean.jsonObj.overrides[key];
                                const label = field.label;
                                const unit = field.unit;
                                const defaultValue = field.default_value;
                                const desc = field.description;
                                return (
                                    <tr>
                                        <td style={{ width: '220px' }}>
                                            {label}
                                        </td>
                                        <td>
                                            <TipTrigger title={label} content={desc}>
                                                <Input
                                                    style={{ width: '93px' }}
                                                    value={defaultValue}
                                                    onChange={(value) => {
                                                        actions.onChangeCustomConfig(key, value);
                                                    }}
                                                />
                                                <span className={styles.unit}>{unit}</span>
                                            </TipTrigger>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                }
                { state.selectedMaterialBean && state.selectedMaterialBean.jsonObj.name === 'CUSTOM' &&
                <div className={styles.separator} style={{ marginTop: '10px', marginBottom: '10px' }} />
                }
                { state.adhesionSupportBean &&
                <div style={{ marginTop: '18px', marginBottom: '3px' }}>
                    <table className={styles['parameter-table']}>
                        <tbody>
                            <tr>
                                <td style={{ width: '100px' }}>
                                    Adhesion
                                </td>
                                <td>
                                    <TipTrigger title="Adhension" content={adhesionBeanOverrides.adhesion_type.description}>
                                        <Select
                                            backspaceRemoves={false}
                                            className="sm"
                                            clearable={false}
                                            style={{ height: '30px' }}
                                            menuContainerStyle={{ zIndex: 5 }}
                                            name="adhesion"
                                            options={[{
                                                value: 'none',
                                                label: 'None'
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
                                            placeholder="choose adhesion"
                                            searchable={false}
                                            value={adhesionBeanOverrides.adhesion_type.default_value}
                                            onChange={actions.onChangeAdhesion}
                                        />
                                    </TipTrigger>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    Support
                                </td>
                                <td>
                                    <TipTrigger title="Adhesion" content={adhesionBeanOverrides.support_enable.description}>
                                        <Select
                                            backspaceRemoves={false}
                                            className="sm"
                                            clearable={false}
                                            menuContainerStyle={{ zIndex: 5 }}
                                            name="adhesion"
                                            options={[{
                                                value: 'none',
                                                label: 'None'
                                            }, {
                                                value: 'buildplate',
                                                label: 'Touch Building Plate'
                                            }, {
                                                value: 'everywhere',
                                                label: 'Everywhere'
                                            }]}
                                            placeholder="choose support"
                                            searchable={false}
                                            value={
                                                (adhesionBeanOverrides.support_enable.default_value === true)
                                                    ? adhesionBeanOverrides.support_type.default_value
                                                    : 'none'
                                            }
                                            onChange={actions.onChangeSupport}
                                        />
                                    </TipTrigger>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                }
            </React.Fragment>
        );
    }
}

export default Material;
