import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import Anchor from '../Anchor';
import styles from './index.styl';

const Toggler = (props) => {
    const { onToggle, className, ...rest } = props;

    return (
        <Anchor
            {...rest}
            className={classNames(className, styles.toggler)}
            onClick={(event) => {
                onToggle(event);
            }}
        />
    );
};

Toggler.propTypes = {
    onToggle: PropTypes.func.isRequired
};

export default Toggler;
