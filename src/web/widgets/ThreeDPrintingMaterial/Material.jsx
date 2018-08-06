import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import {
    ACTION_3DP_CONFIG_LOADED
} from '../../constants';
import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import styles from './styles.styl';
import configManager from '../Print3dConfigManager';


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
                <div style={{ marginBottom: '18px' }}>
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
                        {i18n._('Custom Material')}
                    </Anchor>
                </div>
                <div className={styles.separator} />
                {state.selectedMaterialBean &&
                <table className={styles['parameter-table']}>
                    <tbody>
                        {MATERIAL_CONFIG_KEYS.map((key) => {
                            const field = state.selectedMaterialBean.jsonObj.overrides[key];
                            const label = field.label;
                            const unit = field.unit;
                            const defaultValue = field.default_value;
                            const type = field.type;
                            const desc = field.description;

                            const enableStr = field.enabled;
                            let isDisplayed = true;
                            if (enableStr) {
                                // for example: retraction_hop.enable = retraction_enable and retraction_hop_enabled
                                const arr = enableStr.split('and');
                                for (let enableKey of arr) {
                                    if (state.selectedMaterialBean.jsonObj.overrides[enableKey.trim()]) {
                                        isDisplayed = isDisplayed && state.selectedMaterialBean.jsonObj.overrides[enableKey.trim()].default_value;
                                    }
                                }
                            }
                            // changes on diameter is not allowed
                            const disabled = ((state.selectedMaterialBean.jsonObj.name !== 'CUSTOM') || key === 'material_diameter');

                            return (
                                <tr key={key} style={{ display: isDisplayed ? 'block' : 'none' }}>
                                    <td style={{ width: '220px' }}>
                                        {i18n._(label)}
                                    </td>
                                    <td>
                                        <TipTrigger title={i18n._(label)} content={i18n._(desc)}>
                                            {type === 'float' &&
                                            <Input
                                                style={{ width: '93px' }}
                                                value={defaultValue}
                                                onChange={value => {
                                                    actions.onChangeCustomConfig(key, value);
                                                }}
                                                disabled={disabled}
                                            />
                                            }
                                            { type === 'bool' &&
                                            <input
                                                className={styles.checkbox}
                                                type="checkbox"
                                                checked={defaultValue}
                                                disabled={disabled}
                                                onChange={(event) => actions.onChangeCustomConfig(key, event.target.checked)}
                                            />
                                            }
                                            <span className={styles.unit}>{unit}</span>
                                        </TipTrigger>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                }
                <div className={styles.separator} style={{ marginTop: '10px', marginBottom: '10px' }} />
                { state.adhesionSupportBean &&
                <div style={{ marginTop: '18px', marginBottom: '3px' }}>
                    <table className={styles['parameter-table']}>
                        <tbody>
                            <tr>
                                <td style={{ width: '100px' }}>
                                    {i18n._('Adhesion')}
                                </td>
                                <td>
                                    <TipTrigger
                                        title={i18n._('Adhesion')}
                                        content={i18n._(adhesionBeanOverrides.adhesion_type.description)}
                                    >
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
                                            value={i18n._(adhesionBeanOverrides.adhesion_type.default_value)}
                                            onChange={actions.onChangeAdhesion}
                                        />
                                    </TipTrigger>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    {i18n._('Support')}
                                </td>
                                <td>
                                    <TipTrigger
                                        title={i18n._('Support')}
                                        content={i18n._(adhesionBeanOverrides.support_enable.description)}
                                    >
                                        <Select
                                            backspaceRemoves={false}
                                            className="sm"
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
