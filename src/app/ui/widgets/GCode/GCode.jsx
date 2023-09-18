import _ from 'lodash';
import moment from 'moment';
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { controller } from '../../../communication/socket-communication';
import { mm2in } from '../../../lib/units';
import {
    // Units
    PROTOCOL_TEXT,
    IMPERIAL_UNITS,
    METRIC_UNITS
} from '../../../constants';
import i18n from '../../../lib/i18n';
// import SvgIcon from '../../components/SvgIcon';
// import Anchor from '../../components/Anchor';
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

export const formatDuration = (value, withSecond = true) => {
    if (!value || value < 0) {
        return '–';
    }
    const d = moment.duration(value, 'ms');
    const str = moment(d._data).format(`${withSecond ? 'H[h] mm[m] ss[s]' : 'H[h] m[m]'}`);
    if (d.days()) {
        return `${d.days()}d ${str}`;
    } else {
        return str;
    }
};

function getInitialState() {
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

function GCode({ widgetActions }) {
    const {
        isConnected,
        workflowStatus,
        gcodePrintingInfo,
        boundingBox,
    } = useSelector(state => state.workspace);

    const [state, setState] = useState(() => getInitialState());

    const controllerEvents = {
        'connection:close': () => {
            const initialState = getInitialState();
            setState({ ...state, ...initialState });
        },
        'workflow:state': (options) => {
            const { workflowState, dataSource } = options;
            if (dataSource !== PROTOCOL_TEXT) {
                return;
            }
            if (state.workflowState !== workflowState) {
                setState({ ...state, workflowState });
            }
        }
    };

    function addControllerEvents() {
        Object.keys(controllerEvents).forEach(eventName => {
            const callback = controllerEvents[eventName];
            controller.on(eventName, callback);
        });
    }

    function removeControllerEvents() {
        Object.keys(controllerEvents).forEach(eventName => {
            const callback = controllerEvents[eventName];
            controller.off(eventName, callback);
        });
    }

    useEffect(() => {
        widgetActions.setTitle(i18n._('key-Workspace/GcodeInspect-Inspect G-code'));
        addControllerEvents();
        return () => {
            removeControllerEvents();
        };
    }, []);

    useEffect(() => {
        if (workflowStatus === 'running') {
            widgetActions.setDisplay(false);
        } else {
            widgetActions.setDisplay(true);
        }
    }, [workflowStatus, isConnected]);

    useEffect(() => {
        if (boundingBox === null) {
            setState({
                ...state,
                bbox: {
                    min: {
                        x: 0,
                        y: 0,
                        z: 0,
                        b: 0
                    },
                    max: {
                        x: 0,
                        y: 0,
                        z: 0,
                        b: 0
                    },
                    delta: {
                        x: 0,
                        y: 0,
                        z: 0,
                        b: 0
                    }
                }
            });
        } else {
            const bbox = boundingBox;
            const dX = bbox.max.x - bbox.min.x;
            const dY = bbox.max.y - bbox.min.y;
            const dZ = bbox.max.z - bbox.min.z;
            const dB = bbox.max.b - bbox.min.b;

            setState({
                ...state,
                bbox: {
                    min: {
                        x: bbox.min.x,
                        y: bbox.min.y,
                        z: bbox.min.z,
                        b: bbox.min.b
                    },
                    max: {
                        x: bbox.max.x,
                        y: bbox.max.y,
                        z: bbox.max.z,
                        b: bbox.max.b
                    },
                    delta: {
                        x: dX,
                        y: dY,
                        z: dZ,
                        b: dB
                    }
                }
            });
        }
    }, [boundingBox]);

    const { total, sent, received } = gcodePrintingInfo;
    const bbox = _.mapValues(state.bbox, (position) => {
        position = _.mapValues(position, (val) => toFixedUnits(state.units, val));
        return position;
    });
    const { units } = state;
    const displayUnits = (units === METRIC_UNITS) ? i18n._('key-Workspace/GcodeInspect-mm') : i18n._('key-Workspace/GcodeInspect-in');
    const startTime = formatISODateTime(gcodePrintingInfo.startTime);
    const finishTime = formatISODateTime(gcodePrintingInfo.finishTime);
    const elapsedTime = formatDuration(gcodePrintingInfo.elapsedTime);
    const remainingTime = formatDuration(gcodePrintingInfo.remainingTime);

    return (
        <div className={styles['gcode-inspect']}>
            <div>
                <div className="row no-gutters margin-bottom-16">
                    <div className="col-12">
                        <table
                            className="table table-bordered"
                            data-table="dimension"
                            style={{
                                borderCollapse: 'separate',
                                borderRadius: '8px',
                                borderSpacing: 0
                            }}
                        >
                            <thead>
                                <tr>
                                    <th className={styles.axis}>{i18n._('key-Workspace/GcodeInspect-Axis')}</th>
                                    <th>{i18n._('key-Workspace/GcodeInspect-Min')}</th>
                                    <th>{i18n._('key-Workspace/GcodeInspect-Max')}</th>
                                    <th>{i18n._('key-Workspace/GcodeInspect-Dimension')}</th>
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
                                <tr>
                                    <td className={styles.axis}>B</td>
                                    <td>{bbox.min.b} °</td>
                                    <td>{bbox.max.b} °</td>
                                    <td>{bbox.delta.b} °</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="row no-gutters margin-bottom-16">
                    <div className="col-6">
                        <div>{i18n._('key-Workspace/GcodeInspect-Sent')}</div>
                        <div>{total > 0 ? `${sent} / ${total}` : '–'}</div>
                    </div>
                    <div className="col-6">
                        <div>{i18n._('key-Workspace/GcodeInspect-Received')}</div>
                        <div>{total > 0 ? `${received} / ${total}` : '–'}</div>
                    </div>
                </div>
                <div className="row no-gutters margin-bottom-16">
                    <div className="col-6">
                        <div>{i18n._('key-Workspace/GcodeInspect-Start Time')}</div>
                        <div>{startTime}</div>
                    </div>
                    <div className="col-6">
                        <div>{i18n._('key-Workspace/GcodeInspect-Elapsed Time')}</div>
                        <div>{elapsedTime}</div>
                    </div>
                </div>
                <div className="row no-gutters">
                    <div className="col-6">
                        <div>{i18n._('key-Workspace/GcodeInspect-Finish Time')}</div>
                        <div>{finishTime}</div>
                    </div>
                    <div className="col-6">
                        <div>{i18n._('key-Workspace/GcodeInspect-Remaining Time')}</div>
                        <div>{remainingTime}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
GCode.propTypes = {
    widgetActions: PropTypes.object.isRequired
};

export default GCode;
