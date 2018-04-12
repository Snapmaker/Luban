import React from 'react';
import PropTypes from 'prop-types';
import { STAGE_IMAGE_LOADED } from '../../constants';
import { InputWithValidation as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import styles from './index.styl';


const ToolParameters = (props) => {
    const { state, actions } = { ...props };

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
                            <TipTrigger
                                title="Tool Diameter"
                                content={(
                                    <div>
                                        <p>Enter the diameter of the widest part of the blade. Please note that it is not the shank diameter.</p>
                                        <p>For the carving bits that we provide, please enter the following value:</p>
                                        <ul>
                                            <li><b>Carving V-Bit</b>: 3.175 mm</li>
                                            <li><b>Ball End Mill</b>: 3.175 mm</li>
                                            <li><b>Flat End Mill</b>: 3.175 mm</li>
                                        </ul>
                                    </div>
                                )}
                            >
                                <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                    <Input
                                        value={state.toolDiameter}
                                        min={0.1}
                                        max={10}
                                        step={0.1}
                                        onChange={actions.onChangeToolDiameter}
                                        disabled={state.stage < STAGE_IMAGE_LOADED}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{ 'mm' }</span>
                                </div>
                            </TipTrigger>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Tool Angle
                        </td>
                        <td>
                            <TipTrigger
                                title="Tool Diameter"
                                content={(
                                    <div>
                                        <p>Enter the angle of the blade.</p>
                                        <p>For the carving bits that we provide, please enter the following value:</p>
                                        <p>Carving V-Bit: 30°</p>
                                        <p>Ball End Mill: 180°</p>
                                        <p>Flat End Mill: 180°</p>
                                    </div>
                                )}
                            >
                                <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                    <Input
                                        value={state.toolAngle}
                                        min={1}
                                        max={180}
                                        step={1}
                                        onChange={actions.onChangeToolAngle}
                                        disabled={state.stage < STAGE_IMAGE_LOADED}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{ '°' }</span>
                                </div>
                            </TipTrigger>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Jog Speed
                        </td>
                        <td>
                            <TipTrigger title="Jog Speed" content="Determines how fast the tool moves when it’s not carving.">
                                <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                    <Input
                                        value={state.jogSpeed}
                                        min={1}
                                        max={6000}
                                        step={10}
                                        onChange={actions.onChangeJogSpeed}
                                        disabled={state.stage < STAGE_IMAGE_LOADED}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'mm/minute'}</span>
                                </div>
                            </TipTrigger>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Work Speed
                        </td>
                        <td>
                            <TipTrigger title="Work Speed" content="Determines how fast the tool moves on the stock.">
                                <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                    <Input
                                        value={state.workSpeed}
                                        min={1}
                                        max={3600}
                                        step={10}
                                        onChange={actions.onChangeWorkSpeed}
                                        disabled={state.stage < STAGE_IMAGE_LOADED}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'mm/minute'}</span>
                                </div>
                            </TipTrigger>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Plunge Speed
                        </td>
                        <td>
                            <TipTrigger title="Plunge Speed" content="Determines how fast the tool feeds into the stock.">
                                <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                    <Input
                                        value={state.plungeSpeed}
                                        min={1}
                                        max={3600}
                                        step={10}
                                        onChange={actions.onChangePlungeSpeed}
                                        disabled={state.stage < STAGE_IMAGE_LOADED}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'mm/minute'}</span>
                                </div>
                            </TipTrigger>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};


ToolParameters.propTypes = {
    state: PropTypes.object,
    action: PropTypes.object
};

export default ToolParameters;
