import path from 'path';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Sortable from 'react-sortablejs';
import classNames from 'classnames';
import jQuery from 'jquery';
import pubsub from 'pubsub-js';
import i18n from '../../lib/i18n';
import {
    WEB_CACHE_IMAGE,
    BOUND_SIZE,
    STAGE_IMAGE_LOADED,
    STAGE_PREVIEWED,
    STAGE_GENERATED,
    DEFAULT_VECTOR_IMAGE,
    DEFAULT_SIZE_WIDTH,
    DEFAULT_SIZE_HEIGHT,
    ACTION_REQ_PREVIEW_CNC,
    ACTION_REQ_GENERATE_GCODE_CNC,
    ACTION_CHANGE_IMAGE_CNC,
    ACTION_CHANGE_TOOL,
    ACTION_CHANGE_PATH,
    ACTION_CHANGE_GENERATE_GCODE_CNC
} from '../../constants';
import modal from '../../lib/modal';
import controller from '../../lib/controller';
import api from '../../api';
import LaserVisualizer from '../../widgets/LaserVisualizer';
import Widget from '../../widgets/Widget';
import { actions } from '../../reducers/modules/cnc';
import styles from './styles.styl';


class Laser extends Component {
    static propTypes = {
        stage: PropTypes.number.isRequired,
        workState: PropTypes.string.isRequired,
        output: PropTypes.object.isRequired,
        changeStage: PropTypes.func.isRequired,
        changeWorkState: PropTypes.func.isRequired,
        changeOutputGcodePath: PropTypes.func.isRequired
    };

    state = this.getInitialState();

    fileInputEl = null;

    widgetMap = {};
    widgets = [];

