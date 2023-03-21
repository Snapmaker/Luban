import classNames from 'classnames';
import { noop } from 'lodash';
import includes from 'lodash/includes';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import * as Icons from 'snapmaker-react-icon';
import styles from './styles.styl';

class SvgIcon extends PureComponent {
    static propTypes = {
        name: PropTypes.string.isRequired,
        className: PropTypes.string,
        title: PropTypes.string,
        onClick: PropTypes.func,
        disabled: PropTypes.bool,
        hasBorderBottom: PropTypes.bool,
        isHorizontal: PropTypes.bool,
        children: PropTypes.node,
        color: PropTypes.string,
        spanText: PropTypes.string,
        spanClassName: PropTypes.string,
        size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        inputInfo: PropTypes.object,
        hoversize: PropTypes.number, // hover background size
        borderRadius: PropTypes.number,
        onMouseEnter: PropTypes.func,
        onMouseLeave: PropTypes.func,
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
    };

    state = {
        isHovered: false,
        isPressed: false
    };

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
            hasBorderBottom,
            type,
            children,
            borderRadius = 4,
            onMouseEnter,
            onMouseLeave,
            ...props
        } = this.props;
        let {
            hoversize = 30,
            color = '#85888C'
        } = this.props;
        let iconBackground = 'transparent';
        let iconLineHeight = `${hoversize}px`;
        let Component = Icons[name];
        if (!Component) {
            Component = Icons.PrintingSettingNormal;
        }
        const hoverBackgroundColor = includes(type, 'hoverNoBackground') ? 'transparent' : '#EEEFF0';
        const hoverIconColor = includes(type, 'hoverNoBackground') ? '#2A2C2E' : color;
        // const pressedBackground = includes(type, 'pressSpecial') ? '#E7F3FF' : '#D5D6D9';// '#D5D6D9'
        let pressedBackground = '#D5D6D9';
        switch (true) {
            case includes(type, 'pressSpecial'):
                pressedBackground = '#E7F3FF';
                break;
            case includes(type, 'pressNoBackground'):
                pressedBackground = 'transparent';
                break;
            default:
                pressedBackground = '#D5D6D9';
                break;
        }
        const pressedIconColor = includes(type, 'pressSpecial') ? '#1890FF' : '#2A2C2E'; // '#2A2C2E'
        const isStaticIcon = includes(type, 'static');
        const onlyIcon = !(spanText || children || this.props.size > 24);
        if (isHovered && !isPressed) {
            color = isStaticIcon ? color : hoverIconColor;
            iconBackground = isStaticIcon ? 'transparent' : hoverBackgroundColor;
        } else if (isPressed && isHovered) {
            color = (isStaticIcon || includes(type, 'hoverNoBackground')) ? color : pressedIconColor;
            iconBackground = (isStaticIcon || includes(type, 'hoverNoBackground')) ? 'transparent' : pressedBackground;
        } else {
            iconBackground = 'transparent';
            color = color || '#85888C';
        }
        if (this.props.size > 24 || isStaticIcon) {
            hoversize = 'auto';
            iconLineHeight = 'normal';
        }
        return (
            <span
                title={title}
                className={classNames(
                    className,
                    'display-inline',
                    styles[`border-radius-${borderRadius}`]
                )}
                style={{ verticalAlign: 'top', background: onlyIcon ? 'transparent' : iconBackground, fontSize: '0' }}
            >
                {/* , borderRadius: 4, height: hoverSize, width: hoverSize, textAlign: 'center', lineHeight: iconLineHeight */}
                {/* width: hoverSize, height: hoverSize, textAlign: 'center'  */}
                {inputInfo !== undefined && (
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
                    className={classNames('display-inline', styles['icon-wrapper'])}
                    style={{ maxWidth: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer' }}
                    onKeyDown={noop}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                        if (!disabled && onClick) {
                            onClick(e);
                        }
                    }}
                    onFocus={() => 0}
                    onBlur={() => 0}
                    onMouseEnter={this.props.onMouseEnter || this.actions.handleMouseOver}
                    onMouseLeave={this.props.onMouseLeave || this.actions.handleMouseOut}
                    onMouseDown={this.actions.handleMouseDown}
                    onMouseUp={this.actions.handleMouseUp}
                >
                    {Component && (
                        <div className={classNames('display-inline')} style={{ height: hoversize, width: hoversize, textAlign: 'center', lineHeight: iconLineHeight, background: iconBackground, borderRadius: borderRadius }}>
                            <Component
                                {...props}
                                disabled={disabled}
                                color={disabled ? '#D5D6D9' : color}
                                style={{ background: iconBackground, borderBottom: hasBorderBottom ? '1px solid #D5D6D9' : 0 }}
                            />
                        </div>
                    )}
                    {children}
                    {spanText && isHorizontal && (
                        <span
                            className={spanClassName}
                            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '14px', color: disabled ? '#D5D6D9' : '#545659' }}
                        >
                            {spanText}
                        </span>
                    )}
                    {spanText && !isHorizontal && (
                        <div
                            className={spanClassName}
                            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '14px', color: disabled ? '#D5D6D9' : '#545659' }}
                        >
                            {spanText}
                        </div>
                    )}
                </div>
            </span>
        );
    }
}


export default SvgIcon;
