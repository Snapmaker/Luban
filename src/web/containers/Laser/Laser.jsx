import noop from 'lodash/noop';
import React, { Component } from 'react';
import path from 'path';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Sortable from 'react-sortablejs';
import controller from '../../lib/controller';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import LaserVisualizer from '../../widgets/LaserVisualizer';
import Widget from '../../widgets/Widget';
import Dropzone from '../../components/Dropzone';
import { actions } from '../../reducers/laser';
import styles from './styles.styl';

const ACCEPT = '.svg, .png, .jpg, .jpeg, .bmp';

class Laser extends Component {
    static propTypes = {
        uploadImage: PropTypes.func.isRequired,
        changeWorkState: PropTypes.func.isRequired
    };

    state = {
        widgets: ['laser-set-background', 'laser-params', 'laser-output']
    };

    actions = {
        // todo: show UI then select process mode
        onDropAccepted: (file) => {
            let mode = 'bw';
            if (path.extname(file.name).toLowerCase() === '.svg') {
                mode = 'vector';
            }
            this.props.uploadImage(file, mode, () => {
                modal({
                    title: i18n._('Parse Image Error'),
                    body: i18n._('Failed to parse image file {{filename}}', { filename: file.name })
                });
            });
        },
        onDropRejected: () => {
            modal({
                title: i18n._('Warning'),
                body: i18n._('Only {{ACCEPT}} files are supported.', { ACCEPT })
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
        const { style } = this.props;

        const widgets = this.state.widgets.map((widgetId) => this.widgetMap[widgetId]);

        const dragEnterMsg = i18n._('Drop an image file here.');

        return (
            <div style={style}>
                <Dropzone
                    accept={ACCEPT}
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

const mapDispatchToProps = (dispatch) => {
    return {
        uploadImage: (file, mode, onFailure) => dispatch(actions.uploadImage(file, mode, onFailure)),
        changeWorkState: (state) => dispatch(actions.changeWorkState(state))
    };
};

// https://stackoverflow.com/questions/47657365/can-i-mapdispatchtoprops-without-mapstatetoprops-in-redux
export default connect(null, mapDispatchToProps)(Laser);
