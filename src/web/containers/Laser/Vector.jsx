import React, { Component } from 'react';
import PropTypes from 'prop-types';
import styles from './index.styl';

// stage
const STAGE_IMAGE_LOADED = 1;
const STAGE_PREVIEWD = 2;

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
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'mm/minute'}</span>
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
                                        step={1}
                                        onChange={actions.onChangeJogSpeed}
                                        disabled={state.stage < STAGE_PREVIEWD}
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

export default Vector;
