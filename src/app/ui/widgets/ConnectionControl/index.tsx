import React, { useEffect } from 'react';

import i18n from '../../../lib/i18n';
import ConnectionControl from './Control';

declare interface WidgetActions {
    setTitle: (title: string) => void;
}
export declare interface ConnectionProps {
    widgetId: string;
    widgetActions: WidgetActions;
    isNotInWorkspace?: boolean
    canABPosition?: boolean
}

/**
 * Connection Control Widget.
 *
 * After connect to networked printer, you can control printer via this widget.
 */
const ConnectionControlWidget: React.FC<ConnectionProps> = (props) => {
    const widgetActions = props.widgetActions;

    useEffect(() => {
        widgetActions.setTitle(i18n._('key-Workspace/Console-Control'));
    }, [widgetActions]);

    return (
        <ConnectionControl {...props} />
    );
};

export default ConnectionControlWidget;
