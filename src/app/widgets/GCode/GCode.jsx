import _ from 'lodash';
import pubsub from 'pubsub-js';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { controller } from '../../lib/controller';
import { mm2in } from '../../lib/units';
import GCodeStates from './GCodeStats';
import {
    // Units
    PROTOCOL_TEXT,
    IMPERIAL_UNITS,
    METRIC_UNITS
} from '../../constants';
import i18n from '../../lib/i18n';

const toFixedUnits = (units, val) => {
    val = Number(val) || 0;
    if (units === IMPERIAL_UNITS) {
        val = mm2in(val).toFixed(4);
    }
    if (units === METRIC_UNITS) {
        val = val.toFixed(3);
    }

    return val;
};

class GCode extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,

        server: PropTypes.object.isRequired
    };

    state = this.getInitialState();

    actions = {
        toggleFullscreen: () => {
            const { minimized, isFullscreen } = this.state;
            this.setState({
                minimized: isFullscreen ? minimized : false,
                isFullscreen: !isFullscreen
            });
        },
        toggleMinimized: () => {
            const { minimized } = this.state;
            this.setState({ minimized: !minimized });
        },
        onChangeVar: (key, value) => {
            this.state.varValue[key] = value;
        },
        onTest: (key) => {
            if (key === 'var1') {
                this.props.server.uploadLaserPower(this.state.varValue[key]);
            } else if (key === 'var2') {
                this.props.server.uploadWorkSpeedFactor(this.state.varValue[key]);
            } else if (key === 'var3') {
                this.props.server.uploadNozzleTemperature(this.state.varValue[key]);
            } else if (key === 'var4') {
                this.props.server.uploadBedTemperature(this.state.varValue[key]);
            }
        }
    };

    controllerEvents = {
        'serialport:open': (options) => {
            const { port, dataSource } = options;
            if (dataSource !== PROTOCOL_TEXT) {
                return;
            }
            this.setState({ port: port });
        },
        'serialport:close': (options) => {
            const { dataSource } = options;
            if (dataSource !== PROTOCOL_TEXT) {
                return;
            }
            const initialState = this.getInitialState();
            this.setState({ ...initialState });
        },
        // 'sender:status': (data, dataSource) => {
        'sender:status': (options) => {
            const { data, dataSource } = options;
            if (dataSource !== PROTOCOL_TEXT) {
                return;
            }
            const { total, sent, received, startTime, finishTime, elapsedTime, remainingTime } = data;
            this.setState({
                total,
                sent,
                received,
                startTime,
                finishTime,
                elapsedTime,
                remainingTime
            });
        },
        'workflow:state': (options) => {
            const { workflowState, dataSource } = options;
            if (dataSource !== PROTOCOL_TEXT) {
                return;
            }
            if (this.state.workflowState !== workflowState) {
                this.setState({ workflowState });
            }
        }
    };

    pubsubTokens = [];

    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('G-Code'));
    }

    getInitialState() {
        return {
            port: controller.port,
            units: METRIC_UNITS,
            workflowState: controller.workflowState,

            // G-code Status (from server)
            total: 0,
            sent: 0,
            received: 0,
            startTime: 0,
            finishTime: 0,
            elapsedTime: 0,
            remainingTime: 0,

            // Bounding box
            bbox: {
                min: {
                    x: 0,
                    y: 0,
                    z: 0
                },
                max: {
                    x: 0,
                    y: 0,
                    z: 0
                },
                delta: {
                    x: 0,
                    y: 0,
                    z: 0
                }
            },
            varValue: {}
        };
    }

    componentDidMount() {
        this.subscribe();
        this.addControllerEvents();
    }

    componentWillUnmount() {
        this.removeControllerEvents();
        this.unsubscribe();
    }

    subscribe() {
        const tokens = [
            pubsub.subscribe('gcode:unload', () => {
                this.setState({
                    bbox: {
                        min: {
                            x: 0,
                            y: 0,
                            z: 0
                        },
                        max: {
                            x: 0,
                            y: 0,
                            z: 0
                        },
                        delta: {
                            x: 0,
                            y: 0,
                            z: 0
                        }
                    }
                });
            }),
            pubsub.subscribe('gcode:bbox', (msg, bbox) => {
                const dX = bbox.max.x - bbox.min.x;
                const dY = bbox.max.y - bbox.min.y;
                const dZ = bbox.max.z - bbox.min.z;

                this.setState({
                    bbox: {
                        min: {
                            x: bbox.min.x,
                            y: bbox.min.y,
                            z: bbox.min.z
                        },
                        max: {
                            x: bbox.max.x,
                            y: bbox.max.y,
                            z: bbox.max.z
                        },
                        delta: {
                            x: dX,
                            y: dY,
                            z: dZ
                        }
                    }
                });
            })
        ];
        this.pubsubTokens = this.pubsubTokens.concat(tokens);
    }

    unsubscribe() {
        this.pubsubTokens.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        this.pubsubTokens = [];
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

    render() {
        const { units, bbox } = this.state;
        const state = {
            ...this.state,
            bbox: _.mapValues(bbox, (position) => {
                position = _.mapValues(position, (val) => toFixedUnits(units, val));
                return position;
            })
        };
        const actions = {
            ...this.actions
        };

        return (
            <GCodeStates
                state={state}
                actions={actions}
            />
        );
    }
}

const mapStateToProps = (state) => {
    const { server } = state.machine;

    return {
        server
    };
};


export default connect(mapStateToProps)(GCode);
