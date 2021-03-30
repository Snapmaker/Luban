import PropTypes from 'prop-types';
import isNil from 'lodash/isNil';
import React, { PureComponent } from 'react';
import Select, { components } from 'react-select';

const groupStyles = {
    color: '#979899',
    padding: '0px 0px',
    display: 'flex'
};

const customStyles = {
    option: (provided, state) => {
        if (state.data && state.data.definitionId === 'new') {
            return {
                ...provided,
                borderTop: '1px solid #C5C5C5',
                textIndent: '8px',
                height: 'auto'
            };
        } else {
            return {
                ...provided,
                textIndent: '8px',
                height: 30
            };
        }
    },
    singleValue: (provided, state) => {
        const opacity = state.isDisabled ? 0.5 : 1;
        const transition = 'opacity 300ms';

        return { ...provided, opacity, transition };
    },
    dropdownIndicator: (provided) => {
        return {
            ...provided,
            paddingTop: 0,
            paddingBottom: 0,
            paddingLeft: 5,
            paddingRight: 5
        };
    },
    valueContainer: (provided) => {
        return { ...provided, padding: '0px 8px' };
    },
    menuList: (provided) => {
        return { ...provided, marginTop: '0', marginBottom: '0', paddingTop: '0', paddingBottom: '0' };
    },
    menu: (provided) => {
        return { ...provided, marginTop: '0', marginBottom: '0' };
    },
    control: () => ({
        // none of react-select's styles are passed to <Control />
        height: 30,
        alignItems: 'center',
        backgroundColor: 'hsl(0,0%,100%)',
        borderColor: 'hsl(0,0%,80%)',
        borderRadius: '4px',
        borderStyle: 'solid',
        borderWidth: '1px',
        cursor: 'default',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        outline: '0 !important',
        position: 'relative',
        transition: 'all 100ms',
        boxSizing: 'border-box'
    })
};


const GroupHeading = props => (
    <div style={groupStyles}>
        <components.GroupHeading {...props} />
    </div>
);


class ChangedReactSelect extends PureComponent {
    static propTypes = {
        value: PropTypes.string,
        options: PropTypes.array.isRequired,
        // whether using 'GroupHeading' component
        isGroup: PropTypes.bool,
        // to calculate the 'defaultValue' for the react-select component
        valueObj: PropTypes.shape({
            firstKey: PropTypes.string,
            firstValue: PropTypes.oneOfType([
                PropTypes.number,
                PropTypes.bool,
                PropTypes.string
            ]),
            secondKey: PropTypes.string,
            secondValue: PropTypes.oneOfType([
                PropTypes.number,
                PropTypes.bool,
                PropTypes.string
            ])
        })
    };

    static defaultProps = {
        isGroup: false
    };

    actions = {
    };

    render() {
        const {
            valueObj,
            value,
            options,
            isGroup,
            ...props
        } = this.props;
        let defaultValue = {};
        if (isGroup) {
            const {
                firstKey = '',
                firstValue = '',
                secondKey = '',
                secondValue = ''
            } = valueObj;
            if (!isNil(firstValue) && !isNil(secondValue)) {
                defaultValue = options
                    .find(d => d[firstKey] === firstValue)
                    .options.find(d => d[secondKey] === secondValue);
            }
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
        }

        return (
            <Select
                {...props}
                options={options}
                styles={customStyles}
                components={{ GroupHeading }}
                defaultValue={defaultValue}
            />
        );
    }
}

export default ChangedReactSelect;
