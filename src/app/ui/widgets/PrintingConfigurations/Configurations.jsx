import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import { cloneDeep, includes } from 'lodash';
import Select from '../../components/Select';
import Anchor from '../../components/Anchor';
import Modal from '../../components/Modal';
import i18n from '../../../lib/i18n';
import { actions as printingActions } from '../../../flux/printing';
import { actions as projectActions } from '../../../flux/project';
import { HEAD_3DP, PRINTING_MANAGER_TYPE_QUALITY, PRINTING_QUALITY_CONFIG_INDEX,
    PRINTING_QUALITY_CUSTOMIZE_FIELDS, PRINTING_QUALITY_CONFIG_GROUP } from '../../../constants';
import SettingItem from '../../views/ProfileManager/SettingItem';
import ConfigValueBox from '../../views/ProfileManager/ConfigValueBox';
import styles from './styles.styl';

const newKeys = cloneDeep(PRINTING_QUALITY_CONFIG_INDEX);
function isDefinitionEditable(key) {
    return !includes(cloneDeep(PRINTING_QUALITY_CUSTOMIZE_FIELDS), key);
}
function calculateTextIndex(key) {
    return `${newKeys[key] * 20}px`;
}

class Configurations extends PureComponent {
    static propTypes = {
        widgetActions: PropTypes.object.isRequired,
        defaultQualityId: PropTypes.string.isRequired,
        qualityDefinitions: PropTypes.array.isRequired,
        inProgress: PropTypes.bool.isRequired,

        updateDefinitionSettings: PropTypes.func.isRequired,
        updateDefinitionsForManager: PropTypes.func.isRequired,
        updateManagerDisplayType: PropTypes.func.isRequired,
        updateActiveDefinition: PropTypes.func.isRequired,
        updateShowPrintingManager: PropTypes.func.isRequired,
        updateDefaultQualityId: PropTypes.func.isRequired
    };

    state = {
        customConfigs: cloneDeep(PRINTING_QUALITY_CUSTOMIZE_FIELDS),
        showCustomConfigPannel: false,
        selectedDefinition: null
    };

    actions = {
        toggleShowCustomConfigPannel: () => {
            const { showCustomConfigPannel } = this.state;
            this.setState({
                showCustomConfigPannel: !showCustomConfigPannel
            });
        },
        closePannel: () => {
            this.setState({
                showCustomConfigPannel: false
            });
        },
        onChangeCustomConfig: (key, value) => {
            let { customConfigs } = this.state;
            if (value && !includes(customConfigs, key)) {
                customConfigs.push(key);
                customConfigs = [...customConfigs];
            } else if (!value) {
                customConfigs = customConfigs.filter((a) => a !== key);
            }
            this.setState({
                customConfigs
            });
        },
        onChangeDefinition: async (key, value) => {
            // const {} = this.state;
            const { selectedDefinition } = this.state;
            const newDefinitionForManager = cloneDeep(selectedDefinition);
            newDefinitionForManager.settings[key].default_value = value;

            const newDefinitionSettings = {};
            newDefinitionSettings[key] = { 'default_value': value };

            await this.props.updateDefinitionSettings(selectedDefinition, newDefinitionSettings);
            await this.props.updateDefinitionsForManager(selectedDefinition.definitionId, 'quality');
            this.setState({
                selectedDefinition: newDefinitionForManager
            });
        },
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
        const { qualityDefinitions, inProgress } = this.props;
        const state = this.state;
        const actions = this.actions;
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
                            actions.onSelectCustomDefinitionById(option.value);
                        }}
                        disabled={inProgress}
                    />
                </div>
                <Anchor
                    onClick={this.actions.onShowMaterialManager}
                    disabled={inProgress}
                >
                    <span
                        className={classNames(
                            styles['manager-icon'],
                        )}
                    />
                </Anchor>
                <div className="sm-parameter-container">
                    { state.customConfigs.map((key) => {
                        return (
                            <SettingItem
                                settings={qualityDefinition?.settings}
                                definitionKey={key}
                                key={key}
                                onChangeDefinition={actions.onChangeDefinition}
                            />
                        );
                    })}
                </div>
                <button
                    type="button"
                    className="sm-btn-large sm-btn-default"
                    onClick={actions.toggleShowCustomConfigPannel}
                >
                    {i18n._('Custom')}
                </button>
                {state.showCustomConfigPannel && (
                    <Modal
                        className={classNames(styles['manager-body'])}
                        style={{ minWidth: '700px' }}
                        onClose={actions.closePannel}
                    >
                        <Modal.Body>
                            <div className={classNames(styles['manager-type-wrapper'])}>
                                <div
                                    className={classNames(styles['manager-type'])}
                                >
                                    {i18n._('managerTitle')}
                                </div>
                            </div>

                            <div
                                className={classNames(styles['manager-content'])}
                            >
                                <ConfigValueBox
                                    calculateTextIndex={calculateTextIndex}
                                    customConfigs={state.customConfigs}
                                    definitionForManager={state.selectedDefinition}
                                    optionConfigGroup={PRINTING_QUALITY_CONFIG_GROUP}
                                    isDefinitionEditable={isDefinitionEditable}
                                    type="checkbox"
                                    onChangeDefinition={actions.onChangeCustomConfig}
                                />
                            </div>
                            <div style={{ float: 'right' }}>
                                <Anchor
                                    onClick={actions.closePannel}
                                    className="sm-btn-large sm-btn-default"
                                    style={{ marginRight: '11px' }}
                                >
                                    {i18n._('Close')}
                                </Anchor>
                            </div>
                        </Modal.Body>
                    </Modal>
                )}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const { qualityDefinitions, defaultQualityId, isRecommended, activeDefinition, inProgress } = state.printing;
    return {
        qualityDefinitions,
        defaultQualityId,
        isRecommended,
        activeDefinition,
        inProgress
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateDefaultQualityId: (qualityId) => dispatch(printingActions.updateDefaultQualityId(qualityId)),
        updateActiveDefinition: (definition) => {
            dispatch(printingActions.updateActiveDefinition(definition));
            dispatch(projectActions.autoSaveEnvironment(HEAD_3DP, true));
        },
        updateDefinitionsForManager: (definition, type) => dispatch(printingActions.updateDefinitionsForManager(definition, type)),
        updateDefinitionSettings: (definition, settings) => dispatch(printingActions.updateDefinitionSettings(definition, settings)),
        updateManagerDisplayType: (managerDisplayType) => dispatch(printingActions.updateManagerDisplayType(managerDisplayType)),
        updateShowPrintingManager: (showPrintingManager) => dispatch(printingActions.updateShowPrintingManager(showPrintingManager))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Configurations);
