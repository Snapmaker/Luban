import React, { PureComponent } from 'react';
import Select from 'react-select';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import {
    STAGE_IDLE,
    STAGE_IMAGE_LOADED,
    ACTION_CHANGE_STAGE_3DP,
    ACTION_REQ_GENERATE_GCODE_3DP, ACTION_CHANGE_MATERIAL_3DP
} from '../../constants';
import Anchor from '../../components/Anchor';
import OptionalDropdown from '../../components/OptionalDropdown';
import { InputWithValidation as Input } from '../../components/Input';
import styles from './styles.styl';
import Print3dConfigManager from './Print3dConfigManager';

const OFFICIAL_CONFIG_KEYS = [
    'layer_height',
    'top_thickness',
    'infill_sparse_density',
    'speed_print',
    'speed_infill',
    'speed_wall_0',
    'speed_wall_x',
    'speed_travel'
];

//config type: official ('fast print', 'normal quality', 'high quality'); custom: ...
//do all things by 'config name'
class Configurations extends PureComponent {
    configManager = new Print3dConfigManager();
    state = {
        //control UI
        stage: STAGE_IDLE,
        isOfficialConfigSelected: true,

        //official config
        selectedOfficialConfigName: undefined,
        showOfficialConfigDetails: true,

        //rename custom config
        newName: undefined,
        isRenaming: false,

        //custom config
        selectedCustomConfigName: undefined,
        customConfigOptions: undefined,
        customConfigGroup: [
            {
                name: 'Quality',
                expanded: false,
                fields: [
                    'layer_height',
                    'layer_height_0',
                    'initial_layer_line_width_factor'
                ]
            },
            {
                name: 'Shell',
                expanded: false,
                fields: [
                    'wall_thickness',
                    'top_thickness',
                    'bottom_thickness'
                ]
            },
            {
                name: 'Infill',
                expanded: false,
                fields: [
                    'infill_sparse_density'
                ]
            },
            {
                name: 'Speed',
                expanded: false,
                fields: [
                    'speed_print',
                    'speed_print_layer_0',
                    'speed_infill',
                    'speed_wall_0',
                    'speed_wall_x',
                    'speed_topbottom',
                    'speed_travel',
                    'speed_travel_layer_0'
                ]
            },
            {
                name: 'Travel',
                expanded: false,
                fields: [
                    'retraction_hop_enabled',
                    'retraction_hop'
                ]
            }
        ]
    };

