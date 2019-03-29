import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import i18n from '../lib/i18n';
import Widget from '../components/Widget';
import WidgetConfig from './WidgetConfig';


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

// TODO: integrate with WidgetState
function createWidget(WrappedWidget) {
    return class extends PureComponent {
        static propTypes = {
            widgetId: PropTypes.string.isRequired,
            title: PropTypes.string.isRequired
        };

        state = {};

        config = new WidgetConfig(this.props.widgetId);

        constructor(props) {
            super(props);
            WidgetState.bind(this);
        }

        render() {
            const widgetState = this.state.widgetState;

            return (
                <Widget fullscreen={widgetState.fullscreen}>
                    <Widget.Header>
                        <Widget.Title>
                            <DefaultSortableHandle />
                            {this.props.title}
                        </Widget.Title>
                        <Widget.Controls className="sortable-filter">
                            <DefaultMinimizeButton widgetState={widgetState} />
                            <DefaultDropdownButton widgetState={widgetState} />
                        </Widget.Controls>
                    </Widget.Header>
                    <Widget.Content
                        style={{
                            position: 'relative',
                            padding: '18px 12px',
                            display: widgetState.minimized ? 'none' : 'block'
                        }}
                    >
                        <WrappedWidget config={this.config} />
                    </Widget.Content>
                </Widget>
            );
        }
    };
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
    createWidget,
    WidgetState,
    DefaultSortableHandle,
    DefaultMinimizeButton,
    DefaultDropdownButton
};
