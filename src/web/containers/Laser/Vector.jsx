import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import Select from 'react-select';
import styles from './index.styl';
import { STAGE_IMAGE_LOADED, STAGE_PREVIEWED } from '../../constants';

class Vector extends Component {
    static propTypes = {
        state: PropTypes.object,
        actions: PropTypes.object
    };

    render() {
        const { state, actions } = { ...this.props };

        return (
            <div>
                <table className={styles.paramTable}>
                    <tbody>
                        <tr>
                            <td>
                                Source Type
                            </td>
                            <td>
                                <Select
                                    options={[{
                                        value: 'raster',
                                        label: 'Raster'
                                    }, {
                                        value: 'svg',
                                        label: 'SVG'
                                    }]}
                                    value={state.subMode}
                                    searchable={false}
                                    clearable={false}
                                    backspaceRemoves={false}
                                    onChange={actions.onChangeSubMode}
                                />
                            </td>
                        </tr>
                        {state.subMode === 'raster' &&
                        <tr>
                            <td>
                                B&W
                            </td>
                            <td>
                                <div className="text-center">{state.vectorThreshold}</div>
                                <Slider
                                    style={{ padding: 0 }}
                                    defaultValue={state.vectorThreshold}
                                    min={0}
                                    max={255}
                                    step={1}
                                    onChange={actions.changeVectorThreshold}
                                />
                            </td>
                        </tr>}
                        {state.subMode === 'raster' &&
                        <tr>
                            <td>
                                Turd Size
                            </td>
                            <td>
                                <input
                                    type="number"
                                    className="form-control"
                                    style={{ borderRadius: 0, display: 'inline', width: '100%' }}
                                    value={state.turdSize}
                                    onChange={actions.onChangeTurdSize}
                                />
                            </td>
                        </tr>}
                        {state.subMode === 'raster' &&
                        <tr>
                            <td>
                            </td>
                            <td>
                                <input type="checkbox" defaultChecked={state.isInvert} onChange={actions.onToggleInvert} /> <span>Invert</span>
                            </td>
                        </tr>}
                        <tr>
                            <td>
                                Resolution
                            </td>
                            <td>
                                <input
                                    type="number"
                                    className="form-control"
                                    style={{ borderRadius: 0, display: 'inline', width: '45%' }}
                                    value={state.originWidth}
                                    disabled="disabled"
                                />
                                <span style={{ width: '10%', textAlign: 'center', display: 'inline-block' }}>X</span>
                                <input
                                    type="number"
                                    className="form-control"
                                    style={{ borderRadius: 0, display: 'inline', width: '45%' }}
                                    value={state.originHeight}
                                    disabled="disabled"
                                />
                            </td>
                        </tr>
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
                                    disabled={state.stage < STAGE_IMAGE_LOADED}
                                />
                                <span style={{ width: '10%', textAlign: 'center', display: 'inline-block' }}>X</span>
                                <input
                                    type="number"
                                    className="form-control"
                                    style={{ borderRadius: 0, display: 'inline', width: '45%' }}
                                    value={state.sizeHeight}
                                    onChange={actions.onChangeHeight}
                                    disabled={state.stage < STAGE_IMAGE_LOADED}
                                />
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
                                        disabled={state.stage < STAGE_PREVIEWED}
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
                                        disabled={state.stage < STAGE_PREVIEWED}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'mm/minute'}</span>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td>
                            </td>
                            <td>
                                <input type="checkbox" defaultChecked={state.optimizePath} onChange={actions.onToggleOptimizePath} /> <span>Optimize Path</span>
                            </td>
                        </tr>
                        <tr>
                            <td>
                            </td>
                            <td>
                                <input type="checkbox" defaultChecked={state.clip} onChange={actions.onToggleClip} /> <span>Clip</span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    }
}

export default Vector;
