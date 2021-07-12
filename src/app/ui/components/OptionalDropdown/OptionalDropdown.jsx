import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Anchor from '../Anchor';
import TipTrigger from '../TipTrigger';
import styles from './styles.styl';
import Checkbox from '../Checkbox';

// TODO: to be improved
const OptionalDropdown = (props) => {
    const { hidden, title, titletip, onClick, disabled = false, children, ...rest } = props;

    return (
        <div>
            <div className={classNames(styles['expandable-start'], { [styles.show]: !hidden })}>
                <TipTrigger {...rest} title={title} content={titletip}>
                    <div className={styles['expandable-title']}>
                        <Anchor
                            onClick={onClick}
                            disabled={disabled}
                        >
                            <Checkbox disabled={disabled} checked={!hidden} className={styles.checkbox} label={title} />
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
    titletip: PropTypes.string,
    children: PropTypes.node.isRequired,
    onClick: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
    hidden: PropTypes.bool.isRequired
};

export default OptionalDropdown;
