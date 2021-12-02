import PropTypes from 'prop-types';
import isNil from 'lodash/isNil';
import classNames from 'classnames';
import React, { PureComponent } from 'react';
// import { components } from 'react-select';
import { Select, TreeSelect } from 'antd';
import styles from './styles.styl';

const { Option } = Select;
const CustomValue = 'new';
// const { TreeNode } = TreeSelect;

class ChangedReactSelect extends PureComponent {
    static propTypes = {
        value: PropTypes.oneOfType([
            PropTypes.number,
            PropTypes.bool,
            PropTypes.string
        ]),
        showSearch: PropTypes.bool,
        disabled: PropTypes.bool,
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
        })
    };

    static defaultProps = {
        isGroup: false,
        disabled: false
    };

    actions = {
        handleChange: (value) => {
            const option = this.props.options.find(d => d.value === value);
            this.props.onChange && this.props.onChange(option);
        },
        handleTreeChange: (definitionId) => {
            let currentOption = {};
            console.log('handleTreeChange', definitionId, CustomValue);
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
                console.log('this.props.options', this.props.options);
                this.props.options.some((option) => {
                    if (option.definitionId === CustomValue) {
                        currentOption = option;
                        return true;
                    } else {
                        return false;
                    }
                });
            }
            // console.log('handleTreeChange', definitionId, this.props.options);
            this.props.onChange && this.props.onChange(currentOption);
        }
    }

    render() {
        const {
            valueObj,
            value,
            options,
            size = '100%',
            className,
            isGroup,
            showSearch = true,
            disabled = true
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
            const treeData = options.map((oldOption, index) => {
                const newOption = {};
                newOption.title = oldOption.label;
                newOption.value = oldOption.definitionId === 'new' ? oldOption.definitionId : oldOption.definitionId + index;
                if (oldOption.definitionId !== CustomValue) {
                    newOption.disabled = true;
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
                        className={styles[size]}
                        showSearch
                        style={{ width: size }}
                        value={defaultValue?.definitionId}
                        treeData={treeData}
                        onChange={(option) => this.actions.handleTreeChange(option)}
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
                        className={styles[size]}
                        value={defaultValue?.value}
                        showSearch={showSearch}
                        optionFilterProp="children"
                        style={{ width: size }}
                        disabled={disabled}
                        onChange={this.actions.handleChange}
                    >
                        {(options.map((option) => {
                            return (<Option key={option.value + option.label} value={option.value}>{option.label}</Option>);
                        }))}
                    </Select>
                </div>
            );
        }
    }
}


export default ChangedReactSelect;
