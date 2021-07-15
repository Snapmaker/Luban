import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import * as Icons from 'snapmaker-react-icon';
import classNames from 'classnames';
import includes from 'lodash/includes';
import { noop } from 'lodash';

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
        inputInfo: PropTypes.object,
        /** type value:
         * 1. hoverNormal: isHovered background: #EEEFF0, color: the same as this.props.color;
         * 2. hoverNoBackground: isHovered background: transparent, color: #2A2C2E;
         * 3. pressNormal: isPressed background: #D5D6D9, color: #545659;
         * 4. pressSpecial: isPressed background: #E7F3FF, color: #74BCFF;
         * 5. static: no change
         */
        type: PropTypes.array
    };

    static defaultProps = {
        isHorizontal: true,
        type: ['pressNormal', 'hoverNormal']
    }

    state = {
        isHovered: false,
        isPressed: false
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
        },
        handleMouseDown: () => {
            this.setState({
                isPressed: true
            });
        },
        handleMouseUp: () => {
            this.setState({
                isPressed: false
            });
        }
    };

    render() {
        const { isHovered, isPressed } = this.state;
        const {
            className,
            title,
            name,
            disabled,
            onClick,
            spanText,
            spanClassName,
            isHorizontal,
            inputInfo,
            type,
            ...props
        } = this.props;
        let {
            color = '#85888C'
        } = this.props;
        let iconBackground = 'transparent';
        const Component = Icons[name];
        if (!Component) {
            console.log(`Can't find the icon named '${name}', please check your icon name`);
            return null;
        }
        const hoverBackgroundColor = includes(type, 'hoverNoBackground') ? 'transparent' : '#EEEFF0';
        const hoverIconColor = includes(type, 'hoverNoBackground') ? '#2A2C2E' : color;
        const pressedBackground = includes(type, 'pressSpecial') ? '#E7F3FF' : '#D5D6D9';// '#D5D6D9'
        const pressedIconColor = includes(type, 'pressSpecial') ? '#1890FF' : '#545659'; // '#545659'
        const isStaticIcon = includes(type, 'static');
        if (isHovered && !isPressed) {
            color = isStaticIcon ? color : hoverIconColor;
            iconBackground = isStaticIcon ? 'transparent' : hoverBackgroundColor;
        } else if (isPressed && isHovered) {
            color = (isStaticIcon || includes(type, 'hoverNoBackground')) ? color : pressedIconColor;
            iconBackground = (isStaticIcon || includes(type, 'hoverNoBackground')) ? 'transparent' : pressedBackground;
        } else {
            iconBackground = 'transparent';
            color = '#85888C';
        }

        return (
            <span title={title} className={classNames(className, 'display-inline')} style={{ verticalAlign: 'top', background: iconBackground }}>
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
                <div
                    className={classNames('display-inline')}
                    disabled={disabled}
                    onKeyDown={noop}
                    role="button"
                    tabIndex={0}
                    onClick={onClick}
                    onFocus={() => 0}
                    onBlur={() => 0}
                    onMouseEnter={this.actions.handleMouseOver}
                    onMouseLeave={this.actions.handleMouseOut}
                    onMouseDown={this.actions.handleMouseDown}
                    onMouseUp={this.actions.handleMouseUp}
                >
                    {Component && (
                        <Component
                            {...props}
                            disabled={disabled}
                            color={disabled ? '#D5D6D9' : color}
                            style={{ background: iconBackground }}
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
                </div>
            </span>
        );
    }
}


export default SvgIcon;
