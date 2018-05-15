import React from 'react';
import classNames from 'classnames';
import Anchor from '../Anchor';
import styles from './index.styl';

const Button = (props) => {
    const { className, ...rest } = props;

    return (
        <Anchor
            {...rest}
            className={classNames(
                className,
                styles.widgetButton,
                { [styles.disabled]: !!props.disabled }
            )}
        />
    );
};

Button.propTypes = Anchor.propTypes;
Button.defaultProps = Anchor.defaultProps;

export default Button;
