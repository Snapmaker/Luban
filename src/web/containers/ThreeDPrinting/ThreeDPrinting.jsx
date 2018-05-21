import React, { PureComponent } from 'react';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import _ from 'lodash';
import pubsub from 'pubsub-js';
import {
    DEFAULT_MATERIAL_PLA_PARAMS,
    ACTION_REQ_GENERATE_GCODE_3DP,
    ACTION_REQ_LOAD_GCODE_3DP,
    ACTION_REQ_EXPORT_GCODE_3DP
} from '../../constants';
import Widget from '../../widgets/Widget';
import Sortable from '../../components/Widget/Sortable';
import ThreeDPrintingVisualizer from '../../widgets/ThreeDPrintingVisualizer';
import styles from '../layout.styl';


class ThreeDPrinting extends PureComponent {
    static propTypes = {
        hidden: PropTypes.bool.isRequired
    };

    state = {
        widgets: ['3dp-material', '3dp-configurations', '3dp-output'],

        // material & support
        material: 'PLA',
        materialParams: DEFAULT_MATERIAL_PLA_PARAMS,
        adhesion: 'none',
        support: 'none'
    };

    subscriptions = [];

    componentDidMount() {
        this.subscriptions = [
            pubsub.subscribe(ACTION_REQ_GENERATE_GCODE_3DP, () => {
                // TODO: generate G-code here
            }),
            pubsub.subscribe(ACTION_REQ_LOAD_GCODE_3DP, () => {
                // TODO: load G-code here
            }),
            pubsub.subscribe(ACTION_REQ_EXPORT_GCODE_3DP, () => {
                // TODO: export G-code here
            })
        ];
    }

    componentWillUnmount() {
        this.subscriptions.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        this.subscriptions = [];
    }

    render() {
        const hidden = this.props.hidden;

        const widgets = this.state.widgets
            .map((widgetId) => (
                <div data-widget-id={widgetId} key={widgetId}>
                    <Widget widgetId={widgetId} />
                </div>
            ));

        return (
            <div style={{ display: hidden ? 'none' : 'block' }}>
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
                                onChange={(order) => {
                                    this.setState({ widgets: order });
                                }}
                            />
                            {widgets}
                        </form>
                    </div>
                </div>
            </div>
        );
    }
}

export default withRouter(ThreeDPrinting);