    actions = {
        onChangeCustomConfigName: (event) => {
            this.setState({
                newName: event.target.value
            });
        },
        onRenameCustomConfigStart: () => {
            if (!this.state.isRenaming) {
                this.setState({
                    isRenaming: true,
                    newName: this.state.selectedCustomConfigName
                });
            }
        },
        onRenameCustomConfigEnd: () => {
            //1.check renameStr: not empty, not same as old, not same as existed
            let newName = this.state.newName;
            let oldName = this.state.selectedCustomConfigName;
            if (newName === null || newName === undefined || newName.trim().length === 0) {
                //TODO: alert(new name can not be empty)
                console.log('rename failed: new name can not be empty');
                return;
            }
            if (newName === oldName) {
                //TODO: alert(new name can not be same as old name)
                console.log('rename failed: new name can not be same as old name');
                return;
            }
            for (let existedName of this.configManager.getCustomBeanNames()) {
                if (existedName.toLowerCase() === newName.toLowerCase()) {
                    //TODO: alert(new name existed)
                    console.log('rename failed: new name can not be same as existed names');
                    return;
                }
            }
            //2.do rename
            this.configManager.rename(oldName, newName.trim(), (err) => {
                if (err) {
                    console.log('rename failed:' + err);
                } else {
                    //TODO: alert(rename succeed)
                    console.log('rename succeed');
                    //3.update state
                    const customBeanNames = this.configManager.getCustomBeanNames();
                    const customConfigOptions = customBeanNames.map((name) => ({
                        label: name,
                        value: name
                    }));
                    this.setState({
                        selectedCustomConfigName: newName,
                        customConfigOptions: customConfigOptions,
                        isRenaming: false,
                        newName: undefined
                    });
                }
            });
        },
        onDuplicateCustomConfig: () => {
            let beanName = this.state.selectedCustomConfigName;
            this.configManager.duplicate(beanName, (err, newName) => {
                if (err) {
                    console.log('Duplicate failed:' + err);
                } else {
                    console.log('Duplicate succeed');
                    //update state
                    const customBeanNames = this.configManager.getCustomBeanNames();
                    const customConfigOptions = customBeanNames.map((name) => ({
                        label: name,
                        value: name
                    }));
                    this.setState({
                        selectedCustomConfigName: newName,
                        customConfigOptions: customConfigOptions
                    });
                }
            });
        },
        onRemoveCustomConfig: () => {
            //TODO: show conform dialog
            //must be at least 1 custom config
            if (this.configManager.getCustomBeanNames().length <= 1) {
                //TODO: alert(must be at least 1 custom config)
                console.log('Remove failed: must be at least 1 custom config');
                return;
            }
            let beanName = this.state.selectedCustomConfigName;
            this.configManager.remove(beanName, (err) => {
                if (err) {
                    console.log('Remove failed:' + err);
                } else {
                    console.log('Remove succeed');
                    //update state
                    const customBeanNames = this.configManager.getCustomBeanNames();
                    const selectedCustomConfigName = (customBeanNames.length > 0) ? customBeanNames[0] : '';
                    const customConfigOptions = customBeanNames.map((name) => ({
                        label: name,
                        value: name
                    }));
                    this.setState({
                        selectedCustomConfigName: selectedCustomConfigName,
                        customConfigOptions: customConfigOptions
                    });
                }
            });
        },
        onChangeCustomConfig: (key, value) => {
            // console.log('onChangeConfig: key:' + key + ' value:' + value);
            const selectedCustomConfigBean = this.configManager.findBeanByName(this.state.selectedCustomConfigName);
            selectedCustomConfigBean.jsonObj.overrides[key].default_value = value;
            this.forceUpdate();
            this.configManager.saveModificationToFile(this.state.selectedCustomConfigName, (err) => {
                if (err) {
                    console.log('saveModificationToFile failed:' + err);
                } else {
                    console.log('saveModificationToFile succeed');
                }
            });
        },
        onClickGenerateGcode: () => {
            //prepare config file and then publish msg
            let configNameForPrint = null;
            if (this.state.isOfficialConfigSelected) {
                configNameForPrint = this.state.selectedOfficialConfigName;
            } else {
                configNameForPrint = this.state.selectedCustomConfigName;
            }
            if (configNameForPrint) {
                this.configManager.saveForPrint(configNameForPrint, (err, filePath) => {
                    if (err && err.message) {
                        console.log(err.message);
                    } else {
                        console.log('saveForPrint succeed');
                        //request generate G-code directly
                        //Visualizer receive
                        pubsub.publish(ACTION_REQ_GENERATE_GCODE_3DP, filePath);
                    }
                });
            }
        }
    };

    subscriptions = [];

    componentDidMount() {
        this.subscriptions = [
            pubsub.subscribe(ACTION_CHANGE_STAGE_3DP, (msg, state) => {
                this.setState(state);
            }),
            pubsub.subscribe(ACTION_CHANGE_MATERIAL_3DP, (msg, state) => {
                if (state.adhesion) {
                    switch (state.adhesion.toLowerCase()) {
                    case 'skirt':
                        console.log('Adhesion skirt');
                        this.configManager.setAdhesion_skirt();
                        break;
                    case 'brim':
                        console.log('Adhesion brim');
                        this.configManager.setAdhesion_brim();
                        break;
                    case 'raft':
                        console.log('Adhesion raft');
                        this.configManager.setAdhesion_raft();
                        break;
                    case 'none':
                        console.log('Adhesion none');
                        this.configManager.setAdhesion_none();
                        break;
                    default:
                        break;
                    }
                } else if (state.support) {
                    switch (state.support.toLowerCase()) {
                    case 'buildplate':
                        console.log('Support buildplate');
                        this.configManager.setSupport_buildplate();
                        break;
                    case 'everywhere':
                        console.log('Support everywhere');
                        this.configManager.setSupport_everywhere();
                        break;
                    case 'none':
                        console.log('Support none');
                        this.configManager.setSupport_none();
                        break;
                    default:
                        break;
                    }
                } else if (state.material) {
                    switch (state.material.toUpperCase()) {
                    case 'PLA':
                        console.log('PLA');
                        this.configManager.setMaterial_PLA();
                        break;
                    case 'ABS':
                        console.log('ABS');
                        this.configManager.setMaterial_ABS();
                        break;
                    case 'CUSTOM':
                        console.log('CUSTOM is not implemented yet');//todo
                        break;
                    default:
                        break;
                    }
                }
                // console.log(msg, state);
                this.setState(state);
            })
        ];
        this.loadConfig();
    }

    componentWillUnmount() {
        this.subscriptions.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        this.subscriptions = [];
    }

