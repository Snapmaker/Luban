import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Button as AntdButton } from 'antd';
import styles from './styles.styl';
import '../../../styles/global.styl';

const Button = React.memo((props) => {
    const { priority = 'level-three', className, suffixIcon, width = '100%', minWidth, ...rest } = props;
    const ref = useRef();
    const type = priority === 'level-three' ? 'default' : (props.type || 'primary');
    return (
        <div
            style={{ width: width, minWidth: minWidth }}
            className={classNames(
                'display-inline',
                className
            )}
        >
            <AntdButton
                {...rest}
                block
                ref={ref}
                type={type} // default, primary, link, Text
                className={classNames(
                    styles[priority],
                    styles['button-lb']
                )}
            >
                <div className={classNames('position-re', styles['inside-button'])}>
                    <div className={classNames(!!suffixIcon && styles['width-with-suffix-icon'])}>{props.children}</div>
                    {
                        !!suffixIcon && (priority === 'level-one' || priority === 'level-two') && (
                            <div className={classNames(styles['suffix-container'], 'position-ab')}>
                                <div className={classNames(styles.content, 'display-inline')}>{suffixIcon}</div>
                            </div>
                        )
                    }
                </div>
            </AntdButton>
        </div>
    );
});

Button.propTypes = {
    width: PropTypes.string,
    type: PropTypes.string,
    priority: PropTypes.string,
    className: PropTypes.string,
    suffixIcon: PropTypes.element,
    minWidth: PropTypes.string,
    children: PropTypes.oneOfType([
        PropTypes.number,
        PropTypes.element,
        PropTypes.string,
        PropTypes.node
    ])
};
export default Button;
