import React, { PureComponent } from 'react';
import Select from 'react-select';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import update from 'immutability-helper';
import {
    STAGE_IDLE,
    STAGE_IMAGE_LOADED,
    ACTION_CHANGE_STAGE_3DP,
    ACTION_CHANGE_CONFIG_3DP,
    ACTION_REQ_GENERATE_GCODE_3DP, ACTION_CHANGE_MATERIAL_3DP
} from '../../constants';
import Anchor from '../../components/Anchor';
import OptionalDropdown from '../../components/OptionalDropdown';
import { InputWithValidation as Input } from '../../components/Input';
import styles from './styles.styl';
import Print3dConfigManager from './Print3dConfigManager';

const PRINTING_CONFIG_TYPE_FAST_PRINT = 'FAST_PRINT';
const PRINTING_CONFIG_TYPE_NORMAL_QUALITY = 'NORMAL_QUALITY';
const PRINTING_CONFIG_TYPE_HIGH_QUALITY = 'HIGH_QUALITY';
const PRINTING_CONFIG_TYPE_CUSTOM = 'CUSTOM';

// TODO: use data from JSON file?
const PRINTING_CONFIG_FAST_PRINT = {
    // quality
    layer_height: { value: 0.15, unit: 'mm' },
    layer_height_0: { value: 0.1, unit: 'mm' },
    initial_layer_line_width_factor: { value: 100, unit: '%' }, // 100%

    // shell
    wall_thickness: { value: 0.8, unit: 'mm' },
    top_thickness: { value: 0.8, unit: 'mm' },
    bottom_thickness: { value: 0.8, unit: 'mm' },

    // infill
    infill_sparse_density: { value: 8, unit: '%' }, // 8%

    // speed
    speed_print: { value: 35, unit: 'mm/s' },
    speed_print_layer_0: { value: 35, unit: 'mm/s' },
    speed_infill: { value: 35, unit: 'mm/s' },
    speed_wall_0: { value: 35, unit: 'mm/s' },
    speed_wall_x: { value: 35, unit: 'mm/s' },
    speed_topbottom: { value: 35, unit: 'mm/s' },
    speed_travel: { value: 35, unit: 'mm/s' },
    speed_travel_layer_0: { value: 35, unit: 'mm/s' },

    retraction_hop_enabled: { value: false, unit: 'boolean' },
    retraction_hop: { value: 0, unit: 'mm' },

    _: '' // placeholder
};

const PRINTING_CONFIG_NORMAL_QUALITY = {
    // quality
    layer_height: { value: 0.15, unit: 'mm' },
    layer_height_0: { value: 0.1, unit: 'mm' },
    initial_layer_line_width_factor: { value: 100, unit: '%' }, // 100%

    // shell
    wall_thickness: { value: 0.8, unit: 'mm' },
    top_thickness: { value: 1, unit: 'mm' },
    bottom_thickness: { value: 1, unit: 'mm' },

    // infill
    infill_sparse_density: { value: 15, unit: '%' }, // 8%

    // speed
    speed_print: { value: 35, unit: 'mm/s' },
    speed_print_layer_0: { value: 35, unit: 'mm/s' },
    speed_infill: { value: 35, unit: 'mm/s' },
    speed_wall_0: { value: 35, unit: 'mm/s' },
    speed_wall_x: { value: 35, unit: 'mm/s' },
    speed_topbottom: { value: 35, unit: 'mm/s' },
    speed_travel: { value: 35, unit: 'mm/s' },
    speed_travel_layer_0: { value: 35, unit: 'mm/s' },

    retraction_hop_enabled: { value: false, unit: 'boolean' },
    retraction_hop: { value: 0, unit: 'mm' },

    _: '' // placeholder
};

const field2Copy = {
    // quality
    layer_height: 'Layer Height',
    layer_height_0: 'Initial Layer Height',
    initial_layer_line_width_factor: 'Initial Layer Line Width',

    // Shell
    wall_thickness: 'Wall Thickness',
    top_thickness: 'Top Thickness',
    bottom_thickness: 'Bottom Thickness',

    // Infill
    infill_sparse_density: 'Infill',

    // Speed
    speed_print: 'Print Speed',
    speed_print_layer_0: 'Initial Layer Print Speed',
    speed_infill: 'Infill Speed',
    speed_wall_0: 'Outer Wall Speed',
    speed_wall_x: 'Inner Wall Speed',
    speed_topbottom: 'Top / Bottom Speed',
    speed_travel: 'Travel Speed',
    speed_travel_layer_0: 'Initial Layer Travel Speed',

    // travel
    retraction_hop_enabled: 'Z Hop During Retraction',
    retraction_hop: 'Z Hop Height'
};
// detail field to be shown
// const standardDetailFields = [
//     'layer_height',
//     'top_thickness',
//     'infill_sparse_density',
//     'speed_print',
//     'speed_infill',
//     'speed_wall_0',
//     'speed_wall_x',
//     'speed_travel'
// ];

