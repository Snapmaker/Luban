import PropTypes from 'prop-types';
import { isNil, difference } from 'lodash';
import classNames from 'classnames';
import React, { useState } from 'react';
// import { components } from 'react-select';
import { Select, TreeSelect } from 'antd';
import styles from './styles.styl';

const { Option } = Select;
const CustomValue = 'new';
const PARENT_ID = 'parent';

const ChangedReactSelect = React.forwardRef(({ value, showSearch = false, disabled = false, options, size = '100%', className, isGroup, onChange, valueObj, dropdownRender }, ref) => {
    const [expandedKeys, setExpandedKeys] = useState([]);

    const actions = {
        onDropdownVisibleChange: (open) => {
            if (open) {
                let newExpandedKeys = expandedKeys;
                options.some((oldOption) => {
                    if (oldOption.definitionId !== CustomValue) {
                        return oldOption.options.some((child) => {
                            if (child.definitionId === valueObj.firstValue) {
                                newExpandedKeys = [PARENT_ID + oldOption.definitionId];
                                return true;
                            }
                            return false;
                        });
                    }
                    return false;
                });
                if (newExpandedKeys !== expandedKeys) {
                    setExpandedKeys(newExpandedKeys);
                }
            }
        },
        onTreeExpand: (newExpandedKeys) => {
            setExpandedKeys(difference(newExpandedKeys, expandedKeys));
        },
        handleChange: (_value) => {
            const option = options.find(d => d.value === _value);
            onChange && onChange(option);
        },
        handleTreeChange: (definitionId) => {
            if (definitionId.slice(0, 1) === '0') {
                if (expandedKeys.length === 1 && definitionId === expandedKeys[0]) {
                    setExpandedKeys([]);
                } else {
                    setExpandedKeys([definitionId]);
                }
            } else {
                let currentOption = {};
                // 0tool.28575028
                if (definitionId !== CustomValue) {
                    options.some((option) => {
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
                    options.some((option) => {
                        if (option.definitionId === CustomValue) {
                            currentOption = option;
                            return true;
                        } else {
                            return false;
                        }
                    });
                }
                onChange && onChange(currentOption);
            }
        }
    };

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
                    className={styles[size]}
                    onTreeExpand={actions.onTreeExpand}
                    showSearch
                    style={{ width: size }}
                    onDropdownVisibleChange={actions.onDropdownVisibleChange}
                    treeExpandedKeys={expandedKeys}
                    value={defaultValue?.definitionId}
                    treeData={treeData}
                    onChange={(option) => actions.handleTreeChange(option)}
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
                    dropdownRender={dropdownRender}
                    getPopupContainer={() => ref?.current || document.querySelector('body')}
                    className={styles[size]}
                    value={defaultValue?.value}
                    showSearch={showSearch}
                    optionFilterProp="children"
                    style={{ width: size }}
                    disabled={disabled}
                    onChange={actions.handleChange}
                >
                    {(options.map((option) => {
                        return (<Option key={option.value + option.label} value={option.value}>{option.label}</Option>);
                    }))}
                </Select>
            </div>
        );
    }
});

ChangedReactSelect.propTypes = {
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
    }),
    dropdownRender: PropTypes.func
};

export default ChangedReactSelect;
