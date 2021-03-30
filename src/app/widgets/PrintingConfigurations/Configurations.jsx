import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import Select from '../../components/Select';
import Anchor from '../../components/Anchor';
import OptionalDropdown from '../../components/OptionalDropdown';
import i18n from '../../lib/i18n';
import widgetStyles from '../styles.styl';
import { actions as printingActions } from '../../flux/printing';
import { actions as projectActions } from '../../flux/project';
import { HEAD_3DP, PRINTING_MANAGER_TYPE_QUALITY } from '../../constants';

import styles from './styles.styl';

const OFFICIAL_CONFIG_KEYS = [
    'layer_height',
    'top_thickness',
    'infill_sparse_density',
    'speed_infill',
    'speed_wall_0',
    'speed_wall_x',
    'speed_travel'
];

class Configurations extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,
        defaultQualityId: PropTypes.string.isRequired,
        qualityDefinitions: PropTypes.array.isRequired,

        updateManagerDisplayType: PropTypes.func.isRequired,
        // updateDefinitionsForManager: PropTypes.func.isRequired,
        // updateDefinitionSettings: PropTypes.func.isRequired,
        updateActiveDefinition: PropTypes.func.isRequired,
        updateShowPrintingManager: PropTypes.func.isRequired,
        // updateIsRecommended: PropTypes.func.isRequired,
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
                <div className="sm-tabs" style={{ marginBottom: '12px' }}>
                    <div style={{
                        marginBottom: '10px'
                    }}
                    >
                        <div className={classNames(widgetStyles.separator, widgetStyles['separator-underline'])} />
                    </div>
                </div>
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
