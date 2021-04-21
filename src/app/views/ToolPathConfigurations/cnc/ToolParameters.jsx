import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import _ from 'lodash';
import { connect } from 'react-redux';
import classNames from 'classnames';
import Select from '../../../components/Select';
import i18n from '../../../lib/i18n';
import Anchor from '../../../components/Anchor';
import styles from '../styles.styl';
import { actions as cncActions } from '../../../flux/cnc';
import TipTrigger from '../../../components/TipTrigger';
import { NumberInput as Input } from '../../../components/Input';
import { TOOLPATH_TYPE_VECTOR } from '../../../constants';
// import { limitStringLength } from '../../../lib/normalize-range';

class ToolParameters extends PureComponent {
    static propTypes = {
        toolDefinitions: PropTypes.array.isRequired,
        activeToolDefinition: PropTypes.object.isRequired,
        toolPath: PropTypes.object.isRequired,
        isModifiedDefinition: PropTypes.bool.isRequired,
        updateToolConfig: PropTypes.func.isRequired,
        setCurrentValueAsProfile: PropTypes.func.isRequired,

        changeActiveToolListDefinition: PropTypes.func.isRequired,
        updateShowCncToolManager: PropTypes.func.isRequired
    };

    state = {
        selectedTool: {
            definitionId: '',
            name: ''
        }
    };

    actions = {
        onShowCncToolManager: () => {
            this.props.updateShowCncToolManager(true);
        },
        onChangeActiveToolListValue: async (option) => {
            if (option.definitionId === 'new') {
                await this.actions.onShowCncToolManager();
                this.props.setCurrentValueAsProfile();
            } else {
                const definitionId = option.definitionId;
                const name = option.name;
                this.props.changeActiveToolListDefinition(definitionId, name);
            }
        }
    };

    componentDidMount() {
        const { toolPath, activeToolDefinition } = this.props;
        const selectedTool = {
            definitionId: toolPath.toolParams.definitionId ?? activeToolDefinition.definitionId,
            name: toolPath.toolParams.definitionName ?? activeToolDefinition.name
        };
        this.setState({
            selectedTool
        });
    }

    componentWillReceiveProps(nextProps) {
        const { selectedTool } = this.state;
        if (nextProps.activeToolDefinition.definitionId !== this.props.activeToolDefinition.definitionId) {
            selectedTool.definitionId = nextProps.activeToolDefinition.definitionId;
        }
        if (nextProps.activeToolDefinition.name !== this.props.activeToolDefinition.name) {
            selectedTool.name = nextProps.activeToolDefinition.name;
        }
        this.setState({
            selectedTool
        });
    }

    render() {
        const { toolDefinitions, activeToolDefinition, toolPath, isModifiedDefinition } = this.props;
        const { type } = toolPath;
        const isSVG = type === TOOLPATH_TYPE_VECTOR;

        const toolDefinitionOptions = [];
        toolDefinitions.forEach(d => {
            const category = d.category;
            const definitionId = d.definitionId;
            const groupOptions = {
                label: category,
                definitionId: definitionId,
                options: d.toolList.map((item) => {
                    const checkboxAndSelectGroup = {};
                    const name = item.name;
                    let detailName = '';
                    if (item.config.angle.default_value !== '180') {
                        detailName = `${item.name} (${item.config.angle.default_value}${item.config.angle.unit} ${item.config.shaft_diameter.default_value}${item.config.shaft_diameter.unit} )`;
                    } else {
                        detailName = `${item.name} (${item.config.shaft_diameter.default_value}${item.config.shaft_diameter.unit} )`;
                    }
                    checkboxAndSelectGroup.name = name;
                    checkboxAndSelectGroup.definitionId = definitionId;
                    checkboxAndSelectGroup.label = `${detailName}`;
                    checkboxAndSelectGroup.value = `${definitionId}-${name}`;
                    return checkboxAndSelectGroup;
                })
            };
            toolDefinitionOptions.push(groupOptions);
        });
        const foundDefinition = toolDefinitionOptions.find(d => d.definitionId === (this.state.selectedTool.definitionId));

        console.log('state', this.state.selectedTool);
        const valueObj = {
            firstKey: 'definitionId',
            firstValue: this.state.selectedTool.definitionId,
            secondKey: 'name',
            secondValue: this.state.selectedTool.name
        };
        if (isModifiedDefinition) {
            toolDefinitionOptions.push({
                name: 'modified',
                definitionId: 'new',
                label: 'Create profile with current parameters',
                value: 'new-modified'
            });
        }
        return (
            <div>
                <React.Fragment>
                    <div className="sm-parameter-container">
                        <div
                            className={classNames(
                                styles['manager-wrapper']
                            )}
                        >
                            <span className={classNames(
                                'sm-parameter-row__label',
                                styles['manager-select-name'],
                            )}
                            >
                                {i18n._('Tool')}
                            </span>
                            {(isModifiedDefinition
                                && (
                                    <span
                                        className={classNames(
                                            styles['manager-is-modified']
                                        )}
                                    />
                                )
                            )}
                            <Select
                                className={classNames(
                                    styles['manager-select'],
                                    'sm-parameter-row__select'
                                )}
                                clearable={false}
                                isGroup
                                valueObj={valueObj}
                                options={toolDefinitionOptions}
                                placeholder={i18n._('Choose profile')}
                                onChange={this.actions.onChangeActiveToolListValue}
                            />
                            <p className={classNames(
                                styles['manager-detail'],
                            )}
                            >
                                {foundDefinition && `${i18n._('Material')} : ${foundDefinition.label}`}
                            </p>
                            <Anchor
                                onClick={this.actions.onShowCncToolManager}
                            >
                                <span
                                    className={classNames(
                                        styles['manager-icon'],
                                    )}
                                />
                            </Anchor>
                        </div>

                        {(Object.keys(activeToolDefinition.config).map(key => {
                            const setting = activeToolDefinition.config[key];
                            const defaultValue = setting.default_value;
                            const label = setting.label;
                            const unit = setting.unit;
                            const min = setting.min || 0;
                            const max = setting.max || 6000;
                            const content = setting.description || '';

                            const isToolParams = (k) => {
                                return _.includes(['angle', 'shaft_diameter', 'diameter'], k);
                            };

                            if (key === 'density' && isSVG) {
                                return null;
                            }

                            return (
                                <div key={key} className="sm-parameter-row">
                                    <TipTrigger
                                        title={i18n._(label)}
                                        content={i18n._(content)}
                                    >
                                        <span className="sm-parameter-row__label-lg">{i18n._(label)}</span>
                                        <Input
                                            className="sm-parameter-row__input"
                                            value={defaultValue}
                                            min={min}
                                            max={max}
                                            style={{ width: '160px' }}
                                            onChange={value => {
                                                this.props.updateToolConfig(key, value);
                                            }}
                                            disabled={isToolParams(key)}
                                        />
                                        <span className="sm-parameter-row__input-unit">{unit}</span>
                                    </TipTrigger>
                                </div>
                            );
                        }))}

                    </div>
                </React.Fragment>
            </div>
        );
    }
}

const mapDispatchToProps = (dispatch) => {
    return {
        changeActiveToolListDefinition: (definitionId, name) => dispatch(cncActions.changeActiveToolListDefinition(definitionId, name)),
        updateShowCncToolManager: (showCncToolManager) => dispatch(cncActions.updateShowCncToolManager(showCncToolManager))
    };
};

export default connect(null, mapDispatchToProps)(ToolParameters);
