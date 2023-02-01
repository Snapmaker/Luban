import PropTypes from 'prop-types';
import { isNil, difference } from 'lodash';
import classNames from 'classnames';
import React, { PureComponent } from 'react';
import { Select, TreeSelect } from 'antd';
import styles from './styles.styl';
import i18n from '../../../lib/i18n';

const { Option } = Select;
const CustomValue = 'new';
const PARENT_ID = 'parent';

class ChangedReactSelect extends PureComponent {
    static propTypes = {
        value: PropTypes.oneOfType([
            PropTypes.number,
            PropTypes.bool,
            PropTypes.string
        ]),
        showSearch: PropTypes.bool,
        disabled: PropTypes.bool,
        bordered: PropTypes.bool,
        options: PropTypes.array.isRequired,
        size: PropTypes.string,
        className: PropTypes.string,
        // whether using 'GroupHeading' component
        isGroup: PropTypes.bool,
        onChange: PropTypes.func,
        // to calculate the 'defaultValue' for the react-select component
        valueObj: PropTypes.shape({
            firstKey: PropTypes.string,
            firstValue: PropTypes.oneOfType([
                PropTypes.number,
                PropTypes.bool,
                PropTypes.string
            ])
        }),
        dropdownRender: PropTypes.func,
        placement: PropTypes.string,
        dropdownStyle: PropTypes.object
    };

    static defaultProps = {
        isGroup: false,
        disabled: false
    };

    state = {
        expandedKeys: []
    };

    actions = {
        onDropdownVisibleChange: (open) => {
            if (open) {
                let newExpandedKeys = this.state.expandedKeys;
                this.props.options.some((oldOption) => {
                    if (oldOption.definitionId !== CustomValue) {
                        return oldOption.options.some((child) => {
                            if (child.definitionId === this.props.valueObj.firstValue) {
                                newExpandedKeys = [PARENT_ID + oldOption.definitionId];
                                return true;
                            }
                            return false;
                        });
                    }
                    return false;
                });
                if (newExpandedKeys !== this.state.expandedKeys) {
                    this.setState({
                        expandedKeys: newExpandedKeys
                    });
                }
            }
        },
        onTreeExpand: (newExpandedKeys) => {
            this.setState({
                expandedKeys: difference(newExpandedKeys, this.state.expandedKeys)
            });
        },
        handleChange: (value) => {
            const option = this.props.options.find(d => d.value === value);
            this.props.onChange && this.props.onChange(option);
        },
        handleTreeChange: (definitionId) => {
            if (definitionId.slice(0, 1) === '0') {
                if (this.state.expandedKeys.length === 1 && definitionId === this.state.expandedKeys[0]) {
                    this.setState({
                        expandedKeys: []
                    });
                } else {
                    this.setState({
                        expandedKeys: [definitionId]
                    });
                }
            } else {
                let currentOption = {};
                // 0tool.28575028
                if (definitionId !== CustomValue) {
                    this.props.options.some((option) => {
                        return option.options.some((item) => {
                            if (item.definitionId === definitionId) {
                                currentOption = item;
                                return true;
                            } else {
                                return false;
                            }
                        });
                    });
                } else {
                    this.props.options.some((option) => {
                        if (option.definitionId === CustomValue) {
                            currentOption = option;
                            return true;
                        } else {
                            return false;
                        }
                    });
                }
                this.props.onChange && this.props.onChange(currentOption);
            }
        }
    };

    render() {
        const {
            valueObj,
            value,
            options,
            size = '100%',
            className,
            isGroup,
            showSearch = true,
            disabled = true,
            bordered = true
        } = this.props;
        let defaultValue = {};
        if (isGroup) {
            const {
                firstKey = '',
                firstValue = ''
            } = valueObj;
            if (!isNil(firstValue) && !isNil(firstKey)) {
                options.forEach((group) => {
                    if (group.options && group.options.find(d => d[firstKey] === firstValue)) {
                        defaultValue = group.options.find(d => d[firstKey] === firstValue);
                    }
                });
            }
            const treeData = options.map((oldOption) => {
                const newOption = {};
                newOption.title = oldOption.label;
                newOption.value = oldOption.definitionId === 'new' ? oldOption.definitionId : PARENT_ID + oldOption.definitionId;
                if (oldOption.definitionId !== CustomValue) {
                    // newOption.disabled = true;
                    newOption.selectable = false;
                    newOption.children = oldOption.options.map((child) => {
                        child.value = child.definitionId;
                        child.title = child?.name;
                        child.disabled = false;
                        return child;
                    });
                } else {
                    newOption.disabled = false;
                }

                return newOption;
            });

            return (
                <div className={classNames(styles['override-select'], className)} style={{ width: size }}>
                    <TreeSelect
                        onTreeExpand={this.actions.onTreeExpand}
                        showSearch
                        className={classNames(
                            styles[size]
                        )}
                        onDropdownVisibleChange={this.actions.onDropdownVisibleChange}
                        treeExpandedKeys={this.state.expandedKeys}
                        value={defaultValue?.definitionId}
                        treeData={treeData}
                        onChange={(option) => this.actions.handleTreeChange(option)}
                        bordered={bordered}
                    />
                </div>
            );
        } else {
            // Compatible with old interfaces
            if (!isNil(value)) {
                defaultValue = options.find(d => d.value === value);
            } else if (!isNil(valueObj)) {
                const {
                    firstKey = 'value',
                    firstValue = ''
                } = valueObj;
                defaultValue = options.find(d => d[firstKey] === firstValue);
            }
            return (
                <div className={classNames(styles['override-select'], className)}>
                    <Select
                        dropdownRender={this.props.dropdownRender}
                        dropdownStyle={this.props.dropdownStyle}
                        className={classNames(
                            styles[size]
                        )}
                        value={defaultValue?.value}
                        showSearch={showSearch}
                        optionFilterProp="children"
                        style={{ width: size }}
                        disabled={disabled}
                        onChange={this.actions.handleChange}
                        bordered={bordered}
                        placement={this.props.placement}
                    >
                        {(options.map((option) => {
                            return (<Option key={option.value + option.label} value={option.value}>{i18n._(option.label)}</Option>);
                        }))}
                    </Select>
                </div>
            );
        }
    }
}


export default ChangedReactSelect;
