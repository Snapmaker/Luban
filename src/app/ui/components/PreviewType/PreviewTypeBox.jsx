import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Checkbox from '../Checkbox';
import SvgIcon from '../SvgIcon';

class PreviewTypeBox extends PureComponent {
    static propTypes = {
        fatherContent: PropTypes.string.isRequired,
        fatherColor: PropTypes.string,

        isDropdown: PropTypes.bool,

        // object: {
        // value, content, color, onChangeValue
        // }
        childrenObjects: PropTypes.array
    };

    state = {
        showDropdown: false,
        fatherValue: false,
        indeterminate: false
    };

    renderFatherObject() {
        let count = 0;
        this.props.childrenObjects.forEach((child) => {
            if (child.value) {
                count += 1;
            }
        });
        if (count === this.props.childrenObjects.length) {
            this.setState({
                fatherValue: true,
                indeterminate: false
            });
        } else if (count === 0) {
            this.setState({
                fatherValue: false,
                indeterminate: false
            });
        } else {
            this.setState({
                fatherValue: false,
                indeterminate: true
            });
        }
    }

    componentDidMount() {
        this.renderFatherObject();
    }

    componentDidUpdate(prevProps) {
        if (prevProps.childrenObjects !== this.props.childrenObjects) {
            this.renderFatherObject();
        }
    }

    onChangeFatherValue = (event) => {
        this.props.childrenObjects.forEach((child) => {
            child.onChangeValue(event);
        });
    };

    render() {
        const { fatherContent, fatherColor, isDropdown, childrenObjects } = this.props;
        const { showDropdown, indeterminate, fatherValue } = this.state;
        const { onChangeFatherValue } = this;
        return (
            <div>
                <div
                    className="sm-flex justify-space-between height-24 margin-vertical-8 padding-right-16 align-center"
                >
                    <div>
                        {isDropdown && (
                            <SvgIcon
                                className="margin-left-n-8"
                                name={showDropdown ? 'DropdownOpen' : 'DropdownClose'}
                                size={24}
                                type={['static']}
                                onClick={() => {
                                    this.setState({
                                        showDropdown: !showDropdown
                                    });
                                }}
                            />
                        )}
                        <Checkbox
                            indeterminate={indeterminate}
                            checked={fatherValue}
                            onChange={(event) => {
                                onChangeFatherValue(event);
                            }}
                        />
                        <span className="v-align-m margin-left-8 max-width-106 margin-right-4 text-overflow-ellipsis">
                            {fatherContent}
                        </span>
                    </div>
                    {fatherColor && (
                        <div>
                            <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: fatherColor }} />
                        </div>
                    )}
                </div>
                {showDropdown && (childrenObjects.map((child) => {
                    const { value, onChangeValue, color, content } = child;
                    return (
                        <div key={content} className="sm-flex justify-space-between height-24 margin-vertical-8 margin-left-32 padding-right-16">
                            <div>
                                <Checkbox
                                    checked={value}
                                    onChange={(event) => {
                                        onChangeValue(event);
                                    }}
                                />
                                <span className="v-align-m margin-left-8">
                                    {content}
                                </span>
                            </div>
                            {color && (
                                <div>
                                    <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: color }} />
                                </div>
                            )}
                        </div>
                    );
                }))}
            </div>
        );
    }
}

export default PreviewTypeBox;
