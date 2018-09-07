import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import i18n from '../../lib/i18n';
import Widget from '../../components/Widget';


/**
 * Call WidgetState.bind(this) in constructor to initialize widgetState.
 */
class WidgetState {
    static bind(component) {
        component.state.widgetState = {
            fullscreen: false,
            minimized: false,
            toggleFullscreen: () => {
                component.setState(state => {
                    const { fullscreen, minimized } = state.widgetState;
                    return {
                        widgetState: {
                            ...state.widgetState,
                            fullscreen: !fullscreen,
                            minimized: fullscreen ? minimized : false
                        }
                    };
                });
            },
            toggleMinimized: () => {
                component.setState(state => ({
                    widgetState: {
                        ...state.widgetState,
                        minimized: !state.widgetState.minimized
                    }
                }));
            }
        };
    }
}


const DefaultSortableHandle = () => (
    <Widget.Sortable className="sortable-handle">
        <i className="fa fa-bars" />
        <span className="space" />
    </Widget.Sortable>
);

const DefaultMinimizeButton = (props) => {
    const { fullscreen, minimized, toggleMinimized } = props.widgetState;

    return (
        <Widget.Button
            disabled={fullscreen}
            title={minimized ? i18n._('Expand') : i18n._('Collapse')}
            onClick={toggleMinimized}
        >
            <i
                className={classNames(
                    'fa',
                    'fa-fw',
                    { 'fa-chevron-up': !minimized },
                    { 'fa-chevron-down': minimized }
                )}
            />
        </Widget.Button>
    );
};
DefaultMinimizeButton.propTypes = {
    widgetState: PropTypes.object.isRequired
};


const DefaultDropdownButton = (props) => {
    const { fullscreen, toggleFullscreen } = props.widgetState;

    return (
        <Widget.DropdownButton
            title={i18n._('fullscreen')}
            toggle={<i className="fa fa-ellipsis-v" />}
            onSelect={(eventKey) => {
                if (eventKey === 'fullscreen') {
                    toggleFullscreen();
                }
            }}
        >
            <Widget.DropdownMenuItem eventKey="fullscreen">
                <i
                    className={classNames(
                        'fa',
                        'fa-fw',
                        { 'fa-expand': !fullscreen },
                        { 'fa-compress': fullscreen }
                    )}
                />
                <span className="space space-sm" />
                {!fullscreen ? i18n._('Enter Full Screen') : i18n._('Exit Full Screen')}
            </Widget.DropdownMenuItem>
        </Widget.DropdownButton>
    );
};
DefaultDropdownButton.propTypes = {
    widgetState: PropTypes.object.isRequired
};

export {
    WidgetState,
    DefaultSortableHandle,
    DefaultMinimizeButton,
    DefaultDropdownButton
};
