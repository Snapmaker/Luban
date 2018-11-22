import noop from 'lodash/noop';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Sortable from 'react-sortablejs';
import controller from '../../lib/controller';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import LaserVisualizer from '../../widgets/LaserVisualizer';
import Widget from '../../widgets/Widget';
import Dropzone from '../../components/Dropzone';
import { actions } from '../../reducers/modules/laser';
import styles from './styles.styl';


class Laser extends Component {
    static propTypes = {
        // redux state like '.png, .jpg, .jpeg, .bmp'
        accept: PropTypes.string.isRequired,
        // redux actions
        uploadImage: PropTypes.func.isRequired,
        changeWorkState: PropTypes.func.isRequired
    };

    state = {
        widgets: ['laser-params', 'laser-generate-gcode', 'laser-output']
    };

    actions = {
        onDropAccepted: (file) => {
            this.props.uploadImage(file, () => {
                modal({
                    title: i18n._('Parse Image Error'),
                    body: i18n._('Failed to parse image file {{filename}}', { filename: file.name })
                });
            });
        },
        onDropRejected: () => {
            modal({
                title: i18n._('Warning'),
                body: i18n._('Only {{accept}} files are supported.', { accept: this.props.accept })
            });
        }
    };

    widgetMap = {};

    controllerEvents = {
        'workflow:state': (workflowState) => {
            this.props.changeWorkState(workflowState);
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
        const { style, accept } = this.props;

        const widgets = this.state.widgets.map((widgetId) => this.widgetMap[widgetId]);

        const dragEnterMsg = (accept === '.svg' ? i18n._('Drop an SVG file here.') : i18n._('Drop an image file here.'));

        return (
            <div style={style}>
                <Dropzone
                    accept={accept}
                    dragEnterMsg={dragEnterMsg}
                    onDropAccepted={this.actions.onDropAccepted}
                    onDropRejected={this.actions.onDropRejected}
                >
                    <div className={styles['laser-table']}>
                        <div className={styles['laser-table-row']}>
                            <div className={styles['view-space']}>
                                <LaserVisualizer
                                    widgetId="laserVisualizer"
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
                </Dropzone>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        accept: state.laser.source.accept
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        uploadImage: (file, onFailure) => dispatch(actions.uploadImage(file, onFailure)),
        changeWorkState: (state) => dispatch(actions.changeWorkState(state))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Laser);
