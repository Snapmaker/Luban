import noop from 'lodash/noop';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Sortable from 'react-sortablejs';
import controller from '../../lib/controller';
import LaserVisualizer from '../../widgets/LaserVisualizer';
import Widget from '../../widgets/Widget';
import { actions } from '../../reducers/modules/laser';
import styles from './index.styl';


class Laser extends Component {
    static propTypes = {
        source: PropTypes.object.isRequired,
        target: PropTypes.object.isRequired,

        // redux actions
        changeWorkState: PropTypes.func.isRequired
    };

    state = {
        widgets: ['laser-params', 'laser-generate-gcode', 'laser-output']
    };

    widgetMap = {};

    controllerEvents = {
        'workflow:state': (workflowState) => {
            this.props.changeWorkState(workflowState);
        }
    };

    constructor(props) {
        super(props);

        for (let widgetId of this.state.widgets) {
            this.widgetMap[widgetId] = (
                <div data-widget-id={widgetId} key={widgetId}>
                    <Widget widgetId={widgetId} />
                </div>
            );
        }
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

    onChangeWidgetOrder = (widgets) => {
        this.setState({ widgets });
    };

    render() {
        const { style } = this.props;

        const widgets = this.state.widgets.map((widgetId) => this.widgetMap[widgetId]);

        return (
            <div style={style}>
                <div className={styles['laser-table']}>
                    <div className={styles['laser-table-row']}>
                        <div className={styles['view-space']}>
                            <LaserVisualizer
                                widgetId="laserVisualizer"
                                source={this.props.source}
                                target={this.props.target}
                            />
                        </div>

                        <form className={styles['control-bar']} noValidate={true}>
                            <Sortable
                                options={{
                                    animation: 150,
                                    delay: 0,
                                    group: {
                                        name: 'laser-control'
                                    },
                                    handle: '.sortable-handle',
                                    filter: '.sortable-filter',
                                    chosenClass: 'sortable-chosen',
                                    ghostClass: 'sortable-ghost',
                                    dataIdAttr: 'data-widget-id',
                                    onStart: noop,
                                    onEnd: noop
                                }}
                                onChange={this.onChangeWidgetOrder}
                            >
                                {widgets}
                            </Sortable>
                        </form>
                    </div>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        source: state.laser.source,
        target: state.laser.target
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        changeWorkState: (state) => dispatch(actions.changeWorkState(state))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Laser);
