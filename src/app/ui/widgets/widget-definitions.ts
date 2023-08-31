export declare interface WidgetActions {
    setTitle: (title: string) => void;
    setDisplay: (display: boolean) => void;
}

export declare interface WidgetProps {
    widgetId: string;
    widgetActions: WidgetActions;
}

