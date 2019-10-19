import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import Console from './DefaultConsole';
import Widget from '../../components/Widget';
import styles from '../styles.styl';

class ConsoleWidget extends PureComponent {
    static propTypes = {
        // redux
        widgetId: PropTypes.string.isRequired
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
        const { clearRenderStamp } = this.state;
        const { widgetId } = this.props;

        return (
            <Widget borderless>
                <Widget.Content className={styles['visualizer-content']}>
                    <Console
                        widgetId={widgetId}
                        clearRenderStamp={clearRenderStamp}
                    />
                </Widget.Content>
            </Widget>
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

export default connect(mapStateToProps)(ConsoleWidget);
