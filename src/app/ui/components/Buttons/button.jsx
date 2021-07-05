import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Button as AntdButton } from 'antd';
import styles from './styles.styl';
import '../../../styles/global.styl';

const Button = (props) => {
    const { priority, suffixIcon, width, ...rest } = props;
    const ref = useRef();
    const type = priority === 'level-three' ? 'default' : props.type;
    return (
        <div style={{ width: width }}>
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
                <div className={classNames('position-re')}>
                    {props.children}
                    {
                        !!suffixIcon && priority === 'level-one' && (
                            <div className={classNames(styles['suffix-container'], 'position-ab')}>
                                <div className={classNames(styles.content, 'display-inline')}>{suffixIcon}</div>
                            </div>
                        )
                    }
                </div>
            </AntdButton>
        </div>
    );
};

Button.propTypes = {
    width: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    priority: PropTypes.string.isRequired,
    suffixIcon: PropTypes.element,
    children: PropTypes.string | PropTypes.element
};
export default Button;
