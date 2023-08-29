import React, { useEffect } from 'react';

import i18n from '../../../lib/i18n';
import SetOriginView from './SetOriginView';


declare interface WidgetActions {
    setTitle: (title: string) => void;
    setDisplay: (display: boolean) => void;
}

export declare interface WidgetProps {
    widgetId: string;
    widgetActions: WidgetActions;
}


const RaySetOriginWiget: React.FC<WidgetProps> = (props) => {
    const widgetActions = props.widgetActions;

    useEffect(() => {
        widgetActions.setTitle(i18n._('Set Origin Mode'));
    }, [widgetActions]);

    return (
        <SetOriginView
            setDisplay={widgetActions.setDisplay}
        />
    );
};

export default RaySetOriginWiget;
