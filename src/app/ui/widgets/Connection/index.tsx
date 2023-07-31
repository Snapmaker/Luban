import React, { useEffect } from 'react';

import i18n from '../../../lib/i18n';
import Connection from './Connection';

declare interface WidgetActions {
    setTitle: (title: string) => void;
}

export declare interface ConnectionProps {
    widgetId: string;
    widgetActions: WidgetActions;
}

const ConnectionWidget: React.FC<ConnectionProps> = (props) => {
    const widgetActions = props.widgetActions;

    useEffect(() => {
        widgetActions.setTitle(i18n._('key-Workspace/Connection-Connection'));
    }, [widgetActions]);

    return (
        <Connection />
    );
};

export default ConnectionWidget;
