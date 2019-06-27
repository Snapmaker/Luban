import React, { PureComponent } from 'react';
import Sortable from 'react-sortablejs';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Widget from '../../widgets/Widget';
import PrintingVisualizer from '../../widgets/PrintingVisualizer';
import styles from '../layout.styl';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import Dropzone from '../../components/Dropzone';
import { actions } from '../../redux/printing';


class Printing extends PureComponent {
    static propTypes = {
        hidden: PropTypes.bool.isRequired,
        uploadModel: PropTypes.func.isRequired
    };

    state = {
        widgets: ['3dp-material', '3dp-configurations', '3dp-output'],
        isDraggingWidget: false
    };

    widgetMap = {};

    widgets = [];

    actions = {
        onDropAccepted: async (file) => {
            try {
                await this.props.uploadModel(file);
            } catch (e) {
                modal({
                    title: i18n._('Failed to upload model.'),
                    body: e.message
                });
            }
        },
        onDropRejected: () => {
            const title = i18n._('Warning');
            const body = i18n._('Only STL/OBJ files are supported.');
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
        }
    };

    constructor(props) {
        super(props);

        for (const widgetId of this.state.widgets) {
            this.widgetMap[widgetId] = (
                <div data-widget-id={widgetId} key={widgetId}>
                    <Widget widgetId={widgetId} />
                </div>
            );
        }
        this.widgets = this.state.widgets.map((widgetId) => this.widgetMap[widgetId]);
    }

    onChangeWidgetOrder = (widgets) => {
        this.widgets = widgets.map((widgetId) => this.widgetMap[widgetId]);
        this.setState({ widgets });
    };

    render() {
        const hidden = this.props.hidden;
        const state = this.state;
        return (
            <div style={{ display: hidden ? 'none' : 'block' }}>
                <Dropzone
                    disabled={state.isDraggingWidget}
                    accept=".stl, .obj"
                    dragEnterMsg={i18n._('Drop an STL/OBJ file here.')}
                    onDropAccepted={this.actions.onDropAccepted}
                    onDropRejected={this.actions.onDropRejected}
                >
                    <div className={styles['content-table']}>
                        <div className={styles['content-row']}>
                            <div className={styles.visualizer}>
                                <PrintingVisualizer widgetId="printingVisualizer" />
                            </div>
                            <form className={styles.controls} noValidate>
                                <Sortable
                                    options={{
                                        animation: 150,
                                        delay: 0,
                                        group: {
                                            name: '3dp-control'
                                        },
                                        handle: '.sortable-handle',
                                        filter: '.sortable-filter',
                                        chosenClass: 'sortable-chosen',
                                        ghostClass: 'sortable-ghost',
                                        dataIdAttr: 'data-widget-id',
                                        onStart: this.actions.onDragWidgetStart,
                                        onEnd: this.actions.onDragWidgetEnd
                                    }}
                                    onChange={this.onChangeWidgetOrder}
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
        uploadModel: (file) => dispatch(actions.uploadModel(file))
    };
};

export default connect(null, mapDispatchToProps)(Printing);
