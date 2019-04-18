import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Slider from 'rc-slider';
import i18n from '../../lib/i18n';
import { NumberInput as Input } from '../../components/Input';
import styles from '../styles.styl';


const LaserPad = (props) => {
    const { state, actions } = props;
    const controllerState = state.controller.state;

    return (
        <React.Fragment>
            <p style={{ margin: '0 0 0 0', padding: '0 6px' }}>{i18n._('Power (%)')}</p>
            <table className={styles['parameter-table']} style={{ marginTop: '0px' }}>
                <tbody>
                    <tr>
                        <td style={{ width: '80%', padding: '0 6px' }}>
                            <Slider
                                value={state.headPower}
                                min={0}
                                max={100}
                                step={0.5}
                                marks={state.marks}
                                onChange={actions.selectHeadPower}
                            />
                        </td>
                        <td style={{ width: '20%' }}>
                            <Input
                                style={{ width: '100%' }}
                                min={0}
                                max={100}
                                step={0.5}
                                value={state.headPower}
                                onChange={actions.selectHeadPower}
                            />
                        </td>
                    </tr>
                </tbody>
            </table>

            <table className={styles['parameter-table']} style={{ marginTop: '20px' }}>
                <tbody>
                    <tr>
                        <td style={{ width: '47%', padding: '0 6px' }}>
                            <div>{i18n._('Tool Head Status')}</div>
                        </td>
                        <td style={{ width: '18%' }}>
                            <div>{ controllerState.headPower }%</div>
                        </td>
                        <td style={{ width: '20%' }}>
                            <div>
                                {controllerState.headStatus === 'on' && (
                                    <button
                                        type="button"
                                        className="btn btn-warning"
                                        onClick={() => actions.toggleToolHead()}
                                    >
                                        <i className="fa fa-toggle-on fa-fw" />
                                        <span className="space space-sm" />
                                        {i18n._('ON')}
                                    </button>
                                )}
                                {controllerState.headStatus === 'off' && (
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => actions.toggleToolHead()}
                                    >
                                        <i className="fa fa-toggle-off fa-fw" />
                                        <span className="space space-sm" />
                                        {i18n._('OFF')}
                                    </button>
                                )}
                            </div>
                        </td>
                        <td style={{ width: '15%' }}>
                            <button
                                type="button"
                                style={{ width: '100%' }}
                                className={classNames(styles.btn, styles['btn-default'])}
                                onClick={actions.laserSave}
                            >
                                {i18n._('Save')}
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </React.Fragment>
    );
};

LaserPad.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};

export default LaserPad;
