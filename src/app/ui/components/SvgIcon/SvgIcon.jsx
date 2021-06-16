import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import * as Icons from 'snapmaker-react-icon';
import Anchor from '../Anchor';

class SvgIcon extends PureComponent {
    static propTypes = {
        name: PropTypes.string.isRequired,
        className: PropTypes.string,
        title: PropTypes.string,
        onClick: PropTypes.func,
        disabled: PropTypes.bool,
        isHorizontal: PropTypes.bool,
        color: PropTypes.string,
        spanText: PropTypes.string,
        spanClassName: PropTypes.string,
        size: PropTypes.number,
        inputInfo: PropTypes.object
    };

    static defaultProps = {
        isHorizontal: true
    }

    state = {
        isHovered: false
    }

    actions = {
        handleMouseOver: () => {
            this.setState({
                isHovered: true
            });
        },
        handleMouseOut: () => {
            this.setState({
                isHovered: false
            });
        }
    };

    render() {
        const { isHovered } = this.state;
        const {
            className,
            title,
            name,
            disabled,
            onClick,
            spanText,
            spanClassName,
            color,
            isHorizontal,
            inputInfo,
            ...props
        } = this.props;
        const Component = Icons[name];
        if (!Component) {
            console.error(`Can't find the icon named '${name}', please check your icon name`);
        }

        return (
            <span>
                { inputInfo !== undefined && (
                    <input
                        ref={inputInfo.fileInput}
                        type="file"
                        accept={inputInfo.accept}
                        style={{ display: 'none' }}
                        multiple={false}
                        onChange={inputInfo.onChange}
                    />
                )}
                <Anchor
                    className={className}
                    title={title}
                    disabled={disabled}
                    onClick={onClick}
                    onFocus={() => 0}
                    onBlur={() => 0}
                    onMouseEnter={this.actions.handleMouseOver}
                    onMouseLeave={this.actions.handleMouseOut}
                >
                    {Component && (
                        <Component
                            {...props}
                            disabled={disabled}
                            color={isHovered ? '#272829' : color}
                        />
                    )}
                    { spanText && isHorizontal && (
                        <span className={spanClassName}>
                            {spanText}
                        </span>
                    )}
                    { spanText && !isHorizontal && (
                        <div className={spanClassName}>
                            {spanText}
                        </div>
                    )}
                </Anchor>
            </span>
        );
    }
}


export default SvgIcon;
