import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import i18n from '../../lib/i18n';

import { actions as workspaceActions } from '../../flux/workspace';
import { actions as machineActions } from '../../flux/machine';
import { actions as widgetActions } from '../../flux/widget';

import { controller } from '../../lib/controller';

import styles from './index.styl';

class Leveling extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,
        workPosition: PropTypes.object.isRequired,
        boundingBox: PropTypes.object,
        gcodeFile: PropTypes.object,
        // widgetId: PropTypes.string.isRequired,
        // updateWidgetState: PropTypes.func.isRequired,
        renderGcodeFile: PropTypes.func.isRequired
    }

    state = {
        step: 0,
        levelingProgress: null,
        targetFile: null,
        gridNum: 3,
        areaBorder: { TopLeft: { x: 0, y: 0 }, BottomRight: { x: 0, y: 0 } },
        testPoints: []
    }

    actions = {

        copyWorkPositionTo: (k1, k2) => {
            const workPosition = this.props.workPosition;
            // const workPosition = { x: Math.floor(Math.random() * 100), y: Math.floor(Math.random() * 100), z: Math.floor(Math.random() * 100) };
            let obj = this.state[k1];
            obj = { ...obj, [k2]: { ...workPosition } };
            this.setState({ [k1]: obj });
        },
        copyBoundingBoxToArea: () => {
            const { min, max } = this.props.boundingBox;
            this.setState({ areaBorder: { TopLeft: min, BottomRight: max } });
        },
        startTesting: () => {
            this.setState({ step: 1 });
            const { TopLeft, BottomRight } = this.state.areaBorder;
            const gridNum = this.state.gridNum;
            const testPoints = [];
            for (let x = 0; x < gridNum; x++) {
                for (let y = 0; y < gridNum; y++) {
                    testPoints.push({
                        x: (Math.min(TopLeft.x, BottomRight.x) + Math.abs(TopLeft.x - BottomRight.x) / (gridNum - 1) * x).toFixed(3),
                        y: (Math.min(TopLeft.y, BottomRight.y) + Math.abs(TopLeft.y - BottomRight.y) / (gridNum - 1) * y).toFixed(3),
                        z: undefined
                    });
                }
            }

            this.setState({ testPoints });
        },
        gotoPoint: (idx) => {
            const point = this.state.testPoints[idx];
            controller.command('gcode', 'G90');
            controller.command('gcode', `G0 Z${10 + parseInt(this.props.workPosition.z, 10)}  F1000`);
            controller.command('gcode', `G0 X${point.x} Y${point.y}  F1000`);
        },
        setTestPointZ: (idx) => {
            let { testPoints } = this.state;
            testPoints[idx].z = this.props.workPosition.z;
            // testPoints[idx].z = Math.random() * 10 - 2;
            testPoints = [...testPoints];
            this.setState({ testPoints });
            const tested = this.state.testPoints.reduce((prev, current) => prev && current.z, true);
            if (tested) {
                this.setState({ step: 2 });
            }
        },
        levelingGcode: () => {
            const { TopLeft, BottomRight } = this.state.areaBorder;

            const zValues = this.state.testPoints.reduce((prev, current) => [...prev, current.z], []);
            const rect = { startx: TopLeft.x, starty: TopLeft.y, endx: BottomRight.x, endy: BottomRight.y };
            const gridNum = this.state.gridNum;
            const uploadName = this.props.gcodeFile.uploadName;


            const helper = controller.taskHelper();
            helper.startTask({
                task: { taskName: 'LevelingGcode', rect, zValues, gridNum, uploadName },
                onProgress: ({ tips, progress }) => {
                    this.setState({ levelingProgress: `${tips} ${progress}%` });
                },
                onComplete: (targetFile) => {
                    this.setState({ targetFile, step: 5, levelingProgress: null });
                }
            });
        },
        loadNewGcode: () => {
            this.props.renderGcodeFile(this.state.targetFile);
            this.setState({ step: 10 });
        }
    }

    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('Leveling Before Run'));
    }


    render() {
        let key = 0;
        const { gridNum, areaBorder, testPoints } = this.state;
        return (
            <React.Fragment>
                <div className="sm-tabs" style={{ marginTop: '6px', marginBottom: '12px' }}>
                    <button
                        type="button"
                        style={{ width: '50%' }}
                        className={classNames('sm-tab', { 'sm-selected': gridNum === 3 })}
                        onClick={() => {
                            this.setState({ gridNum: 3 });
                        }}
                    >
                        {i18n._('3 * 3')}
                    </button>
                </div>
                <table className="table table-bordered" data-table="dimension">
                    <thead>
                        <tr>
                            <th className={styles.axis}>{i18n._('Axis')}</th>
                            <th>{i18n._('X')}</th>
                            <th>{i18n._('Y')}</th>
                            <th>{i18n._('action')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className={styles.axis}>{i18n._('Top Left')}</td>
                            <td>{areaBorder.TopLeft.x} </td>
                            <td>{areaBorder.TopLeft.y} </td>
                            <td>
                                <button
                                    className="sm-btn-small sm-btn-primary"
                                    type="button"
                                    onClick={() => {
                                        this.actions.copyWorkPositionTo('areaBorder', 'TopLeft');
                                    }}
                                >CopyWorkPosition
                                </button>
                            </td>
                        </tr>
                        <tr>
                            <td className={styles.axis}>{i18n._('Bottom Right')}</td>
                            <td>{areaBorder.BottomRight.x} </td>
                            <td>{areaBorder.BottomRight.y} </td>
                            <td>
                                <button
                                    className="sm-btn-small sm-btn-primary"
                                    type="button"
                                    onClick={() => {
                                        this.actions.copyWorkPositionTo('areaBorder', 'BottomRight');
                                    }}
                                >CopyWorkPosition
                                </button>
                            </td>
                        </tr>
                        {(this.props.boundingBox && (
                            <tr>
                                <td colSpan="4">
                                    <button
                                        className="sm-btn-small sm-btn-primary"
                                        type="button"
                                        onClick={() => {
                                            this.actions.copyBoundingBoxToArea();
                                        }}
                                    > Copy From Gcode
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {(this.state.step === 0) && (
                    <button
                        className="sm-btn-small sm-btn-primary"
                        type="button"
                        onClick={() => {
                            this.actions.startTesting();
                        }}
                    > start test
                    </button>
                )}

                {(this.state.step > 0) && (
                    <table className="table table-bordered" data-table="dimension">
                        <thead>
                            <tr>
                                <th className={styles.axis}>{i18n._('Axis')}</th>
                                <th>{i18n._('X')}</th>
                                <th>{i18n._('Y')}</th>
                                <th>{i18n._('Z')}</th>
                                <th>{i18n._('action')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            { testPoints.map((point, idx) => {
                                return (
                                    <tr key={key++}>
                                        <td className={styles.axis}>{idx + 1}</td>
                                        <td>{point.x} </td>
                                        <td>{point.y} </td>
                                        <td>{point.z}</td>
                                        <td>

                                            <button
                                                className="sm-btn-small sm-btn-primary"
                                                type="button"
                                                onClick={() => {
                                                    this.actions.gotoPoint(idx);
                                                }}
                                            > goto
                                            </button>
                                            <button
                                                className="sm-btn-small sm-btn-primary"
                                                type="button"
                                                onClick={() => {
                                                    this.actions.setTestPointZ(idx);
                                                }}
                                            > fill
                                            </button>

                                        </td>
                                    </tr>
                                );
                            })}


                        </tbody>
                    </table>
                )}

                {(this.state.step === 2) && (
                    <button
                        className="sm-btn-small sm-btn-primary"
                        type="button"
                        onClick={() => {
                            this.actions.levelingGcode();
                        }}
                    > startLevelingGcode
                    </button>
                )}
                <div>{this.state.levelingProgress}</div>
                {(this.state.step === 5) && (
                    <button
                        className="sm-btn-small sm-btn-primary"
                        type="button"
                        onClick={() => {
                            this.actions.loadNewGcode();
                        }}
                    > load new Gcode
                    </button>
                )}
                {(true && this.state.step === 10) && (
                    <button
                        className="sm-btn-small sm-btn-warning"
                        type="button"
                        onClick={() => {
                            this.setState({ step: 0 });
                        }}
                    > reset
                    </button>
                )}

            </React.Fragment>

        );
    }
}

const mapStateToProps = (state) => {
    const { workPosition } = state.machine;
    const { boundingBox, gcodeFile } = state.workspace;
    return { boundingBox, workPosition, gcodeFile };
};

const mapDispatchToProps = (dispatch) => {
    return {
        renderGcodeFile: (fileInfo) => dispatch(workspaceActions.renderGcodeFile(fileInfo)),
        executeGcode: (gcode) => dispatch(machineActions.executeGcode(gcode)),
        executeGcodeAutoHome: () => dispatch(machineActions.executeGcodeAutoHome()),
        updateWidgetState: (widgetId, key, value) => dispatch(widgetActions.updateWidgetState(widgetId, key, value))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Leveling);