class Configurations extends PureComponent {
    configManager = new Print3dConfigManager();
    state = {
        //config bean
        curConBean: undefined,

        stage: STAGE_IDLE,
        configType: PRINTING_CONFIG_TYPE_FAST_PRINT,
        config: PRINTING_CONFIG_FAST_PRINT,
        // standard config type
        showConfigDetails: true,
        // custom config type
        profiles: ['Fast Print', 'Normal Quality'], // FIXME: read user profiles
        selectedProfile: 'Fast Print',
        editingProfileName: false,
        configGroups: [
            'configGroupQuality',
            'configGroupShell',
            'configGroupInfill',
            'configGroupSpeed',
            'configGroupTravel'
        ],
        configGroupQuality: {
            name: 'Quality',
            expanded: false,
            fields: [
                'layer_height',
                'layer_height_0',
                'initial_layer_line_width_factor'
            ]
        },
        configGroupShell: {
            name: 'Shell',
            expanded: false,
            fields: [
                'wall_thickness',
                'top_thickness',
                'bottom_thickness'
            ]
        },
        configGroupInfill: {
            name: 'Infill',
            expanded: false,
            fields: [
                'infill_sparse_density'
            ]
        },
        configGroupSpeed: {
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
        configGroupTravel: {
            name: 'Travel',
            expanded: false,
            fields: [
                'retraction_hop_enabled',
                'retraction_hop'
            ]
        }
    };

    actions = {
        onChangeConfigTypeFastPrint: () => {
            this.setState({
                curConBean: this.configManager.findBeanByName('fast print'),
                configType: PRINTING_CONFIG_TYPE_FAST_PRINT,
                config: PRINTING_CONFIG_FAST_PRINT
            });
        },
        onChangeConfigTypeNormalQuality: () => {
            this.setState({
                curConBean: this.configManager.findBeanByName('normal quality'),
                configType: PRINTING_CONFIG_TYPE_NORMAL_QUALITY,
                config: PRINTING_CONFIG_NORMAL_QUALITY
            });
        },
        onChangeConfigTypeHighQuality: () => {
            this.setState({
                curConBean: this.configManager.findBeanByName('high quality'),
                configType: PRINTING_CONFIG_TYPE_HIGH_QUALITY,
                config: PRINTING_CONFIG_NORMAL_QUALITY // FIXME
            });
        },
        onChangeConfigTypeCustom: () => {
            this.setState({
                configType: PRINTING_CONFIG_TYPE_CUSTOM,
                config: PRINTING_CONFIG_NORMAL_QUALITY // FIXME
            });
        },
        onChangeProfile: (option) => {
            const profile = option.value;
            // FIXME: use specific profile config
            let config;
            if (profile === 'Fast Print') {
                config = PRINTING_CONFIG_FAST_PRINT;
            } else {
                config = PRINTING_CONFIG_NORMAL_QUALITY;
            }
            this.setState({
                selectedProfile: profile,
                config: config
            });
        },
        onChangeProfileName: (event) => {
            const index = this.state.profiles.indexOf(this.state.selectedProfile);
            const profiles = update(this.state.profiles, {
                $splice: [[index, 1, event.target.value]]
            });
            const profileOptions = profiles.map((profile) => ({
                label: profile,
                value: profile
            }));
            this.setState({
                profiles,
                profileOptions,
                selectedProfile: event.target.value
            });
        },
        onEditProfile: () => {
            this.setState({ editingProfileName: true });
        },
        onEditProfileDone: () => {
            this.setState({ editingProfileName: false });
        },
        onDuplicateProfile: () => {
            const profileName = 'New Profile';
            const profiles = update(this.state.profiles, {
                $push: [profileName]
            });
            const profileOptions = profiles.map((profile) => ({
                label: profile,
                value: profile
            }));
            this.setState({
                profiles,
                profileOptions,
                selectedProfile: profileName
            });
        },
        onRemoveProfile: () => {
            // remove profile
            console.error(`remove profile ${this.state.selectedProfile}`);
        },
        onChangeConfig: (field, value) => {
            const newConfig = update(this.state.config, {
                [field]: {
                    $merge: { value: value }
                }
            });
            this.setState({ config: newConfig });
            pubsub.publish(ACTION_CHANGE_CONFIG_3DP, { config: newConfig });
            if (this.state.configType === PRINTING_CONFIG_TYPE_CUSTOM) {
                // save changes on `selectedProfile`
            }
            return true;
        },
        onClickGenerateGcode: () => {
            //prepare config file and then publish msg
            if (this.state.curConBean) {
                this.configManager.saveForPrint(this.state.curConBean.jsonObj.name, (err, filePath) => {
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

    constructor(props) {
        super(props);

        // Calculate properties before mount
        this.state.profileOptions = this.state.profiles.map((profile) => ({
            label: profile,
            value: profile
        }));
    }

    componentDidMount() {
        this.subscriptions = [
            pubsub.subscribe(ACTION_CHANGE_STAGE_3DP, (msg, state) => {
                this.setState(state);
            }),
            pubsub.subscribe(ACTION_CHANGE_MATERIAL_3DP, (msg, state) => {
                if (state.adhesion) {
                    switch (state.adhesion.toLowerCase()) {
                    case 'skit':
                        this.configManager.setAdhesion_skirt();//FIXME should be 'skirt'
                        break;
                    case 'brim':
                        this.configManager.setAdhesion_brim();
                        break;
                    case 'raft':
                        this.configManager.setAdhesion_raft();
                        break;
                    case 'none':
                        this.configManager.setAdhesion_none();
                        break;
                    default:
                        break;
                    }
                } else if (state.support) {
                    switch (state.support.toLowerCase()) {
                    case 'touch_building_plate'://FIXME should be 'buildplate'
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

        return (
            <div>
                <div className={styles.tabs} style={{ marginTop: '6px', marginBottom: '12px' }}>
                    <button
                        type="button"
                        style={{ width: '50%' }}
                        className={classNames(
                            styles.tab,
                            {
                                [styles.selected]: state.configType !== PRINTING_CONFIG_TYPE_CUSTOM
                            }
                        )}
                        onClick={actions.onChangeConfigTypeFastPrint}
                    >
                        Recommended
                    </button>
                    <button
                        type="button"
                        style={{ width: '50%' }}
                        className={classNames(
                            styles.tab,
                            {
                                [styles.selected]: state.configType === PRINTING_CONFIG_TYPE_CUSTOM
                            }
                        )}
                        onClick={actions.onChangeConfigTypeCustom}
                    >
                        Customize
                    </button>
                </div>
                { state.configType !== PRINTING_CONFIG_TYPE_CUSTOM &&
                <div className={styles.tabs} style={{ marginTop: '18px' }}>
                    <button
                        type="button"
                        style={{ width: '33.333333%' }}
                        className={classNames(
                            styles.tab,
                            styles['tab-large'],
                            {
                                [styles.selected]: state.configType === PRINTING_CONFIG_TYPE_FAST_PRINT
                            }
                        )}
                        onClick={actions.onChangeConfigTypeFastPrint}
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
                                [styles.selected]: state.configType === PRINTING_CONFIG_TYPE_NORMAL_QUALITY
                            }
                        )}
                        onClick={actions.onChangeConfigTypeNormalQuality}
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
                                [styles.selected]: state.configType === PRINTING_CONFIG_TYPE_HIGH_QUALITY
                            }
                        )}
                        onClick={actions.onChangeConfigTypeHighQuality}
                    >
                        High Quality
                    </button>
                </div>
                }
                { state.configType !== PRINTING_CONFIG_TYPE_CUSTOM &&
                <div style={{ marginTop: '10px' }}>
                    <OptionalDropdown
                        title="Show Details"
                        titleWidth="105px"
                        hidden={state.showConfigDetails}
                        onClick={() => {
                            this.setState({ showConfigDetails: !state.showConfigDetails });
                        }}
                    >
                        { state.curConBean &&
                        <table className={styles['config-details-table']}>
                            <tbody>
                                <tr>
                                    <td>Layer Height</td>
                                    <td>{state.curConBean.jsonObj.overrides.layer_height.default_value + 'mm'}</td>
                                </tr>
                                <tr>
                                    <td>Top Thickness</td>
                                    <td>{state.curConBean.jsonObj.overrides.top_thickness.default_value + 'mm'}</td>
                                </tr>
                                <tr>
                                    <td>Infill</td>
                                    <td>{state.curConBean.jsonObj.overrides.infill_sparse_density.default_value + '%'}</td>
                                </tr>
                                <tr>
                                    <td>Print Speed</td>
                                    <td>{state.curConBean.jsonObj.overrides.speed_print.default_value + 'mm/s'}</td>
                                </tr>
                                <tr>
                                    <td>Infill Speed</td>
                                    <td>{state.curConBean.jsonObj.overrides.speed_infill.default_value + 'mm/s'}</td>
                                </tr>
                                <tr>
                                    <td>Outer Wall Speed</td>
                                    <td>{state.curConBean.jsonObj.overrides.speed_wall_x.default_value + 'mm/s'}</td>
                                </tr>
                                <tr>
                                    <td>Inner Wall Speed</td>
                                    <td>{state.curConBean.jsonObj.overrides.speed_wall_0.default_value + 'mm/s'}</td>
                                </tr>
                                <tr>
                                    <td>Travel Speed</td>
                                    <td>{state.curConBean.jsonObj.overrides.speed_travel.default_value + 'mm/s'}</td>
                                </tr>
                            </tbody>
                        </table>
                        }
                    </OptionalDropdown>
                </div>
                }
                { state.configType === PRINTING_CONFIG_TYPE_CUSTOM &&
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
                            options={state.profileOptions}
                            placeholder=""
                            value={state.selectedProfile}
                            onChange={actions.onChangeProfile}
                        />
                    </div>
                    <div style={{ marginTop: '10px' }}>
                        { !state.editingProfileName &&
                        <span>{state.selectedProfile}</span>
                        }
                        { state.editingProfileName &&
                            <React.Fragment>
                                <input
                                    value={state.selectedProfile}
                                    onChange={actions.onChangeProfileName}
                                />
                                <Anchor
                                    className={classNames('fa', 'fa-check', styles['fa-btn'])}
                                    onClick={actions.onEditProfileDone}
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
                                onClick={actions.onEditProfile}
                            />
                            <Anchor
                                className={classNames('fa', 'fa-copy', styles['fa-btn'])}
                                onClick={actions.onDuplicateProfile}
                            />
                            <Anchor
                                className={classNames('fa', 'fa-trash-o', styles['fa-btn'])}
                                onClick={actions.onRemoveProfile}
                            />
                        </div>
                    </div>
                    <div className={classNames(styles.separator, styles['separator-underline'])} />
                    { state.configGroups.map((groupKey) => {
                        const group = state[groupKey];
                        return (
                            <div className={styles['config-group']} key={groupKey}>
                                <Anchor
                                    className={styles['group-header']}
                                    onClick={() => {
                                        this.setState(() => {
                                            const expanded = !group.expanded;
                                            return {
                                                [groupKey]: update(group, {
                                                    $merge: { expanded }
                                                })
                                            };
                                        });
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
                                    { group.fields.map((field) => {
                                        const fieldData = state.config[field];
                                        return (
                                            <div className={styles['field-row']} key={field}>
                                                <span className={styles.field}>{field2Copy[field]}</span>
                                                { fieldData.unit !== 'boolean' &&
                                                <React.Fragment>
                                                    <Input
                                                        validClassName={styles.input}
                                                        value={fieldData.value}
                                                        min={0}
                                                        max={1000}
                                                        onChange={(value) => {
                                                            return actions.onChangeConfig(field, value);
                                                        }}
                                                    />
                                                    <span className={styles.unit}>{fieldData.unit}</span>
                                                </React.Fragment>
                                                }
                                                { fieldData.unit === 'boolean' &&
                                                <input
                                                    className={styles.checkbox}
                                                    type="checkbox"
                                                    checked={fieldData.value}
                                                    onChange={(event) => actions.onChangeConfig(field, event.target.checked)}
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
                this.actions.onChangeConfigTypeFastPrint();
                //set default: Adhesion=none, Support=none, material=PLA
                this.configManager.setAdhesion_none();
                this.configManager.setSupport_none();
                this.configManager.setMaterial_PLA();
            }
        });
    }
}

export default Configurations;
