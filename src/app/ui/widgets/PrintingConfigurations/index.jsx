import React from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';

import ConfigurationView from './ConfigurationView';
import styles from './styles.styl';


const ConfigurationWidget = ({ className = null }) => {
    return (
        <div
            className={classNames(
                className,
                styles['widget-container'],
            )}
        >
            <ConfigurationView />
        </div>
    );
};

ConfigurationWidget.propTypes = {
    className: PropTypes.string,
};

export default ConfigurationWidget;
