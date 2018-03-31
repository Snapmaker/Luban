import React from 'react';
import PropTypes from 'prop-types';
import {
    STAGE_IMAGE_LOADED
} from '../../constants';
import styles from './index.styl';


class ToolParameters extends React.PureComponent {

    static propTypes = {
        state: PropTypes.object
    };

    render() {
        const { state, actions } = { ...this.props };

        return (
            <div>
                <h6><b>Tool</b></h6>
                <table className={styles.paramTable}>
                    <tbody>
                        <tr>
                            <td>
                                Tool Diameter
                            </td>
                            <td>
                                <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                    <input
                                        type="number"
                                        className="form-control"
                                        style={{ borderRadius: 0 }}
                                        value={state.toolDiameter}
                                        min={1}
                                        step={1}
                                        onChange={actions.onChangeToolDiameter}
                                        onBlur={actions.onInputBlur}
                                        disabled={state.stage < STAGE_IMAGE_LOADED}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{ 'mm' }</span>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Tool Angle
                            </td>
                            <td>
                                <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                    <input
                                        type="number"
                                        className="form-control"
                                        style={{ borderRadius: 0 }}
                                        value={state.toolAngle}
                                        min={1}
                                        step={1}
                                        onChange={actions.onChangeToolAngle}
                                        onBlur={actions.onInputBlur}
                                        disabled={state.stage < STAGE_IMAGE_LOADED}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{ '°' }</span>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Work Speed
                            </td>
                            <td>
                                <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                    <input
                                        type="number"
                                        className="form-control"
                                        style={{ borderRadius: 0 }}
                                        value={state.workSpeed}
                                        min={1}
                                        step={1}
                                        onChange={actions.onChangeWorkSpeed}
                                        onBlur={actions.onInputBlur}
                                        disabled={state.stage < STAGE_IMAGE_LOADED}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'mm/minute'}</span>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Jog Speed
                            </td>
                            <td>
                                <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                    <input
                                        type="number"
                                        className="form-control"
                                        style={{ borderRadius: 0 }}
                                        value={state.jogSpeed}
                                        min={1}
                                        step={1}
                                        onChange={actions.onChangeJogSpeed}
                                        onBlur={actions.onInputBlur}
                                        disabled={state.stage < STAGE_IMAGE_LOADED}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'mm/minute'}</span>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Plunge Speed
                            </td>
                            <td>
                                <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                    <input
                                        type="number"
                                        className="form-control"
                                        style={{ borderRadius: 0 }}
                                        value={state.plungeSpeed}
                                        min={1}
                                        step={1}
                                        onChange={actions.onPlungeSpeed}
                                        onBlur={actions.onInputBlur}
                                        disabled={state.stage < STAGE_IMAGE_LOADED}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'mm/minute'}</span>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    }
}

export default ToolParameters;
