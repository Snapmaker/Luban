import React, { PureComponent } from 'react';
import { withRouter } from 'react-router-dom';
import Sortable from 'react-sortablejs';
import PropTypes from 'prop-types';
import _ from 'lodash';
import pubsub from 'pubsub-js';
import Widget from '../../widgets/Widget';
import ThreeDPrintingVisualizer from '../../widgets/ThreeDPrintingVisualizer';
import styles from '../layout.styl';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import Dropzone from '../../components/Dropzone';
import { ACTION_3DP_LOAD_MODEL } from '../../constants';


class ThreeDPrinting extends PureComponent {
    static propTypes = {
        hidden: PropTypes.bool.isRequired
    };

    state = {
        widgets: ['3dp-material', '3dp-configurations', '3dp-output']
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

    render() {
        const hidden = this.props.hidden;
        const actions = this.actions;
        return (
            <div style={{ display: hidden ? 'none' : 'block' }}>
                <Dropzone
                    accept=".stl, .obj"
                    dragEnterMsg={i18n._('Drop an STL/OBJ file here.')}
                    onDropAccepted={(file) => {
                        actions.onDropAccepted(file);
                    }}
                    onDropRejected={() => {
                        actions.onDropRejected();
                    }}
                >
                    <div className={styles['content-table']}>
                        <div className={styles['content-row']}>
                            <div className={styles.visualizer}>
                                <ThreeDPrintingVisualizer widgetId="threeDPrintingVisualizer" />
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
                                        onStart: _.noop,
                                        onEnd: _.noop
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

export default withRouter(ThreeDPrinting);
