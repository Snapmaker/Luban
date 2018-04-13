import React from 'react';
import Select from 'react-select';
import PropTypes from 'prop-types';
import { BOUND_SIZE, STAGE_IMAGE_LOADED } from '../../constants';
import { InputWithValidation as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import styles from './index.styl';


const Vector = (props) => {
    const { state, actions } = { ...props };

    return (
        <div>
            <h6><b>Carving Path</b></h6>
            <table className={styles.paramTable}>
                <tbody>
                    <tr>
                        <td>Carve Path</td>
                        <td>
                            <TipTrigger
                                title="Carve Path"
                                content={(
                                    <div>
                                        <p>Select a carve path:</p>
                                        <ul>
                                            <li><b>Outline</b>: Carve along the contour of the image.</li>
                                            <li><b>On the Path</b>: Carve along the shape of the image.</li>
                                        </ul>
                                    </div>
                                )}
                            >
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
                            </TipTrigger>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Resolution
                        </td>
                        <td>
                            <TipTrigger title="Resolution" content="The detected resolution of the loaded image.">
                                <Input
                                    style={{ width: '45%' }}
                                    value={state.originWidth}
                                    disabled="disabled"
                                />
                                <span style={{ width: '10%', textAlign: 'center', display: 'inline-block' }}>X</span>
                                <Input
                                    style={{ width: '45%' }}
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
                            <TipTrigger
                                title="Size"
                                content="Enter the size of the engraved picture. The size cannot be larger than 125 x 125 mm or the size of your material."
                            >
                                <Input
                                    style={{ width: '45%' }}
                                    value={state.sizeWidth}
                                    min={1}
                                    max={BOUND_SIZE}
                                    onChange={actions.onChangeWidth}
                                    disabled={state.stage < STAGE_IMAGE_LOADED}
                                />
                                <span style={{ width: '10%', textAlign: 'center', display: 'inline-block' }}>X</span>
                                <Input
                                    style={{ width: '45%' }}
                                    value={state.sizeHeight}
                                    min={1}
                                    max={BOUND_SIZE}
                                    onChange={actions.onChangeHeight}
                                    disabled={state.stage < STAGE_IMAGE_LOADED}
                                />
                            </TipTrigger>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Target Depth
                        </td>
                        <td>
                            <TipTrigger title="Target Depth" content="Enter the depth of the carved image. The depth cannot be deeper than the flute length.">
                                <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                    <Input
                                        value={state.targetDepth}
                                        min={0.01}
                                        max={BOUND_SIZE}
                                        step={0.1}
                                        onChange={actions.onChangeTargetDepth}
                                        disabled={state.stage < STAGE_IMAGE_LOADED}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'mm'}</span>
                                </div>
                            </TipTrigger>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Step Down
                        </td>
                        <td>
                            <TipTrigger title="Step Down" content="Enter the depth of each carving step.">
                                <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                    <Input
                                        value={state.stepDown}
                                        min={0.01}
                                        max={state.targetDepth}
                                        step={0.1}
                                        onChange={actions.onChangeStepDown}
                                        disabled={state.stage < STAGE_IMAGE_LOADED}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'mm'}</span>
                                </div>
                            </TipTrigger>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Safety Height
                        </td>
                        <td>
                            <TipTrigger title="Safety Height" content="The distance between the tool and the material when it’s not carving.">
                                <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                    <Input
                                        value={state.safetyHeight}
                                        min={0.1}
                                        max={BOUND_SIZE}
                                        step={1}
                                        onChange={actions.onChangeSafetyHeight}
                                        disabled={state.stage < STAGE_IMAGE_LOADED}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'mm'}</span>
                                </div>
                            </TipTrigger>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Stop Height
                        </td>
                        <td>
                            <TipTrigger title="Stop Height" content="The distance between the tool and the material when the machine stops.">
                                <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                    <Input
                                        value={state.stopHeight}
                                        min={0.1}
                                        max={BOUND_SIZE}
                                        step={1}
                                        onChange={actions.onChangeStopHeight}
                                        disabled={state.stage < STAGE_IMAGE_LOADED}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'mm'}</span>
                                </div>
                            </TipTrigger>
                        </td>
                    </tr>
                    <tr>
                        <td />
                        <td>
                            <TipTrigger title="Clip" content="Moves the image to align to the X-axis and Y-axis automatically.">
                                <input type="checkbox" defaultChecked={state.clip} onChange={actions.onToggleClip} /> <span>Clip</span>
                            </TipTrigger>
                        </td>
                    </tr>
                    <tr>
                        <td />
                        <td>
                            <TipTrigger title="Tab" content="Tabs help to hold the part when cutting the stock along the contour.">
                                <input type="checkbox" defaultChecked={state.enableTab} onChange={actions.onToggleEnableTab} /> <span>Tabs</span>
                            </TipTrigger>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Tab Height
                        </td>
                        <td>
                            <TipTrigger title="Tab Height" content="Enter the height of the tabs.">
                                <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                    <Input
                                        value={state.tabHeight}
                                        min={-state.targetDepth}
                                        max={0}
                                        step={0.5}
                                        onChange={actions.onTabHeight}
                                        disabled={state.stage < STAGE_IMAGE_LOADED || !state.enableTab}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'mm'}</span>
                                </div>
                            </TipTrigger>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Tab Space
                        </td>
                        <td>
                            <TipTrigger title="Tab Space" content="Enter the space between any two tabs.">
                                <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                    <Input
                                        value={state.tabSpace}
                                        min={1}
                                        step={1}
                                        onChange={actions.onTabSpace}
                                        disabled={state.stage < STAGE_IMAGE_LOADED || !state.enableTab}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'mm'}</span>
                                </div>
                            </TipTrigger>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Tab Width
                        </td>
                        <td>
                            <TipTrigger title="Tab Width" content="Enter the width of the tabs.">
                                <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                    <Input
                                        value={state.tabWidth}
                                        min={1}
                                        step={1}
                                        onChange={actions.onTabWidth}
                                        disabled={state.stage < STAGE_IMAGE_LOADED || !state.enableTab}
                                    />
                                    <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>{'mm'}</span>
                                </div>
                            </TipTrigger>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

Vector.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};

export default Vector;
