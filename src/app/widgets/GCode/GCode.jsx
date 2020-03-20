import _ from 'lodash';
import moment from 'moment';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { controller } from '../../lib/controller';
import { mm2in } from '../../lib/units';
import {
    // Units
    PROTOCOL_TEXT,
    IMPERIAL_UNITS,
    METRIC_UNITS
} from '../../constants';
import i18n from '../../lib/i18n';
import styles from './index.styl';

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

const formatISODateTime = (time) => {
    return time > 0 ? moment.unix(time / 1000).format('YYYY-MM-DD HH:mm:ss') : '–';
};

const formatElapsedTime = (elapsedTime) => {
    if (!elapsedTime || elapsedTime < 0) {
        return '–';
    }
    const d = moment.duration(elapsedTime, 'ms');
    return moment(d._data).format('HH:mm:ss');
};

const formatRemainingTime = (remainingTime) => {
    if (!remainingTime || remainingTime < 0) {
        return '–';
    }
    const d = moment.duration(remainingTime, 'ms');
    return moment(d._data).format('HH:mm:ss');
};

class GCode extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,

        boundingBox: PropTypes.object,
        gcodePrintingInfo: PropTypes.shape({
            sent: PropTypes.number,
            received: PropTypes.number,
            total: PropTypes.number,
            startTime: PropTypes.number,
            finishTime: PropTypes.number,
            elapsedTime: PropTypes.number,
            remainingTime: PropTypes.number
        })
    };

    state = this.getInitialState();

    actions = {

    };

    controllerEvents = {
        'serialport:close': (options) => {
            const { dataSource } = options;
            if (dataSource !== PROTOCOL_TEXT) {
                return;
            }
            const initialState = this.getInitialState();
            this.setState({ ...initialState });
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

    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('G-code'));
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
        this.addControllerEvents();
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.boundingBox !== this.props.boundingBox) {
            if (nextProps.boundingBox === null) {
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
            } else {
                const bbox = nextProps.boundingBox;
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
            }
        }
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

    render() {
        const { gcodePrintingInfo } = this.props;
        const { total, sent, received } = gcodePrintingInfo;
        const state = {
            ...this.state,
            bbox: _.mapValues(this.state.bbox, (position) => {
                position = _.mapValues(position, (val) => toFixedUnits(this.state.units, val));
                return position;
            })
        };
        const { units, bbox } = state;
        const displayUnits = (units === METRIC_UNITS) ? i18n._('mm') : i18n._('in');
        const startTime = formatISODateTime(gcodePrintingInfo.startTime);
        const finishTime = formatISODateTime(gcodePrintingInfo.finishTime);
        const elapsedTime = formatElapsedTime(gcodePrintingInfo.elapsedTime);
        const remainingTime = formatRemainingTime(gcodePrintingInfo.remainingTime);

        return (
            <div className={styles['gcode-stats']}>
                <div className="row no-gutters" style={{ marginBottom: 10 }}>
                    <div className="col-xs-12">
                        <table className="table-bordered" data-table="dimension">
                            <thead>
                                <tr>
                                    <th className={styles.axis}>{i18n._('Axis')}</th>
                                    <th>{i18n._('Min')}</th>
                                    <th>{i18n._('Max')}</th>
                                    <th>{i18n._('Dimension')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className={styles.axis}>X</td>
                                    <td>{bbox.min.x} {displayUnits}</td>
                                    <td>{bbox.max.x} {displayUnits}</td>
                                    <td>{bbox.delta.x} {displayUnits}</td>
                                </tr>
                                <tr>
                                    <td className={styles.axis}>Y</td>
                                    <td>{bbox.min.y} {displayUnits}</td>
                                    <td>{bbox.max.y} {displayUnits}</td>
                                    <td>{bbox.delta.y} {displayUnits}</td>
                                </tr>
                                <tr>
                                    <td className={styles.axis}>Z</td>
                                    <td>{bbox.min.z} {displayUnits}</td>
                                    <td>{bbox.max.z} {displayUnits}</td>
                                    <td>{bbox.delta.z} {displayUnits}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="row no-gutters" style={{ marginBottom: 10 }}>
                    <div className="col-xs-6">
                        <div>{i18n._('Sent')}</div>
                        <div>{total > 0 ? `${sent} / ${total}` : '–'}</div>
                    </div>
                    <div className="col-xs-6">
                        <div>{i18n._('Received')}</div>
                        <div>{total > 0 ? `${received} / ${total}` : '–'}</div>
                    </div>
                </div>
                <div className="row no-gutters" style={{ marginBottom: 10 }}>
                    <div className="col-xs-6">
                        <div>{i18n._('Start Time')}</div>
                        <div>{startTime}</div>
                    </div>
                    <div className="col-xs-6">
                        <div>{i18n._('Elapsed Time')}</div>
                        <div>{elapsedTime}</div>
                    </div>
                </div>
                <div className="row no-gutters">
                    <div className="col-xs-6">
                        <div>{i18n._('Finish Time')}</div>
                        <div>{finishTime}</div>
                    </div>
                    <div className="col-xs-6">
                        <div>{i18n._('Remaining Time')}</div>
                        <div>{remainingTime}</div>
                    </div>
                </div>
            </div>
        );
    }
}
const mapStateToProps = (state) => {
    const { boundingBox } = state.workspace;
    const { gcodePrintingInfo } = state.machine;

    return {
        gcodePrintingInfo,
        boundingBox
    };
};

export default connect(mapStateToProps)(GCode);
