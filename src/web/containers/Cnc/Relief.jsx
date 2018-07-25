import React from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';
import { STAGE_IMAGE_LOADED, STAGE_PREVIEWED } from '../../constants';
import styles from './styles.styl';


const Relief = (props) => {
    const { stage, state, actions } = { ...props };

    return (
        <div>
            <table className={styles.paramTable}>
                <tbody>
                    <tr>
                        <td>
                            Size
                        </td>
                        <td>
                            <input
                                type="number"
                                className="form-control"
                                style={{ borderRadius: 0, display: 'inline', width: '45%' }}
                                value={state.sizeWidth}
                                onChange={actions.onChangeWidth}
                                disabled={stage < STAGE_IMAGE_LOADED}
                            />
                            <span style={{ width: '10%', textAlign: 'center', display: 'inline-block' }}>X</span>
                            <input
                                type="number"
                                className="form-control"
                                style={{ borderRadius: 0, display: 'inline', width: '45%' }}
                                value={state.sizeHeight}
                                onChange={actions.onChangeHeight}
                                disabled={stage < STAGE_IMAGE_LOADED}
                            />
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Work Speed
                        </td>
                        <td>
                            <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                <input
                                    type="number"
                                    className="form-control"
                                    style={{ borderRadius: 0 }}
                                    value={state.workSpeed}
                                    min={1}
                                    step={1}
                                    onChange={actions.onChangeWorkSpeed}
                                    disabled={stage < STAGE_PREVIEWED}
                                />
                                <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>mm/minute</span>
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
                                    onChange={actions.onChangePlungeSpeed}
                                    disabled={stage < STAGE_PREVIEWED}
                                />
                                <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>mm/minute</span>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Jog Speed
                        </td>
                        <td>
                            <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                <input
                                    type="number"
                                    className="form-control"
                                    style={{ borderRadius: 0 }}
                                    value={state.jogSpeed}
                                    min={1}
                                    max={6000}
                                    step={1}
                                    onChange={actions.onChangeJogSpeed}
                                    disabled={stage < STAGE_PREVIEWED}
                                />
                                <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>mm/minute</span>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Grey Level
                        </td>
                        <td>
                            <Select
                                backspaceRemoves={false}
                                className="sm"
                                clearable={false}
                                menuContainerStyle={{ zIndex: 5 }}
                                name="Grey Level"
                                options={[{
                                    value: '4',
                                    label: '4'
                                }, {
                                    value: '8',
                                    label: '8'
                                }, {
                                    value: '16',
                                    label: '16'
                                }, {
                                    value: '32',
                                    label: '32'
                                }, {
                                    value: '64',
                                    label: '64'
                                }, {
                                    value: '128',
                                    label: '128'
                                }, {
                                    value: '256',
                                    label: '256'
                                }]}
                                placeholder="choose grey level"
                                searchable={false}
                                value={state.greyLevel}
                                onChange={actions.onChangeGreyLevel}
                                disabled={stage < STAGE_IMAGE_LOADED}
                            />
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Target Depth
                        </td>
                        <td>
                            <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                <input
                                    type="number"
                                    className="form-control"
                                    style={{ borderRadius: 0 }}
                                    value={state.targetDepth}
                                    min={1}
                                    step={1}
                                    onChange={actions.onTargetDepth}
                                    disabled={stage < STAGE_PREVIEWED}
                                />
                                <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>mm</span>
                            </div>
                        </td>
                    </tr>

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
                                    min={0.05}
                                    step={0.05}
                                    onChange={actions.onChangeToolDiameter}
                                    disabled={stage < STAGE_PREVIEWED}
                                />
                                <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>mm</span>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Stop Height
                        </td>
                        <td>
                            <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                <input
                                    type="number"
                                    className="form-control"
                                    style={{ borderRadius: 0 }}
                                    value={state.stopHeight}
                                    min={0.05}
                                    step={0.05}
                                    onChange={actions.onChangeStopHeight}
                                    disabled={stage < STAGE_PREVIEWED}
                                />
                                <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>mm</span>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td />
                        <td>
                            <input type="checkbox" defaultChecked={state.isInvert} onChange={actions.onToggleInvert} /> <span>Invert</span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

Relief.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};

export default Relief;
