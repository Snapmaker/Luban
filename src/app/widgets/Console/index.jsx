import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Console from './Console';
import { actions as widgetActions } from '../../flux/widget';
import Widget from '../../components/Widget';
import SMSortableHandle from '../../components/SMWidget/SMSortableHandle';
import i18n from '../../lib/i18n';

class ConsoleWidget extends PureComponent {
    static propTypes = {
        minimized: PropTypes.bool.isRequired,
        widgetId: PropTypes.string.isRequired,
        isDefault: PropTypes.bool.isRequired,

        updateWidgetState: PropTypes.func.isRequired,
        toggleWorkspaceWidgetToDefault: PropTypes.func.isRequired
    };

    state = {
        // trigger termininal render
        clearRenderStamp: 0,
        minimized: this.props.minimized
    };

    actions = {
        toggleMinimized: () => {
            const { minimized } = this.state;
            this.setState(() => ({
                minimized: !minimized
            }));
            this.props.updateWidgetState({ minimized: !minimized });
        },
        clearAll: () => {
            const clearRenderStamp = this.state.clearRenderStamp + 1;
            this.setState({
                clearRenderStamp
            });
        },
        toggleWorkspaceWidgetToDefault: () => {
            this.props.toggleWorkspaceWidgetToDefault();
        }
    };

    render() {
        const { clearRenderStamp, minimized } = this.state;
        const { widgetId, isDefault } = this.props;

        return (
            <Widget>
                {!isDefault && (
                    <Widget.Header>
                        <Widget.Title>
                            <SMSortableHandle />
                            {i18n._('Console')}
                        </Widget.Title>
                        <Widget.Controls className="sortable-filter">
                            <Widget.Button
                                title={i18n._('Clear All')}
                                onClick={this.actions.clearAll}
                            >
                                <i
                                    className="fa fa-ban fa-flip-horizontal"
                                />
                            </Widget.Button>
                            <Widget.Button
                                title={minimized ? i18n._('Expand') : i18n._('Collapse')}
                                onClick={this.actions.toggleMinimized}
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
                            <Widget.Button
                                title={i18n._('fullscreen')}
                                onClick={this.actions.toggleWorkspaceWidgetToDefault}
                            >
                                <i
                                    className={classNames(
                                        'fa',
                                        'fa-fw',
                                        { 'fa-expand': !isDefault },
                                        { 'fa-compress': isDefault }
                                    )}
                                />
                            </Widget.Button>

                        </Widget.Controls>
                    </Widget.Header>
                )}
                <Widget.Content
                    style={{
                        position: isDefault ? 'absolute' : 'relative',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: '32px',
                        display: !isDefault && minimized ? 'none' : 'block'
                    }}
                >
                    <Console
                        minimized={minimized}
                        isDefault={isDefault}
                        widgetId={widgetId}
                        clearRenderStamp={clearRenderStamp}
                    />
                </Widget.Content>
                {isDefault && (
                    <Widget.Footer style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '32px'
                    }}
                    >
                        <Widget.Controls className="sortable-filter">
                            <Widget.Button
                                title={i18n._('Clear All')}
                                onClick={this.actions.clearAll}
                            >
                                <i
                                    className="fa fa-ban fa-flip-horizontal"
                                />
                            </Widget.Button>
                            <Widget.Button
                                title={i18n._('fullscreen')}
                                onClick={this.actions.toggleWorkspaceWidgetToDefault}
                            >
                                <i
                                    className={classNames(
                                        'fa',
                                        'fa-fw',
                                        { 'fa-expand': !isDefault },
                                        { 'fa-compress': isDefault }
                                    )}
                                />
                            </Widget.Button>

                        </Widget.Controls>
                    </Widget.Footer>
                )}
            </Widget>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const widget = state.widget;
    const { minimized = false } = widget.widgets[ownProps.widgetId];
    const defaultWidgets = widget.workspace.default.widgets;
    const isDefault = defaultWidgets.indexOf(ownProps.widgetId) !== -1;

    return {
        minimized,
        isDefault
    };
};

const mapDispatchToProps = (dispatch, ownProps) => ({
    updateWidgetState: (value) => dispatch(widgetActions.updateWidgetState(ownProps.widgetId, '', value)),
    toggleWorkspaceWidgetToDefault: () => dispatch(widgetActions.toggleWorkspaceWidgetToDefault(ownProps.widgetId))
});


export default connect(mapStateToProps, mapDispatchToProps)(ConsoleWidget);
