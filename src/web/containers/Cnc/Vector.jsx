import React, { Component } from 'react';
import Select from 'react-select';
import PropTypes from 'prop-types';
import { STAGE_IMAGE_LOADED } from '../../constants';
import styles from './index.styl';


class Vector extends Component {
    static propTypes = {
        state: PropTypes.object,
        actions: PropTypes.object
    };

    render() {
        const { state, actions } = { ...this.props };

        return (
            <div>
                <h6><b>Carve Parameters</b></h6>
                <table className={styles.paramTable}>
                    <tbody>
                        <tr>
                            <td>Carve Path</td>
                            <td>
                                <Select
                                    backspaceRemoves={false}
                                    className="sm"
                                    clearable={false}
                                    menuContainerStyle={{ zIndex: 5 }}
                                    name="carvePath"
                                    options={[
                                        {
                                            label: 'Outline',
                                            value: 'outline'
                                        },
                                        {
                                            label: 'On the Path',
                                            value: 'path'
                                        }
                                    ]}
                                    placeholder={'Choose Carve Path'}
                                    value={state.pathType}
                                    onChange={actions.onChangePathType}
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
                                Size (mm)
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
                                        onChange={actions.onTargetDepth}
                                        onBlur={actions.onInputBlur}
                                        disabled={state.stage < STAGE_IMAGE_LOADED}
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
                                        onBlur={actions.onInputBlur}
                                        disabled={state.stage < STAGE_IMAGE_LOADED}
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
                                        onBlur={actions.onInputBlur}
                                        disabled={state.stage < STAGE_IMAGE_LOADED}
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
                                        onBlur={actions.onInputBlur}
                                        disabled={state.stage < STAGE_IMAGE_LOADED}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'mm'}</span>
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
                        <tr>
                            <td>
                            </td>
                            <td>
                                <input type="checkbox" defaultChecked={state.enableTab} onChange={actions.onToggleEnableTab} /> <span>Tab</span>
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
                                        onBlur={actions.onInputBlur}
                                        disabled={state.stage < STAGE_IMAGE_LOADED || !state.enableTab}
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
                                        onBlur={actions.onInputBlur}
                                        disabled={state.stage < STAGE_IMAGE_LOADED || !state.enableTab}
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
                                        onBlur={actions.onInputBlur}
                                        disabled={state.stage < STAGE_IMAGE_LOADED || !state.enableTab}
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
