import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import i18n from '../../lib/i18n';

import { actions as machineActions } from '../../flux/machine';
import { actions as widgetActions } from '../../flux/widget';

import { controller } from '../../lib/controller';

import styles from './index.styl';

class Leveling extends PureComponent {
    static propTypes = {
        widgetId: PropTypes.string.isRequired,
        testCount: PropTypes.number.isRequired,
        areaBorder: PropTypes.object.isRequired,
        testPoints: PropTypes.array.isRequired,

        updateWidgetState: PropTypes.func.isRequired
    }

    state = {
        step: 'init'
    }

    actions = {
        updateWidgetState: (key, value) => {
            this.props.updateWidgetState(this.props.widgetId, key, value);
        },
        startTesting: () => {
            this.setState({ step: 'testing' });
            const { x0, y0, x1, y1 } = this.props.areaBorder;
            const testCount = this.props.testCount;
            const testPoints = [];
            for (let x = 0; x < testCount; x++) {
                for (let y = 0; y < testCount; y++) {
                    testPoints.push({
                        x: (Math.min(x0, x1) + Math.abs(x0 - x1) / (testCount - 1) * x).toFixed(3),
                        y: (Math.min(y0, y1) + Math.abs(y0 - y1) / (testCount - 1) * y).toFixed(3),
                        z: undefined
                    });
                }
            }
            console.log(testPoints);
            this.actions.updateWidgetState('', { testPoints });
        },
        setTestPointZ: (idx, z) => {
            let { testPoints } = this.props;
            testPoints[idx].z = z;
            testPoints = [...testPoints];
            this.actions.updateWidgetState('', { testPoints });
        },
        levelingGcode: () => {
            controller.commitWorkerTask({ taskName: 'LevelingGcode', gcodefile: 'abc.gcode', points: [{ a: 1 }] });
        }
    }

    componentWillReceiveProps(nextProps) {
        if (this.state.step === 'testing') {
            const tested = nextProps.testPoints.reduce((prev, current) => prev && current.z, true);
            if (tested) {
                this.setState({ step: 'tested' });
            }
        }
    }

    render() {
        let key = 0;
        const { testCount, areaBorder, testPoints } = this.props;


        return (
            <React.Fragment>
                <div className="sm-tabs" style={{ marginTop: '6px', marginBottom: '12px' }}>
                    <button
                        type="button"
                        style={{ width: '50%' }}
                        className={classNames('sm-tab', { 'sm-selected': testCount === 2 })}
                        onClick={() => {
                            this.actions.updateWidgetState('', { testCount: 2 });
                        }}
                    >
                        {i18n._('2 * 2')}
                    </button>
                    <button
                        type="button"
                        style={{ width: '50%' }}
                        className={classNames('sm-tab', { 'sm-selected': testCount === 3 })}
                        onClick={() => {
                            this.actions.updateWidgetState('', { testCount: 3 });
                        }}
                    >
                        {i18n._('3 * 3')}
                    </button>
                </div>
                <table className="table table-bordered" data-table="dimension">
                    <thead>
                        <tr>
                            <th className={styles.axis}>{i18n._('Axis')}</th>
                            <th>{i18n._('Min')}</th>
                            <th>{i18n._('Max')}</th>

                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className={styles.axis}>X</td>
                            <td>{areaBorder.x0}

                            </td>
                            <td>{areaBorder.x1} </td>

                        </tr>
                        <tr>
                            <td className={styles.axis}>Y</td>
                            <td>{areaBorder.y0} </td>
                            <td>{areaBorder.y1} </td>
                        </tr>
                        <tr>
                            <td>
                                <button
                                    className="sm-btn-small sm-btn-primary"
                                    type="button"
                                    onClick={() => {
                                        this.actions.updateWidgetState('', { areaBorder: { x0: 20, x1: 130, y0: 20, y1: 130 } });
                                    }}
                                >shuffle
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {(this.state.step === 'init') && (
                    <button
                        className="sm-btn-small sm-btn-primary"
                        type="button"
                        onClick={() => {
                            this.actions.startTesting();
                        }}
                    > start test
                    </button>
                )}

                {(this.state.step === 'testing') && (
                    <table className="table table-bordered" data-table="dimension">
                        <thead>
                            <tr>
                                <th className={styles.axis}>{i18n._('Axis')}</th>
                                <th>{i18n._('Min')}</th>
                                <th>{i18n._('Max')}</th>
                                <th>{i18n._('Dimension')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            { testPoints.map((point, idx) => {
                                return (
                                    <tr key={key++}>
                                        <td className={styles.axis}>{idx + 1}</td>
                                        <td>{point.x} </td>
                                        <td>{point.y} </td>
                                        <td>{point.z}
                                            <button
                                                className="sm-btn-small sm-btn-primary"
                                                type="button"
                                                onClick={() => {
                                                    this.actions.setTestPointZ(idx, (Math.random() * 5).toFixed(3));
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

                {(this.state.step === 'tested') && (
                    <button
                        className="sm-btn-small sm-btn-primary"
                        type="button"
                        onClick={() => {
                            this.actions.levelingGcode();
                        }}
                    > startLevelingGcode
                    </button>
                )}
                <div>{this.props.widgetId}</div>
            </React.Fragment>

        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const { widgets } = state.widget;
    const { widgetId } = ownProps;
    const { testCount, areaBorder, testPoints } = widgets[widgetId];
    console.log('---', widgets[widgetId]);
    return { testCount, areaBorder, testPoints };
};

const mapDispatchToProps = (dispatch) => {
    return {
        executeGcode: (gcode) => dispatch(machineActions.executeGcode(gcode)),
        executeGcodeAutoHome: () => dispatch(machineActions.executeGcodeAutoHome()),
        updateWidgetState: (widgetId, key, value) => dispatch(widgetActions.updateWidgetState(widgetId, key, value))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Leveling);
