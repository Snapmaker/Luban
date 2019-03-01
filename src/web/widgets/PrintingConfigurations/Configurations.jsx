import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Select from 'react-select';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import includes from 'lodash/includes';
import {
    ACTION_CHANGE_STAGE_3DP,
    ACTION_REQ_GENERATE_GCODE_3DP,
    ACTION_3DP_MODEL_OVERSTEP_CHANGE,
    STAGES_3DP
} from '../../constants';
import Anchor from '../../components/Anchor';
import Notifications from '../../components/Notifications';
import OptionalDropdown from '../../components/OptionalDropdown';
import TipTrigger from '../../components/TipTrigger';
import { NumberInput as Input } from '../../components/Input';
import i18n from '../../lib/i18n';
import confirm from '../../lib/confirm';
import controller from '../../lib/controller';
import widgetStyles from './../styles.styl';
import { actions } from '../../reducers/printing';
import styles from './styles.styl';


const OFFICIAL_CONFIG_KEYS = [
    'layer_height',
    'top_thickness',
    'infill_sparse_density',
    // 'speed_print',
    'speed_infill',
    'speed_wall_0',
    'speed_wall_x',
    'speed_travel'
];

function isOfficialDefinition(definition) {
    return includes(['fast_print.quality', 'normal_quality.quality', 'high_quality.quality'], definition.definitionId);
}

// config type: official ('fast print', 'normal quality', 'high quality'); custom: ...
// do all things by 'config name'
class Configurations extends PureComponent {
    static propTypes = {
        widgetState: PropTypes.object.isRequired,
        qualityDefinitions: PropTypes.array.isRequired,
        updateDefinitionSettings: PropTypes.func.isRequired,
        updateActiveDefinition: PropTypes.func.isRequired,
        duplicateQualityDefinition: PropTypes.func.isRequired,
        removeQualityDefinition: PropTypes.func.isRequired,
        updateQualityDefinitionName: PropTypes.func.isRequired
    };

