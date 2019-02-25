import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Sortable from 'react-sortablejs';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import Dropzone from '../../components/Dropzone';
import CNCVisualizer from '../../widgets/CNCVisualizer';
import Widget from '../../widgets/Widget';
import { actions } from '../../reducers/cncLaserShared';
import styles from './styles.styl';


class Cnc extends Component {
    static propTypes = {
        uploadImage: PropTypes.func.isRequired
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
                    onDropAccepted={actions.onDropAccepted}
                    onDropRejected={actions.onDropRejected}
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
                                        onStart: actions.onDragWidgetStart,
                                        onEnd: actions.onDragWidgetEnd
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

const mapDispatchToProps = (dispatch) => {
    return {
        uploadImage: (file, onFailure) => dispatch(actions.uploadImage('cnc', file, onFailure))
    };
};

export default connect(null, mapDispatchToProps)(Cnc);
