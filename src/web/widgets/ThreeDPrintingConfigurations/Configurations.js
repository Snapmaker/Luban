import React, { PureComponent } from 'react';
import Select from 'react-select';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import update from 'immutability-helper';
import {
    STAGE_IDLE,
    STAGE_IMAGE_LOADED,
    ACTION_CHANGE_STAGE_3DP,
    ACTION_REQ_GENERATE_GCODE_3DP
} from '../../constants';
import Anchor from '../../components/Anchor';
import OptionalDropdown from '../../components/OptionalDropdown';
import { InputWithValidation as Input } from '../../components/Input';
import styles from './styles.styl';


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
    speed_infill: { value: 35, unit: 'mm/s' },
    speed_wall_0: { value: 35, unit: 'mm/s' },
    speed_wall_x: { value: 35, unit: 'mm/s' },
    speed_travel: { value: 35, unit: 'mm/s' },

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
    speed_infill: { value: 35, unit: 'mm/s' },
    speed_wall_0: { value: 35, unit: 'mm/s' },
    speed_wall_x: { value: 35, unit: 'mm/s' },
    speed_travel: { value: 35, unit: 'mm/s' },

    _: '' // placeholder
};

class Configurations extends PureComponent {
    state = {
        stage: STAGE_IDLE,
        configType: PRINTING_CONFIG_TYPE_FAST_PRINT,
        config: PRINTING_CONFIG_FAST_PRINT,
        // standard config type
        showConfigDetails: true,
        // custom config type
        profiles: ['Fast Print', 'Normal Quality'], // FIXME: read user profiles
        selectedProfile: 'Fast Print',
        configCategories: [
            'configCategoryQuality',
            'configCategoryShell',
            'configCategoryInfill'
        ],
        configCategoryQuality: {
            expanded: false,
            fields: [
                'layer_height',
                'layer_height_0',
                'initial_layer_line_width_factor'
            ]
        },
        configCategoryShell: {
            expanded: false,
            fields: [
                'wall_thickness',
                'top_thickness',
                'bottom_thickness'
            ]
        },
        configCategoryInfill: {
            expanded: false,
            fields: [
                'infill_sparse_density'
            ]
        }
    };

    actions = {
        onChangeConfigTypeFastPrint: () => {
            this.setState({
                configType: PRINTING_CONFIG_TYPE_FAST_PRINT,
                config: PRINTING_CONFIG_FAST_PRINT
            });
        },
        onChangeConfigTypeNormalQuality: () => {
            this.setState({
                configType: PRINTING_CONFIG_TYPE_NORMAL_QUALITY,
                config: PRINTING_CONFIG_NORMAL_QUALITY
            });
        },
        onChangeConfigTypeHighQuality: () => {
            this.setState({
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
            this.setState({
                selectedProfile: profile,
                config: PRINTING_CONFIG_NORMAL_QUALITY // FIXME: use specific profile config
            });
        },
        onDuplicate: () => {
            // duplicate profile
        },
        onClickGenerateGcode: () => {
            // request generate G-code directly
            pubsub.publish(ACTION_REQ_GENERATE_GCODE_3DP);
        }
    };

    subscriptions = [];

    componentDidMount() {
        this.subscriptions = [
            pubsub.subscribe(ACTION_CHANGE_STAGE_3DP, (msg, state) => {
                this.setState(state);
            })
        ];
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

        const field2Copy = {
            layer_height: 'Layer Height',
            top_thickness: 'Top Thickness',
            bottom_thickness: 'Bottom Thickness',
            infill_sparse_density: 'Infill',
            speed_print: 'Print Speed',
            speed_infill: 'Infill Speed',
            speed_wall_0: 'Outer Wall Speed',
            speed_wall_x: 'Inner Wall Speed',
            speed_travel: 'Travel Speed'
        };
        // detail field to be shown
        const standardDetailFields = [
            'layer_height',
            'top_thickness',
            'infill_sparse_density',
            'speed_print',
            'speed_infill',
            'speed_wall_0',
            'speed_wall_x',
            'speed_travel'
        ];

        const profileOptions = state.profiles.map((profile) => ({
            label: profile,
            value: profile
        }));

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
                        <table className={styles['config-details-table']}>
                            <tbody>
                                {standardDetailFields.map((field) => {
                                    const c = state.config[field];
                                    return (
                                        <tr key={field}>
                                            <td>{field2Copy[field]}</td>
                                            <td>{c.value}{c.unit === '%' ? '%' : ` ${c.unit}`}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
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
                            options={profileOptions}
                            placeholder=""
                            value={state.selectedProfile}
                            onChange={actions.onChangeProfile}
                        />
                    </div>
                    <div style={{ marginTop: '10px' }}>
                        <span>{state.selectedProfile}</span>
                        <div
                            style={{
                                display: 'inline-block',
                                float: 'right'
                            }}
                        >
                            <Anchor
                                className={classNames('fa', 'fa-copy', styles['fa-btn'])}
                                onClick={actions.onDuplicate}
                            />
                        </div>
                    </div>
                    <div className={classNames(styles.separator, styles['separator-underline'])} />
                    { state.configCategories.map((categoryKey) => {
                        const category = state[categoryKey];
                        return (
                            <div className={styles['config-category']} key={categoryKey}>
                                <Anchor
                                    className={styles['category-header']}
                                    onClick={() => {
                                        this.setState(() => {
                                            const expanded = !category.expanded;
                                            return {
                                                [categoryKey]: update(category, {
                                                    $merge: { expanded }
                                                })
                                            };
                                        });
                                    }}
                                >
                                    <span className={styles['category-title']}>Quality</span>
                                    <span className={classNames(
                                        'fa',
                                        category.expanded ? 'fa-angle-down' : 'fa-angle-left',
                                        styles['category-indicator']
                                    )}
                                    />
                                </Anchor>
                                <div
                                    className={classNames(styles['category-content'], {
                                        [styles.expanded]: category.expanded
                                    })}
                                >
                                    <div className={styles['field-row']}>
                                        <span className={styles.field}>Wall Thickness</span>
                                        <Input
                                            validClassName={styles.input}
                                            value={800}
                                            min={0}
                                            max={1000}
                                            onChange={() => {
                                            }}
                                        />
                                    </div>
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
}

export default Configurations;
