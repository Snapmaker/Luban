import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import {
    STAGE_IDLE,
    STAGE_IMAGE_LOADED,
    ACTION_CHANGE_STAGE_3DP,
    ACTION_REQ_GENERATE_GCODE_3DP,
    ACTION_3DP_CONFIG_LOADED
} from '../../constants';
import Anchor from '../../components/Anchor';
import Notifications from '../../components/Notifications';
import OptionalDropdown from '../../components/OptionalDropdown';
import { NumberInput as Input } from '../../components/Input';
import confirm from '../../lib/confirm';
import controller from '../../lib/controller';
import styles from './styles.styl';
import configManager from '../Print3dConfigManager';

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

// config type: official ('fast print', 'normal quality', 'high quality'); custom: ...
// do all things by 'config name'
class Configurations extends PureComponent {
    static propTypes = {
        widgetState: PropTypes.object.isRequired
    };

    state = {
        // control UI
        stage: STAGE_IDLE,
        notificationMessage: '',
        isSlicing: false,
        isOfficialConfigSelected: true,

        // official config
        selectedOfficialConfigName: undefined,
        showOfficialConfigDetails: true,

        // rename custom config
        newName: undefined,
        isRenaming: false,

        // custom config
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
                name: 'Retract & Z Hop',
                expanded: false,
                fields: [
                    'retraction_enable',
                    'retract_at_layer_change',
                    'retraction_amount',
                    'retraction_speed',
                    'retraction_hop_enabled',
                    'retraction_hop'
                ]
            },
            {
                name: 'Surface',
                expanded: false,
                fields: [
                    'magic_spiralize',
                    'magic_mesh_surface_mode'
                ]
            }
        ]
    };

    actions = {
        showNotification: (msg) => {
            this.setState({
                notificationMessage: msg
            });
        },
        clearNotification: () => {
            this.setState({
                notificationMessage: ''
            });
        },
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
            // 1.check renameStr: not empty, not same as old, not same as existed
            let newName = this.state.newName;
            let oldName = this.state.selectedCustomConfigName;
            if (newName === null || newName === undefined || newName.trim().length === 0) {
                this.actions.showNotification('rename failed: new name can not be empty');
                return;
            }
            if (newName === oldName) {
                this.actions.showNotification('rename failed: new name can not be same as old name');
                return;
            }
            for (let existedName of configManager.getCustomBeanNames()) {
                if (existedName.toLowerCase() === newName.toLowerCase()) {
                    this.actions.showNotification('rename failed: new name can not be same as existed names');
                    return;
                }
            }
            // 2.do rename
            configManager.renameCustom(oldName, newName.trim(), (err) => {
                if (!err) {
                    // 3.update state
                    const customBeanNames = configManager.getCustomBeanNames();
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
            configManager.duplicateOfficialOrCustom(beanName, (err, newName) => {
                if (!err) {
                    // update state
                    const customBeanNames = configManager.getCustomBeanNames();
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
            if (this.configManager.getCustomBeanNames().length <= 1) {
                this.actions.showNotification('Remove failed: you can\'t delete the last custom profile');
                return;
            }

            const beanName = this.state.selectedCustomConfigName;
            confirm({
                body: <p>Are you sure to remove profile <b>{beanName}</b></p>
            }).then(() => {
                configManager.removeCustom(beanName, (err) => {
                    if (!err) {
                        const customBeanNames = configManager.getCustomBeanNames();
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
            });
        },
        onChangeCustomConfig: (key, value) => {
            const selectedCustomConfigBean = configManager.findBean('custom', this.state.selectedCustomConfigName);
            selectedCustomConfigBean.jsonObj.overrides[key].default_value = value;
            configManager.saveModificationToFile('custom', this.state.selectedCustomConfigName);
            this.forceUpdate();
        },
        onClickGenerateGcode: () => {
            this.setState({
                isSlicing: true
            });

            // prepare config file and then publish msg
            let targetBean = null;
            if (this.state.isOfficialConfigSelected) {
                targetBean = configManager.findBean('official', this.state.selectedOfficialConfigName);
            } else {
                targetBean = configManager.findBean('custom', this.state.selectedCustomConfigName);
            }
            if (targetBean) {
                // request generate G-code
                pubsub.publish(ACTION_REQ_GENERATE_GCODE_3DP, targetBean.filePath);
            }
        }
    };

    subscriptions = [];

    controllerEvents = {
        'print3D:gcode-generated': () => {
            this.setState({
                isSlicing: false
            });
        }
    };

    componentWillReceiveProps(nextProps) {
        // Switch to Fullscreen
        if (nextProps.widgetState.fullscreen && !this.props.widgetState.fullscreen) {
            this.setState({
                showConfigDetails: true
            });
        }
    }

    componentDidMount() {
        this.addControllerEvents();
        this.addSubscriptions();
    }

    componentWillUnmount() {
        this.removeControllerEvents();
        this.removeSubscriptions();
    }

    addControllerEvents() {
        Object.keys(this.controllerEvents).forEach(event => {
            const callback = this.controllerEvents[event];
            controller.on(event, callback);
        });
    }

    removeControllerEvents() {
        Object.keys(this.controllerEvents).forEach(event => {
            const callback = this.controllerEvents[event];
            controller.off(event, callback);
        });
    }

    addSubscriptions() {
        this.subscriptions = [
            pubsub.subscribe(ACTION_CHANGE_STAGE_3DP, (msg, state) => {
                this.setState(state);
            }),
            pubsub.subscribe(ACTION_3DP_CONFIG_LOADED, (msg, data) => {
                if (data === 'official') {
                    this.setState({
                        selectedOfficialConfigName: 'fast print'
                    });
                } else if (data === 'custom') {
                    const customBeanNames = configManager.getCustomBeanNames();
                    const customConfigOptions = customBeanNames.map((name) => ({
                        label: name,
                        value: name
                    }));
                    const selectedCustomConfigName = (customBeanNames.length > 0) ? customBeanNames[0] : '';
                    this.setState({
                        selectedCustomConfigName: selectedCustomConfigName,
                        customConfigOptions: customConfigOptions
                    });
                }
            })
        ];
    }

    removeSubscriptions() {
        this.subscriptions.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        this.subscriptions = [];
    }

    render() {
        const state = this.state;
        const actions = this.actions;

        const selectedOfficialConfigBean = configManager.findBean('official', state.selectedOfficialConfigName);
        const selectedCustomConfigBean = configManager.findBean('custom', state.selectedCustomConfigName);
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
                            width: '100px',
                            lineHeight: '34px',
                            marginRight: '15px'
                        }}
                        >
                            Profile
                        </span>
                        <span style={{
                            width: '206px',
                            float: 'right'
                        }}
                        >
                            <Select
                                backspaceRemoves={false}
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
                        </span>
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
                    {state.notificationMessage &&
                    <Notifications bsStyle="danger" onDismiss={actions.clearNotification}>
                        {state.notificationMessage}
                    </Notifications>
                    }
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
                                        const options = selectedCustomConfigBean.jsonObj.overrides[key].options;
                                        let enableStr = selectedCustomConfigBean.jsonObj.overrides[key].enabled;
                                        let enable = true;
                                        if (enableStr) {
                                            // for example: retraction_hop.enable = retraction_enable and retraction_hop_enabled
                                            const arr = enableStr.split('and');
                                            for (let enableKey of arr) {
                                                enable = enable && selectedCustomConfigBean.jsonObj.overrides[enableKey.trim()].default_value;
                                            }
                                        }
                                        let opts = [];
                                        if (options) {
                                            Object.keys(options).forEach((key) => {
                                                opts.push({
                                                    value: key,
                                                    label: options[key]
                                                });
                                            });
                                        }
                                        return (
                                            <div className={styles['field-row']} key={key}>
                                                <span className={styles.field}>{label}</span>
                                                { type === 'float' &&
                                                <React.Fragment>
                                                    <Input
                                                        className={styles.input}
                                                        value={defaultValue}
                                                        disabled={!enable}
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
                                                    disabled={!enable}
                                                    checked={defaultValue}
                                                    onChange={(event) => actions.onChangeCustomConfig(key, event.target.checked)}
                                                />
                                                }
                                                { type === 'enum' &&
                                                <Select
                                                    disabled={!enable}
                                                    className={styles.select}
                                                    backspaceRemoves={false}
                                                    clearable={false}
                                                    menuContainerStyle={{ zIndex: 5 }}
                                                    name={key}
                                                    options={opts}
                                                    searchable={false}
                                                    value={defaultValue}
                                                    onChange={(option) => {
                                                        actions.onChangeCustomConfig(key, option.value);
                                                    }}
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
                    disabled={state.stage < STAGE_IMAGE_LOADED || state.isSlicing}
                    style={{ display: 'block', width: '100%', marginTop: '8px' }}
                >
                    Generate G-code
                </button>
            </div>
        );
    }
}

export default Configurations;
