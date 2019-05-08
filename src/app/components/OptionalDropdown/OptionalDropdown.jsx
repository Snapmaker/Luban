import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Anchor from '../Anchor';
import TipTrigger from '../TipTrigger';
import styles from './styles.styl';

// TODO: to be improved
const OptionalDropdown = (props) => {
    const { hidden, title, titleTip, onClick, children, ...rest } = props;

    return (
        <div>
            <div className={classNames(styles['expandable-start'], { [styles.show]: !hidden })}>
                <TipTrigger {...rest} title={title} content={titleTip}>
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
                </TipTrigger>
            </div>
            {!hidden && children}
            {!hidden && false && (
                <div className={styles['expandable-end']}>
                    <div style={{ marginTop: '10px', width: '0.1px' }} />
                    <div className={styles['expandable-separator']}>
                        <div className={styles['expandable-separator-inner']} />
                    </div>
                </div>
            )}
            <div className="clearfix" />
        </div>
    );
};

OptionalDropdown.propTypes = {
    title: PropTypes.string.isRequired,
    titleTip: PropTypes.string,
    onClick: PropTypes.func.isRequired,
    hidden: PropTypes.bool.isRequired
};

export default OptionalDropdown;