    state = {
        // control UI
        stage: STAGES_3DP.noModel,
        notificationMessage: '',
        isSlicing: false,
        isOfficialConfigSelected: true,
        isModelOverstepped: false,
        showOfficialConfigDetails: true,

        // config
        selectedConfigBean: null,
        selectedOfficialConfigBean: null,

        isOfficialTab: true,
        officialQualityDefinition: null,
        customQualityDefinition: null,

        // rename custom config
        newName: null,
        isRenaming: false,

        // custom config
        customDefinitionOptions: [],
        customConfigGroup: [
            {
                name: i18n._('Quality'),
                expanded: false,
                fields: [
                    'layer_height',
                    'layer_height_0',
                    'initial_layer_line_width_factor'
                ]
            },
            {
                name: i18n._('Shell'),
                expanded: false,
                fields: [
                    'wall_thickness',
                    'top_thickness',
                    'bottom_thickness'
                ]
            },
            {
                name: i18n._('Infill'),
                expanded: false,
                fields: [
                    'infill_sparse_density'
                ]
            },
            {
                name: i18n._('Speed'),
                expanded: false,
                fields: [
                    // 'speed_print',
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
                name: i18n._('Retract & Z Hop'),
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
                name: i18n._('Surface'),
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
        onSelectOfficialDefinition: (definition) => {
            this.setState({
                isOfficialTab: true,
                officialQualityDefinition: definition
            });
            this.props.updateActiveDefinition(definition);
        },
        onSelectCustomDefinitionById: (definitionId) => {
            const definition = this.props.qualityDefinitions.find(d => d.definitionId === definitionId);

            this.actions.onSelectCustomDefinition(definition);
        },
        onSelectCustomDefinition: (definition) => {
            this.setState({
                isOfficialTab: false,
                customQualityDefinition: definition,
                isRenaming: false
            });
            this.props.updateActiveDefinition(definition);
        },
        // Extended operations
        onChangeNewName: (event) => {
            this.setState({
                newName: event.target.value
            });
        },
        onRenameDefinitionStart: () => {
            if (!this.state.isRenaming) {
                const definition = this.state.customQualityDefinition;
                this.setState({
                    isRenaming: true,
                    newName: definition.name
                });
            }
        },
        onRenameDefinitionEnd: async () => {
            const definition = this.state.customQualityDefinition;
            const { newName } = this.state;

            if (newName === definition.name) { // unchanged
                return;
            }

            try {
                await this.props.updateQualityDefinitionName(definition, newName);
            } catch (err) {
                if (typeof err === 'string') {
                    this.actions.showNotification(err);
                } else {
                    console.error(err);
                }
            }

            // Update options
            const customDefinitionOptions = this.props.qualityDefinitions.map(d => ({
                label: d.name,
                value: d.definitionId
            }));

            this.setState({
                isRenaming: false,
                customDefinitionOptions
            });
        },
        onChangeCustomDefinition: (key, value) => {
            const definition = this.state.customQualityDefinition;
            if (isOfficialDefinition(definition)) {
                return;
            }

            definition.settings[key].default_value = value;

            this.props.updateDefinitionSettings(definition, {
                [key]: { default_value: value }
            });
            this.props.updateActiveDefinition({
                ownKeys: [key],
                settings: {
                    [key]: { default_value: value }
                }
            });
        },
        onDuplicateDefinition: async () => {
            const definition = this.state.customQualityDefinition;
            const newDefinition = await this.props.duplicateQualityDefinition(definition);

            // Select new definition after creation
            this.actions.onSelectCustomDefinition(newDefinition);
        },
        onRemoveDefinition: async () => {
            const definition = this.state.customQualityDefinition;
            await confirm({
                body: `Are you sure to remove profile "${definition.name}"?`
            });

            await this.props.removeQualityDefinition(definition);

            // After removal, select the first definition
            if (this.props.qualityDefinitions.length) {
                this.actions.onSelectCustomDefinition(this.props.qualityDefinitions[0]);
            }
        },
        onClickGenerateGcode: () => {
            this.setState({
                isSlicing: true
            });

            /*
            // choose the right config
            let configFilePath = null;
            if (this.state.isOfficialConfigSelected) {
                if (this.state.selectedOfficialConfigBean) {
                    configFilePath = this.state.selectedOfficialConfigBean.filePath;
                }
            } else if (this.state.selectedConfigBean) {
                configFilePath = this.state.selectedConfigBean.filePath;
            }
            */
            pubsub.publish(ACTION_REQ_GENERATE_GCODE_3DP);
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
        if (nextProps.qualityDefinitions !== this.props.qualityDefinitions) {
            const newState = {};

            // First load initialization
            if (this.props.qualityDefinitions.length === 0) {
                const definition = nextProps.qualityDefinitions.find(d => d.definitionId === 'fast_print.quality');

                Object.assign(newState, {
                    isOfficialTab: true,
                    officialQualityDefinition: definition,
                    customQualityDefinition: definition
                });
            }

            // Update custom definition options
            const customDefinitionOptions = nextProps.qualityDefinitions.map(d => ({
                label: d.name,
                value: d.definitionId
            }));
            Object.assign(newState, {
                customDefinitionOptions: customDefinitionOptions
            });

            this.setState(newState);
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
            pubsub.subscribe(ACTION_3DP_MODEL_OVERSTEP_CHANGE, (msg, state) => {
                this.setState({
                    isModelOverstepped: state.overstepped
                });
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

        const fastPrintDefinition = this.props.qualityDefinitions.find(d => d.definitionId === 'fast_print.quality');
        const normalQualityDefinition = this.props.qualityDefinitions.find(d => d.definitionId === 'normal_quality.quality');
        const highQualityDefinition = this.props.qualityDefinitions.find(d => d.definitionId === 'high_quality.quality');

        const { isOfficialTab, officialQualityDefinition, customQualityDefinition, customDefinitionOptions } = this.state;
        const qualityDefinition = isOfficialTab ? officialQualityDefinition : customQualityDefinition;

        if (!qualityDefinition) {
            return null;
        }

        const editable = !isOfficialDefinition(qualityDefinition);

        return (
            <div>
                <div className={styles.tabs} style={{ marginTop: '6px', marginBottom: '12px' }}>
                    <button
                        type="button"
                        style={{ width: '50%' }}
                        className={classNames(styles.tab, { [styles.selected]: isOfficialTab })}
                        onClick={() => {
                            this.setState({
                                isOfficialTab: true
                            });
                        }}
                    >
                        {i18n._('Recommended')}
                    </button>
                    <button
                        type="button"
                        style={{ width: '50%' }}
                        className={classNames(styles.tab, { [styles.selected]: !isOfficialTab })}
                        onClick={() => {
                            this.setState({
                                isOfficialTab: false
                            });
                        }}
                    >
                        {i18n._('Customize')}
                    </button>
                </div>
                {isOfficialTab &&
                <div className={styles.tabs} style={{ marginTop: '18px' }}>
                    <button
                        type="button"
                        style={{ width: '33.333333%' }}
                        className={classNames(styles.tab, styles['tab-large'], { [styles.selected]: qualityDefinition === fastPrintDefinition })}
                        onClick={() => {
                            this.actions.onSelectOfficialDefinition(fastPrintDefinition);
                        }}
                    >
                        {i18n._('Fast Print')}
                    </button>
                    <button
                        type="button"
                        style={{ width: '33.333333%' }}
                        className={classNames(styles.tab, styles['tab-large'], { [styles.selected]: qualityDefinition === normalQualityDefinition })}
                        onClick={() => {
                            this.actions.onSelectOfficialDefinition(normalQualityDefinition);
                        }}
                    >
                        {i18n._('Normal Quality')}
                    </button>
                    <button
                        type="button"
                        style={{ width: '33.333333%' }}
                        className={classNames(styles.tab, styles['tab-large'], { [styles.selected]: qualityDefinition === highQualityDefinition })}
                        onClick={() => {
                            this.actions.onSelectOfficialDefinition(highQualityDefinition);
                        }}
                    >
                        {i18n._('High Quality')}
                    </button>
                </div>
                }
                {isOfficialTab &&
                <div style={{ marginTop: '10px', marginBottom: '5px' }}>
                    <OptionalDropdown
                        title={i18n._('Show Details')}
                        hidden={!state.showOfficialConfigDetails}
                        onClick={() => {
                            this.setState({ showOfficialConfigDetails: !state.showOfficialConfigDetails });
                        }}
                    >
                        {state.showOfficialConfigDetails &&
                        <table className={styles['config-details-table']}>
                            <tbody>
                                {OFFICIAL_CONFIG_KEYS.map((key) => {
                                    const setting = qualityDefinition.settings[key];
                                    const { label, unit } = setting;
                                    const defaultValue = setting.default_value;

                                    return (
                                        <tr key={key}>
                                            <td>{i18n._(label)}</td>
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
                {!isOfficialTab &&
                <div style={{ marginBottom: '18px' }}>
                    <div>
                        <span style={{
                            width: '100px',
                            lineHeight: '34px',
                            marginRight: '15px'
                        }}
                        >
                            {i18n._('Profile')}
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
                                options={customDefinitionOptions}
                                placeholder=""
                                value={qualityDefinition.definitionId}
                                onChange={(option) => {
                                    this.actions.onSelectCustomDefinitionById(option.value);
                                }}
                            />
                        </span>
                    </div>
                    <div style={{ marginTop: '10px' }}>
                        {!state.isRenaming &&
                        <span>{qualityDefinition.name}</span>
                        }
                        {state.isRenaming &&
                        <React.Fragment>
                            <input
                                value={state.newName}
                                onChange={actions.onChangeNewName}
                            />
                            <Anchor
                                className={classNames('fa', 'fa-check', widgetStyles['fa-btn'])}
                                onClick={actions.onRenameDefinitionEnd}
                            />
                        </React.Fragment>
                        }
                        <div
                            style={{
                                display: 'inline-block',
                                float: 'right'
                            }}
                        >
                            {!isOfficialDefinition(qualityDefinition) &&
                            <Anchor
                                className={classNames('fa', 'fa-edit', widgetStyles['fa-btn'])}
                                onClick={actions.onRenameDefinitionStart}
                            />
                            }
                            <Anchor
                                className={classNames('fa', 'fa-copy', widgetStyles['fa-btn'])}
                                onClick={actions.onDuplicateDefinition}
                            />
                            {!isOfficialDefinition(qualityDefinition) &&
                            <Anchor
                                className={classNames('fa', 'fa-trash-o', widgetStyles['fa-btn'])}
                                onClick={actions.onRemoveDefinition}
                            />
                            }
                        </div>
                    </div>
                    <div className={classNames(widgetStyles.separator, widgetStyles['separator-underline'])} />
                    {state.notificationMessage &&
                    <Notifications bsStyle="danger" onDismiss={actions.clearNotification}>
                        {state.notificationMessage}
                    </Notifications>
                    }
                    <div className={widgetStyles['parameter-container']}>
                        {this.state.customConfigGroup.map((group) => {
                            return (
                                <div key={group.name}>
                                    <Anchor
                                        className={widgetStyles['parameter-header']}
                                        onClick={() => {
                                            group.expanded = !group.expanded;
                                            this.setState({
                                                customConfigGroup: JSON.parse(JSON.stringify(state.customConfigGroup))
                                            });
                                        }}
                                    >
                                        <span className={classNames('fa', 'fa-gear', widgetStyles['parameter-header__indicator'])} />
                                        <span className={widgetStyles['parameter-header__title']}>{i18n._(group.name)}</span>
                                        <span className={classNames(
                                            'fa',
                                            group.expanded ? 'fa-angle-double-up' : 'fa-angle-double-down',
                                            widgetStyles['parameter-header__indicator'],
                                            widgetStyles['pull-right']
                                        )}
                                        />
                                    </Anchor>
                                    {group.expanded && group.fields.map((key) => {
                                        const setting = qualityDefinition.settings[key];

                                        const { label, description, type, unit = '', enabled = '', options } = setting;
                                        const defaultValue = setting.default_value;

                                        if (enabled) {
                                            const conditions = enabled.split('and').map(c => c.trim());
                                            for (const condition of conditions) {
                                                if (qualityDefinition.settings[condition]) {
                                                    const value = qualityDefinition.settings[condition].default_value;
                                                    if (!value) {
                                                        return null;
                                                    }
                                                }
                                            }
                                        }

                                        let opts = [];
                                        if (options) {
                                            Object.keys(options).forEach((key) => {
                                                opts.push({
                                                    value: key,
                                                    label: i18n._(options[key])
                                                });
                                            });
                                        }
                                        return (
                                            <TipTrigger title={i18n._(label)} content={i18n._(description)} key={key}>
                                                <div className={widgetStyles['parameter-row']} key={key}>
                                                    <span className={widgetStyles['parameter-row__label-lg']}>{i18n._(label)}</span>
                                                    {type === 'float' &&
                                                    <Input
                                                        className={widgetStyles['parameter-row__input']}
                                                        value={defaultValue}
                                                        disabled={!editable}
                                                        onChange={(value) => {
                                                            actions.onChangeCustomDefinition(key, value);
                                                        }}
                                                    />
                                                    }
                                                    {type === 'float' &&
                                                    <span className={widgetStyles['parameter-row__input-unit']}>{unit}</span>
                                                    }
                                                    {type === 'bool' &&
                                                    <input
                                                        className={widgetStyles['parameter-row__checkbox']}
                                                        type="checkbox"
                                                        checked={defaultValue}
                                                        disabled={!editable}
                                                        onChange={(event) => actions.onChangeCustomDefinition(key, event.target.checked)}
                                                    />
                                                    }
                                                    {type === 'enum' &&
                                                    <Select
                                                        className={widgetStyles['parameter-row__select']}
                                                        backspaceRemoves={false}
                                                        clearable={false}
                                                        menuContainerStyle={{ zIndex: 5 }}
                                                        name={key}
                                                        disabled={!editable}
                                                        options={opts}
                                                        searchable={false}
                                                        value={defaultValue}
                                                        onChange={(option) => {
                                                            actions.onChangeCustomDefinition(key, option.value);
                                                        }}
                                                    />
                                                    }
                                                </div>
                                            </TipTrigger>
                                        );
                                    })
                                    }
                                </div>
                            );
                        })}
                    </div>
                    <div className={widgetStyles.separator} />
                </div>
                }
                <button
                    type="button"
                    className={classNames(widgetStyles['btn-large'], widgetStyles['btn-default'])}
                    onClick={actions.onClickGenerateGcode}
                    disabled={state.stage === STAGES_3DP.noModel || state.isSlicing || state.isModelOverstepped}
                    style={{ display: 'block', width: '100%', marginTop: '8px' }}
                >
                    {i18n._('Generate G-code')}
                </button>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const printing = state.printing;
    return {
        qualityDefinitions: printing.qualityDefinitions,
        activeDefinition: printing.activeDefinition
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateActiveDefinition: (definition) => dispatch(actions.updateActiveDefinition(definition)),
        duplicateQualityDefinition: (definition) => dispatch(actions.duplicateQualityDefinition(definition)),
        removeQualityDefinition: (definition) => dispatch(actions.removeQualityDefinition(definition)),
        updateQualityDefinitionName: (definition, name) => dispatch(actions.updateQualityDefinitionName(definition, name)),
        updateDefinitionSettings: (definition, settings) => dispatch(actions.updateDefinitionSettings(definition, settings)),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Configurations);
