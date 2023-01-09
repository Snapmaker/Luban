import classNames from 'classnames';
import React from 'react';

import Widget from '../layouts/Widget';
import WidgetList from '../views/widget-list';

const getWidgetByName = (name, allWidgets) => {
    const foundWidget = allWidgets[name];
    if (!foundWidget) {
        throw new Error(`Unknown Widget ${name}`);
    }
    return foundWidget;
};


export default function renderWidgetList(tab, container, widgetIds, Widgets, listActions, widgetProps, controlActions = null) {
    return (
        <div
            className={classNames(
                'scroll-bar-none',
                'overflow-y-auto',
                `${widgetProps.headType}-widget-list-intro`,
            )}
            style={{
                height: 'auto'
            }}
        >
            <WidgetList
                tab={tab}
                container={container}
                className="widget-list-intro"
                {...listActions}
                // widgets={Widgets}
                // toggleToDefault={this.actions.toggleToDefault}
                // onDragStart={this.widgetEventHandler.onDragStart}
                // onDragEnd={this.widgetEventHandler.onDragEnd}
                // updateTabContainer={this.props.updateTabContainer}
            >
                {
                    widgetIds.map(widgetId => (
                        <Widget
                            widgetId={widgetId}
                            key={widgetId}
                            component={getWidgetByName(widgetId, Widgets)}
                            widgetProps={widgetProps}
                            controlActions={controlActions}
                        />
                    ))
                }
            </WidgetList>
        </div>
    );
}
