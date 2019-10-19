import classNames from 'classnames';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { createDefaultWidget } from '../../components/SMWidget';
import Console from './Console';

class ConsoleWidget extends PureComponent {
    static propTypes = {
        widgetId: PropTypes.string.isRequired,
        setTitle: PropTypes.func.isRequired,
        setControlButtons: PropTypes.func.isRequired,

        defaultWidgets: PropTypes.array.isRequired,

        onToggle: PropTypes.func.isRequired
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

    constructor(props) {
        super(props);
        this.props.setTitle('Console');
        const defaultWidgets = this.props.defaultWidgets;
        const isToggled = defaultWidgets.find(wid => wid === 'console') !== undefined;
        // const headerStyle = isToggled ? 'widget-header-absolute' : 'widget-header';
        this.props.setControlButtons([{
            title: 'Clear all',
            onClick: this.actions.clearAll,
            className: 'fa fa-ban fa-flip-horizontal'
        },
        'SMMinimize',
        {
            title: 'Toggle',
            onClick: this.props.onToggle,
            className: classNames(
                'fa',
                'fa-fw',
                { 'fa-expand': !isToggled },
                { 'fa-compress': isToggled }
            )
        }]);
    }

    render() {
        const { clearRenderStamp } = this.state;
        const { widgetId } = this.props;

        return (
            <div
                style={{
                    margin: '-18px -12px'
                }}
            >
                <Console
                    widgetId={widgetId}
                    clearRenderStamp={clearRenderStamp}
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const widget = state.widget;
    const defaultWidgets = widget.tab.workspace.container.default.widgets;
    return {
        defaultWidgets
    };
};

export default createDefaultWidget(connect(mapStateToProps)(ConsoleWidget));
