import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Anchor from '../Anchor';
import styles from './styles.styl';

// TODO: to be improved
const OptionalDropdown = (props) => {
    const { hidden, title, onClick, children } = props;

    return (
        <div>
            <div className={classNames(styles['expandable-start'], { [styles.show]: !hidden })}>
                <div className={styles['expandable-title']}>
                    <Anchor
                        onClick={onClick}
                    >
                        <i className={classNames(styles.icon, hidden ? styles['icon-unchecked'] : styles['icon-checked'])} />
                        <span>{title}</span>
                    </Anchor>
                </div>
                <div className={styles['expandable-separator']}>
                    <div className={styles['expandable-separator-inner']} />
                </div>
            </div>
            {!hidden && children}
            {!hidden &&
            <div className={styles['expandable-end']}>
                <div style={{ marginTop: '10px', width: '0.1px' }} />
                <div className={styles['expandable-separator']}>
                    <div className={styles['expandable-separator-inner']} />
                </div>
            </div>}
        </div>
    );
};

OptionalDropdown.propTypes = {
    title: PropTypes.string.isRequired,
    onClick: PropTypes.func.isRequired,
    hidden: PropTypes.bool.isRequired
};

export default OptionalDropdown;
