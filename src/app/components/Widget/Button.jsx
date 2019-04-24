import React from 'react';
import classNames from 'classnames';
import Anchor from '../Anchor';
import styles from './index.styl';

const Button = (props) => {
    const { inverted, className, ...rest } = props;

    return (
        <Anchor
            {...rest}
            className={classNames(
                className,
                styles['widget-button'],
                {
                    [styles.disabled]: !!props.disabled,
                    [styles.inverted]: inverted
                }
            )}
        />
    );
};

Button.propTypes = Anchor.propTypes;
Button.defaultProps = Anchor.defaultProps;

export default Button;