    actions = {
        // element events
        onClickToUpload: () => {
            this.fileInputEl.value = null;
            this.fileInputEl.click();
        },
        onChangeFile: (event) => {
            const file = event.target.files[0];
            const formData = new FormData();
            formData.append('image', file);

            api.uploadImage(formData).then((res) => {
                const image = res.body;
                this.parseImage(image);
            }).catch(() => {
                modal({
                    title: 'Parse Image Error',
                    body: `Failed to parse image file ${file.name}`
                });
            });
        },
        onLoadGcode: () => {
            const gcodePath = `${WEB_CACHE_IMAGE}/${this.state.gcodePath}`;
            document.location.href = '/#/workspace';
            window.scrollTo(0, 0);
            jQuery.get(gcodePath, (result) => {
                pubsub.publish('gcode:upload', { gcode: result, meta: { name: gcodePath } });
            });
        },
        onExport: () => {
            // https://stackoverflow.com/questions/3682805/javascript-load-a-page-on-button-click
            const gcodePath = this.state.gcodePath;
            const filename = path.basename(gcodePath);
            document.location.href = '/api/gcode/download_cache?filename=' + filename;
        }
    };

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
            pubsub.subscribe(ACTION_CHANGE_TOOL, (msg, data) => {
                this.setState(data);
            }),
            pubsub.subscribe(ACTION_CHANGE_PATH, (msg, data) => {
                this.setState(data);
                if (this.props.stage !== STAGE_IMAGE_LOADED) {
                    this.props.changeStage(STAGE_IMAGE_LOADED);
                }
            }),
            pubsub.subscribe(ACTION_CHANGE_GENERATE_GCODE_CNC, (msg, data) => {
                this.setState(data);
                if (this.props.stage !== STAGE_PREVIEWED) {
                    this.props.changeStage(STAGE_PREVIEWED);
                }
            }),
            pubsub.subscribe(ACTION_REQ_PREVIEW_CNC, () => {
                // TODO: draw outline of polygon and show
                this.props.changeStage(STAGE_PREVIEWED);
            }),
            pubsub.subscribe(ACTION_REQ_GENERATE_GCODE_CNC, () => {
                // controller.generateGcode(this.state);
                // TODO: avoid use this.state
                api.generateGCode(this.state).then((res) => {
                    const { gcodePath } = res.body;
                    this.props.changeStage(STAGE_GENERATED);
                    this.props.changeOutputGcodePath(gcodePath);
                });
            })
        ];
    }

    parseImage(image) {
        // check ranges of width / height
        const ratio = image.width / image.height;
        let width = image.width;
        let height = image.height;
        if (width >= height && width > BOUND_SIZE) {
            width = BOUND_SIZE;
            height = BOUND_SIZE / ratio;
        }
        if (height >= width && height > BOUND_SIZE) {
            width = BOUND_SIZE * ratio;
            height = BOUND_SIZE;
        }

        const imageInfo = {
            originSrc: `${WEB_CACHE_IMAGE}/${image.filename}`,
            imageSrc: `${WEB_CACHE_IMAGE}/${image.filename}`,
            originWidth: image.width,
            originHeight: image.height,
            sizeWidth: width,
            sizeHeight: height
        };

        this.setState(imageInfo);
        pubsub.publish(ACTION_CHANGE_IMAGE_CNC, imageInfo);

        this.props.changeStage(STAGE_IMAGE_LOADED);
    }

    unsubscribe() {
        this.subscriptions.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        this.subscriptions = [];
    }

    getInitialState() {
        return {
            widgets: ['cnc-tool', 'cnc-path', 'cnc-generate-gcode', 'cnc-output'],

            // model parameters
            type: 'cnc',
            mode: 'vector',

            // common
            originSrc: DEFAULT_VECTOR_IMAGE,
            originWidth: DEFAULT_SIZE_WIDTH,
            originHeight: DEFAULT_SIZE_HEIGHT,
            imageSrc: DEFAULT_VECTOR_IMAGE,
            sizeWidth: DEFAULT_SIZE_WIDTH / 10,
            sizeHeight: DEFAULT_SIZE_HEIGHT / 10,

            // status
            stage: STAGE_IMAGE_LOADED,
            isWorking: false, // Prevent CPU-critical job during printing

            // tool parameters
            toolDiameter: 3.175, // tool diameter (in mm)
            toolAngle: 30, // tool angle (in degree, defaults to 30° for V-Bit)

            // path parameters
            pathType: 'path', // default
            targetDepth: 2.2,
            stepDown: 0.8,
            safetyHeight: 3,
            stopHeight: 10,
            anchor: 'center',
            clip: true,
            // tab
            enableTab: false,
            tabWidth: 2,
            tabHeight: -1,
            tabSpace: 24,

            // G-code parameters
            jogSpeed: 800,
            workSpeed: 300,
            plungeSpeed: 500
        };
    }

    render() {
        const style = this.props.style;
        const state = { ...this.state };
        const actions = { ...this.actions };

        const source = {
            image: this.state.imageSrc,
            processed: this.state.imageSrc,
            width: this.state.originWidth,
            height: this.state.originHeight
        };

        const alignment2anchor = (alignment) => {
            if (alignment === 'center') {
                return 'Center';
            } else {
                return 'Bottom Left';
            }
        };
        const target = {
            width: this.state.sizeWidth,
            height: this.state.sizeHeight,
            anchor: alignment2anchor(this.state.alignment)
        };

        return (
            <div style={style}>
                <div className={styles['laser-table']}>
                    <div className={styles['laser-table-row']}>
                        <div className={styles['view-space']}>
                            <div style={{ position: 'absolute', top: '47px', left: '15px', zIndex: '300' }}>
                                <input
                                    ref={(node) => {
                                        this.fileInputEl = node;
                                    }}
                                    type="file"
                                    accept={state.mode === 'vector' ? '.svg' : '.png, .jpg, .jpeg, .bmp'}
                                    style={{ display: 'none' }}
                                    multiple={false}
                                    onChange={actions.onChangeFile}
                                />
                                <button
                                    type="button"
                                    className={classNames(styles.btn, styles['btn-upload'])}
                                    title="Upload File"
                                    onClick={actions.onClickToUpload}
                                >
                                    {i18n._('Upload SVG File')}
                                </button>
                            </div>
                            <LaserVisualizer
                                widgetId="laserVisualizer"
                                source={source}
                                target={target}
                                state={state}
                            />
                        </div>

                        <form className={styles['control-bar']} noValidate={true}>
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
                                    onStart: () => {},
                                    onEnd: () => {}
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

const mapStateToProps = (state) => {
    return {
        stage: state.cnc.stage,
        workState: state.cnc.workState,
        output: state.cnc.output
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        changeStage: (stage) => dispatch(actions.changeStage(stage)),
        changeWorkState: (workState) => dispatch(actions.changeWorkState(workState)),
        changeOutputGcodePath: (gcodePath) => dispatch(actions.changeOutputGcodePath(gcodePath))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Laser);
