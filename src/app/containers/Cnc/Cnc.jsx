import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Sortable from 'react-sortablejs';
import path from 'path';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import Dropzone from '../../components/Dropzone';
import CNCVisualizer from '../../widgets/CNCVisualizer';
import Widget from '../../widgets/Widget';
import { actions } from '../../reducers/cncLaserShared';
import styles from './styles.styl';

const ACCEPT = '.svg, .png, .jpg, .jpeg, .bmp';

class Cnc extends Component {
    static propTypes = {
        style: PropTypes.object,
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
            let mode = 'greyscale';
            if (path.extname(file.name).toLowerCase() === '.svg') {
                mode = 'vector';
            }
            this.props.uploadImage(file, mode, () => {
                modal({
                    title: i18n._('Parse Image Error'),
                    body: i18n._('Failed to parse image file {{}}', { filename: file.name })
                });
            });
        },
        onDropRejected: () => {
            modal({
                title: i18n._('Warning'),
                body: i18n._('Only {{accept}} files are supported.', { accept: ACCEPT })
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

        return (
            <div style={style}>
                <Dropzone
                    disabled={state.isDraggingWidget}
                    accept={ACCEPT}
                    dragEnterMsg={i18n._('Drop an image file here.')}
                    onDropAccepted={this.actions.onDropAccepted}
                    onDropRejected={this.actions.onDropRejected}
                >
                    <div className={styles['cnc-table']}>
                        <div className={styles['cnc-table-row']}>
                            <div className={styles['view-space']}>
                                <CNCVisualizer />
                            </div>

                            <form className={styles['control-bar']} noValidate>
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
                                        onStart: this.actions.onDragWidgetStart,
                                        onEnd: this.actions.onDragWidgetEnd
                                    }}
                                    onChange={this.actions.onChangeWidgetOrder}
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
        uploadImage: (file, mode, onFailure) => dispatch(actions.uploadImage('cnc', file, mode, onFailure))
    };
};

export default connect(null, mapDispatchToProps)(Cnc);
