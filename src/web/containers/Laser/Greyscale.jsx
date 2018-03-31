import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import Select from 'react-select';
import styles from './index.styl';
import { STAGE_IMAGE_LOADED, STAGE_PREVIEWED } from '../../constants';

class Greyscale extends Component {
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
                                Contrast
                            </td>
                            <td>
                                <div className="text-center">{state.contrast}%</div>
                                <Slider
                                    style={{ padding: 0 }}
                                    defaultValue={state.contrast}
                                    min={0}
                                    max={100}
                                    step={1}
                                    onChange={actions.onChangeContrast}
                                    disabled={state.stage < STAGE_IMAGE_LOADED}
                                />
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Brightness
                            </td>
                            <td>
                                <div className="text-center">{state.brightness}%</div>
                                <Slider
                                    style={{ padding: 0 }}
                                    defaultValue={state.brightness}
                                    min={0}
                                    max={100}
                                    step={1}
                                    onChange={actions.onChangeBrightness}
                                    disabled={state.stage < STAGE_IMAGE_LOADED}
                                />
                            </td>
                        </tr>
                        <tr>
                            <td>
                                White Clip
                            </td>
                            <td>
                                <div className="text-center">{state.whiteClip}</div>
                                <Slider
                                    style={{ padding: 0 }}
                                    defaultValue={state.whiteClip}
                                    min={1}
                                    max={255}
                                    step={1}
                                    onChange={actions.onChangeWhiteClip}
                                    disabled={state.stage < STAGE_IMAGE_LOADED}
                                />
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Algorithm
                            </td>
                            <td>
                                <Select
                                    backspaceRemoves={false}
                                    className="sm"
                                    clearable={false}
                                    menuContainerStyle={{ zIndex: 5 }}
                                    name="algorithm"
                                    options={[{
                                        value: 'Atkinson',
                                        label: 'Atkinson'
                                    }, {
                                        value: 'Burks',
                                        label: 'Burks'
                                    }, {
                                        value: 'FloyedSteinburg',
                                        label: 'FloyedSteinburg'
                                    }, {
                                        value: 'JarvisJudiceNinke',
                                        label: 'JarvisJudiceNinke'
                                    }, {
                                        value: 'Sierra2',
                                        label: 'Sierra2'
                                    }, {
                                        value: 'Sierra3',
                                        label: 'Sierra3'
                                    }, {
                                        value: 'SierraLite',
                                        label: 'SierraLite'
                                    }, {
                                        value: 'Stucki',
                                        label: 'Stucki'
                                    }]}
                                    placeholder={'choose algorithms'}
                                    searchable={false}
                                    value={state.algorithm}
                                    onChange={actions.onChangeAlgorithm}
                                    disabled={state.stage < STAGE_IMAGE_LOADED}
                                />
                            </td>
                        </tr>
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
                                Density
                            </td>
                            <td>
                                <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                    <input
                                        type="number"
                                        className="form-control"
                                        style={{ borderRadius: 0 }}
                                        value={state.density}
                                        min={1}
                                        step={1}
                                        max={10}
                                        onChange={actions.onChangeDensity}
                                        onBlur={actions.onInputBlur}
                                        disabled={state.stage < STAGE_IMAGE_LOADED}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'pixel/mm'}</span>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Dwell Time
                            </td>
                            <td>
                                <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                    <input
                                        type="number"
                                        className="form-control"
                                        style={{ borderRadius: 0 }}
                                        value={state.dwellTime}
                                        min={0}
                                        step={0.001}
                                        onChange={actions.onChangeDwellTime}
                                        onBlur={actions.onInputBlur}
                                        disabled={state.stage < STAGE_PREVIEWED}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'ms/pixel'}</span>
                                </div>
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
                                        onBlur={actions.onInputBlur}
                                        disabled={state.stage < STAGE_PREVIEWED}
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

export default Greyscale;
