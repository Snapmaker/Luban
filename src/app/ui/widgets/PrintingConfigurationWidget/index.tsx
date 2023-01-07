import classNames from 'classnames';
import React from 'react';

import ConfigurationView from './ConfigurationView';
import styles from './styles.styl';

import PresetInitialization from './PresetInitialization';

export {
    PresetInitialization,
};

declare interface ConfigurationWidgetProps {
    className?: string;
}

const ConfigurationWidget: React.FC<ConfigurationWidgetProps> = ({ className = null }) => {
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

export default ConfigurationWidget;
