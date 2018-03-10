import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import Select from 'react-select';
import styles from './index.styl';

// stage
const STAGE_IMAGE_LOADED = 1;
const STAGE_PREVIEWED = 2;

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
                                        value: 'svg',
                                        label: 'SVG'
                                    }, {
                                        value: 'raster',
                                        label: 'Raster'
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
                                    min={0}
                                    step={1}
                                    onChange={actions.onChangeTurdSize}
                                />
                            </td>
                        </tr>}
                        {state.subMode === 'raster' &&
                        <tr>
                            <td>
                            </td>
                            <td>
                                <input type="checkbox" defaultChecked={state.isInvert} onChange={actions.onToogleInvert} /> <span>Invert</span>
                            </td>
                        </tr>}
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
                                        disabled={state.stage < STAGE_PREVIEWED}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'mm/minute'}</span>
                                </div>
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
                                        // max={0}
                                        step={0.1}
                                        onChange={actions.onTagetDepth}
                                        disabled={state.stage < STAGE_PREVIEWED}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'mm'}</span>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Step Down
                            </td>
                            <td>
                                <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                    <input
                                        type="number"
                                        className="form-control"
                                        style={{ borderRadius: 0 }}
                                        value={state.stepDown}
                                        min={0.01}
                                        step={0.1}
                                        onChange={actions.onStepDown}
                                        disabled={state.stage < STAGE_PREVIEWED}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'mm'}</span>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Safety Height
                            </td>
                            <td>
                                <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                    <input
                                        type="number"
                                        className="form-control"
                                        style={{ borderRadius: 0 }}
                                        value={state.safetyHeight}
                                        min={1}
                                        step={1}
                                        onChange={actions.onSafetyHeight}
                                        disabled={state.stage < STAGE_PREVIEWED}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'mm'}</span>
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
                                        min={1}
                                        step={1}
                                        onChange={actions.onStopHeight}
                                        disabled={state.stage < STAGE_PREVIEWED}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'mm'}</span>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td>
                            </td>
                            <td>
                                <input type="checkbox" defaultChecked={state.optimizePath} onChange={actions.onToogleOptimizePath} /> <span>Optimize Path</span>
                            </td>
                        </tr>
                        <tr>
                            <td>
                            </td>
                            <td>
                                <input type="checkbox" defaultChecked={state.clip} onChange={actions.onToggleClip} /> <span>Clip</span>
                            </td>
                        </tr>
                        <tr>
                            <td>
                            </td>
                            <td>
                                <input type="checkbox" defaultChecked={state.enableTab} onChange={actions.onToogleEnableTab} /> <span>Tab</span>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Tab Height
                            </td>
                            <td>
                                <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                    <input
                                        type="number"
                                        className="form-control"
                                        style={{ borderRadius: 0 }}
                                        value={state.tabHeight}
                                        max={0}
                                        step={0.5}
                                        onChange={actions.onTabHeight}
                                        disabled={state.stage < STAGE_PREVIEWED || !state.enableTab}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'mm'}</span>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Tab Space
                            </td>
                            <td>
                                <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                    <input
                                        type="number"
                                        className="form-control"
                                        style={{ borderRadius: 0 }}
                                        value={state.tabSpace}
                                        min={1}
                                        step={1}
                                        onChange={actions.onTabSpace}
                                        disabled={state.stage < STAGE_PREVIEWED || !state.enableTab}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'mm'}</span>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Tab Width
                            </td>
                            <td>
                                <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                    <input
                                        type="number"
                                        className="form-control"
                                        style={{ borderRadius: 0 }}
                                        value={state.tabWidth}
                                        min={1}
                                        step={1}
                                        onChange={actions.onTabWidth}
                                        disabled={state.stage < STAGE_PREVIEWED || !state.enableTab}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'mm'}</span>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    }
}

export default Vector;
