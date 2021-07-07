import PropTypes from 'prop-types';
import isNil from 'lodash/isNil';
import classNames from 'classnames';
import React, { PureComponent } from 'react';
// import { components } from 'react-select';
import { Select, TreeSelect } from 'antd';
import styles from './styles.styl';

const { Option } = Select;
const { TreeNode } = TreeSelect;

class ChangedReactSelect extends PureComponent {
    static propTypes = {
        value: PropTypes.oneOfType([
            PropTypes.number,
            PropTypes.bool,
            PropTypes.string
        ]),
        disabled: PropTypes.bool,
        options: PropTypes.array.isRequired,
        size: PropTypes.string,
        className: PropTypes.string,
        // whether using 'GroupHeading' component
        isGroup: PropTypes.bool,
        onChange: PropTypes.func.isRequired,
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
            // console.log('option', value, option);
            this.props.onChange(option);
        },
        handleTreeChange: (option) => {
            this.props.onChange(option);
        }
    }

    render() {
        const {
            valueObj,
            value,
            options,
            size = 'middle',
            className,
            isGroup,
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
            const allTreeOptions = [];
            options.forEach((group) => {
                if (group.definitionId === 'new') {
                    allTreeOptions.push(group);
                } else {
                    allTreeOptions.push({ disabled: true, label: group.label });
                }
                group.options && group.options.forEach((item) => {
                    allTreeOptions.push(item);
                });
            });

            return (
                <div className={classNames(styles['override-select'], className)}>
                    <TreeSelect
                        className={styles[size]}
                        value={defaultValue}
                        onChange={this.actions.handleTreeChange}
                        disabled={disabled}
                    >
                        {(allTreeOptions.map((option) => {
                            return (
                                <TreeNode
                                    key={option.definitionId || option.label}
                                    disabled={!!option.disabled}
                                    value={option}
                                    title={option?.name || option.label}
                                />
                            );
                        }))}
                    </TreeSelect>
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
                        disabled={disabled}
                        dropdownStyle={{
                            width: '120%'
                        }}
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
