import React, { useEffect } from 'react';

import i18n from '../../../lib/i18n';
import { WidgetProps } from '../widget-definitions';
import AirPurifierView from './AirPurifierView';


const AirPurifierWidget: React.FC<WidgetProps> = (props) => {
    const widgetActions = props.widgetActions;

    useEffect(() => {
        widgetActions.setTitle(i18n._('key-Workspace/Purifier-Air Purifier'));
    }, [widgetActions]);

    return (
        <AirPurifierView
            setDisplay={widgetActions.setDisplay}
        />
    );
};

export default AirPurifierWidget;
