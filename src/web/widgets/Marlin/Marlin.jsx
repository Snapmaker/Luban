import get from 'lodash/get';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import Controller from './Controller';
import Overrides from './Overrides';
import StatusPad from './StatusPad';
import RepeatButton from '../../components/RepeatButton';

import {
    MODAL_CONTROLLER
} from './constants';

class Marlin extends PureComponent {
    static propTypes = {
        state: PropTypes.object,
        actions: PropTypes.object
    };

    render() {
        const { state, actions } = this.props;
        const controllerState = state.controller.state || {};
        const ovF = get(controllerState, 'ovF', 0);
        const ovS = get(controllerState, 'ovS', 0);

        return (
            <div>
                {state.modal.name === MODAL_CONTROLLER &&
                <Controller state={state} actions={actions} />
                }
                <StatusPad state={state} actions={actions} />
                <Overrides ovF={ovF} ovS={ovS} actions={actions} />

                {actions.isLaser() &&
                    <div>
                        <div className="input-group input-group-sm" style={{ marginTop: '10px', marginBottom: '10px' }}>
                            <span className="input-group-addon">%</span>
                            <div className="input-group-btn">
                                <button
                                    type="button"
                                    className="btn btn-default"
                                    onClick={() => actions.selectPower('100')}
                                >
                                    100
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-default"
                                    onClick={() => actions.selectPower('50')}
                                >
                                    50
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-default"
                                    onClick={() => actions.selectPower('10')}
                                >
                                    10
                                </button>
                            </div>
                            <input
                                type="number"
                                className="form-control"
                                style={{ borderRadius: 0 }}
                                min="1"
                                max="100"
                                step="1"
                                value={ state.laser.power }
                                onChange={(event) => {
                                    const customPower = event.target.value;
                                    actions.selectPower(customPower);
                                }}
                            />
                            <div className="input-group-btn">
                                <RepeatButton
                                    className="btn btn-default"
                                    onClick={() => {
                                        const power = state.laser.power;
                                        if (power < 100) {
                                            actions.selectPower(power + 1);
                                        }
                                    }}
                                >
                                    <i className="fa fa-plus" />
                                </RepeatButton>
                                <RepeatButton
                                    className="btn btn-default"
                                    onClick={() => {
                                        const power = state.laser.power;
                                        if (power > 0) {
                                            actions.selectPower(power - 1);
                                        }
                                    }}
                                >
                                    <i className="fa fa-minus" />
                                </RepeatButton>
                            </div>
                        </div>
                        <div style={{ margin: '10px 12.5%' }}>

                            <div className="input-group-btn">
                                <button
                                    type="button"
                                    className="btn btn-default col-xs-4"
                                    onClick={() => actions.laserFocus() }
                                >
                                    Focus
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-default col-xs-4"
                                    onClick={() => actions.laserSet() }
                                >
                                    Set
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-default col-xs-4"
                                    onClick={() => actions.laserSave() }
                                >
                                    Save
                                </button>
                            </div>

                        </div>
                    </div>
                }
            </div>

        );
    }
}

export default Marlin;
