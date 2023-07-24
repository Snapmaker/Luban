import React, { useEffect } from 'react';

import i18n from '../../../lib/i18n';
import JobStatusView from './JobStatusView';

declare interface WidgetActions {
    setTitle: (title: string) => void;
    setDisplay: (display: boolean) => void;
}

declare interface WidgetProps {
    // widgetId: string;
    widgetActions: WidgetActions;
}

const JobStatusWidget: React.FC<WidgetProps> = (props) => {
    const widgetActions = props.widgetActions;

    useEffect(() => {
        widgetActions.setTitle(i18n._('key-Workspace/Workprogress-Working'));
    }, [widgetActions]);

    return (
        <JobStatusView
            // widgetActions={props.widgetActions}
            controlActions={props.controlActions}
            setDisplay={widgetActions.setDisplay}
        />
    );
};

export default JobStatusWidget;
