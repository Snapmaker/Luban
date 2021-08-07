import React from 'react';
import classNames from 'classnames';
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
        <div className={classNames(`${widgetProps.headType === '3dp' ? 'threedp' : widgetProps.headType}-widget-list-intro`, 'overflow-y-auto')} style={{ height: `${widgetProps.headType === '3dp' ? 'calc(100vh - 185px)' : 'calc(100vh - 230px)'}` }}>
            <WidgetList
                tab={tab}
                container={container}
                className="padding-bottom-176 widget-list-intro"
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
