import React, { PureComponent } from 'react';
import { withRouter } from 'react-router-dom';
import Sortable from 'react-sortablejs';
import PropTypes from 'prop-types';
import _ from 'lodash';
import Widget from '../../widgets/Widget';
import ThreeDPrintingVisualizer from '../../widgets/ThreeDPrintingVisualizer';
import styles from '../layout.styl';


class ThreeDPrinting extends PureComponent {
    static propTypes = {
        hidden: PropTypes.bool.isRequired
    };

    state = {
        widgets: ['3dp-material', '3dp-configurations', '3dp-output']
    };

    widgetMap = {};
    widgets = [];

    constructor(props) {
        super(props);

        for (let widgetId of this.state.widgets) {
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
                                onChange={this.onChangeWidgetOrder}
                            >
                                {this.widgets}
                            </Sortable>
                        </form>
                    </div>
                </div>
            </div>
        );
    }
}

export default withRouter(ThreeDPrinting);
