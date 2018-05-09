import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Anchor from '../Anchor';
import styles from './styles.styl';

// TODO: to be improved
const OptionalDropdown = (props) => {
    const { hidden, title, titleWidth, onClick, children } = props;

    return (
        <React.Fragment>
            <div className={classNames(styles.expandableStart, { [styles.show]: !hidden })}>
                <div style={{ width: titleWidth }}>
                    <Anchor
                        className={classNames(styles.icon, hidden ? styles.iconUnchecked : styles.iconChecked)}
                        style={{ margin: '4px 4px -2px 4px' }}
                        onClick={onClick}
                    />
                    <span className={styles.expandableTitle}>{title}</span>
                </div>
                <div className={styles.expandableSeparator}>
                    <div className={styles.expandableSeparatorInner} />
                </div>
            </div>
            {!hidden && children}
            {!hidden &&
            <div className={styles.expandableEnd}>
                <div style={{ marginTop: '20px', width: '0.1px' }} />
                <div className={styles.expandableSeparator}>
                    <div className={styles.expandableSeparatorInner} />
                </div>
            </div>}
        </React.Fragment>
    );
};

OptionalDropdown.propTypes = {
    title: PropTypes.string,
    titleWidth: PropTypes.string,
    onClick: PropTypes.func,
    hidden: PropTypes.bool
};

export default OptionalDropdown;
