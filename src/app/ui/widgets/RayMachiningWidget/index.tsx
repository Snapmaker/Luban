import React, { useEffect } from 'react';

import i18n from '../../../lib/i18n';
import MachiningView from './MachiningView';


declare interface WidgetActions {
    setTitle: (title: string) => void;
    setDisplay: (display: boolean) => void;
}

export declare interface WidgetProps {
    widgetId: string;
    widgetActions: WidgetActions;
}


const RayMachiningWiget: React.FC<WidgetProps> = (props) => {
    const widgetActions = props.widgetActions;

    useEffect(() => {
        widgetActions.setTitle(i18n._('key-Workspace/Connection-Machining'));
    }, [widgetActions]);

    return (
        <MachiningView
            setDisplay={widgetActions.setDisplay}
        />
    );
};

export default RayMachiningWiget;
