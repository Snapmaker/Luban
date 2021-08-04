import React from 'react';
import WidgetList from '../views/widget-list';
import Widget from '../layouts/Widget';

const getWidgetByName = (name, allWidgets) => {
    const foundWidget = allWidgets[name];
    if (!foundWidget) {
        throw new Error(`Unknown Widget ${name}`);
    }
    return foundWidget;
};


export default function renderWidgetList(tab, container, widgetIds, Widgets, listActions, widgetProps) {
    return (
        // <div style={{ height: `${tab === 'workspace' ? '100%' : `calc(100vh - ${widgetProps.headType === '3dp' ? '185px' : '250px'})`}`, overflowY: 'auto' }}>
        <div className="overflow-y-auto" style={{ height: 'calc(100vh - 160px)' }}>
            <WidgetList
                tab={tab}
                container={container}
                className="padding-bottom-176"
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
