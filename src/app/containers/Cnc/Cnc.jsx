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
import { actions as widgetActions } from '../../flux/widget';
import { actions as editorActions } from '../../flux/editor';

import styles from './styles.styl';


const ACCEPT = '.svg, .png, .jpg, .jpeg, .bmp, .dxf, .stl';

class Cnc extends Component {
    static propTypes = {
        style: PropTypes.object,
        widgets: PropTypes.array.isRequired,
        uploadImage: PropTypes.func.isRequired,
        updateTabContainer: PropTypes.func.isRequired
    };

    state = {
        isDraggingWidget: false
    };

    actions = {
        onDropAccepted: (file) => {
            let mode = 'greyscale';
            if (path.extname(file.name).toLowerCase() === '.svg' || path.extname(file.name).toLowerCase() === '.dxf') {
                mode = 'vector';
            }
            this.props.uploadImage(file, mode, () => {
                modal({
                    title: i18n._('Parse Error'),
                    body: i18n._('Failed to parse image file {{}}.', { filename: file.name })
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
            this.props.updateTabContainer({ widgets });
        }
    };


    render() {
        const style = this.props.style;
        const state = this.state;
        const widgets = this.props.widgets;

        return (
            <div style={style}>
                <div className={styles['cnc-table']}>
                    <div className={styles['cnc-table-row']}>
                        <Dropzone
                            disabled={state.isDraggingWidget}
                            accept={ACCEPT}
                            dragEnterMsg={i18n._('Drop an image file here.')}
                            onDropAccepted={this.actions.onDropAccepted}
                            onDropRejected={this.actions.onDropRejected}
                        >
                            <div className={styles['view-space']}>
                                <CNCVisualizer />
                            </div>
                        </Dropzone>
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
                                {widgets.map(widget => {
                                    return (
                                        <div data-widget-id={widget} key={widget}>
                                            <Widget widgetId={widget} headType="cnc" />
                                        </div>
                                    );
                                })}
                            </Sortable>
                        </form>
                    </div>
                </div>
            </div>
        );
    }
}
const mapStateToProps = (state) => {
    const widget = state.widget;
    const widgets = widget.cnc.default.widgets;
    return {
        widgets
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        uploadImage: (file, mode, onFailure) => dispatch(editorActions.uploadImage('cnc', file, mode, onFailure)),
        updateTabContainer: (widgets) => dispatch(widgetActions.updateTabContainer('cnc', 'default', widgets))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Cnc);
