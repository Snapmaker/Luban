import React, { useEffect, useState } from 'react';

import Select from '../../components/Select';

interface FilterNode {
    name: string;
    value: string;
    filters?: FilterNode[]; // sub-filters
}


type Props = {
    disabled?: boolean,
    filters: FilterNode[];
    filterValues: string[];
    onChangeFilterValues?: (index, value) => void,
};


/**
 * A bar that shows parameter filters.
 *
 * For simplicity, we only support 2 levels of options.
 *
 * Note that the component has 0 padding itself.
 *
 * @constructor
 */
const ParameterFiltersBar: React.FC<Props> = (props) => {
    const { disabled = false, filters, filterValues, onChangeFilterValues } = props;

    const [options, setOptions] = useState([]);
    const [subOptions, setSubOptions] = useState([]);

    useEffect(() => {
        const newOptions = [];
        for (const filterNode of filters) {
            const option = {
                value: filterNode.value,
                label: filterNode.name,
            };
            newOptions.push(option);
        }
        setOptions(newOptions);

        if (filterValues.length > 0) {
            const v0 = filterValues[0];
            const f0 = filters.find(filter => filter.value === v0);
            if (f0 && f0.filters) {
                const newSubOptions = [];
                for (const filterNode of f0.filters) {
                    const option = {
                        value: filterNode.value,
                        label: filterNode.name,
                    };
                    newSubOptions.push(option);
                }
                setSubOptions(newSubOptions);
            } else {
                setSubOptions([]);
            }
        }
    }, [filters, filterValues]);

    function onChangeOptionValue(option) {
        onChangeFilterValues && onChangeFilterValues(0, option.value);
    }

    function onChangeSubOptionValue(option) {
        onChangeFilterValues && onChangeFilterValues(1, option.value);
    }

    return (
        <div className="sm-flex">
            {/* first level filter */
                filterValues.length > 0 && (
                    <Select
                        clearable={false}
                        showSearch={false}
                        bordered
                        disabled={disabled}
                        size="large"
                        className="margin-right-8"
                        options={options}
                        value={filterValues[0]}
                        onChange={onChangeOptionValue}
                    />
                )
            }
            {/* second level filter */
                filterValues.length > 1 && subOptions.length > 0 && (
                    <Select
                        clearable={false}
                        showSearch={false}
                        bordered
                        disabled={disabled}
                        size="large"
                        options={subOptions}
                        value={filterValues[1]}
                        onChange={onChangeSubOptionValue}
                    />
                )
            }
        </div>
    );
};

export default ParameterFiltersBar;
