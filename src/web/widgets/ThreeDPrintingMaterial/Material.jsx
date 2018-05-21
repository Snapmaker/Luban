import React, { PureComponent } from 'react';
import Select from 'react-select';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import {
    DEFAULT_MATERIAL_PLA_PARAMS,
    DEFAULT_MATERIAL_ABS_PARAMS,
    DEFAULT_MATERIAL_CUSTOM_PARAMS,
    ACTION_CHANGE_MATERIAL_3DP
} from '../../constants';
import Anchor from '../../components/Anchor';
import { InputWithValidation as Input } from '../../components/Input';
import styles from './styles.styl';


class Material extends PureComponent {
    state = {
        // TODO: read last used material settings
        material: 'PLA',
        materialParams: DEFAULT_MATERIAL_PLA_PARAMS,
        adhesion: 'none',
        support: 'none'
    };

    actions = {
        onChangeMaterial: (material) => {
            let materialParams;
            if (material === 'PLA') {
                materialParams = DEFAULT_MATERIAL_PLA_PARAMS;
            } else if (material === 'ABS') {
                materialParams = DEFAULT_MATERIAL_ABS_PARAMS;
            } else {
                materialParams = DEFAULT_MATERIAL_CUSTOM_PARAMS;
            }
            this.update({ material, materialParams });
        },
        onChangeMaterialParameter: (key) => {
            const onChange = (value) => {
                const newMaterialParams = {
                    ...this.state.materialParams,
                    [key]: value
                };
                this.update({ materialParams: newMaterialParams });
            };
            return onChange;
        },
        onChangeAdhesion: (option) => {
            this.update({ adhesion: option.value });
        },
        onChangeSupport: (option) => {
            this.update({ support: option.value });
        }
    };

    update(action, state) {
        if (state === undefined) {
            state = action;
            action = ACTION_CHANGE_MATERIAL_3DP;
        }

        this.setState(state);
        pubsub.publish(action, state);

        return true;
    }

    render() {
        const state = this.state;
        const actions = this.actions;

        return (
            <React.Fragment>
                <div style={{ marginTop: '3px', marginBottom: '18px' }}>
                    <Anchor
                        className={classNames(styles['material-btn'], { [styles.selected]: state.material === 'PLA' })}
                        onClick={() => actions.onChangeMaterial('PLA')}
                    >
                        PLA
                    </Anchor>
                    <Anchor
                        className={classNames(styles['material-btn'], { [styles.selected]: state.material === 'ABS' })}
                        onClick={() => actions.onChangeMaterial('ABS')}
                    >
                        ABS
                    </Anchor>
                    <Anchor
                        className={classNames(styles['material-btn'], { [styles.selected]: state.material === 'CUSTOM' })}
                        onClick={() => actions.onChangeMaterial('CUSTOM')}
                    >
                        Other Materials
                    </Anchor>
                </div>
                <div className={styles.separator} />
                { state.material === 'CUSTOM' &&
                <div>
                    <table className={styles['parameter-table']}>
                        <tbody>
                            <tr>
                                <td style={{ width: '220px' }}>
                                    Diameter
                                </td>
                                <td>
                                    <Input
                                        style={{ width: '93px' }}
                                        value={state.materialParams.diameter}
                                    />
                                    <span className={styles.unit}>mm</span>
                                </td>
                            </tr>
                            <tr>
                                <td style={{ width: '220px' }}>
                                    Heated Bed Temp
                                </td>
                                <td>
                                    <Input
                                        style={{ width: '93px' }}
                                        value={state.materialParams.material_bed_temperature}
                                        onChange={actions.onChangeMaterialParameter('material_bed_temperature')}
                                    />
                                    <span className={styles.unit}>°C</span>
                                </td>
                            </tr>
                            <tr>
                                <td style={{ width: '220px' }}>
                                    Heated Bed Temp Initial Layer
                                </td>
                                <td>
                                    <Input
                                        style={{ width: '93px' }}
                                        value={state.materialParams.material_bed_temperature_layer_0}
                                        onChange={actions.onChangeMaterialParameter('material_bed_temperature_layer_0')}
                                    />
                                    <span className={styles.unit}>°C</span>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    Printing Temp
                                </td>
                                <td>
                                    <Input
                                        style={{ width: '93px' }}
                                        value={state.materialParams.material_print_temperature}
                                        onChange={actions.onChangeMaterialParameter('material_print_temperature')}
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    Printing Temp Initial Layer
                                </td>
                                <td>
                                    <Input
                                        style={{ width: '93px' }}
                                        value={state.materialParams.material_print_temperature_layer_0}
                                        onChange={actions.onChangeMaterialParameter('material_print_temperature_layer_0')}
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    Final Printing Temp
                                </td>
                                <td>
                                    <Input
                                        style={{ width: '93px' }}
                                        value={state.materialParams.material_final_print_temperature}
                                        onChange={actions.onChangeMaterialParameter('material_final_print_temperature')}
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                }
                { state.material === 'CUSTOM' &&
                <div className={styles.separator} style={{ marginTop: '10px', marginBottom: '10px' }} />
                }
                <div style={{ marginTop: '18px', marginBottom: '3px' }}>
                    <table className={styles['parameter-table']}>
                        <tbody>
                            <tr>
                                <td style={{ width: '100px' }}>
                                    Adhesion
                                </td>
                                <td>
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
                                            value: 'skit',
                                            label: 'Skit'
                                        }, {
                                            value: 'brim',
                                            label: 'Brim'
                                        }, {
                                            value: 'raft',
                                            label: 'Raft'
                                        }]}
                                        placeholder="choose adhesion"
                                        searchable={false}
                                        value={state.adhesion}
                                        onChange={actions.onChangeAdhesion}
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    Support
                                </td>
                                <td>
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
                                            value: 'touch_building_plate',
                                            label: 'Touch Building Plate'
                                        }, {
                                            value: 'everywhere',
                                            label: 'Everywhere'
                                        }]}
                                        placeholder="choose adhesion"
                                        searchable={false}
                                        value={state.support}
                                        onChange={actions.onChangeSupport}
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </React.Fragment>
        );
    }
}

export default Material;