    render() {
        const state = this.state;
        const actions = this.actions;
        const disabled = state.stage < STAGE_IMAGE_LOADED;

        const selectedOfficialConfigBean = this.configManager.findBeanByName(state.selectedOfficialConfigName);
        const selectedCustomConfigBean = this.configManager.findBeanByName(state.selectedCustomConfigName);
        return (
            <div>
                <div className={styles.tabs} style={{ marginTop: '6px', marginBottom: '12px' }}>
                    <button
                        type="button"
                        style={{ width: '50%' }}
                        className={classNames(
                            styles.tab,
                            {
                                [styles.selected]: state.isOfficialConfigSelected
                            }
                        )}
                        onClick={() => {
                            this.setState({
                                isOfficialConfigSelected: true
                            });
                        }}
                    >
                        Recommended
                    </button>
                    <button
                        type="button"
                        style={{ width: '50%' }}
                        className={classNames(
                            styles.tab,
                            {
                                [styles.selected]: !state.isOfficialConfigSelected
                            }
                        )}
                        onClick={() => {
                            this.setState({
                                isOfficialConfigSelected: false
                            });
                        }}
                    >
                        Customize
                    </button>
                </div>
                { state.isOfficialConfigSelected &&
                <div className={styles.tabs} style={{ marginTop: '18px' }}>
                    <button
                        type="button"
                        style={{ width: '33.333333%' }}
                        className={classNames(
                            styles.tab,
                            styles['tab-large'],
                            {
                                [styles.selected]: state.selectedOfficialConfigName === 'fast print'
                            }
                        )}
                        onClick={() => {
                            this.setState({
                                selectedOfficialConfigName: 'fast print'
                            });
                        }}
                    >
                        Fast Print
                    </button>
                    <button
                        type="button"
                        style={{ width: '33.333333%' }}
                        className={classNames(
                            styles.tab,
                            styles['tab-large'],
                            {
                                [styles.selected]: state.selectedOfficialConfigName === 'normal quality'
                            }
                        )}
                        onClick={() => {
                            this.setState({
                                selectedOfficialConfigName: 'normal quality'
                            });
                        }}
                    >
                        Normal Quality
                    </button>
                    <button
                        type="button"
                        style={{ width: '33.333333%' }}
                        className={classNames(
                            styles.tab,
                            styles['tab-large'],
                            {
                                [styles.selected]: state.selectedOfficialConfigName === 'high quality'
                            }
                        )}
                        onClick={() => {
                            this.setState({
                                selectedOfficialConfigName: 'high quality'
                            });
                        }}
                    >
                        High Quality
                    </button>
                </div>
                }
                { state.isOfficialConfigSelected &&
                <div style={{ marginTop: '10px' }}>
                    <OptionalDropdown
                        title="Show Details"
                        titleWidth="105px"
                        hidden={!state.showOfficialConfigDetails}
                        onClick={() => {
                            this.setState({ showOfficialConfigDetails: !state.showOfficialConfigDetails });
                        }}
                    >
                        { state.showOfficialConfigDetails && selectedOfficialConfigBean &&
                        <table className={styles['config-details-table']}>
                            <tbody>
                                {OFFICIAL_CONFIG_KEYS.map((key) => {
                                    const label = selectedOfficialConfigBean.jsonObj.overrides[key].label;
                                    const unit = selectedOfficialConfigBean.jsonObj.overrides[key].unit;
                                    const defaultValue = selectedOfficialConfigBean.jsonObj.overrides[key].default_value;
                                    return (
                                        <tr key={key}>
                                            <td>{label}</td>
                                            <td>{defaultValue}{unit}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        }
                    </OptionalDropdown>
                </div>
                }
                { !state.isOfficialConfigSelected && selectedCustomConfigBean &&
                <div style={{ marginBottom: '18px' }}>
                    <div>
                        <span style={{
                            float: 'left',
                            width: '100px',
                            lineHeight: '34px',
                            marginRight: '15px'
                        }}
                        >
                            Profile
                        </span>
                        <Select
                            style={{ width: '206px' }}
                            backspaceRemoves={false}
                            className="sm"
                            clearable={false}
                            menuContainerStyle={{ zIndex: 5 }}
                            name="profile"
                            options={state.customConfigOptions}
                            placeholder=""
                            value={state.selectedCustomConfigName}
                            onChange={(option) => {
                                this.setState({
                                    selectedCustomConfigName: option.value,
                                    isRenaming: false,
                                    newName: undefined
                                });
                            }}
                        />
                    </div>
                    <div style={{ marginTop: '10px' }}>
                        { !state.isRenaming &&
                        <span>{state.selectedCustomConfigName}</span>
                        }
                        { state.isRenaming &&
                            <React.Fragment>
                                <input
                                    value={state.isRenaming ? state.newName : state.selectedCustomConfigName}
                                    onChange={actions.onChangeCustomConfigName}
                                />
                                <Anchor
                                    className={classNames('fa', 'fa-check', styles['fa-btn'])}
                                    onClick={actions.onRenameCustomConfigEnd}
                                />
                            </React.Fragment>
                        }
                        <div
                            style={{
                                display: 'inline-block',
                                float: 'right'
                            }}
                        >
                            <Anchor
                                className={classNames('fa', 'fa-edit', styles['fa-btn'])}
                                onClick={actions.onRenameCustomConfigStart}
                            />
                            <Anchor
                                className={classNames('fa', 'fa-copy', styles['fa-btn'])}
                                onClick={actions.onDuplicateCustomConfig}
                            />
                            <Anchor
                                className={classNames('fa', 'fa-trash-o', styles['fa-btn'])}
                                onClick={actions.onRemoveCustomConfig}
                            />
                        </div>
                    </div>
                    <div className={classNames(styles.separator, styles['separator-underline'])} />
                    { this.state.customConfigGroup.map((group) => {
                        return (
                            <div className={styles['config-group']} key={group.name}>
                                <Anchor
                                    className={styles['group-header']}
                                    onClick={() => {
                                        group.expanded = !group.expanded;
                                        this.forceUpdate();
                                    }}
                                >
                                    <span className={styles['group-title']}>{group.name}</span>
                                    <span className={classNames(
                                        'fa',
                                        group.expanded ? 'fa-angle-down' : 'fa-angle-left',
                                        styles['group-indicator']
                                    )}
                                    />
                                </Anchor>
                                <div
                                    className={classNames(styles['group-content'], {
                                        [styles.expanded]: group.expanded
                                    })}
                                >
                                    { group.fields.map((key) => {
                                        const label = selectedCustomConfigBean.jsonObj.overrides[key].label;
                                        const unit = selectedCustomConfigBean.jsonObj.overrides[key].unit;
                                        const defaultValue = selectedCustomConfigBean.jsonObj.overrides[key].default_value;
                                        const type = selectedCustomConfigBean.jsonObj.overrides[key].type;
                                        return (
                                            <div className={styles['field-row']} key={key}>
                                                <span className={styles.field}>{label}</span>
                                                { type !== 'bool' &&
                                                <React.Fragment>
                                                    <Input
                                                        validClassName={styles.input}
                                                        value={defaultValue}
                                                        min={0}
                                                        max={1000}
                                                        onChange={(value) => {
                                                            return actions.onChangeCustomConfig(key, value);
                                                        }}
                                                    />
                                                    <span className={styles.unit}>{unit}</span>
                                                </React.Fragment>
                                                }
                                                { type === 'bool' &&
                                                <input
                                                    className={styles.checkbox}
                                                    type="checkbox"
                                                    checked={defaultValue}
                                                    onChange={(event) => actions.onChangeCustomConfig(key, event.target.checked)}
                                                />
                                                }
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                    <div className={styles.separator} />
                </div>
                }
                <button
                    type="button"
                    className={classNames(styles.btn, styles['btn-large-green'])}
                    onClick={actions.onClickGenerateGcode}
                    disabled={disabled}
                    style={{ display: 'block', width: '100%', marginTop: '8px' }}
                >
                    Generate G-code
                </button>
            </div>
        );
    }
    //config
    loadConfig = () => {
        this.configManager.loadConfigs((err, beanArr) => {
            if (err) {
                console.log('loadConfig err' + JSON.stringify(err));
            } else {
                console.log('loadConfig succeed');
                //set default: Adhesion=none, Support=none, material=PLA
                this.configManager.setAdhesion_none();
                this.configManager.setSupport_none();
                this.configManager.setMaterial_PLA();

                //init state
                const selectedOfficialConfigName = 'fast print';
                const customBeanNames = this.configManager.getCustomBeanNames();
                const customConfigOptions = customBeanNames.map((name) => ({
                    label: name,
                    value: name
                }));
                const selectedCustomConfigName = (customBeanNames.length > 0) ? customBeanNames[0] : '';
                this.setState({
                    selectedOfficialConfigName: selectedOfficialConfigName,
                    selectedCustomConfigName: selectedCustomConfigName,
                    customConfigOptions: customConfigOptions
                });
                console.log('selectedOfficialConfigName:' + JSON.stringify(this.state.selectedOfficialConfigName));
                console.log('selectedCustomConfigName:' + JSON.stringify(this.state.selectedCustomConfigName));
                console.log('customConfigOptions:' + JSON.stringify(this.state.customConfigOptions));
            }
        });
    }
}

export default Configurations;
