import PropTypes from 'prop-types';
import isNil from 'lodash/isNil';
import React, { PureComponent } from 'react';
import Select, { components } from 'react-select';

const groupStyles = {
    color: '#979899',
    padding: '0px 0px',
    display: 'flex'
};
const defaultStyles = {
    option: (provided, state) => {
        if (state.data && state.data.definitionId === 'new') {
            return {
                ...provided,
                borderTop: '1px solid #C5C5C5',
                textIndent: '8px',
                paddingRight: '0',
                marginBottom: '8px',
                height: 'auto'
            };
        } else {
            return {
                ...provided,
                textIndent: '8px',
                paddingRight: '0',
                height: 30,
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden'
            };
        }
    },
    singleValue: (provided, state) => {
        const opacity = state.isDisabled ? 0.5 : 1;
        const transition = 'opacity 300ms';
        const color = state.isDisabled ? '#000' : '#282828';

        return { ...provided, opacity, transition, color };
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
    input: (provided,) => {
        return { ...provided, lineHeight: '20px' };
    },
    menu: (provided) => {
        return { ...provided, marginTop: '0', marginBottom: '0', zIndex: '10' };
    },
    control: (provided, state) => {
        const backgroundColor = state.isDisabled ? '#eee' : '#fff';

        return {
            // const backgroundColor = '#ccc';
            // none of react-select's styles are passed to <Control />
            height: 30,
            alignItems: 'center',
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
            boxSizing: 'border-box',
            backgroundColor
        };
    }
};
const stylesWithGroup = {
    ...defaultStyles,
    menuList: (provided) => {
        return { ...provided, marginTop: '0', marginBottom: '0', paddingTop: '0', paddingBottom: '0', lineHeight: '20px' };
    }
};
const stylesWithoutGroup = {
    ...defaultStyles,
    menuList: (provided) => {
        return { ...provided, marginTop: '8px', marginBottom: '8px', paddingTop: '0', paddingBottom: '0', lineHeight: '20px' };
    }
};

// const Option = (props) => (
//     <components.Option {...props} />
// );
// const Input = (props) => (
//     <components.Input {...props} />
// );


const GroupHeading = props => (
    <div style={groupStyles}>
        <components.GroupHeading {...props} />
    </div>
);


class ChangedReactSelect extends PureComponent {
    static propTypes = {
        value: PropTypes.oneOfType([
            PropTypes.number,
            PropTypes.bool,
            PropTypes.string
        ]),
        disabled: PropTypes.bool,
        options: PropTypes.array.isRequired,
        // whether using 'GroupHeading' component
        isGroup: PropTypes.bool,
        componentsCovered: PropTypes.object,
        // to calculate the 'defaultValue' for the react-select component
        valueObj: PropTypes.shape({
            firstKey: PropTypes.string,
            firstValue: PropTypes.oneOfType([
                PropTypes.number,
                PropTypes.bool,
                PropTypes.string
            ])
            // secondKey: PropTypes.string,
            // secondValue: PropTypes.oneOfType([
            //     PropTypes.number,
            //     PropTypes.bool,
            //     PropTypes.string
            // ])
        })
    };

    static defaultProps = {
        isGroup: false
    };

    render() {
        const {
            valueObj,
            value,
            options,
            isGroup,
            disabled,
            componentsCovered,
            ...props
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
                isDisabled={disabled}
                styles={isGroup ? stylesWithGroup : stylesWithoutGroup}
                components={componentsCovered || GroupHeading}
                value={defaultValue}
                defaultValue={defaultValue}
            />
        );
    }
}

export default ChangedReactSelect;
