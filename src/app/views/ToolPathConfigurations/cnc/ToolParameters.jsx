import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';
import _ from 'lodash';
import { connect } from 'react-redux';
import classNames from 'classnames';
import i18n from '../../../lib/i18n';
import Anchor from '../../../components/Anchor';
import styles from '../styles.styl';
import { actions as cncActions } from '../../../flux/cnc';
import TipTrigger from '../../../components/TipTrigger';
import { NumberInput as Input } from '../../../components/Input';
import { TOOLPATH_TYPE_VECTOR } from '../../../constants';
import { limitStringLength } from '../../../lib/normalize-range';

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

    actions = {
        onShowCncToolManager: () => {
            this.props.updateShowCncToolManager(true);
        },
        onChangeActiveToolListValue: (option) => {
            if (option.definitionId === 'new') {
                this.actions.onShowCncToolManager();
                this.props.setCurrentValueAsProfile();
            } else {
                const definitionId = option.definitionId;
                const name = option.name;
                this.props.changeActiveToolListDefinition(definitionId, name);
            }
        }
    };

    render() {
        const { toolDefinitions, activeToolDefinition, toolPath, isModifiedDefinition } = this.props;
        const { type } = toolPath;
        const isSVG = type === TOOLPATH_TYPE_VECTOR;

        const toolDefinitionOptions = [];
        toolDefinitions.forEach(d => {
            const category = d.category;
            const definitionId = d.definitionId;
            toolDefinitionOptions.push(...d.toolList.map((item) => {
                const checkboxAndSelectGroup = {};
                const name = item.name;
                checkboxAndSelectGroup.name = name;
                checkboxAndSelectGroup.definitionId = definitionId;
                checkboxAndSelectGroup.label = limitStringLength(`${category} - ${name}`, 24);
                checkboxAndSelectGroup.value = `${definitionId}-${name}`;
                return checkboxAndSelectGroup;
            }));
        });
        console.log('toolDefinitionOptions', toolDefinitionOptions);
        if (isModifiedDefinition) {
            toolDefinitionOptions.push({
                name: '以当前设置创建配置文件',
                definitionId: 'new',
                label: '以当前设置创建配置文件',
                value: 'new-以当前设置创建配置文件'
            });
        }

        return (
            <div>
                <React.Fragment>
                    <div className="sm-parameter-container">
                        <div
                            style={{ position: 'relative' }}
                        >
                            <span className={classNames(
                                'sm-parameter-row__label',
                                styles['manager-select-name'],
                            )}
                            >
                                {i18n._('Material & Tool')}
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
                                    'sm-parameter-row__select-lg'
                                )}
                                style={{ width: '248px' }}
                                clearable={false}
                                options={toolDefinitionOptions}
                                placeholder={i18n._('Choose carving path')}
                                value={`${activeToolDefinition.definitionId}-${activeToolDefinition.name}`}
                                onChange={this.actions.onChangeActiveToolListValue}
                            />
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
