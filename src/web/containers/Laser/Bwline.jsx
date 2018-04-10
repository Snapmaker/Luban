import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import Select from 'react-select';
import styles from './index.styl';
import { STAGE_IMAGE_LOADED, STAGE_PREVIEWED } from '../../constants';
import TipTrigger from '../../components/TipTrigger';


class Bwline extends Component {
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
                                B&W
                            </td>
                            <td>
                                <TipTrigger title="B&W" content="PLACEHOLDER">
                                    <div className="text-center">{state.bwThreshold}</div>
                                    <Slider
                                        style={{ padding: 0 }}
                                        defaultValue={state.bwThreshold}
                                        min={0}
                                        max={255}
                                        step={1}
                                        onChange={actions.changeBWThreshold}
                                        disabled={state.stage < STAGE_IMAGE_LOADED}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>

                        <tr>
                            <td>
                                Resolution
                            </td>
                            <td>
                                <TipTrigger title="Resolution" content="Original Resolution of uploaded image">
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
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Size (mm)
                            </td>
                            <td>
                                <TipTrigger title="Size" content="Set print size">
                                    <input
                                        type="number"
                                        className="form-control"
                                        style={{ borderRadius: 0, display: 'inline', width: '45%', border: '1px solid #C00000' }}
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
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Line Direction
                            </td>
                            <td>
                                <TipTrigger title="PLACEHOLDER" content="PLACEHOLDER">
                                    <Select
                                        backspaceRemoves={false}
                                        className="sm"
                                        clearable={false}
                                        menuContainerStyle={{ zIndex: 5 }}
                                        name="line_direction"
                                        options={[{
                                            value: 'Horizontal',
                                            label: 'Horizontal'
                                        }, {
                                            value: 'Vertical',
                                            label: 'Vertical'
                                        }, {
                                            value: 'Diagonal',
                                            label: 'Diagonal'
                                        }, {
                                            value: 'Diagnonal2',
                                            label: 'Diagnonal2'
                                        }]}
                                        placeholder={'choose algorithms'}
                                        searchable={false}
                                        value={state.direction}
                                        onChange={actions.onChangeDirection}
                                        disabled={state.stage < STAGE_IMAGE_LOADED}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Density
                            </td>
                            <td>
                                <TipTrigger title="PLACEHOLDER" content="PLACEHOLDER">
                                    <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                        <input
                                            type="number"
                                            className="form-control"
                                            style={{ borderRadius: 0 }}
                                            value={state.density}
                                            min={1}
                                            step={1}
                                            onChange={actions.onChangeDensity}
                                            onBlur={actions.onInputBlur}
                                            disabled={state.stage < STAGE_IMAGE_LOADED}
                                        />
                                        <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'pixel/mm'}</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Work Speed
                            </td>
                            <td>
                                <TipTrigger title="PLACEHOLDER" content="PLACEHOLDER">
                                    <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                        <input
                                            type="number"
                                            className="form-control"
                                            style={{ borderRadius: 0 }}
                                            value={state.workSpeed}
                                            min={1}
                                            step={1}
                                            max={6000}
                                            onChange={actions.onChangeWorkSpeed}
                                            onBlur={actions.onInputBlur}
                                            disabled={state.stage < STAGE_PREVIEWED}
                                        />
                                        <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'mm/minute'}</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Jog Speed
                            </td>
                            <td>
                                <TipTrigger title="PLACEHOLDER" content="PLACEHOLDER">
                                    <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                        <input
                                            type="number"
                                            className="form-control"
                                            style={{ borderRadius: 0 }}
                                            value={state.jogSpeed}
                                            min={1}
                                            step={1}
                                            max={6000}
                                            onChange={actions.onChangeJogSpeed}
                                            onBlur={actions.onInputBlur}
                                            disabled={state.stage < STAGE_PREVIEWED}
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
    }
}

export default Bwline;
