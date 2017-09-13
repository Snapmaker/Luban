import get from 'lodash/get';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import React, { PureComponent } from 'react';
import Controller from './Controller';
import Overrides from './Overrides';
import StatusPad from './StatusPad';

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
                        <table style={{ width: '100%', textAlign: 'center', marginTop: '20px' }}>
                            <tr>
                                <td style={{ width: '25%', textAlign: 'left' }}>Power(%)</td>
                                <td style={{ width: '54%', position: 'relative', top: '4px', paddingRight: '4%' }}>
                                    <Slider
                                        style={{ padding: 0 }}
                                        defaultValue={state.laser.power}
                                        min={0}
                                        max={100}
                                        step={1}
                                        onChange={actions.selectPower}
                                    />
                                </td>
                                <td style={{ width: '21%' }}>
                                    <input
                                        type="number"
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
                                </td>
                            </tr>
                        </table>


                        <div style={{ margin: '10px 0px' }}>

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
