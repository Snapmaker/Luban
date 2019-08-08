import classNames from 'classnames';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Widget from '../../components/Widget';
import { WidgetConfig } from '../../components/SMWidget';
import i18n from '../../lib/i18n';
import Console from './Console';
import styles from './index.styl';

class ConsoleWidget extends PureComponent {
    static propTypes = {
        widgetId: PropTypes.string.isRequired,
        onToggle: PropTypes.func,
        sortable: PropTypes.object
    };

    config = new WidgetConfig(this.props.widgetId);

    state = {
        minimized: this.config.get('minimized', false)
    };

    actions = {
        toggleMinimized: () => {
            const { minimized } = this.state;
            this.setState(() => ({
                minimized: !minimized
            }));
        }
    };

    componentDidUpdate() {
        this.config.set('minimized', this.state.minimized);
    }

    render() {
        const { minimized } = this.state;
        const { widgetId } = this.props;

        return (
            <Widget>
                <Widget.Header>
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
                        <Widget.DropdownButton
                            title={i18n._('More')}
                            toggle={<i className="fa fa-ellipsis-v" />}
                            onSelect={(eventKey) => {
                                if (eventKey === 'toggle') {
                                    this.props.onToggle();
                                }
                            }}
                        >
                            <Widget.DropdownMenuItem eventKey="toggle">
                                <i className="fa fa-fw fa-expand" />
                                <span className="space space-sm" />
                                {i18n._('Toggle Widget')}
                            </Widget.DropdownMenuItem>
                        </Widget.DropdownButton>
                    </Widget.Controls>
                </Widget.Header>
                <Widget.Content
                    className={classNames(
                        styles.widgetContent,
                        { [styles.hidden]: minimized }
                    )}
                >
                    <Console
                        widgetId={widgetId}
                    />
                </Widget.Content>
            </Widget>
        );
    }
}

export default ConsoleWidget;
