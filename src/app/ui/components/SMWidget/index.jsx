// SMWidget
// Snapmaker Widget, styled wrapper on top of Widget.
//


import Widget from './Widget';

import SMSortableHandle from './SMSortableHandle';
import SMDropdownButton from './SMDropdownButton';
import SMMinimizeButton from './SMMinimizeButton';


/**
 * Call WidgetState.bind(this) in constructor to initialize widgetState.
 */
class WidgetState {
    static bind(component, config) {
        if (!component.state) {
            component.state = {};
        }

        component.state = {
            ...component.state,
            fullscreen: config && config.get('fullscreen', false),
            minimized: config && config.get('minimized', false)
        };

        if (!component.actions) {
            component.actions = {};
        }

        component.actions = {
            ...component.actions,
            onToggleFullscreen: () => {
                component.setState(state => {
                    const { fullscreen, minimized } = state;
                    return {
                        fullscreen: !fullscreen,
                        minimized: fullscreen ? minimized : false
                    };
                });
            },
            onToggleMinimized: () => {
                component.setState(state => ({
                    minimized: !state.minimized
                }));
            }
        };
    }
}

export {
    Widget,
    WidgetState,
    SMSortableHandle,
    SMMinimizeButton,
    SMDropdownButton
};
