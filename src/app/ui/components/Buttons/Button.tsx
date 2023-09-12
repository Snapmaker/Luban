import { Button as AntdButton, ButtonProps as AntdButtonProps } from 'antd';
import classNames from 'classnames';
import React from 'react';

import styles from './styles.styl';

declare type ButtonType = 'default' | 'primary';


declare type ButtonProps = {
    type: ButtonType; // 'default' or 'primary'
    priority?: 'level-one' | 'level-two' | 'level-three';

    className?: string;

    suffixIcon?: React.ReactNode;

    width?: string;

    minWidth?: string;

    loading?: boolean | {
        delay?: number;
    };

    innerClassNames?: string; // class provide to antd

    children?: React.ReactNode;
} & AntdButtonProps;

const Button: React.FC<ButtonProps> = React.memo((props) => {
    const { priority = 'level-three', className, suffixIcon, width = '100%', minWidth, innerClassNames = '', ...rest } = props;
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
                type={type} // default, primary, link, Text
                className={classNames(
                    styles[priority],
                    styles['button-lb'],
                    innerClassNames
                )}
            >
                <div className={classNames('position-re', styles['inside-button'])}>
                    <div
                        className={classNames(
                            !!suffixIcon && styles['width-with-suffix-icon'],
                            'width-percent-100', 'text-overflow-ellipsis'
                        )}
                    >
                        {props.children}
                    </div>
                    {
                        !!suffixIcon && (priority === 'level-one' || priority === 'level-two') && (
                            <div className={classNames(styles['suffix-container'], 'position-absolute')}>
                                <div className={classNames(styles.content, 'display-inline')}>{suffixIcon}</div>
                            </div>
                        )
                    }
                </div>
            </AntdButton>
        </div>
    );
});

export default Button;
