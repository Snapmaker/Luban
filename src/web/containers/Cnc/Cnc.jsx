import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Sortable from 'react-sortablejs';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import controller from '../../lib/controller';
import Dropzone from '../../components/Dropzone';
import CNCVisualizer from '../../widgets/CNCVisualizer';
import Widget from '../../widgets/Widget';
import { actions } from '../../reducers/cnc';
import styles from './styles.styl';


class Cnc extends Component {
    static propTypes = {
        // from redux
        uploadImage: PropTypes.func.isRequired,
        updateWorkState: PropTypes.func.isRequired
    };

    widgetMap = {};
    widgets = [];

    state = {
        widgetIds: ['cnc-tool', 'cnc-path', 'cnc-output'],
        isDraggingWidget: false
    };

    actions = {
        onDropAccepted: (file) => {
            this.props.uploadImage(file, () => {
                modal({
                    title: i18n._('Parse Image Error'),
                    body: i18n._('Failed to parse image file {{}}', { filename: file.name })
                });
            });
        },
        onDropRejected: () => {
            const title = i18n._('Warning');
            const body = i18n._('Only SVG files are supported.');
            modal({
                title: title,
                body: body
            });
        },
        onDragWidgetStart: () => {
            this.setState({ isDraggingWidget: true });
        },
        onDragWidgetEnd: () => {
            this.setState({ isDraggingWidget: false });
        },
        onChangeWidgetOrder: (widgets) => {
            this.widgets = widgets.map((widgetId) => this.widgetMap[widgetId]);
        }
    };

    controllerEvents = {
        'workflow:state': (workflowState) => {
            this.props.updateWorkState(workflowState);
        }
    };

    constructor(props) {
        super(props);

        for (const widgetId of this.state.widgetIds) {
            this.widgetMap[widgetId] = (
                <div data-widget-id={widgetId} key={widgetId}>
                    <Widget widgetId={widgetId} />
                </div>
            );
        }
        this.widgets = this.state.widgetIds.map((widgetId) => this.widgetMap[widgetId]);
    }

    componentDidMount() {
        this.addControllerEvents();
    }

    componentWillUnmount() {
        this.removeControllerEvents();
    }

    addControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.on(eventName, callback);
        });
    }

    removeControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.off(eventName, callback);
        });
    }

    render() {
        const style = this.props.style;
        const state = this.state;
        const actions = this.actions;
        return (
            <div style={style}>
                <Dropzone
                    disabled={state.isDraggingWidget}
                    accept=".svg"
                    dragEnterMsg={i18n._('Drop an SVG file here.')}
                    onDropAccepted={this.actions.onDropAccepted}
                    onDropRejected={this.actions.onDropRejected}
                >
                    <div className={styles['cnc-table']}>
                        <div className={styles['cnc-table-row']}>
                            <div className={styles['view-space']}>
                                <CNCVisualizer />
                            </div>

                            <form className={styles['control-bar']} noValidate={true}>
                                <Sortable
                                    options={{
                                        animation: 150,
                                        delay: 0,
                                        group: {
                                            name: 'cnc-control'
                                        },
                                        handle: '.sortable-handle',
                                        filter: '.sortable-filter',
                                        chosenClass: 'sortable-chosen',
                                        ghostClass: 'sortable-ghost',
                                        dataIdAttr: 'data-widget-id',
                                        onStart: () => {
                                            actions.onDragWidgetStart();
                                        },
                                        onEnd: () => {
                                            actions.onDragWidgetEnd();
                                        }
                                    }}
                                    onChange={actions.onChangeWidgetOrder}
                                >
                                    {this.widgets}
                                </Sortable>
                            </form>
                        </div>
                    </div>
                </Dropzone>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        uploadImage: (file, onFailure) => dispatch(actions.uploadImage(file, onFailure)),
        updateWorkState: (workState) => dispatch(actions.updateWorkState(workState))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Cnc);
