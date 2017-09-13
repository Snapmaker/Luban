import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import Select from 'react-select';
import styles from './index.styl';

// stage
const STAGE_IMAGE_LOADED = 1;
const STAGE_PREVIEWD = 2;

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
                                    name="baudrate"
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
                                Quality
                            </td>
                            <td>
                                <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                    <input
                                        type="number"
                                        className="form-control"
                                        style={{ borderRadius: 0 }}
                                        value={state.quality}
                                        min={1}
                                        step={1}
                                        onChange={actions.onChangeQuality}
                                        disabled={state.stage < STAGE_IMAGE_LOADED}
                                    />
                                    <span className="input-group-addon" style={{ width: '80px' }}>{'pixel/mm'}</span>
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
                                        disabled={state.stage < STAGE_PREVIEWD}
                                    />
                                    <span className="input-group-addon" style={{ width: '80px' }}>{'ms/pixel'}</span>
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
                                        disabled={state.stage < STAGE_PREVIEWD}
                                    />
                                    <span className="input-group-addon" style={{ width: '80px' }}>{'mm/minute'}</span>
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
