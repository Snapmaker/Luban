import React, { PureComponent } from 'react';
import Sortable from 'react-sortablejs';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import pubsub from 'pubsub-js';
import Widget from '../../widgets/Widget';
import PrintingVisualizer from '../../widgets/PrintingVisualizer';
import styles from '../layout.styl';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import Dropzone from '../../components/Dropzone';
import { ACTION_3DP_LOAD_MODEL } from '../../constants';
import { actions } from '../../reducers/printing';


class Printing extends PureComponent {
    static propTypes = {
        hidden: PropTypes.bool.isRequired,
        init: PropTypes.func.isRequired
    };

    state = {
        widgets: ['3dp-material', '3dp-configurations', '3dp-output'],
        isDraggingWidget: false
    };

    widgetMap = {};
    widgets = [];

    onChangeWidgetOrder = (widgets) => {
        this.widgets = widgets.map((widgetId) => this.widgetMap[widgetId]);
        this.setState({ widgets });
    };

    actions = {
        onDropAccepted: (file) => {
            pubsub.publish(ACTION_3DP_LOAD_MODEL, file);
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

    componentDidMount() {
        this.props.init();
    }

    render() {
        const hidden = this.props.hidden;
        const actions = this.actions;
        const state = this.state;
        return (
            <div style={{ display: hidden ? 'none' : 'block' }}>
                <Dropzone
                    disabled={state.isDraggingWidget}
                    accept=".stl, .obj"
                    dragEnterMsg={i18n._('Drop an STL/OBJ file here.')}
                    onDropAccepted={actions.onDropAccepted}
                    onDropRejected={actions.onDropRejected}
                >
                    <div className={styles['content-table']}>
                        <div className={styles['content-row']}>
                            <div className={styles.visualizer}>
                                <PrintingVisualizer widgetId="threeDPrintingVisualizer" />
                            </div>
                            <form className={styles.controls} noValidate={true}>
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
                                        onStart: actions.onDragWidgetStart,
                                        onEnd: actions.onDragWidgetEnd
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
        init: () => dispatch(actions.init())
    };
};

export default connect(null, mapDispatchToProps)(Printing);
