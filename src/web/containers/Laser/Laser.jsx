import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Sortable from 'react-sortablejs';
import pubsub from 'pubsub-js';
import i18n from '../../lib/i18n';
import {
    WEB_CACHE_IMAGE,
    STAGE_IMAGE_LOADED,
    STAGE_PREVIEWED,
    STAGE_GENERATED,
    DEFAULT_RASTER_IMAGE,
    DEFAULT_SIZE_WIDTH,
    DEFAULT_SIZE_HEIGHT,
    ACTION_CHANGE_IMAGE_LASER,
    ACTION_CHANGE_PARAMETER_LASER,
    ACTION_REQ_PREVIEW_LASER,
    ACTION_REQ_GENERATE_GCODE_LASER
} from '../../constants';
import controller from '../../lib/controller';
import api from '../../api';
import LaserVisualizer from '../../widgets/LaserVisualizer';
import Widget from '../../widgets/Widget';
import { actions } from '../../reducers/modules/laser';
import styles from './index.styl';


class Laser extends Component {
    static propTypes = {
        stage: PropTypes.number.isRequired,
        source: PropTypes.object.isRequired,
        target: PropTypes.object.isRequired,
        output: PropTypes.object.isRequired,
        changeStage: PropTypes.func.isRequired,
        changeWorkState: PropTypes.func.isRequired,
        changeSourceImage: PropTypes.func.isRequired,
        changeTargetSize: PropTypes.func.isRequired,
        changeOutputGcodePath: PropTypes.func.isRequired
    };

    state = this.getInitialState();

    widgetMap = {};
    widgets = [];

    controllerEvents = {
        'workflow:state': (workflowState) => {
            this.setState({ isWorking: workflowState === 'running' });
            this.props.changeWorkState(workflowState);
        }
    };

    subscriptions = [];

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

    componentDidMount() {
        this.addControllerEvents();
        this.subscribe();
    }
    componentWillUnmount() {
        this.removeControllerEvents();
        this.unsubscribe();
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
        this.widgets = widgets.map((widgetId) => this.widgetMap[widgetId]);
        this.setState({ widgets });
    };

    subscribe() {
        this.subscriptions = [
            pubsub.subscribe(ACTION_CHANGE_IMAGE_LASER, (msg, data) => {
                this.setState(data);
                this.props.changeStage(STAGE_IMAGE_LOADED);
            }),
            pubsub.subscribe(ACTION_CHANGE_PARAMETER_LASER, (msg, data) => {
                this.setState(data);
                if (this.props.stage !== STAGE_IMAGE_LOADED) {
                    this.props.changeStage(STAGE_IMAGE_LOADED);
                }
            }),
            // TODO: move to redux
            pubsub.subscribe(ACTION_REQ_PREVIEW_LASER, () => {
                if (this.state.mode === 'vector' && this.state.subMode === 'svg') {
                    this.props.changeStage(STAGE_PREVIEWED);
                } else {
                    api.processImage(this.state).then(res => {
                        const { filename } = res.body;
                        this.props.changeStage(STAGE_PREVIEWED);
                        this.props.changeSourceImage(`${WEB_CACHE_IMAGE}/${filename}`);
                    });
                }
            }),
            // FIXME: only works for modes: b&w, greyscale, vector
            pubsub.subscribe(ACTION_REQ_GENERATE_GCODE_LASER, () => {
                const options = {
                    ...this.state,
                    imageSrc: this.props.source.image,
                    jogSpeed: this.props.target.jogSpeed,
                    workSpeed: this.props.target.workSpeed,
                    dwellTime: this.props.target.dwellTime
                };
                api.generateGCode(options).then((res) => {
                    const { gcodePath } = res.body;
                    this.props.changeStage(STAGE_GENERATED);
                    this.props.changeOutputGcodePath(gcodePath);
                });
            })
        ];
    }

    unsubscribe() {
        this.subscriptions.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        this.subscriptions = [];
    }

    getInitialState() {
        return {
            widgets: ['laser-params', 'laser-generate-gcode', 'laser-output'],

            // ModeType
            type: 'laser',
            mode: 'bw',
            // status
            isWorking: false, // Prevent CPU-critical job during printing
            // common
            // jogSpeed: 1500,
            // workSpeed: 288,
            originSrc: DEFAULT_RASTER_IMAGE,
            originWidth: DEFAULT_SIZE_WIDTH,
            originHeight: DEFAULT_SIZE_HEIGHT,
            imageSrc: DEFAULT_RASTER_IMAGE,
            sizeWidth: DEFAULT_SIZE_WIDTH / 10,
            sizeHeight: DEFAULT_SIZE_HEIGHT / 10,
            // BW
            bwThreshold: 128,
            direction: 'Horizontal',
            density: 10, // BW & GrayScale
            // GrayScale
            contrast: 50,
            brightness: 50,
            whiteClip: 255,
            algorithm: 'FloyedSteinburg',
            // dwellTime: 42,
            // vector
            subMode: 'svg',
            alignment: 'clip',
            optimizePath: true,
            vectorThreshold: 128,
            isInvert: false,
            turdSize: 2
        };
    }

    render() {
        const style = this.props.style;
        const state = this.state;

        return (
            <div style={style}>
                <div className={styles['laser-table']}>
                    <div className={styles['laser-table-row']}>
                        <div className={styles['view-space']}>
                            <LaserVisualizer
                                widgetId="laserVisualizer"
                                source={this.props.source}
                                target={this.props.target}
                                state={state}
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
                                    onStart: () => {},
                                    onEnd: () => {}
                                }}
                                onChange={this.onChangeWidgetOrder}
                            >
                                {this.widgets}
                            </Sortable>

                            <div className={styles['warn-info']}>
                                {state.isWorking &&
                                <div className="alert alert-success" role="alert">
                                    {i18n._('Notice: You are printing! Pause the print if you want to preview again.')}
                                </div>
                                }
                                {!state.isWorking && this.props.stage < STAGE_IMAGE_LOADED &&
                                <div className="alert alert-info" role="alert">
                                    {i18n._('Please upload image!')}
                                </div>
                                }
                                {!state.isWorking && this.props.stage === STAGE_IMAGE_LOADED &&
                                <div className="alert alert-info" role="alert">
                                    {i18n._('Adjust parameter then preview!')}
                                </div>
                                }
                                {!state.isWorking && this.props.stage === STAGE_PREVIEWED &&
                                <div className="alert alert-info" role="alert">
                                    {i18n._('Adjust parameter then generate G-code!')}
                                </div>
                                }
                                {!state.isWorking && this.props.stage === STAGE_GENERATED &&
                                <div className="alert alert-info" role="alert">
                                    <p>{i18n._('Now you can:')}</p>
                                    <p>{i18n._('1. Click "Load" to load generated G-code and then you are ready for printing. Or')}</p>
                                    <p>{i18n._('2. Click "Export" to export generated G-code file for later printing.')}</p>
                                </div>
                                }
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        stage: state.laser.stage,
        source: state.laser.source,
        target: state.laser.target,
        output: state.laser.output
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        changeStage: (stage) => dispatch(actions.changeStage(stage)),
        changeWorkState: (state) => dispatch(actions.changeWorkState(state)),
        changeSourceImage: (image, width, height) => dispatch(actions.changeSourceImage(image, width, height)),
        changeTargetSize: (width, height) => dispatch(actions.changeTargetSize(width, height)),
        changeOutputGcodePath: (gcodePath) => dispatch(actions.changeOutputGcodePath(gcodePath))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Laser);
