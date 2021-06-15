import React from 'react';
import WidgetList from '../views/widget-list';
import Widget from '../Layouts/Widget';

const getWidgetByName = (name, allWidgets) => {
    const foundWidget = allWidgets[name];
    if (!foundWidget) {
        throw new Error(`Unknown Widget ${name}`);
    }
    return foundWidget;
};


export default function renderWidgetList(tab, container, widgetIds, Widgets, listActions, widgetProps) {
    return (
        <div>
            <WidgetList
                tab={tab}
                container={container}
                {...listActions}
                // widgets={Widgets}
                // toggleToDefault={this.actions.toggleToDefault}
                // onDragStart={this.widgetEventHandler.onDragStart}
                // onDragEnd={this.widgetEventHandler.onDragEnd}
                // updateTabContainer={this.props.updateTabContainer}
            >
                {widgetIds.map(widgetId => (
                    <Widget
                        widgetId={widgetId}
                        key={widgetId}
                        component={getWidgetByName(widgetId, Widgets)}
                        widgetProps={widgetProps}
                    />
                )) }
            </WidgetList>
        </div>
    );
}
