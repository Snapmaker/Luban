import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import Select from '../../components/Select';
import Anchor from '../../components/Anchor';
import OptionalDropdown from '../../components/OptionalDropdown';
import i18n from '../../../lib/i18n';
import { actions as printingActions } from '../../../flux/printing';
import { actions as projectActions } from '../../../flux/project';
import { HEAD_3DP, PRINTING_MANAGER_TYPE_QUALITY } from '../../../constants';
import Space from '../../components/Space';

import styles from './styles.styl';

const OFFICIAL_CONFIG_KEYS = [
    'layer_height',
    'top_thickness',
    'infill_sparse_density',
    'speed_infill',
    'speed_wall_0',
    'speed_wall_x',
    'speed_travel',
    'infill_pattern',
    'magic_mesh_surface_mode',
    'support_enable'
];

class Configurations extends PureComponent {
    static propTypes = {
        widgetActions: PropTypes.object.isRequired,
        defaultQualityId: PropTypes.string.isRequired,
        qualityDefinitions: PropTypes.array.isRequired,

        updateManagerDisplayType: PropTypes.func.isRequired,
        updateActiveDefinition: PropTypes.func.isRequired,
        updateShowPrintingManager: PropTypes.func.isRequired,
        updateDefaultQualityId: PropTypes.func.isRequired
    };

    state = {
        // control UI
        showOfficialConfigDetails: true,

        selectedDefinition: null
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
        }
    };

    constructor(props) {
        super(props);
        this.props.widgetActions.setTitle(i18n._('Printing Settings'));
    }

    componentDidMount() {
        const { defaultQualityId, qualityDefinitions } = this.props;
        if (qualityDefinitions.length) {
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
        const { qualityDefinitions } = this.props;
        const state = this.state;
        // const actions = this.actions;
        const qualityDefinition = this.state.selectedDefinition;

        const customDefinitionOptions = qualityDefinitions.map(d => ({
            label: d.name,
            value: d.definitionId
        }));

        if (!qualityDefinition) {
            return null;
        }

        return (
            <div>
                <div className={classNames(
                    styles['material-select']
                )}
                >
                    <Select
                        clearable={false}
                        searchable
                        options={customDefinitionOptions}
                        value={qualityDefinition.definitionId}
                        onChange={(option) => {
                            this.actions.onSelectCustomDefinitionById(option.value);
                        }}
                    />
                </div>
                <Anchor
                    onClick={this.actions.onShowMaterialManager}
                >
                    <span
                        className={classNames(
                            styles['manager-icon'],
                        )}
                    />
                </Anchor>
                <div>
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
                                        const { label, type, unit = '', enabled = '' } = setting;
                                        const defaultValue = setting.default_value;

                                        if (enabled) {
                                            // for example: retraction_hop.enable = retraction_enable and retraction_hop_enabled
                                            const conditions = enabled.split('and').map(c => c.trim());

                                            for (const condition of conditions) {
                                                // Simple implementation of condition
                                                if (qualityDefinition.settings[condition]) {
                                                    const value = qualityDefinition.settings[condition].default_value;
                                                    if (!value) {
                                                        return null;
                                                    }
                                                }
                                            }
                                        }
                                        return (
                                            <tr key={key}>
                                                <td>{i18n._(label)}</td>
                                                { type === 'float' && (
                                                    <td>
                                                        <span>{i18n._(defaultValue)}</span>
                                                        <Space width="4" />
                                                        <span>{i18n._(unit)}</span>
                                                    </td>
                                                )}
                                                { type === 'enum' && (
                                                    <td>
                                                        <span>{i18n._(setting.options[defaultValue])}</span>
                                                        <Space width="4" />
                                                        <span>{i18n._(unit)}</span>
                                                    </td>
                                                )}
                                                { type === 'bool' && (
                                                    <td>
                                                        {defaultValue ? i18n._('Yes') : i18n._('No')}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </OptionalDropdown>
                </div>
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
        updateShowPrintingManager: (showPrintingManager) => dispatch(printingActions.updateShowPrintingManager(showPrintingManager))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Configurations);
