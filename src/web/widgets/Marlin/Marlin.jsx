import get from 'lodash/get';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import React from 'react';
import { NumberInput as Input } from '../../components/Input';
import styles from '../styles.styl';
import Controller from './Controller';
import Overrides from './Overrides';
import StatusPad from './StatusPad';

import { MODAL_CONTROLLER } from './constants';


const Marlin = (props) => {
    const { state, actions } = props;
    const controllerState = state.controller.state || {};
    const ovF = get(controllerState, 'ovF', 0);
    const ovS = get(controllerState, 'ovS', 0);

    const isDetected = actions.is3DPrinting() || actions.isLaser() || actions.isCNC();
    if (!isDetected) {
        return null;
    }

    return (
        <div>
            {state.modal.name === MODAL_CONTROLLER &&
            <Controller state={state} actions={actions} />
            }
            <StatusPad state={state} actions={actions} />
            <Overrides ovF={ovF} ovS={ovS} actions={actions} />

            {actions.isLaser() &&
                <React.Fragment>
                    <table className={styles['parameter-table']} style={{ marginTop: '20px' }}>
                        <tbody>
                            <tr>
                                <td style={{ width: '25%' }}>
                                    Power (%)
                                </td>
                                <td style={{ width: '50%', paddingLeft: '5%', paddingRight: '5%' }}>
                                    <Slider
                                        value={state.laser.power}
                                        min={0}
                                        max={100}
                                        step={0.5}
                                        onChange={actions.selectPower}
                                    />
                                </td>
                                <td style={{ width: '25%' }}>
                                    <Input
                                        style={{ width: '100%' }}
                                        min={1}
                                        max={100}
                                        value={state.laser.power}
                                        onChange={actions.selectPower}
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <div style={{ margin: '10px 0px' }}>
                        <div className="input-group-btn">
                            <button
                                type="button"
                                className="btn btn-default col-xs-4"
                                onClick={() => actions.laserFocus()}
                            >
                                Focus
                            </button>
                            <button
                                type="button"
                                className="btn btn-default col-xs-4"
                                onClick={() => actions.laserSet()}
                            >
                                Set
                            </button>
                            <button
                                type="button"
                                className="btn btn-default col-xs-4"
                                onClick={() => actions.laserSave()}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </React.Fragment>
            }
        </div>
    );
};

Marlin.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};

export default Marlin;
