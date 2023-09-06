import React, { useEffect } from 'react';

import i18n from '../../../lib/i18n';
import { WidgetProps } from '../widget-definitions';
import SetOriginView from './SetOriginView';


const RaySetOriginWidget: React.FC<WidgetProps> = React.memo((props) => {
    const widgetActions = props.widgetActions;

    useEffect(() => {
        widgetActions.setTitle(i18n._('Set Origin Mode'));
    }, [widgetActions]);

    return (
        <SetOriginView
            setDisplay={widgetActions.setDisplay}
        />
    );
});

export default RaySetOriginWidget;
