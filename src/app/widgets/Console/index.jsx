import classNames from 'classnames';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Widget from '../../components/Widget';
import i18n from '../../lib/i18n';
import store from '../../store';
import Console from './Console';
import styles from './index.styl';

class ConsoleWidget extends PureComponent {
    static propTypes = {
        widgetId: PropTypes.string.isRequired,
        onToggle: PropTypes.func.isRequired,
        sortable: PropTypes.object
    };

    state = {
        // trigger termininal render
        clearRenderStamp: 0,
        minimized: false
    };

    actions = {
        toggleMinimized: () => {
            const { minimized } = this.state;
            this.setState(() => ({
                minimized: !minimized
            }));
        },
        clearAll: () => {
            const clearRenderStamp = this.state.clearRenderStamp + 1;
            this.setState({
                clearRenderStamp
            });
        }
    };

    render() {
        const { clearRenderStamp, minimized } = this.state;
        const { widgetId } = this.props;
        const defaultWidgets = store.get('workspace.container.default.widgets');
        const isToggled = defaultWidgets.find(wid => wid === 'console') !== undefined;
        const headerStyle = isToggled ? 'widget-header-absolute' : 'widget-header';

        return (
            <Widget>
                <Widget.Header className={styles[headerStyle]}>
                    <Widget.Title>
                        <Widget.Sortable className={this.props.sortable.handleClassName}>
                            <i className="fa fa-bars" />
                            <span className="space" />
                        </Widget.Sortable>
                        {i18n._('Console')}
                    </Widget.Title>
                    <Widget.Controls className={this.props.sortable.filterClassName}>
                        <Widget.Button
                            title={i18n._('Clear all')}
                            onClick={this.actions.clearAll}
                        >
                            <i className="fa fa-ban fa-flip-horizontal" />
                        </Widget.Button>
                        {!isToggled && (
                            <Widget.Button
                                title={minimized ? i18n._('Expand') : i18n._('Collapse')}
                                onClick={this.actions.toggleMinimized}
                            >
                                <i
                                    className={classNames(
                                        'fa',
                                        { 'fa-chevron-up': !minimized },
                                        { 'fa-chevron-down': minimized }
                                    )}
                                />
                            </Widget.Button>
                        )}
                        <Widget.Button
                            title={i18n._('Toggle')}
                            onClick={this.props.onToggle}
                        >
                            <i
                                className={classNames(
                                    'fa',
                                    'fa-fw',
                                    { 'fa-expand': !isToggled },
                                    { 'fa-compress': isToggled }
                                )}
                            />
                        </Widget.Button>
                    </Widget.Controls>
                </Widget.Header>
                <Widget.Content
                    className={classNames(
                        isToggled ? styles.widgetContentAbsolute : styles.widgetContent,
                        { [styles.hidden]: minimized }
                    )}
                >
                    <Console
                        widgetId={widgetId}
                        clearRenderStamp={clearRenderStamp}
                    />
                </Widget.Content>
            </Widget>
        );
    }
}

export default ConsoleWidget;
