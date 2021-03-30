import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import Select from '../../components/Select';
import Anchor from '../../components/Anchor';
import OptionalDropdown from '../../components/OptionalDropdown';
import TipTrigger from '../../components/TipTrigger';
import { NumberInput as Input } from '../../components/Input';
import i18n from '../../lib/i18n';
import widgetStyles from '../styles.styl';
import { actions as printingActions } from '../../flux/printing';
import { actions as projectActions } from '../../flux/project';
import { HEAD_3DP, PRINTING_MANAGER_TYPE_QUALITY, PRINTING_QUALITY_CONFIG_GROUP } from '../../constants';

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


function isDefinitionEditable(definition) {
    return !definition.metadata.readonly;
}


// config type: official ('fast print', 'normal quality', 'high quality'); custom: ...
// do all things by 'config name'
class Configurations extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,
        isRecommended: PropTypes.bool.isRequired,
        defaultQualityId: PropTypes.string.isRequired,
        qualityDefinitions: PropTypes.array.isRequired,

        updateManagerDisplayType: PropTypes.func.isRequired,
        updateDefinitionsForManager: PropTypes.func.isRequired,
        updateDefinitionSettings: PropTypes.func.isRequired,
        updateActiveDefinition: PropTypes.func.isRequired,
        updateShowPrintingManager: PropTypes.func.isRequired,
        updateIsRecommended: PropTypes.func.isRequired,
        updateDefaultQualityId: PropTypes.func.isRequired
    };

    fileInput = React.createRef();

    state = {
        // control UI
        showOfficialConfigDetails: true,

        selectedDefinition: null,

        customConfigGroup: PRINTING_QUALITY_CONFIG_GROUP.map((config) => {
            config.expanded = false;
            return config;
        })

    };

    actions = {
        onShowMaterialManager: () => {
            this.props.updateManagerDisplayType(PRINTING_MANAGER_TYPE_QUALITY);
            this.props.updateShowPrintingManager(true);
        },
        /**
         * Select `definition`.
         *
         * @param definition
         */
        onSelectOfficialDefinition: (definition) => {
            this.setState({
                selectedDefinition: definition
            });
            this.props.updateDefaultQualityId(definition.definitionId);
            this.props.updateActiveDefinition(definition);
        },
        onSelectCustomDefinitionById: (definitionId) => {
            const definition = this.props.qualityDefinitions.find(d => d.definitionId === definitionId);
            // has to update defaultQualityId
            this.props.updateDefaultQualityId(definitionId);
            this.actions.onSelectCustomDefinition(definition);
        },
        onSelectCustomDefinition: (definition) => {
            this.setState({
                selectedDefinition: definition
            });
            // this.props.updateDefaultQualityId(definition.definitionId);
            this.props.updateActiveDefinition(definition);
        },
        onChangeCustomDefinition: (key, value, shouldUpdateDefinitionsForManager = false) => {
            const definition = this.props.qualityDefinitions.find(d => d.definitionId === this.props.defaultQualityId);
            if (!isDefinitionEditable(definition)) {
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
            if (shouldUpdateDefinitionsForManager) {
                this.props.updateDefinitionsForManager(definition.definitionId, PRINTING_MANAGER_TYPE_QUALITY);
            }
        },
        onSetOfficialTab: (isRecommended) => {
            if (isRecommended && (/^quality.([0-9_]+)$/.test(this.props.defaultQualityId) || this.props.defaultQualityId.indexOf('Caselibrary') > -1)) {
                this.props.updateDefaultQualityId('quality.fast_print');
            }
            this.props.updateIsRecommended(isRecommended);
        }
    };

    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('Printing Settings'));
    }

    componentDidUpdate(prevProps) {
        const { defaultQualityId, qualityDefinitions } = this.props;

        // selected quality ID or definitions changed
        if (defaultQualityId !== prevProps.defaultQualityId || qualityDefinitions !== prevProps.qualityDefinitions) {
            // re-select definition based on new properties
            let definition = null;

            if (defaultQualityId && qualityDefinitions.length > 0) {
                definition = qualityDefinitions.find(d => d.definitionId === defaultQualityId);
            }

            if (!definition) {
                // definition no found, select first official definition
                this.actions.onSelectOfficialDefinition(qualityDefinitions[0]);
            } else {
                this.actions.onSelectCustomDefinition(definition);
            }
        }
    }

    render() {
        const { isRecommended, qualityDefinitions } = this.props;
        const state = this.state;
        const actions = this.actions;

        const fastPrintDefinition = qualityDefinitions.find(d => d.definitionId === 'quality.fast_print');
        const normalQualityDefinition = qualityDefinitions.find(d => d.definitionId === 'quality.normal_quality');
        const highQualityDefinition = qualityDefinitions.find(d => d.definitionId === 'quality.high_quality');

        const qualityDefinition = this.state.selectedDefinition;

        const customDefinitionOptions = qualityDefinitions.map(d => ({
            label: d.name,
            value: d.definitionId
        }));

        if (!qualityDefinition) {
            return null;
        }

        const editable = isDefinitionEditable(qualityDefinition);

        return (
            <div>
                <div className="sm-tabs" style={{ marginTop: '6px', marginBottom: '12px' }}>
                    <button
                        type="button"
                        style={{ width: '43%' }}
                        className={classNames('sm-tab', { 'sm-selected': isRecommended })}
                        onClick={() => {
                            this.actions.onSetOfficialTab(true);
                        }}
                    >
                        {i18n._('Recommended')}
                    </button>
                    <button
                        type="button"
                        style={{ width: '43%', borderRight: '1px solid #c8c8c8' }}
                        className={classNames('sm-tab', { 'sm-selected': !isRecommended })}
                        onClick={() => {
                            this.actions.onSetOfficialTab(false);
                        }}
                    >
                        {i18n._('Customize')}
                    </button>
                    <Anchor
                        onClick={this.actions.onShowMaterialManager}
                    >
                        <span
                            className={classNames(
                                styles['manager-icon'],
                            )}
                        />
                    </Anchor>
                </div>
                {isRecommended && (
                    <div className="sm-tabs" style={{ marginTop: '12px' }}>
                        <button
                            type="button"
                            style={{ width: '33.333333%' }}
                            className={classNames('sm-tab', 'sm-tab-large', { 'sm-selected': qualityDefinition === fastPrintDefinition })}
                            onClick={() => {
                                this.actions.onSelectOfficialDefinition(fastPrintDefinition);
                            }}
                        >
                            {i18n._('Fast Print')}
                        </button>
                        <button
                            type="button"
                            style={{ width: '33.333333%' }}
                            className={classNames('sm-tab', 'sm-tab-large', { 'sm-selected': qualityDefinition === normalQualityDefinition })}
                            onClick={() => {
                                this.actions.onSelectOfficialDefinition(normalQualityDefinition);
                            }}
                        >
                            {i18n._('Normal Quality')}
                        </button>
                        <button
                            type="button"
                            style={{ width: '33.333333%' }}
                            className={classNames('sm-tab', 'sm-tab-large', { 'sm-selected': qualityDefinition === highQualityDefinition })}
                            onClick={() => {
                                this.actions.onSelectOfficialDefinition(highQualityDefinition);
                            }}
                        >
                            {i18n._('High Quality')}
                        </button>
                    </div>
                )}
                {isRecommended && (
                    <div style={{ marginTop: '12px', marginBottom: '6px' }}>
                        <OptionalDropdown
                            draggable="false"
                            title={i18n._('Show Details')}
                            hidden={!state.showOfficialConfigDetails}
                            onClick={() => {
                                this.setState({ showOfficialConfigDetails: !state.showOfficialConfigDetails });
                            }}
                        >
                            {state.showOfficialConfigDetails && (
                                <table className={styles['config-details-table']}>
                                    <tbody>
                                        {OFFICIAL_CONFIG_KEYS.map((key) => {
                                            const setting = qualityDefinition.settings[key];
                                            const { label, unit } = setting;
                                            const defaultValue = setting.default_value;

                                            return (
                                                <tr key={key}>
                                                    <td>{i18n._(label)}</td>
                                                    <td>
                                                        {defaultValue}
                                                        {unit}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </OptionalDropdown>
                    </div>
                )}
                {!isRecommended && (
                    <div style={{ marginBottom: '6px' }}>
                        <div style={{
                            marginBottom: '10px'
                        }}
                        >
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
                        <div className={classNames(widgetStyles.separator, widgetStyles['separator-underline'])} />
                        <div className="sm-parameter-container">
                            {this.state.customConfigGroup.map((group) => {
                                return (
                                    <div key={i18n._(group.name)}>
                                        <Anchor
                                            className="sm-parameter-header"
                                            onClick={() => {
                                                group.expanded = !group.expanded;
                                                this.setState({
                                                    customConfigGroup: JSON.parse(JSON.stringify(state.customConfigGroup))
                                                });
                                            }}
                                        >
                                            <span className="fa fa-gear sm-parameter-header__indicator" />
                                            <span className="sm-parameter-header__title">{i18n._(group.name)}</span>
                                            <span className={classNames(
                                                'fa',
                                                group.expanded ? 'fa-angle-double-up' : 'fa-angle-double-down',
                                                'sm-parameter-header__indicator',
                                                'pull-right',
                                            )}
                                            />
                                        </Anchor>
                                        {group.expanded && group.fields.map((key) => {
                                            const setting = qualityDefinition.settings[key];

                                            const { label, description, type, unit = '', enabled, options } = setting;
                                            const defaultValue = setting.default_value;

                                            if (typeof enabled === 'string') {
                                                if (enabled.indexOf(' and ') !== -1) {
                                                    const andConditions = enabled.split(' and ').map(c => c.trim());
                                                    for (const condition of andConditions) {
                                                        // parse resolveOrValue('adhesion_type') == 'skirt'
                                                        const enabledKey = condition.match("resolveOrValue\\('(.[^)|']*)'") ? condition.match("resolveOrValue\\('(.[^)|']*)'")[1] : null;
                                                        const enabledValue = condition.match("== ?'(.[^)|']*)'") ? condition.match("== ?'(.[^)|']*)'")[1] : null;
                                                        if (enabledKey) {
                                                            if (qualityDefinition.settings[enabledKey]) {
                                                                const value = qualityDefinition.settings[enabledKey].default_value;
                                                                if (value !== enabledValue) {
                                                                    return null;
                                                                }
                                                            }
                                                        } else {
                                                            if (qualityDefinition.settings[condition]) {
                                                                const value = qualityDefinition.settings[condition].default_value;
                                                                if (!value) {
                                                                    return null;
                                                                }
                                                            }
                                                        }
                                                    }
                                                } else {
                                                    const orConditions = enabled.split(' or ')
                                                        .map(c => c.trim());
                                                    let result = false;
                                                    for (const condition of orConditions) {
                                                        if (qualityDefinition.settings[condition]) {
                                                            const value = qualityDefinition.settings[condition].default_value;
                                                            if (value) {
                                                                result = true;
                                                            }
                                                        }
                                                        if (condition.match('(.*) > ([0-9]+)')) {
                                                            const m = condition.match('(.*) > ([0-9]+)');
                                                            const enabledKey = m[1];
                                                            const enabledValue = parseInt(m[2], 10);
                                                            if (qualityDefinition.settings[enabledKey]) {
                                                                const value = qualityDefinition.settings[enabledKey].default_value;
                                                                if (value > enabledValue) {
                                                                    result = true;
                                                                }
                                                            }
                                                        }
                                                        if (condition.match('(.*) < ([0-9]+)')) {
                                                            const m = condition.match('(.*) > ([0-9]+)');
                                                            const enabledKey = m[1];
                                                            const enabledValue = parseInt(m[2], 10);
                                                            if (qualityDefinition.settings[enabledKey]) {
                                                                const value = qualityDefinition.settings[enabledKey].default_value;
                                                                if (value < enabledValue) {
                                                                    result = true;
                                                                }
                                                            }
                                                        }
                                                        if (condition.match("resolveOrValue\\('(.[^)|']*)'")) {
                                                            const m1 = condition.match("resolveOrValue\\('(.[^)|']*)'");
                                                            const m2 = condition.match("== ?'(.[^)|']*)'");
                                                            const enabledKey = m1[1];
                                                            const enabledValue = m2[1];
                                                            if (qualityDefinition.settings[enabledKey]) {
                                                                const value = qualityDefinition.settings[enabledKey].default_value;
                                                                if (value === enabledValue) {
                                                                    result = true;
                                                                }
                                                            }
                                                        }
                                                    }
                                                    if (!result) {
                                                        return null;
                                                    }
                                                }
                                            } else if (typeof enabled === 'boolean' && enabled === false) {
                                                return null;
                                            }

                                            const opts = [];
                                            if (options) {
                                                Object.keys(options).forEach((k) => {
                                                    opts.push({
                                                        value: k,
                                                        label: i18n._(options[k])
                                                    });
                                                });
                                            }
                                            return (
                                                <TipTrigger title={i18n._(label)} content={i18n._(description)} key={key}>
                                                    <div className="sm-parameter-row" key={key}>
                                                        <span className="sm-parameter-row__label-lg">{i18n._(label)}</span>
                                                        {type === 'float' && (
                                                            <Input
                                                                className="sm-parameter-row__input"
                                                                value={defaultValue}
                                                                disabled={!editable}
                                                                onChange={(value) => {
                                                                    actions.onChangeCustomDefinition(key, value);
                                                                }}
                                                            />
                                                        )}
                                                        {type === 'float' && (
                                                            <span className="sm-parameter-row__input-unit">{unit}</span>
                                                        )}
                                                        {type === 'int' && (
                                                            <Input
                                                                className="sm-parameter-row__input"
                                                                value={defaultValue}
                                                                disabled={!editable}
                                                                onChange={(value) => {
                                                                    actions.onChangeCustomDefinition(key, value);
                                                                }}
                                                            />
                                                        )}
                                                        {type === 'int' && (
                                                            <span className="sm-parameter-row__input-unit">{unit}</span>
                                                        )}
                                                        {type === 'bool' && (
                                                            <input
                                                                className="sm-parameter-row__checkbox"
                                                                type="checkbox"
                                                                checked={defaultValue}
                                                                disabled={!editable}
                                                                onChange={(event) => actions.onChangeCustomDefinition(key, event.target.checked, type === 'bool')}
                                                            />
                                                        )}
                                                        {type === 'enum' && (
                                                            <Select
                                                                className="sm-parameter-row__select"
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
                                                        )}
                                                    </div>
                                                </TipTrigger>
                                            );
                                        })
                                        }
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const { qualityDefinitions, defaultQualityId, isRecommended, activeDefinition } = state.printing;
    return {
        qualityDefinitions,
        defaultQualityId,
        isRecommended,
        activeDefinition
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateIsRecommended: (isRecommended) => dispatch(printingActions.updateIsRecommended(isRecommended)),
        updateDefaultQualityId: (qualityId) => dispatch(printingActions.updateDefaultQualityId(qualityId)),
        updateActiveDefinition: (definition) => {
            dispatch(printingActions.updateActiveDefinition(definition));
            dispatch(projectActions.autoSaveEnvironment(HEAD_3DP, true));
        },
        updateManagerDisplayType: (managerDisplayType) => dispatch(printingActions.updateManagerDisplayType(managerDisplayType)),
        updateQualityDefinitionName: (definition, name) => dispatch(printingActions.updateQualityDefinitionName(definition, name)),
        updateShowPrintingManager: (showPrintingManager) => dispatch(printingActions.updateShowPrintingManager(showPrintingManager)),
        updateDefinitionSettings: (definition, settings) => dispatch(printingActions.updateDefinitionSettings(definition, settings)),
        updateDefinitionsForManager: (definitionId, type) => dispatch(printingActions.updateDefinitionsForManager(definitionId, type))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Configurations);
